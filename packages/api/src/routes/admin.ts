/**
 * Rutas de administración — solo moderadores y admins.
 * GET  /pending-matches   — Matches pendientes de revisión humana (confidence=medium)
 * GET  /stats             — Estadísticas detalladas por estado
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';

async function requireModerator(req: Parameters<typeof requireAuth>[0], reply: Parameters<typeof requireAuth>[1]) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  const { sub } = req.user as { sub: string };
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (user?.role !== 'moderator' && user?.role !== 'admin') {
    reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Solo moderadores pueden acceder' } });
  }
}

export async function adminRoutes(app: FastifyInstance) {

  // ── GET /pending-matches — Cola de revisión humana ────────────────────────
  app.get('/pending-matches', { preHandler: requireModerator }, async (req) => {
    const { page, limit } = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }).parse(req.query);

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: {
          status:          'pending',
          confidenceLevel: 'medium',
        },
        include: {
          lostCase: {
            include: {
              dog: { select: { name: true, breed: true, color: true, size: true, photos: true } },
              owner: { select: { name: true, email: true } },
            },
          },
          sighting: {
            select: {
              photos:      true,
              locationCity: true,
              seenAt:      true,
              dogStatus:   true,
              description: true,
              reporter:    { select: { name: true } },
            },
          },
        },
        orderBy: { totalScore: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.match.count({
        where: { status: 'pending', confidenceLevel: 'medium' },
      }),
    ]);

    return { success: true, data: matches, meta: { total, page, limit } };
  });

  // ── GET /stats — Estadísticas detalladas ─────────────────────────────────
  app.get('/stats', { preHandler: requireModerator }, async () => {
    const [
      totalUsers, totalCases, activeCases, foundCases,
      totalSightings, totalMatches,
      pendingMedium, pendingHigh, confirmedMatches, rejectedMatches,
      totalReunions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.lostCase.count(),
      prisma.lostCase.count({ where: { status: 'active' } }),
      prisma.lostCase.count({ where: { status: 'found'  } }),
      prisma.sighting.count(),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'pending', confidenceLevel: 'medium' } }),
      prisma.match.count({ where: { status: 'pending', confidenceLevel: 'high'   } }),
      prisma.match.count({ where: { status: 'confirmed' } }),
      prisma.match.count({ where: { status: 'rejected'  } }),
      prisma.reunionStory.count({ where: { published: true } }),
    ]);

    return {
      success: true,
      data: {
        users:     { total: totalUsers },
        cases:     { total: totalCases, active: activeCases, found: foundCases },
        sightings: { total: totalSightings },
        matches:   { total: totalMatches, pendingMedium, pendingHigh, confirmed: confirmedMatches, rejected: rejectedMatches },
        reunions:  { total: totalReunions },
      },
    };
  });
}
