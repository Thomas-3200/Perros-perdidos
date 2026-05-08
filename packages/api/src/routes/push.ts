/**
 * Rutas de Web Push Notifications.
 *
 * GET    /vapid-public-key  — devuelve la VAPID public key (la usa el frontend al suscribirse)
 * POST   /subscribe         — registra una suscripción del navegador del usuario
 * DELETE /subscribe         — elimina una suscripción (al desactivar notificaciones)
 * POST   /test              — manda una notificación de prueba al usuario actual
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';
import { sendPushToUser } from '@perros/ai';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
  userAgent: z.string().optional(),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function pushRoutes(app: FastifyInstance) {

  // ── GET /vapid-public-key ──────────────────────────────────────────────────
  app.get('/vapid-public-key', async () => {
    return {
      success: true,
      data: { publicKey: process.env.VAPID_PUBLIC_KEY ?? null },
    };
  });

  // ── POST /subscribe ────────────────────────────────────────────────────────
  app.post('/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string };
    const body = SubscribeSchema.parse(req.body);

    // Upsert por endpoint (cada navegador genera un endpoint único)
    const existing = await (prisma as any).pushSubscription.findUnique({
      where: { endpoint: body.endpoint },
    }) as { id: string; userId: string } | null;

    if (existing) {
      // Si la sub existe pero pertenece a otro user (ej: cambió de cuenta), actualizamos
      await (prisma as any).pushSubscription.update({
        where: { endpoint: body.endpoint },
        data: {
          userId,
          p256dh:    body.keys.p256dh,
          auth:      body.keys.auth,
          userAgent: body.userAgent,
        },
      });
    } else {
      await (prisma as any).pushSubscription.create({
        data: {
          userId,
          endpoint:  body.endpoint,
          p256dh:    body.keys.p256dh,
          auth:      body.keys.auth,
          userAgent: body.userAgent,
        },
      });
    }

    return reply.code(201).send({ success: true });
  });

  // ── DELETE /subscribe ──────────────────────────────────────────────────────
  app.delete('/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string };
    const body = UnsubscribeSchema.parse(req.body);

    await (prisma as any).pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId },
    });

    return reply.send({ success: true });
  });

  // ── GET /status ────────────────────────────────────────────────────────────
  // Devuelve cuántas subscripciones tiene el usuario actual
  app.get('/status', { preHandler: requireAuth }, async (req) => {
    const { sub: userId } = req.user as { sub: string };
    const count = await (prisma as any).pushSubscription.count({
      where: { userId },
    }) as number;
    return { success: true, data: { subscribed: count > 0, count } };
  });

  // ── POST /test ─────────────────────────────────────────────────────────────
  app.post('/test', { preHandler: requireAuth }, async (req) => {
    const { sub: userId } = req.user as { sub: string };
    const delivered = await sendPushToUser(userId, {
      title: '🐾 Notificaciones activadas',
      body:  'Te avisaremos al instante si alguien ve a tu perro.',
      url:   '/perfil',
      tag:   'test',
    });
    return { success: true, data: { delivered } };
  });
}
