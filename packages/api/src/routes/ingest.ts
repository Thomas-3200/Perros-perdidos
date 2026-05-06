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
  app.post('/social', { preHandler: requireAuth, config: { rawBody: false } }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    // Puede venir como JSON (text) o multipart (screenshot/photo)
    const contentType = req.headers['content-type'] ?? '';

    let sourceType: 'link' | 'screenshot' | 'photo' | 'text';
    let rawInput: string;

    if (contentType.includes('multipart')) {
      // Caso de imagen/screenshot
      const fields: Record<string, string> = {};
      let uploadedUrl = '';

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const result = await uploadFile(part, 'sightings');
          uploadedUrl = result.url;
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      if (!uploadedUrl) {
        return reply.code(400).send({ success: false, message: 'No se recibió ninguna imagen.' });
      }

      sourceType = (fields.sourceType as 'screenshot' | 'photo') ?? 'photo';
      rawInput   = uploadedUrl;
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
