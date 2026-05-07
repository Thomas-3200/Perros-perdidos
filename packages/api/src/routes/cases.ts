/**
 * Rutas de casos de perros perdidos
 * POST   /             — Crear caso
 * GET    /             — Listar casos activos (con filtro geo opcional)
 * GET    /:id          — Detalle de un caso
 * PATCH  /:id/status   — Actualizar estado (found, closed)
 * POST   /:id/dog      — Crear/actualizar datos del perro del caso
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';
import { uploadFile }  from '../lib/upload.js';
import { haversineKm } from '@perros/shared';

const CreateDogSchema = z.object({
  name:        z.string(),
  breed:       z.string().optional(),
  color:       z.array(z.string()),
  size:        z.enum(['small', 'medium', 'large', 'extra_large']),
  sex:         z.enum(['male', 'female', 'unknown']).default('unknown'),
  age:         z.number().optional(),
  neutered:    z.boolean().optional(),
  microchipId: z.string().optional(),
  description: z.string().optional(),
});

const CreateCaseSchema = z.object({
  dog: CreateDogSchema,
  lastSeenLat:     z.number(),
  lastSeenLng:     z.number(),
  lastSeenAddress: z.string().optional(),
  lastSeenCity:    z.string().optional(),
  lastSeenCountry: z.string().optional(),
  lastSeenAt:      z.string().datetime(),
  reward:          z.number().optional(),
  rewardCurrency:  z.string().default('ARS'),
  behaviorNotes:   z.string().optional(),
  contactMethod:   z.enum(['phone', 'whatsapp', 'email', 'in_app']),
  contactValue:    z.string(),
  searchRadiusKm:  z.number().default(50),
});

export async function casesRoutes(app: FastifyInstance) {

  // ── POST / — Crear caso perdido ───────────────────────────────────────────
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateCaseSchema.parse(req.body);

    // Crear perro + caso en transacción
    const result = await prisma.$transaction(async (tx) => {
      const dog = await tx.dog.create({
        data: {
          ...body.dog,
          ownerId: sub,
          photos: [],
        },
      });

      const lostCase = await tx.lostCase.create({
        data: {
          dogId:           dog.id,
          ownerId:         sub,
          lastSeenLat:     body.lastSeenLat,
          lastSeenLng:     body.lastSeenLng,
          lastSeenAddress: body.lastSeenAddress,
          lastSeenCity:    body.lastSeenCity,
          lastSeenCountry: body.lastSeenCountry,
          lastSeenAt:      new Date(body.lastSeenAt),
          reward:          body.reward,
          rewardCurrency:  body.rewardCurrency,
          behaviorNotes:   body.behaviorNotes,
          contactMethod:   body.contactMethod,
          contactValue:    body.contactValue,
          searchRadiusKm:  body.searchRadiusKm,
        },
        include: { dog: true },
      });

      return lostCase;
    });

    // Notificar a helpers — en background, no bloquear la respuesta
    setImmediate(() => {
      const city = body.lastSeenCity;
      if (!city) return;
      prisma.user.findMany({
        where: {
          helperMode: true,
          alertCity: { equals: city, mode: 'insensitive' },
          id: { not: sub },
        },
        select: { id: true },
      }).then(helpers => {
        if (helpers.length === 0) return;
        return prisma.notification.createMany({
          data: helpers.map(h => ({
            userId:  h.id,
            type:    'helper_alert' as const,
            title:   '🐾 Nuevo caso en tu zona',
            body:    `Reportaron un perro perdido en ${city}. ¿Podés ayudar?`,
            data:    { caseId: result.id },
          })),
          skipDuplicates: true,
        });
      }).catch(err => {
        console.error('[cases] Error notificando helpers:', err);
      });
    });

    return reply.code(201).send({ success: true, data: result });
  });

  // ── POST /:id/photos — Subir fotos del perro ──────────────────────────────
  app.post('/:id/photos', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const lostCase = await prisma.lostCase.findFirst({
      where: { id, ownerId: sub },
      include: { dog: true },
    });
    if (!lostCase) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } });

    const parts = req.files();
    const uploadedUrls: string[] = [];

    for await (const part of parts) {
      const result = await uploadFile(part, 'dogs');
      uploadedUrls.push(result.url);
    }

    // Actualizar fotos del perro
    const updatedDog = await prisma.dog.update({
      where: { id: lostCase.dogId },
      data: { photos: { push: uploadedUrls } },
    });

    return { success: true, data: { photos: updatedDog.photos } };
  });

  // ── GET / — Listar casos activos ──────────────────────────────────────────
  app.get('/', async (req) => {
    const query = z.object({
      lat:      z.coerce.number().optional(),
      lng:      z.coerce.number().optional(),
      radiusKm: z.coerce.number().default(50),
      page:     z.coerce.number().default(1),
      limit:    z.coerce.number().default(20),
      city:     z.string().optional(),
    }).parse(req.query);

    const cases = await prisma.lostCase.findMany({
      where: {
        status: 'active',
        ...(query.city && { lastSeenCity: { contains: query.city, mode: 'insensitive' } }),
      },
      include: {
        dog: { select: { name: true, breed: true, color: true, size: true, photos: true } },
        owner: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (query.page - 1) * query.limit,
      take:  query.limit,
    });

    // Filtro geográfico en memoria si se dan coordenadas
    const filtered = (query.lat && query.lng)
      ? cases.filter(c =>
          haversineKm(query.lat!, query.lng!, c.lastSeenLat, c.lastSeenLng) <= query.radiusKm
        )
      : cases;

    const total = await prisma.lostCase.count({ where: { status: 'active' } });
    return { success: true, data: filtered, meta: { total, page: query.page, limit: query.limit } };
  });

  // ── GET /mine — Mis casos (autenticado) ──────────────────────────────────
  app.get('/mine', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };
    const query = z.object({
      status: z.enum(['active', 'found', 'closed', 'all']).default('all'),
      limit:  z.coerce.number().default(20),
    }).parse(req.query);

    const cases = await prisma.lostCase.findMany({
      where: {
        ownerId: sub,
        ...(query.status !== 'all' && { status: query.status }),
      },
      take: query.limit,
      include: {
        dog: { select: { name: true, breed: true, color: true, size: true, photos: true } },
        _count: { select: { matches: { where: { status: { in: ['pending', 'confirmed'] } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: cases };
  });

  // ── GET /:id — Detalle de un caso ─────────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lostCase = await prisma.lostCase.findUnique({
      where: { id },
      include: {
        dog: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        matches: {
          where: {
            status:          { in: ['pending', 'confirmed'] },
            confidenceLevel: { in: ['high', 'medium'] },
          },
          include: {
            sighting: {
              select: {
                photos:       true,
                locationLat:  true,
                locationLng:  true,
                locationCity: true,
                seenAt:       true,
                dogStatus:    true,
                description:  true,
                reporter:     { select: { name: true } },
              },
            },
          },
          orderBy: { totalScore: 'desc' },
          take: 10,
        },
      },
    });
    if (!lostCase) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } });
    return { success: true, data: lostCase };
  });

  // ── PATCH /:id — Editar datos del caso y el perro ──────────────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const body = z.object({
      // Datos del perro
      dogName:        z.string().min(1).optional(),
      dogBreed:       z.string().optional(),
      dogColor:       z.array(z.string()).optional(),
      dogSize:        z.enum(['small', 'medium', 'large', 'extra_large']).optional(),
      dogSex:         z.enum(['male', 'female', 'unknown']).optional(),
      dogAge:         z.number().optional(),
      dogDescription: z.string().optional(),
      // Datos del caso
      lastSeenAddress: z.string().optional(),
      lastSeenCity:    z.string().optional(),
      lastSeenCountry: z.string().optional(),
      lastSeenAt:      z.string().datetime().optional(),
      reward:          z.number().optional().nullable(),
      behaviorNotes:   z.string().optional(),
      contactMethod:   z.enum(['phone', 'whatsapp', 'email', 'in_app']).optional(),
      contactValue:    z.string().optional(),
    }).parse(req.body);

    // Verificar que el caso pertenece al usuario
    const lostCase = await prisma.lostCase.findFirst({
      where: { id, ownerId: sub },
      include: { dog: true },
    });
    if (!lostCase) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caso no encontrado' },
      });
    }

    // Actualizar perro si hay cambios
    const dogUpdates = {
      ...(body.dogName        !== undefined && { name:        body.dogName }),
      ...(body.dogBreed       !== undefined && { breed:       body.dogBreed }),
      ...(body.dogColor       !== undefined && { color:       body.dogColor }),
      ...(body.dogSize        !== undefined && { size:        body.dogSize }),
      ...(body.dogSex         !== undefined && { sex:         body.dogSex }),
      ...(body.dogAge         !== undefined && { age:         body.dogAge }),
      ...(body.dogDescription !== undefined && { description: body.dogDescription }),
    };
    if (Object.keys(dogUpdates).length > 0) {
      await prisma.dog.update({ where: { id: lostCase.dogId }, data: dogUpdates });
    }

    // Actualizar caso si hay cambios
    const caseUpdates = {
      ...(body.lastSeenAddress !== undefined && { lastSeenAddress: body.lastSeenAddress }),
      ...(body.lastSeenCity    !== undefined && { lastSeenCity:    body.lastSeenCity }),
      ...(body.lastSeenCountry !== undefined && { lastSeenCountry: body.lastSeenCountry }),
      ...(body.lastSeenAt      !== undefined && { lastSeenAt:      new Date(body.lastSeenAt) }),
      ...(body.reward          !== undefined && { reward:          body.reward }),
      ...(body.behaviorNotes   !== undefined && { behaviorNotes:   body.behaviorNotes }),
      ...(body.contactMethod   !== undefined && { contactMethod:   body.contactMethod }),
      ...(body.contactValue    !== undefined && { contactValue:    body.contactValue }),
    };
    const updated = await prisma.lostCase.update({
      where: { id },
      data:  caseUpdates,
      include: {
        dog: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return { success: true, data: updated };
  });

  // ── DELETE /:id — Eliminar caso (solo el dueño) ──────────────────────────
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const existing = await prisma.lostCase.findFirst({ where: { id, ownerId: sub } });
    if (!existing) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado o no tenés permiso' } });

    // Eliminar en cascada respetando foreign keys:
    // Match → SupportSession → ReunionStory → Notification → LostCase → Dog
    await prisma.match.deleteMany({ where: { lostCaseId: id } });
    await prisma.supportSession.deleteMany({ where: { lostCaseId: id } });
    await prisma.reunionStory.deleteMany({ where: { lostCaseId: id } });
    await prisma.notification.deleteMany({ where: { lostCaseId: id } });
    await prisma.lostCase.delete({ where: { id } });
    await prisma.dog.deleteMany({ where: { id: existing.dogId } });

    return { success: true, message: 'Caso eliminado correctamente' };
  });

  // ── PATCH /:id/status — Actualizar estado del caso ────────────────────────
  app.patch('/:id/status', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };
    const { status } = z.object({
      status: z.enum(['found', 'closed']),
    }).parse(req.body);

    const existing = await prisma.lostCase.findFirst({ where: { id, ownerId: sub } });
    if (!existing) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } });

    const updated = await prisma.lostCase.update({
      where: { id },
      data: { status, closedAt: new Date() },
    });

    return { success: true, data: updated };
  });
}
