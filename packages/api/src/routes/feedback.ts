/**
 * Rutas de feedback de usuarios
 *
 * GET  /          — Listar sugerencias (ordenadas por votos)
 * POST /          — Crear sugerencia (auth opcional)
 * POST /:id/vote  — Votar a favor (auth requerida, un voto por usuario)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';

export async function feedbackRoutes(app: FastifyInstance) {

  // ── GET / — Listar feedback ───────────────────────────────────────────────
  app.get('/', async (req) => {
    const query = z.object({
      type:  z.enum(['add', 'remove', 'all']).default('all'),
      limit: z.coerce.number().default(50),
    }).parse(req.query);

    const items = await (prisma as any).feedback.findMany({
      where: {
        ...(query.type !== 'all' && { type: query.type }),
        status: { in: ['open', 'reviewing', 'done'] },
      },
      select: {
        id: true, type: true, title: true, description: true,
        votes: true, status: true, createdAt: true,
        user: { select: { name: true } },
        voterIds: true,
      },
      orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
    }) as Array<{
      id: string; type: string; title: string; description?: string;
      votes: number; status: string; createdAt: Date;
      user?: { name: string }; voterIds: string[];
    }>;

    return { success: true, data: items };
  });

  // ── POST / — Crear sugerencia ─────────────────────────────────────────────
  app.post('/', async (req, reply) => {
    // Auth opcional: leer token si viene, pero no fallar si no
    let userId: string | undefined;
    try {
      await req.jwtVerify();
      userId = (req.user as { sub: string }).sub;
    } catch {
      // usuario anónimo — válido
    }

    const body = z.object({
      type:        z.enum(['add', 'remove']),
      title:       z.string().min(3).max(120),
      description: z.string().max(500).optional(),
    }).parse(req.body);

    const item = await (prisma as any).feedback.create({
      data: {
        type:        body.type,
        title:       body.title,
        description: body.description,
        ...(userId && { userId }),
      },
      select: {
        id: true, type: true, title: true, description: true,
        votes: true, status: true, createdAt: true,
      },
    });

    return reply.code(201).send({ success: true, data: item });
  });

  // ── POST /:id/vote — Votar ─────────────────────────────────────────────────
  app.post('/:id/vote', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const existing = await (prisma as any).feedback.findUnique({
      where: { id },
      select: { id: true, votes: true, voterIds: true },
    }) as { id: string; votes: number; voterIds: string[] } | null;

    if (!existing) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sugerencia no encontrada' } });
    }

    // Si ya votó, quitar el voto (toggle)
    const alreadyVoted = existing.voterIds.includes(sub);
    const updated = await (prisma as any).feedback.update({
      where: { id },
      data: {
        votes:    alreadyVoted ? existing.votes - 1 : existing.votes + 1,
        voterIds: alreadyVoted
          ? existing.voterIds.filter((v: string) => v !== sub)
          : [...existing.voterIds, sub],
      },
      select: { id: true, votes: true, voterIds: true },
    }) as { id: string; votes: number; voterIds: string[] };

    return {
      success: true,
      data: { id: updated.id, votes: updated.votes, voted: !alreadyVoted },
    };
  });
}
