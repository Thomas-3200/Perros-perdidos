/**
 * Rutas de apoyo emocional — chat con IA empática
 * POST /sessions          — Iniciar sesión de apoyo
 * POST /sessions/:id/chat — Enviar mensaje a la sesión
 * GET  /sessions/:id      — Ver historial de sesión
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }     from '../lib/auth.js';
import { emotionalSupport } from '@perros/ai';

const AI_AVAILABLE = Boolean(process.env.ANTHROPIC_API_KEY);

const DISABLED_RESPONSE = {
  success: false,
  error: { code: 'FEATURE_DISABLED', message: 'El asistente de apoyo no está disponible en este momento.' },
} as const;

export async function supportRoutes(app: FastifyInstance) {

  // ── GET /status — Disponibilidad del módulo ───────────────────────────────
  app.get('/status', async (_req, reply) => {
    return reply.send({ success: true, data: { available: AI_AVAILABLE } });
  });

  // ── POST /sessions — Iniciar sesión de apoyo ──────────────────────────────
  app.post('/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { caseId } = z.object({ caseId: z.string() }).parse(req.body);

    // Verificar que el caso existe y pertenece al usuario
    const lostCase = await prisma.lostCase.findFirst({
      where: { id: caseId, ownerId: sub },
      include: { dog: true },
    });
    if (!lostCase) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } });

    // Crear o retomar sesión
    const existing = await prisma.supportSession.findFirst({
      where: { userId: sub, lostCaseId: caseId },
      orderBy: { startedAt: 'desc' },
    });

    if (existing) return { success: true, data: existing };

    const session = await prisma.supportSession.create({
      data: {
        userId:     sub,
        lostCaseId: caseId,
        messages:   [],
      },
    });

    return reply.code(201).send({ success: true, data: session });
  });

  // ── POST /sessions/:id/chat — Enviar mensaje ──────────────────────────────
  app.post('/sessions/:id/chat', { preHandler: requireAuth }, async (req, reply) => {
    if (!AI_AVAILABLE) return reply.code(503).send(DISABLED_RESPONSE);

    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };
    const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

    const session = await prisma.supportSession.findFirst({
      where: { id, userId: sub },
      include: {
        lostCase: {
          include: { dog: true },
        },
      },
    });
    if (!session) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesión no encontrada' } });

    const history = session.messages as Array<{ role: string; content: string; timestamp: string }>;

    // Llamar a IA empática
    const aiReply = await emotionalSupport({
      userMessage: message,
      dogName:     session.lostCase.dog.name,
      daysMissing: Math.floor((Date.now() - session.lostCase.lastSeenAt.getTime()) / 86_400_000),
      conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const now = new Date().toISOString();
    const updatedMessages = [
      ...history,
      { role: 'user',      content: message,  timestamp: now },
      { role: 'assistant', content: aiReply,  timestamp: now },
    ];

    const updated = await prisma.supportSession.update({
      where: { id },
      data: { messages: updatedMessages },
    });

    return { success: true, data: { reply: aiReply, session: updated } };
  });

  // ── GET /sessions/:id — Ver historial ─────────────────────────────────────
  app.get('/sessions/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const session = await prisma.supportSession.findFirst({ where: { id, userId: sub } });
    if (!session) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sesión no encontrada' } });

    return { success: true, data: session };
  });
}
