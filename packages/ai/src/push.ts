/**
 * Web Push Notifications helper.
 *
 * Usa VAPID (Voluntary Application Server Identification) para autenticar
 * con los push services del navegador (FCM/Mozilla/Apple).
 *
 * Requiere las env vars:
 *   VAPID_PUBLIC_KEY  — clave pública (también usada por el frontend)
 *   VAPID_PRIVATE_KEY — clave privada (solo el backend)
 *   VAPID_SUBJECT     — mailto: del owner del proyecto
 */
import webpush from 'web-push';
import prisma from '@perros/db';

const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:noreply@perros-perdidos.app';

let _configured = false;
function configure(): boolean {
  if (_configured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  _configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;          // URL a abrir cuando se hace click en la notificación
  icon?: string;          // Icon del navegador
  badge?: string;         // Badge en mobile
  image?: string;         // Imagen grande (foto del perro)
  tag?:   string;         // Para no apilar duplicados
}

/**
 * Envía una push notification a TODOS los dispositivos registrados de un usuario.
 * Si una subscription falla con 410 Gone, se elimina automáticamente.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) {
    console.log('[push] VAPID keys no configuradas, skipping push');
    return 0;
  }

  const subs = await (prisma as any).pushSubscription.findMany({
    where: { userId },
  }) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;

  if (subs.length === 0) return 0;

  let delivered = 0;
  const stalePromises: Promise<unknown>[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 24 * 60 * 60 }, // 1 día
      );
      delivered++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number }).statusCode;
      // 410 Gone o 404 = subscription expirada → eliminar
      if (code === 410 || code === 404) {
        stalePromises.push(
          (prisma as any).pushSubscription.delete({ where: { id: sub.id } })
            .catch(() => null),
        );
        console.log(`[push] Subscription expirada eliminada: ${sub.id}`);
      } else {
        console.warn(`[push] Error enviando a ${sub.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  await Promise.all(stalePromises);
  console.log(`[push] Entregadas ${delivered}/${subs.length} a user ${userId}`);
  return delivered;
}
