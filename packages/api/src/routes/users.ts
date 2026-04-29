/**
 * Rutas de usuarios — registro, login, perfil
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';

const RegisterSchema = z.object({
  email:    z.string().email(),
  name:     z.string().min(2),
  phone:    z.string().optional(),
  role:     z.enum(['owner', 'helper', 'finder']).default('owner'),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationCity: z.string().optional(),
  locationCountry: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  // En producción: usar Supabase Auth o Clerk para JWT real
  // Aquí simplificamos con email lookup para el MVP local
});

export async function usersRoutes(app: FastifyInstance) {

  // POST /api/v1/users/register
  app.post('/register', async (req, reply) => {
    const data = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: { code: 'USER_EXISTS', message: 'El email ya está registrado' },
      });
    }

    const user = await prisma.user.create({ data });
    const token = app.jwt.sign({ sub: user.id, role: user.role });

    return reply.code(201).send({ success: true, data: { user, token } });
  });

  // POST /api/v1/users/login (simplificado — producción usa Supabase/Clerk)
  app.post('/login', async (req, reply) => {
    const { email } = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' },
      });
    }
    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return { success: true, data: { user, token } };
  });

  // GET /api/v1/users/me
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: sub } });
    return { success: true, data: user };
  });

  // PATCH /api/v1/users/me
  app.patch('/me', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const updates = z.object({
      name:            z.string().min(2).optional(),
      phone:           z.string().optional(),
      locationLat:     z.number().optional(),
      locationLng:     z.number().optional(),
      locationCity:    z.string().optional(),
      locationCountry: z.string().optional(),
    }).parse(req.body);

    const user = await prisma.user.update({ where: { id: sub }, data: updates });
    return { success: true, data: user };
  });
}
