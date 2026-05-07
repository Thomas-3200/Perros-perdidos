/**
 * Email helper — Resend API
 *
 * Free tier: 3000 emails/mes con el dominio onboarding@resend.dev
 * Para usar dominio propio: configurar DNS y verificar en https://resend.com/domains
 */
import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Perros Perdidos <onboarding@resend.dev>';
const WEB_URL    = process.env.WEB_URL ?? 'https://perros-perdidos-web.vercel.app';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

interface MatchEmailParams {
  to:           string;
  ownerName:    string;
  dogName:      string;
  matchScore:   number; // 0-1
  sightingCity: string | null;
  sightingDate: Date;
  sightingPhotoUrl?: string;
  caseId:       string;
}

/**
 * Envía un email al dueño cuando se detecta un match HIGH.
 * Devuelve true si el envío fue exitoso, false si falló o no hay API key.
 */
export async function sendMatchEmail(p: MatchEmailParams): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log('[email] RESEND_API_KEY no configurada, skipping email');
    return false;
  }

  const scorePct = Math.round(p.matchScore * 100);
  const caseUrl  = `${WEB_URL}/casos/${p.caseId}`;
  const fechaStr = p.sightingDate.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  try {
    const result = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [p.to],
      subject: `🐾 Posible avistamiento de ${p.dogName} (${scorePct}% de coincidencia)`,
      html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Posible avistamiento de ${p.dogName}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#fff7ed; color:#1f2937;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px; line-height: 1;">🐾</div>
      <h1 style="font-size: 22px; font-weight: 700; color: #c2410c; margin: 12px 0 4px;">
        Posible avistamiento de ${escapeHtml(p.dogName)}
      </h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">Hola ${escapeHtml(p.ownerName)},</p>
    </div>

    <!-- Card -->
    <div style="background: white; border: 2px solid #fed7aa; border-radius: 16px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">

      <p style="font-size: 16px; line-height: 1.5; color: #1f2937; margin: 0 0 16px;">
        Encontramos un avistamiento que coincide en un
        <strong style="color: #f97316; font-size: 20px;">${scorePct}%</strong>
        con la información que cargaste.
      </p>

      ${p.sightingPhotoUrl ? `
        <div style="text-align: center; margin: 16px 0;">
          <img src="${p.sightingPhotoUrl}" alt="Avistamiento" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #f3f4f6;" />
        </div>
      ` : ''}

      <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
        ${p.sightingCity ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 90px;">📍 Ubicación</td>
            <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${escapeHtml(p.sightingCity)}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">🕐 Visto</td>
          <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${fechaStr}</td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="${caseUrl}"
           style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 16px;">
          Ver el avistamiento →
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 16px 0 0; line-height: 1.5;">
        Si reconocés a ${escapeHtml(p.dogName)} en la foto, contactá al reportero desde la app
        usando el botón de WhatsApp en el detalle del avistamiento.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #fed7aa;">
      <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0;">
        Recibiste este email porque tenés una búsqueda activa en
        <a href="${WEB_URL}" style="color: #c2410c; text-decoration: none;">Perros Perdidos</a>.<br />
        La IA cruzó este avistamiento automáticamente — verificalo antes de actuar.
      </p>
    </div>

  </div>
</body>
</html>
      `.trim(),
    });

    if (result.error) {
      console.warn('[email] Resend error:', result.error);
      return false;
    }

    console.log(`[email] Match email enviado a ${p.to} (id: ${result.data?.id})`);
    return true;
  } catch (err) {
    console.warn('[email] Falla enviando email:', err instanceof Error ? err.message : err);
    return false;
  }
}

// Escape básico de HTML para evitar inyección desde nombres con caracteres raros
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
