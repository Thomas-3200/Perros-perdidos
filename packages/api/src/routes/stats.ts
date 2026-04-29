import type { FastifyInstance } from 'fastify';
import prisma from '@perros/db';

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const [totalCases, activeCases, totalSightings, totalMatches, reunions] =
      await Promise.all([
        prisma.lostCase.count(),
        prisma.lostCase.count({ where: { status: 'active' } }),
        prisma.sighting.count(),
        prisma.match.count({ where: { status: { in: ['pending', 'confirmed'] } } }),
        prisma.reunionStory.count({ where: { published: true } }),
      ]);

    return {
      success: true,
      data: {
        totalCases,
        activeCases,
        totalSightings,
        totalMatches,
        reunions,
      },
    };
  });
}
