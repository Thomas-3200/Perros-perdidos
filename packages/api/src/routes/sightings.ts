/**
 * Rutas de avistamientos
 * POST / — Reportar avistamiento (con foto)
 * GET  / — Listar avistamientos recientes cercanos
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }    from '../lib/auth.js';
import { uploadFile }     from '../lib/upload.js';
import { enqueueMatching } from '../lib/queue.js';

const CreateSightingSchema = z.object({
  locationLat:     z.coerce.number(),
  locationLng:     z.coerce.number(),
  locationAddress: z.string().optional(),
  locationCity:    z.string().optional(),
  seenAt:          z.string().datetime(),
  dogStatus:       z.enum(['still_there', 'gone', 'retained', 'injured', 'unknown']).default('unknown'),
  description:     z.string().optional(),
});

export async function sightingsRoutes(app: FastifyInstance) {

  // ── POST / — Crear avistamiento ───────────────────────────────────────────
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    // Parsear campos del form + archivos
    const fields: Record<string, string> = {};
    const photoBuffers: Parameters<typeof uploadFile>[0][] = [];

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        photoBuffers.push(part);
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const body = CreateSightingSchema.parse({
      ...fields,
      seenAt: fields.seenAt ?? new Date().toISOString(),
    });

    // Subir fotos
    const photoUrls: string[] = [];
    for (const file of photoBuffers) {
      const result = await uploadFile(file, 'sightings');
      photoUrls.push(result.url);
    }

    const sighting = await prisma.sighting.create({
      data: {
        reporterId:      sub,
        locationLat:     body.locationLat,
        locationLng:     body.locationLng,
        locationAddress: body.locationAddress,
        locationCity:    body.locationCity,
        seenAt:          new Date(body.seenAt),
        dogStatus:       body.dogStatus,
        description:     body.description,
        source:          'app',
        photos:          photoUrls,
      },
    });

    // Encolar job de matching (siempre — el engine básico funciona sin fotos)
    await enqueueMatching(sighting.id);

    return reply.code(201).send({ success: true, data: sighting });
  });

  // ── GET / — Listar avistamientos recientes ────────────────────────────────
  app.get('/', async (req) => {
    const query = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
      city:  z.string().optional(),
    }).parse(req.query);

    const sightings = await prisma.sighting.findMany({
      where: query.city
        ? { locationCity: { contains: query.city, mode: 'insensitive' } }
        : {},
      include: {
        reporter: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (query.page - 1) * query.limit,
      take:  query.limit,
    });

    return { success: true, data: sightings };
  });

  // ── GET /:id — Detalle de avistamiento ────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sighting = await prisma.sighting.findUnique({
      where: { id },
      include: {
        reporter: { select: { name: true, avatarUrl: true } },
        matches: {
          include: {
            lostCase: {
              include: { dog: { select: { name: true, photos: true, breed: true } } },
            },
          },
          orderBy: { totalScore: 'desc' },
        },
      },
    });
    if (!sighting) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Avistamiento no encontrado' } });
    return { success: true, data: sighting };
  });
}
