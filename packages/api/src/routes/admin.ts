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

  // ── DELETE /sightings — Borra avistamientos por IDs (secret) ────────────────
  app.delete('/sightings', async (req, reply) => {
    const { secret, ids } = req.body as { secret?: string; ids?: string[] };
    if (secret !== (process.env.SEED_SECRET ?? 'perros-seed-2026')) {
      return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN' } });
    }
    if (!ids?.length) return reply.code(400).send({ success: false, error: { code: 'NO_IDS' } });
    // Borrar matches asociados primero para evitar FK violation
    await prisma.match.deleteMany({ where: { sightingId: { in: ids } } });
    const { count } = await prisma.sighting.deleteMany({ where: { id: { in: ids } } });
    return { success: true, deleted: count };
  });

  // ── POST /seed-demo — Crea casos de éxito demo (one-time, secret) ──────────
  app.post('/seed-demo', async (req, reply) => {
    const { secret } = req.body as { secret?: string };
    if (secret !== (process.env.SEED_SECRET ?? 'perros-seed-2026')) {
      return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Secret inválido' } });
    }

    const valentina = await prisma.user.upsert({
      where:  { email: 'valentina.demo@perros.app' },
      update: {},
      create: { email: 'valentina.demo@perros.app', name: 'Valentina Gómez', phone: '+5491155550001', locationCity: 'Palermo, Buenos Aires', locationLat: -34.5885, locationLng: -58.4348 },
    });

    const martin = await prisma.user.upsert({
      where:  { email: 'martin.demo@perros.app' },
      update: {},
      create: { email: 'martin.demo@perros.app', name: 'Martín Herrera', phone: '+5491155550002', locationCity: 'Villa Urquiza, Buenos Aires', locationLat: -34.5697, locationLng: -58.4879 },
    });

    const mia = await prisma.dog.upsert({
      where:  { id: 'demo-dog-mia-001' },
      update: {},
      create: {
        id: 'demo-dog-mia-001', ownerId: valentina.id, name: 'Mia', breed: 'Golden Retriever',
        color: ['dorado', 'crema'], size: 'large', sex: 'female', age: 3, neutered: true,
        description: 'Muy sociable. Collar rojo con placa dorada.',
        photos: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80'],
      },
    });

    const miaCase = await prisma.lostCase.upsert({
      where:  { id: 'demo-case-mia-001' },
      update: {},
      create: {
        id: 'demo-case-mia-001', dogId: mia.id, ownerId: valentina.id, status: 'found',
        lastSeenLat: -34.5875, lastSeenLng: -58.4348,
        lastSeenAddress: 'Av. Santa Fe y Scalabrini Ortiz', lastSeenCity: 'Palermo, Buenos Aires', lastSeenCountry: 'Argentina',
        lastSeenAt: new Date(Date.now() - 12 * 86_400_000),
        contactMethod: 'whatsapp', contactValue: '+5491155550001',
        closedAt: new Date(Date.now() - 7 * 86_400_000),
      },
    });

    await prisma.reunionStory.upsert({
      where:  { lostCaseId: miaCase.id },
      update: {},
      create: {
        lostCaseId: miaCase.id, ownerId: valentina.id,
        photos: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80'],
        storyText: 'Mia se escapó cuando una tormenta asustó a toda la cuadra. Cinco días de angustia. Gracias a esta plataforma, una vecina la vio y reportó el avistamiento. Nos reencontramos en menos de una hora. ¡Gracias a toda la comunidad!',
        aiGeneratedStory: `Durante cinco largos días, Valentina recorrió cada rincón de Palermo buscando a Mia, su Golden Retriever de 3 años. Todo comenzó una noche de tormenta: los truenos asustaron a Mia y salió disparada por la puerta entreabierta.\n\nValentina publicó el caso en la plataforma y en pocas horas la comunidad se movilizó. Fue una vecina de la calle Malabia quien la vio tranquila en un jardín cercano y reportó la ubicación exacta.\n\nEn menos de una hora, Mia y Valentina se reencontraron. "No puedo creer lo rápido que la encontramos con la ayuda de todos", dijo entre lágrimas.\n\nHoy Mia duerme tranquila en su lugar favorito del sillón, como si nada hubiera pasado. 🐾❤️`,
        published: true, publishedAt: new Date(Date.now() - 7 * 86_400_000),
      },
    });

    const bruno = await prisma.dog.upsert({
      where:  { id: 'demo-dog-bruno-001' },
      update: {},
      create: {
        id: 'demo-dog-bruno-001', ownerId: martin.id, name: 'Bruno', breed: 'Labrador Retriever',
        color: ['negro'], size: 'large', sex: 'male', age: 5,
        description: 'Tranquilo y obediente. Mancha blanca en el pecho.',
        photos: ['https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=800&q=80'],
      },
    });

    const brunoCase = await prisma.lostCase.upsert({
      where:  { id: 'demo-case-bruno-001' },
      update: {},
      create: {
        id: 'demo-case-bruno-001', dogId: bruno.id, ownerId: martin.id, status: 'found',
        lastSeenLat: -34.5711, lastSeenLng: -58.4905,
        lastSeenAddress: 'Triunvirato y Olazábal', lastSeenCity: 'Villa Urquiza, Buenos Aires', lastSeenCountry: 'Argentina',
        lastSeenAt: new Date(Date.now() - 20 * 86_400_000),
        contactMethod: 'phone', contactValue: '+5491155550002',
        reward: 15000, rewardCurrency: 'ARS',
        closedAt: new Date(Date.now() - 14 * 86_400_000),
      },
    });

    await prisma.reunionStory.upsert({
      where:  { lostCaseId: brunoCase.id },
      update: {},
      create: {
        lostCaseId: brunoCase.id, ownerId: martin.id,
        photos: ['https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=800&q=80'],
        storyText: 'Bruno se perdió cuando salimos a correr y se soltó la correa. Seis días buscándolo. Un chico que usa esta app lo vio en una plaza y lo reportó. A la hora ya estábamos juntos de nuevo. La plataforma fue clave.',
        aiGeneratedStory: `Martín y Bruno salían a correr juntos cada mañana por Villa Urquiza. Pero un martes, la correa cedió y Bruno desapareció entre el tráfico de Triunvirato.\n\nSeis días de búsqueda intensa: carteles en cada árbol, posts en redes sociales y el caso publicado en la plataforma. La comunidad respondió de inmediato.\n\nFue un estudiante quien lo vio descansando en la plaza Gelly, a diez cuadras de casa. Reportó el avistamiento con foto y ubicación exacta. Martín llegó corriendo en minutos.\n\nBruno lo recibió con ese salto de Labrador que vuela a la altura del pecho. "Seis días que me parecieron seis años. Sin la comunidad, no sé qué hubiera pasado."\n\nHoy Bruno sigue saliendo a correr, pero con correa doble. 🖤🐾`,
        published: true, publishedAt: new Date(Date.now() - 14 * 86_400_000),
      },
    });

    return { success: true, message: 'Demo seed completado: 2 historias de reunificación creadas.' };
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
