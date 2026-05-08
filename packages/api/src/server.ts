/**
 * @perros/api — Servidor Fastify principal
 */
import Fastify from 'fastify';
import cors       from '@fastify/cors';
import helmet     from '@fastify/helmet';
import jwt        from '@fastify/jwt';
import rateLimit  from '@fastify/rate-limit';
import multipart  from '@fastify/multipart';
import fs         from 'node:fs';
import path       from 'node:path';

import { casesRoutes }         from './routes/cases.js';
import { sightingsRoutes }     from './routes/sightings.js';
import { matchesRoutes }       from './routes/matches.js';
import { usersRoutes }         from './routes/users.js';
import { ingestRoutes }        from './routes/ingest.js';
import { supportRoutes }       from './routes/support.js';
import { reunionRoutes }       from './routes/reunion.js';
import { statsRoutes }         from './routes/stats.js';
import { adminRoutes }         from './routes/admin.js';
import { notificationsRoutes } from './routes/notifications.js';
import { feedbackRoutes }       from './routes/feedback.js';
import { pushRoutes }           from './routes/push.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

export const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

async function bootstrap() {
  // ── Seguridad ──────────────────────────────────────────────────────────────
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin:      process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  // ── Auth JWT ───────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret:  process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    sign:    { expiresIn: '7d' },
  });

  // ── Multipart (upload de imágenes) ─────────────────────────────────────────
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  // ── Archivos locales (fallback cuando no hay Cloudinary) ───────────────────
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const MIME: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', heic: 'image/heic',
  };

  app.get('/uploads/*', async (req, reply) => {
    const rel      = (req.params as { '*': string })['*'];
    const filePath = path.join(uploadsDir, rel);
    if (!fs.existsSync(filePath)) return reply.code(404).send('Not found');
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream');
    reply.header('Cache-Control', 'public, max-age=31536000');
    return reply.send(fs.createReadStream(filePath));
  });

  // ── Healthcheck ────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status:    'ok',
    service:   'perros-perdidos-api',
    timestamp: new Date().toISOString(),
    workers:   'running',
  }));

  // ── Rutas ──────────────────────────────────────────────────────────────────
  await app.register(usersRoutes,     { prefix: '/api/v1/users' });
  await app.register(casesRoutes,     { prefix: '/api/v1/cases' });
  await app.register(sightingsRoutes, { prefix: '/api/v1/sightings' });
  await app.register(matchesRoutes,   { prefix: '/api/v1/matches' });
  await app.register(ingestRoutes,    { prefix: '/api/v1/ingest' });
  await app.register(supportRoutes,   { prefix: '/api/v1/support' });
  await app.register(reunionRoutes,   { prefix: '/api/v1/reunion' });
  await app.register(statsRoutes,     { prefix: '/api/v1/stats' });
  await app.register(adminRoutes,         { prefix: '/api/v1/admin' });
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
  await app.register(feedbackRoutes,       { prefix: '/api/v1/feedback' });
  await app.register(pushRoutes,           { prefix: '/api/v1/push' });

  // ── Arrancar servidor ──────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`🐾 API corriendo en http://${HOST}:${PORT}`);

  // ── Iniciar workers BullMQ (en el mismo proceso, suficiente para MVP) ──────
  // Se importan aquí para que solo arranquen después de que el servidor esté listo.
  await import('./workers.js');
  app.log.info('⚙️  Workers BullMQ iniciados');
}

bootstrap().catch((err) => {
  console.error('❌ Error al arrancar el servidor:', err);
  process.exit(1);
});
