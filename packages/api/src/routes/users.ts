/**
 * Rutas de usuarios — registro, login, perfil, OAuth Facebook
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';

const FB_APP_ID     = process.env.FACEBOOK_APP_ID     ?? '';
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? '';
const API_BASE_URL  = process.env.API_BASE_URL ?? 'http://localhost:3001';
const WEB_URL       = process.env.CORS_ORIGIN  ?? 'http://localhost:3000';

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

  // ── GET /api/v1/users/auth/facebook — Iniciar OAuth con Facebook ─────────────
  app.get('/auth/facebook', async (_req, reply) => {
    if (!FB_APP_ID) {
      return reply.code(503).send({ success: false, error: { message: 'Facebook Login no configurado' } });
    }
    const redirectUri = encodeURIComponent(`${API_BASE_URL}/api/v1/users/auth/facebook/callback`);
    const scope = encodeURIComponent('email,public_profile');
    const fbUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    return reply.redirect(fbUrl);
  });

  // ── GET /api/v1/users/auth/facebook/callback — Callback OAuth ────────────────
  app.get('/auth/facebook/callback', async (req, reply) => {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error || !code) {
      return reply.redirect(`${WEB_URL}/login?error=facebook_denied`);
    }

    try {
      // 1. Canjear code por access_token
      const redirectUri = encodeURIComponent(`${API_BASE_URL}/api/v1/users/auth/facebook/callback`);
      const tokenRes = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&redirect_uri=${redirectUri}&code=${code}`
      );
      const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };
      if (!tokenData.access_token) throw new Error(tokenData.error?.message ?? 'Sin access_token');

      // 2. Obtener perfil del usuario
      const profileRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
      );
      const profile = await profileRes.json() as {
        id: string; name: string; email?: string;
        picture?: { data: { url: string } };
      };

      if (!profile.id) throw new Error('No se pudo obtener el perfil de Facebook');

      // 3. Buscar o crear usuario
      const email = profile.email ?? `fb_${profile.id}@perros-perdidos.app`;
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name:      profile.name,
            avatarUrl: profile.picture?.data?.url,
            role:      'owner',
          },
        });
      } else if (profile.picture?.data?.url && !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.picture.data.url, name: profile.name },
        });
      }

      // 4. Generar JWT propio y redirigir al frontend
      const token = app.jwt.sign({ sub: user.id, role: user.role });
      return reply.redirect(`${WEB_URL}/auth/callback?token=${token}`);

    } catch (err) {
      console.error('[auth/facebook] Error:', err);
      return reply.redirect(`${WEB_URL}/login?error=facebook_error`);
    }
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
