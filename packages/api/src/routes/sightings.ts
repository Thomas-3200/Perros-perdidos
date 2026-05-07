/**
 * Rutas de avistamientos
 * POST / — Reportar avistamiento (con foto)
 * GET  / — Listar avistamientos recientes cercanos
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth, optionalAuth } from '../lib/auth.js';
import { uploadFile }     from '../lib/upload.js';
import { processSighting } from '@perros/ai';

const CreateSightingSchema = z.object({
  locationLat:     z.coerce.number(),
  locationLng:     z.coerce.number(),
  locationAddress: z.string().optional(),
  locationCity:    z.string().optional(),
  seenAt:          z.string().datetime(),
  dogStatus:       z.enum(['still_there', 'gone', 'retained', 'injured', 'unknown']).default('unknown'),
  description:     z.string().optional(),
  anonymousContact: z.string().optional(), // WhatsApp/teléfono si reporta sin login
});

// ─── Usuario "anónimo" del sistema (lazy init) ──────────────────────────────
const ANON_EMAIL = 'anonymous@perros-perdidos.app';
let _anonId: string | null = null;
async function getAnonymousUserId(): Promise<string> {
  if (_anonId) return _anonId;
  const existing = await prisma.user.findUnique({ where: { email: ANON_EMAIL }, select: { id: true } });
  if (existing) { _anonId = existing.id; return _anonId; }
  const created = await prisma.user.create({
    data: { email: ANON_EMAIL, name: 'Anónimo', role: 'helper' },
    select: { id: true },
  });
  _anonId = created.id;
  return _anonId;
}

// ─── Rate limiting anónimo en memoria (MVP) ─────────────────────────────────
// Map<key, { count, resetAt }>. Para producción real usar Redis con TTL.
const anonHits = new Map<string, { count: number; resetAt: number }>();

async function getAnonymousCountThisHour(key: string): Promise<number> {
  const now = Date.now();
  const rec = anonHits.get(key);
  if (!rec || rec.resetAt < now) return 0;
  return rec.count;
}

function incrementAnonymousCount(key: string): void {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const rec = anonHits.get(key);
  if (!rec || rec.resetAt < now) {
    anonHits.set(key, { count: 1, resetAt: now + HOUR });
  } else {
    rec.count += 1;
  }

  // Cleanup periódico para evitar leak (cada 1000 hits)
  if (anonHits.size > 5000) {
    for (const [k, v] of anonHits.entries()) {
      if (v.resetAt < now) anonHits.delete(k);
    }
  }
}

export async function sightingsRoutes(app: FastifyInstance) {

  // ── POST / — Crear avistamiento (auth opcional — permite anónimos) ────────
  // Rate limit por IP: 5/hora para anónimos, 30/hora para logueados
  app.post('/', {
    preHandler: optionalAuth,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 hour',
        keyGenerator: (req) => {
          const userId = (req.user as { sub?: string } | undefined)?.sub;
          // Si está logueado, contar por user; si no, por IP
          return userId ?? `anon:${req.ip}`;
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    const isAnonymous = !userId;

    // Parsear campos del form + archivos
    const fields: Record<string, string> = {};
    const photoBuffers: Parameters<typeof uploadFile>[0][] = [];

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        // Validación: solo imágenes y máximo 5 fotos por avistamiento
        const mimetype = part.mimetype ?? '';
        if (!mimetype.startsWith('image/')) {
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_FILE_TYPE', message: 'Solo se permiten archivos de imagen' },
          });
        }
        if (photoBuffers.length >= 5) {
          return reply.code(400).send({
            success: false,
            error: { code: 'TOO_MANY_PHOTOS', message: 'Máximo 5 fotos por avistamiento' },
          });
        }
        photoBuffers.push(part);
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    // Honeypot anti-bot: si el campo "website" viene lleno, es un bot
    if (fields.website?.trim()) {
      app.log.warn({ ip: req.ip }, '[sightings] Honeypot triggered, possible bot');
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID', message: 'Solicitud inválida' },
      });
    }

    // Anónimos: límite extra de 5/hora (más estricto que el 30 general)
    if (isAnonymous) {
      const anonKey = `anon:${req.ip}`;
      const anonCount = await getAnonymousCountThisHour(anonKey);
      if (anonCount >= 5) {
        return reply.code(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Demasiados avistamientos en la última hora. Intentá más tarde o creá una cuenta.',
          },
        });
      }
      incrementAnonymousCount(anonKey);
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

    // Si es anónimo, prepender el contacto al description
    let finalDescription = body.description ?? '';
    if (isAnonymous && body.anonymousContact?.trim()) {
      const contact = body.anonymousContact.trim();
      finalDescription = `📱 Contacto del que vio: ${contact}` + (finalDescription ? `\n\n${finalDescription}` : '');
    }

    const reporterId = userId ?? await getAnonymousUserId();

    const sighting = await prisma.sighting.create({
      data: {
        reporterId,
        locationLat:     body.locationLat,
        locationLng:     body.locationLng,
        locationAddress: body.locationAddress,
        locationCity:    body.locationCity,
        seenAt:          new Date(body.seenAt),
        dogStatus:       body.dogStatus,
        description:     finalDescription || undefined,
        source:          'app',
        photos:          photoUrls,
      },
    });

    // Procesar matching en background (sin Redis — directo en el proceso)
    setImmediate(() => {
      processSighting(sighting.id).catch((err) => {
        console.error('[sightings] Error en matching:', err);
      });
    });

    // Si está logueado y no tiene teléfono, recordarle agregarlo
    if (userId) {
      const reporter = await prisma.user.findUnique({
        where:  { id: userId },
        select: { phone: true },
      });
      if (!reporter?.phone) {
        await prisma.notification.create({
          data: {
            userId,
            type:   'case_update',
            title:  '📱 Agregá tu teléfono al perfil',
            body:   'Así otros usuarios pueden contactarte por WhatsApp cuando ven tu avistamiento.',
            data:   { path: '/perfil' },
          },
        });
      }
    }

    return reply.code(201).send({ success: true, data: sighting });
  });

  // ── GET / — Listar avistamientos recientes ────────────────────────────────
  app.get('/', async (req) => {
    const query = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(30),
      city:  z.string().optional(),
      since: z.string().optional(), // ISO date — filtrar por createdAt >= since
    }).parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.city)  where.locationCity = { contains: query.city, mode: 'insensitive' };
    if (query.since) where.createdAt    = { gte: new Date(query.since) };

    const [sightings, total] = await Promise.all([
      prisma.sighting.findMany({
        where,
        include: {
          reporter: { select: { name: true, avatarUrl: true, phone: true } },
          _count:   { select: { matches: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip:  (query.page - 1) * query.limit,
        take:  query.limit,
      }),
      prisma.sighting.count({ where }),
    ]);

    // Aplanar _count para el cliente
    const data = sightings.map(s => ({
      ...s,
      matchCount: s._count.matches,
      _count: undefined,
    }));

    return {
      success: true,
      data,
      meta: { total, page: query.page, limit: query.limit },
    };
  });

  // ── GET /mine — Mis avistamientos ─────────────────────────────────────────
  // IMPORTANTE: registrar /mine ANTES de /:id para evitar conflictos de routing
  app.get('/mine', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };
    const query = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }).parse(req.query);

    const [sightings, total] = await Promise.all([
      prisma.sighting.findMany({
        where: { reporterId: sub },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.sighting.count({ where: { reporterId: sub } }),
    ]);

    return { success: true, data: sightings, meta: { total, page: query.page, limit: query.limit } };
  });

  // ── GET /:id — Detalle de avistamiento ────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sighting = await prisma.sighting.findUnique({
      where: { id },
      include: {
        reporter: { select: { name: true, avatarUrl: true, phone: true } },
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

  // ── PATCH /:id — Editar avistamiento (solo el autor) ────────────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const body = z.object({
      dogStatus:       z.enum(['still_there', 'gone', 'retained', 'injured', 'unknown']).optional(),
      description:     z.string().optional(),
      locationCity:    z.string().optional(),
      locationAddress: z.string().optional(),
    }).parse(req.body);

    const sighting = await prisma.sighting.findFirst({ where: { id, reporterId: sub } });
    if (!sighting) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Avistamiento no encontrado o no tenés permiso' } });

    const updated = await prisma.sighting.update({
      where: { id },
      data: {
        ...(body.dogStatus       !== undefined && { dogStatus:       body.dogStatus }),
        ...(body.description     !== undefined && { description:     body.description }),
        ...(body.locationCity    !== undefined && { locationCity:    body.locationCity }),
        ...(body.locationAddress !== undefined && { locationAddress: body.locationAddress }),
      },
    });

    return { success: true, data: updated };
  });

  // ── DELETE /:id — Eliminar avistamiento (solo el autor) ───────────────────
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const sighting = await prisma.sighting.findFirst({ where: { id, reporterId: sub } });
    if (!sighting) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Avistamiento no encontrado o no tenés permiso' } });

    // Eliminar matches relacionados primero
    await prisma.match.deleteMany({ where: { sightingId: id } });
    await prisma.sighting.delete({ where: { id } });

    return { success: true, message: 'Avistamiento eliminado' };
  });
}
