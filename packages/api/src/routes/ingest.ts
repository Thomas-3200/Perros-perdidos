/**
 * Rutas de ingesta Human API
 * POST /social — Enviar link / screenshot / texto de redes sociales
 * GET  /       — Ver casos pendientes de procesar
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }       from '../lib/auth.js';
import { uploadFile }        from '../lib/upload.js';
import { parseImportedCase } from '@perros/ai';

const CreateImportSchema = z.object({
  sourceType: z.enum(['link', 'screenshot', 'photo', 'text']),
  rawInput:   z.string().min(1),
});

const AI_TIMEOUT_MS = 60_000; // 60 segundos para que Claude procese la imagen

export async function ingestRoutes(app: FastifyInstance) {

  // ── POST /social — Enviar caso desde red social ───────────────────────────
  // Rate limit por IP (el keyGenerator corre antes del preHandler de auth,
  // así que req.user todavía no está disponible). El control por usuario
  // se hace con la query de count() de abajo.
  app.post('/social', {
    preHandler: requireAuth,
    config: {
      rawBody: false,
      rateLimit: {
        max: 30,                  // 30 imports por hora por IP
        timeWindow: '1 hour',
      },
    },
  }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    // Admins y moderadores NO tienen NINGÚN límite — son los que siembran
    // casos para mantener viva la plataforma. Confiamos en su criterio para
    // el control de costos.
    const me = await prisma.user.findUnique({
      where:  { id: sub },
      select: { role: true },
    });
    const isStaff = me?.role === 'admin' || me?.role === 'moderator';

    if (!isStaff) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Tope por usuario por DÍA: 15 imports/usuario/día para usuarios normales
      // (subido de 5 para no frenar a entusiastas legítimos)
      const userTodayCount = await prisma.importedSocialCase.count({
        where: { submittedById: sub, createdAt: { gte: today } },
      });
      if (userTodayCount >= 15) {
        return reply.code(429).send({
          success: false,
          error: {
            code: 'USER_DAILY_QUOTA',
            message: 'Alcanzaste el límite de 15 importaciones diarias. Volvé mañana.',
          },
        });
      }

      // Tope global por DÍA: 200 imports/día en toda la app entre usuarios no-staff
      // (a ~$0.005 USD/imagen = ~$30 USD/mes en el peor caso).
      const todayCount = await prisma.importedSocialCase.count({
        where: {
          createdAt: { gte: today },
          submittedBy: { role: { notIn: ['admin', 'moderator'] } },
        },
      });
      if (todayCount >= 200) {
        return reply.code(429).send({
          success: false,
          error: {
            code: 'DAILY_QUOTA_REACHED',
            message: 'Alcanzamos el límite diario de análisis IA. Intentá de nuevo mañana.',
          },
        });
      }
    }

    // Puede venir como JSON (text) o multipart (screenshot/photo)
    const contentType = req.headers['content-type'] ?? '';

    let sourceType: 'link' | 'screenshot' | 'photo' | 'text';
    let rawInput: string;

    if (contentType.includes('multipart')) {
      // Caso de imagen/screenshot — el usuario puede subir hasta 2 imágenes
      // (ej: una con la foto del perro y otra con la dirección o el contacto).
      // Las URLs se guardan separadas por '\n' en rawInput, y la IA las
      // procesa todas juntas en un solo mensaje a Claude.
      const fields: Record<string, string> = {};
      const uploadedUrls: string[] = [];
      const MAX_IMAGES = 2;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          if (uploadedUrls.length >= MAX_IMAGES) {
            // Drenar el stream del archivo extra para evitar timeouts
            await part.toBuffer().catch(() => undefined);
            continue;
          }
          const result = await uploadFile(part, 'sightings');
          uploadedUrls.push(result.url);
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      if (uploadedUrls.length === 0) {
        return reply.code(400).send({ success: false, message: 'No se recibió ninguna imagen.' });
      }

      sourceType = (fields.sourceType as 'screenshot' | 'photo') ?? 'photo';
      rawInput   = uploadedUrls.join('\n');
    } else {
      // JSON con texto
      const body = CreateImportSchema.parse(req.body);
      sourceType = body.sourceType as 'link' | 'text';
      rawInput   = body.rawInput;
    }

    // Crear el registro en DB
    const imported = await prisma.importedSocialCase.create({
      data: {
        submittedById: sub,
        sourceType,
        rawInput,
        status: 'pending',
      },
    });

    // ── Procesar con IA de forma sincrónica con timeout de 60s ──────────────
    // Esto garantiza que si la IA funciona, el avistamiento se crea antes de
    // que el frontend muestre el éxito. Errores son visibles en los logs.
    let aiProcessed = false;
    let aiError: string | null = null;

    try {
      await Promise.race([
        parseImportedCase(imported.id),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout: excedido 60s')), AI_TIMEOUT_MS)
        ),
      ]);
      aiProcessed = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ingest] Error en AI processing:', msg);
      aiError = msg;
      // Marcar como rechazado si no fue marcado ya por parseImportedCase
      try {
        const current = await prisma.importedSocialCase.findUnique({ where: { id: imported.id } });
        if (current?.status === 'pending') {
          await prisma.importedSocialCase.update({
            where: { id: imported.id },
            data:  { status: 'rejected' },
          });
        }
      } catch { /* ignorar */ }
    }

    // Leer el estado final del caso
    const finalCase = await prisma.importedSocialCase.findUnique({ where: { id: imported.id } });
    const status    = finalCase?.status ?? (aiProcessed ? 'processed' : 'rejected');

    return reply.code(201).send({
      success: true,
      data:    { ...imported, status },
      aiProcessed,
      aiError,
      message: status === 'processed'
        ? '✅ La IA procesó el contenido exitosamente.'
        : status === 'pending'
          ? '⏳ Caso recibido. Procesamiento en curso.'
          : '⚠️ La IA no pudo extraer datos suficientes del contenido.',
    });
  });

  // ── GET / — Ver mis importaciones ─────────────────────────────────────────
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { sub } = req.user as { sub: string };
    const query = z.object({
      status: z.enum(['pending', 'processed', 'rejected', 'all']).default('all'),
      page:   z.coerce.number().default(1),
      limit:  z.coerce.number().default(20),
    }).parse(req.query);

    const imports = await prisma.importedSocialCase.findMany({
      where: {
        submittedById: sub,
        ...(query.status !== 'all' && { status: query.status }),
      },
      orderBy: { createdAt: 'desc' },
      skip:  (query.page - 1) * query.limit,
      take:  query.limit,
    });

    return { success: true, data: imports };
  });

  // ── DELETE /:id — Eliminar importación (solo el autor) ───────────────────
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id }  = req.params as { id: string };

    const imported = await prisma.importedSocialCase.findFirst({ where: { id, submittedById: sub } });
    if (!imported) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Importación no encontrada o no tenés permiso' } });

    await prisma.importedSocialCase.delete({ where: { id } });

    return { success: true, message: 'Importación eliminada' };
  });
}
