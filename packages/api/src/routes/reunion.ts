/**
 * Rutas de reunificaciones
 * POST /            — Crear historia de reunificación
 * GET  /feed        — Feed público de reuniones exitosas
 * GET  /:id         — Historia individual
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }   from '../lib/auth.js';
import { uploadFile }    from '../lib/upload.js';
import { generateReunionStory } from '@perros/ai';

export async function reunionRoutes(app: FastifyInstance) {

  // ── POST / — Crear historia de reunificación ──────────────────────────────
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    const fields: Record<string, string> = {};
    const photoBuffers: Parameters<typeof uploadFile>[0][] = [];
    let videoFile: Parameters<typeof uploadFile>[0] | null = null;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.mimetype.startsWith('video/')) {
          videoFile = part;
        } else {
          photoBuffers.push(part);
        }
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const { caseId, storyText, publishConsent } = z.object({
      caseId:         z.string(),
      storyText:      z.string().optional(),
      publishConsent: z.string().transform(v => v === 'true').default('false'),
    }).parse(fields);

    // Verificar dueño del caso
    const lostCase = await prisma.lostCase.findFirst({
      where: { id: caseId, ownerId: sub },
      include: { dog: true },
    });
    if (!lostCase) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } });

    // Subir fotos/video
    const photoUrls: string[] = [];
    for (const file of photoBuffers) {
      const r = await uploadFile(file, 'reunions');
      photoUrls.push(r.url);
    }
    const videoUrl = videoFile ? (await uploadFile(videoFile, 'reunions')).url : undefined;

    // Generar historia con IA
    const daysMissing = Math.floor(
      (Date.now() - lostCase.lastSeenAt.getTime()) / 86_400_000,
    );
    const aiStory = await generateReunionStory({
      dogName:    lostCase.dog.name,
      breed:      lostCase.dog.breed ?? 'mestizo',
      ownerName:  sub,
      daysMissing,
      city:       lostCase.lastSeenCity ?? 'ciudad desconocida',
      storyText,
    });

    // Marcar caso como found + crear historia
    await prisma.lostCase.update({ where: { id: caseId }, data: { status: 'found', closedAt: new Date() } });

    const story = await prisma.reunionStory.create({
      data: {
        lostCaseId:       caseId,
        ownerId:          sub,
        photos:           photoUrls,
        videoUrl,
        storyText,
        aiGeneratedStory: aiStory,
        published:        publishConsent,
        publishedAt:      publishConsent ? new Date() : undefined,
      },
    });

    return reply.code(201).send({ success: true, data: story });
  });

  // ── GET /feed — Feed público de reuniones ─────────────────────────────────
  app.get('/feed', async (req) => {
    const { page, limit } = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
    }).parse(req.query);

    const stories = await prisma.reunionStory.findMany({
      where: { published: true },
      include: {
        lostCase: {
          include: {
            dog: { select: { name: true, breed: true, photos: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    const total = await prisma.reunionStory.count({ where: { published: true } });
    return { success: true, data: stories, meta: { total, page, limit } };
  });

  // ── GET /:id — Historia individual ────────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.reunionStory.findUnique({
      where: { id },
      include: {
        lostCase: {
          include: { dog: true },
        },
      },
    });
    if (!story) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Historia no encontrada' } });
    return { success: true, data: story };
  });
}
