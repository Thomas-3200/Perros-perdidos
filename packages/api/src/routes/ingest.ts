/**
 * Rutas de ingesta Human API
 * POST /social — Enviar link / screenshot / texto de redes sociales
 * GET  /       — Ver casos pendientes de procesar
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@perros/db';
import { requireAuth }     from '../lib/auth.js';
import { uploadFile }      from '../lib/upload.js';
import { parseImportedCase } from '@perros/ai';

const CreateImportSchema = z.object({
  sourceType: z.enum(['link', 'screenshot', 'photo', 'text']),
  rawInput:   z.string().min(1),
});

export async function ingestRoutes(app: FastifyInstance) {

  // ── POST /social — Enviar caso desde red social ───────────────────────────
  app.post('/social', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    // Puede venir como JSON (link/text) o multipart (screenshot/photo)
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

      sourceType = (fields.sourceType as 'screenshot' | 'photo') ?? 'photo';
      rawInput   = uploadedUrl;
    } else {
      // JSON con link o texto
      const body = CreateImportSchema.parse(req.body);
      sourceType = body.sourceType as 'link' | 'text';
      rawInput   = body.rawInput;
    }

    const imported = await prisma.importedSocialCase.create({
      data: {
        submittedById: sub,
        sourceType,
        rawInput,
        status: 'pending',
      },
    });

    // Procesar con IA en background (sin Redis — directo en el proceso)
    setImmediate(() => {
      parseImportedCase(imported.id).catch((err) => {
        console.error('[ingest] Error procesando caso con IA:', err);
      });
    });

    return reply.code(201).send({
      success: true,
      data: imported,
      message: '✅ Caso recibido. La IA lo procesará en breve.',
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
}
