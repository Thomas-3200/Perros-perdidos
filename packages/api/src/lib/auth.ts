/**
 * Helper de autenticación para Fastify.
 * Verifica el JWT y adjunta el usuario al request.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token inválido o no proporcionado' } });
  }
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    // Continúa sin usuario autenticado
  }
}
