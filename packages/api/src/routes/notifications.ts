/**
 * Rutas de notificaciones
 * GET  /mine       — Notificaciones del usuario autenticado
 * PATCH /:id/read  — Marcar una como leída
 * PATCH /read-all  — Marcar todas como leídas
 */
import type { FastifyInstance } from 'fastify';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';

export async function notificationsRoutes(app: FastifyInstance) {

  // ── GET /mine ─────────────────────────────────────────────────────────────
  app.get('/mine', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };

    const notifications = await prisma.notification.findMany({
      where:   { userId: sub },
      orderBy: { sentAt: 'desc' },
      take:    50,
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return { success: true, data: notifications, meta: { unreadCount } };
  });

  // ── PATCH /read-all — Marcar todas como leídas ────────────────────────────
  // IMPORTANTE: registrar /read-all ANTES de /:id para evitar conflictos de routing
  app.patch('/read-all', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };

    await prisma.notification.updateMany({
      where: { userId: sub, read: false },
      data:  { read: true },
    });

    return { success: true };
  });

  // ── PATCH /:id/read — Marcar una como leída ───────────────────────────────
  app.patch('/:id/read', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const notif = await prisma.notification.findFirst({ where: { id, userId: sub } });
    if (!notif) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Notificación no encontrada' } });
    }

    await prisma.notification.update({ where: { id }, data: { read: true } });

    return { success: true };
  });
}
