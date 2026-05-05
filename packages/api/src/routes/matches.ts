/**
 * Rutas de matches
 * GET  /case/:caseId    — Matches de un caso activo (rankeados por score)
 * PATCH /:id/confirm   — Dueño confirma que es su perro
 * PATCH /:id/reject    — Dueño rechaza el match
 * PATCH /:id/review    — Moderador aprueba/rechaza (MEDIUM)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }        from '../lib/auth.js';
import { enqueueNotification } from '../lib/queue.js'; // fire-and-forget — no bloquea
import { CONFIDENCE_THRESHOLDS } from '@perros/shared';

export async function matchesRoutes(app: FastifyInstance) {

  // ── GET /case/:caseId — Matches de un caso ────────────────────────────────
  app.get('/case/:caseId', { preHandler: requireAuth }, async (req, reply) => {
    const { sub }     = req.user as { sub: string };
    const { caseId }  = req.params as { caseId: string };

    // Solo el dueño o un moderador puede ver los matches
    const lostCase = await prisma.lostCase.findFirst({
      where: { id: caseId, ownerId: sub },
    });
    if (!lostCase) {
      const user = await prisma.user.findUnique({ where: { id: sub } });
      if (user?.role !== 'moderator' && user?.role !== 'admin') {
        return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'No tienes acceso a este caso' } });
      }
    }

    const matches = await prisma.match.findMany({
      where: { lostCaseId: caseId },
      include: {
        sighting: {
          select: {
            id: true,
            photos: true,
            locationLat: true,
            locationLng: true,
            locationCity: true,
            seenAt: true,
            dogStatus: true,
            description: true,
            reporter: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    return { success: true, data: matches };
  });

  // ── PATCH /:id/confirm — Dueño confirma match ─────────────────────────────
  app.patch('/:id/confirm', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const match = await prisma.match.findUnique({
      where: { id },
      include: { lostCase: true },
    });

    if (!match) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Match no encontrado' } });
    if (match.lostCase.ownerId !== sub) return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Solo el dueño puede confirmar' } });

    const updated = await prisma.match.update({
      where: { id },
      data: { status: 'confirmed', ownerConfirmedAt: new Date() },
    });

    return { success: true, data: updated };
  });

  // ── PATCH /:id/reject — Dueño rechaza match ───────────────────────────────
  app.patch('/:id/reject', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const match = await prisma.match.findUnique({
      where: { id },
      include: { lostCase: true },
    });
    if (!match) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Match no encontrado' } });
    if (match.lostCase.ownerId !== sub) return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Solo el dueño puede rechazar' } });

    const updated = await prisma.match.update({
      where: { id },
      data: { status: 'rejected' },
    });

    return { success: true, data: updated };
  });

  // ── PATCH /:id/review — Moderador revisa match MEDIUM ────────────────────
  app.patch('/:id/review', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    // Verificar que es moderador o admin
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (user?.role !== 'moderator' && user?.role !== 'admin') {
      return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Solo moderadores pueden revisar matches' } });
    }

    const { decision } = z.object({
      decision: z.enum(['approve', 'reject']),
    }).parse(req.body);

    const match = await prisma.match.findUnique({
      where: { id },
      include: { lostCase: true },
    });
    if (!match) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Match no encontrado' } });

    const newStatus = decision === 'approve' ? 'pending' : 'rejected';
    const updated = await prisma.match.update({
      where: { id },
      data: { status: newStatus, reviewedById: sub, reviewedAt: new Date() },
    });

    // Si aprobado → notificar al dueño (fire-and-forget, no bloquea la respuesta)
    if (decision === 'approve') {
      enqueueNotification({
        userId: match.lostCase.ownerId,
        type: 'match_medium',
        title: '🐾 Posible avistamiento de tu perro',
        body: `Un moderador verificó un posible avistamiento. Score: ${Math.round(match.totalScore * 100)}%`,
        data: { matchId: match.id, caseId: match.lostCaseId },
      }).catch((err) => console.warn('[matches] Error al notificar:', err));
    }

    return { success: true, data: updated };
  });
}
