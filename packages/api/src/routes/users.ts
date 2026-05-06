/**
 * Rutas de usuarios — registro, login, OAuth (Google + Facebook), editar perfil, avatar
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import prisma from '@perros/db';
import { requireAuth } from '../lib/auth.js';
import { uploadFile }  from '../lib/upload.js';

// ── Config OAuth ────────────────────────────────────────────────────────────────
const FB_APP_ID       = process.env.FACEBOOK_APP_ID     ?? '';
const FB_APP_SECRET   = process.env.FACEBOOK_APP_SECRET ?? '';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const API_BASE_URL    = process.env.API_BASE_URL ?? 'http://localhost:3001';
const WEB_URL         = process.env.CORS_ORIGIN  ?? 'http://localhost:3000';

// ── Store de códigos OAuth de un solo uso ────────────────────────────────────
// Evita exponer el JWT en la URL. Cada code tiene un TTL de 60 segundos y se
// elimina inmediatamente tras ser canjeado (one-time use).
const pendingOAuthCodes = new Map<string, { token: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [code, val] of pendingOAuthCodes) {
    if (val.expiresAt < now) pendingOAuthCodes.delete(code);
  }
}, 60_000);

// ── Helpers de contraseña (Node.js crypto nativo, sin dependencias) ─────────────
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    const inputHash = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(hash, 'hex'), inputHash);
  } catch {
    return false;
  }
}

// ── Schemas ─────────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  email:           z.string().email(),
  name:            z.string().min(2),
  password:        z.string().min(6).optional(),
  phone:           z.string().optional(),
  role:            z.enum(['owner', 'helper', 'finder']).default('owner'),
  locationLat:     z.number().optional(),
  locationLng:     z.number().optional(),
  locationCity:    z.string().optional(),
  locationCountry: z.string().optional(),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().optional(),
});

// ── Rutas ───────────────────────────────────────────────────────────────────────
export async function usersRoutes(app: FastifyInstance) {

  // ── POST /register — Crear cuenta con email + contraseña opcional ────────────
  app.post('/register', async (req, reply) => {
    const data = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: { code: 'USER_EXISTS', message: 'El email ya está registrado' },
      });
    }

    const user = await prisma.user.create({
      data: {
        email:        data.email,
        name:         data.name,
        phone:        data.phone,
        role:         data.role,
        locationLat:  data.locationLat,
        locationLng:  data.locationLng,
        locationCity: data.locationCity,
        passwordHash: data.password ? hashPassword(data.password) : undefined,
      },
    });

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return reply.code(201).send({ success: true, data: { user, token } });
  });

  // ── POST /login — Email + contraseña ────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No encontramos una cuenta con ese email' },
      });
    }

    // Si la cuenta es exclusivamente OAuth (sin contraseña), bloquear login por email
    if (!user.passwordHash) {
      const provider = user.googleId ? 'Google' : user.facebookId ? 'Facebook' : null;
      if (provider) {
        return reply.code(401).send({
          success: false,
          error: {
            code:    'USE_OAUTH',
            message: `Esta cuenta fue creada con ${provider}. Iniciá sesión con ${provider}.`,
          },
        });
      }
      // Cuenta sin hash ni OAuth — no debería existir, pero si ocurre, bloqueamos
      return reply.code(401).send({
        success: false,
        error: { code: 'PASSWORD_REQUIRED', message: 'Esta cuenta no tiene contraseña configurada' },
      });
    }

    // Verificar contraseña
    if (!password) {
      return reply.code(401).send({
        success: false,
        error: { code: 'PASSWORD_REQUIRED', message: 'Esta cuenta requiere contraseña' },
      });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Contraseña incorrecta' },
      });
    }

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return { success: true, data: { user, token } };
  });

  // ── GET /me ─────────────────────────────────────────────────────────────────
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sub },
      select: {
        id: true, email: true, name: true, phone: true,
        avatarUrl: true, role: true, reputationScore: true,
        locationCity: true, locationCountry: true,
        createdAt: true,
        // No exponer passwordHash, googleId, facebookId
      },
    });
    return { success: true, data: user };
  });

  // ── PATCH /me — Actualizar perfil ───────────────────────────────────────────
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

    const user = await prisma.user.update({
      where: { id: sub },
      data: updates,
      select: {
        id: true, email: true, name: true, phone: true,
        avatarUrl: true, role: true, reputationScore: true,
        locationCity: true, locationCountry: true, createdAt: true,
      },
    });
    return { success: true, data: user };
  });

  // ── POST /me/avatar — Subir foto de perfil ───────────────────────────────────
  app.post('/me/avatar', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    let avatarUrl = '';
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const result = await uploadFile(part, 'avatars');
        avatarUrl = result.url;
        break;
      }
    }

    if (!avatarUrl) {
      return reply.code(400).send({ success: false, error: { message: 'No se recibió ninguna imagen' } });
    }

    const user = await prisma.user.update({
      where: { id: sub },
      data: { avatarUrl },
      select: {
        id: true, email: true, name: true, phone: true,
        avatarUrl: true, role: true, reputationScore: true,
        locationCity: true, locationCountry: true, createdAt: true,
      },
    });

    return { success: true, data: user };
  });

  // ── PATCH /me/password — Cambiar contraseña ──────────────────────────────────
  app.patch('/me/password', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().optional(),
      newPassword:     z.string().min(6),
    }).parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: sub } });

    // Si ya tiene contraseña, verificar la actual
    if (user.passwordHash && currentPassword) {
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'La contraseña actual es incorrecta' },
        });
      }
    }

    await prisma.user.update({
      where: { id: sub },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return { success: true, message: 'Contraseña actualizada correctamente' };
  });

  // ── GET /auth/exchange — Canjear código OAuth de un solo uso por JWT ────────
  // El JWT nunca viaja en la URL; el frontend lo canjea con este endpoint.
  app.get('/auth/exchange', async (req, reply) => {
    const { code } = req.query as { code?: string };

    if (!code) {
      return reply.code(400).send({
        success: false,
        error: { code: 'CODE_REQUIRED', message: 'Código requerido' },
      });
    }

    const entry = pendingOAuthCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      pendingOAuthCodes.delete(code);
      return reply.code(401).send({
        success: false,
        error: { code: 'CODE_EXPIRED', message: 'Código inválido o expirado' },
      });
    }

    // One-time use: borrar inmediatamente
    pendingOAuthCodes.delete(code);
    return { success: true, data: { token: entry.token } };
  });

  // ── GET /auth/google — Iniciar OAuth con Google ──────────────────────────────
  app.get('/auth/google', async (_req, reply) => {
    if (!GOOGLE_CLIENT_ID) {
      return reply.code(503).send({ success: false, error: { message: 'Google Login no configurado' } });
    }
    const redirectUri = encodeURIComponent(`${API_BASE_URL}/api/v1/users/auth/google/callback`);
    const scope       = encodeURIComponent('email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    return reply.redirect(url);
  });

  // ── GET /auth/google/callback — Callback OAuth Google ───────────────────────
  app.get('/auth/google/callback', async (req, reply) => {
    const { code: googleCode, error } = req.query as { code?: string; error?: string };

    if (error || !googleCode) {
      return reply.redirect(`${WEB_URL}/auth/callback?error=google_denied`);
    }

    try {
      const redirectUri = `${API_BASE_URL}/api/v1/users/auth/google/callback`;

      // 1. Canjear code por access_token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code:          googleCode,
          client_id:     GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) throw new Error(tokenData.error ?? 'Sin access_token de Google');

      // 2. Obtener perfil
      const profileRes = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`
      );
      const profile = await profileRes.json() as {
        id: string; name: string; email: string; picture?: string;
      };
      if (!profile.id || !profile.email) throw new Error('No se pudo obtener el perfil de Google');

      // 3. Buscar por googleId primero, luego por email
      let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

      if (!user) {
        // Buscar por email (puede que ya exista con email/password)
        user = await prisma.user.findUnique({ where: { email: profile.email } });
        if (user) {
          // Vincular googleId a cuenta existente
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId:  profile.id,
              avatarUrl: user.avatarUrl ?? profile.picture,
            },
          });
        } else {
          // Crear cuenta nueva
          user = await prisma.user.create({
            data: {
              email:     profile.email,
              name:      profile.name,
              avatarUrl: profile.picture,
              googleId:  profile.id,
              role:      'owner',
            },
          });
        }
      } else if (profile.picture && !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.picture },
        });
      }

      const token = app.jwt.sign({ sub: user.id, role: user.role });
      const code  = randomBytes(32).toString('hex');
      pendingOAuthCodes.set(code, { token, expiresAt: Date.now() + 60_000 });
      return reply.redirect(`${WEB_URL}/auth/callback?code=${code}`);

    } catch (err) {
      console.error('[auth/google] Error:', err);
      return reply.redirect(`${WEB_URL}/auth/callback?error=google_error`);
    }
  });

  // ── GET /auth/facebook — Iniciar OAuth con Facebook ─────────────────────────
  app.get('/auth/facebook', async (_req, reply) => {
    if (!FB_APP_ID) {
      return reply.code(503).send({ success: false, error: { message: 'Facebook Login no configurado' } });
    }
    const redirectUri = encodeURIComponent(`${API_BASE_URL}/api/v1/users/auth/facebook/callback`);
    const scope = encodeURIComponent('email,public_profile');
    const fbUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    return reply.redirect(fbUrl);
  });

  // ── GET /auth/facebook/callback — Callback OAuth Facebook ───────────────────
  app.get('/auth/facebook/callback', async (req, reply) => {
    const { code: fbCode, error } = req.query as { code?: string; error?: string };

    if (error || !fbCode) {
      return reply.redirect(`${WEB_URL}/auth/callback?error=facebook_denied`);
    }

    try {
      const redirectUri = encodeURIComponent(`${API_BASE_URL}/api/v1/users/auth/facebook/callback`);
      const tokenRes = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&redirect_uri=${redirectUri}&code=${fbCode}`
      );
      const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };
      if (!tokenData.access_token) throw new Error(tokenData.error?.message ?? 'Sin access_token');

      const profileRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
      );
      const profile = await profileRes.json() as {
        id: string; name: string; email?: string;
        picture?: { data: { url: string } };
      };
      if (!profile.id) throw new Error('No se pudo obtener el perfil de Facebook');

      // Buscar por facebookId primero
      let user = await prisma.user.findUnique({ where: { facebookId: profile.id } });

      if (!user) {
        const email = profile.email ?? `fb_${profile.id}@perros-perdidos.app`;
        user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              facebookId: profile.id,
              avatarUrl:  user.avatarUrl ?? profile.picture?.data?.url,
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              email,
              name:       profile.name,
              avatarUrl:  profile.picture?.data?.url,
              facebookId: profile.id,
              role:       'owner',
            },
          });
        }
      } else if (profile.picture?.data?.url && !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.picture.data.url },
        });
      }

      const token = app.jwt.sign({ sub: user.id, role: user.role });
      const code  = randomBytes(32).toString('hex');
      pendingOAuthCodes.set(code, { token, expiresAt: Date.now() + 60_000 });
      return reply.redirect(`${WEB_URL}/auth/callback?code=${code}`);

    } catch (err) {
      console.error('[auth/facebook] Error:', err);
      return reply.redirect(`${WEB_URL}/auth/callback?error=facebook_error`);
    }
  });
}
