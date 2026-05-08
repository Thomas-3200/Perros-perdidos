'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Camera, Share2, X, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

/* ── Texto y URLs para compartir ─────────────────────────────────────────── */
const SHARE_URL  = 'https://perros-perdidos-web.vercel.app';
const SHARE_TEXT = `🐾 Estoy ayudando a Perros Perdidos, una plataforma gratuita que cruza con IA los perros perdidos con los avistamientos que reporta la gente y avisa al dueño automáticamente.

Si conocés a alguien que perdió un perro o querés ayudar a buscar, sumate:
${SHARE_URL}`;

const WHATSAPP_URL = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`;
const FACEBOOK_URL = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}&quote=${encodeURIComponent(SHARE_TEXT)}`;

/* ── Toast ─────────────────────────────────────────────────────────────── */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-gray-900 text-white rounded-2xl px-5 py-4 flex items-start gap-3 shadow-xl">
        <div className="text-2xl">✅</div>
        <div className="flex-1">
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AyudarPage() {
  const [toast,         setToast]         = useState('');
  const [alertsActive,  setAlertsActive]  = useState(false);
  const [city,          setCity]          = useState('');
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loggedIn,      setLoggedIn]      = useState(false);

  // Leer estado actual del usuario
  useEffect(() => {
    const logged = isLoggedIn();
    setLoggedIn(logged);
    if (!logged) return;

    api.users.me()
      .then((res: unknown) => {
        const r = res as { data: { helperMode?: boolean; alertCity?: string } };
        if (r.data.helperMode || r.data.alertCity) {
          setAlertsActive(true);
          if (r.data.alertCity) setCity(r.data.alertCity);
        }
      })
      .catch(() => {});
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  }

  /* ── Activar / desactivar alertas (unifica modo búsqueda + suscripción) ── */
  async function toggleAlerts() {
    if (!loggedIn) {
      showToast('Iniciá sesión para activar las alertas.');
      return;
    }

    // ── Desactivar ─────────────────────────────────────────────────────
    if (alertsActive) {
      setLoadingAlerts(true);
      try {
        await api.users.updateMe({ helperMode: false, alertCity: '' });
        setAlertsActive(false);
        setCity('');
        showToast('Alertas desactivadas.');
      } catch {
        showToast('Error al desactivar. Intentá de nuevo.');
      } finally {
        setLoadingAlerts(false);
      }
      return;
    }

    // ── Activar — primero intentamos geolocalización, si falla pedimos ciudad ──
    setLoadingAlerts(true);
    let detectedCity = '';

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
        { headers: { 'Accept-Language': 'es' } },
      );
      const geoData = await geoRes.json() as { address?: { city?: string; town?: string; village?: string; county?: string; state?: string } };
      detectedCity = geoData.address?.city
        ?? geoData.address?.town
        ?? geoData.address?.village
        ?? geoData.address?.county
        ?? geoData.address?.state
        ?? '';
    } catch {
      // Geolocalización rechazada o fallida — seguimos al fallback de prompt
    }

    // Si no detectamos, le pedimos al usuario manualmente
    if (!detectedCity) {
      setLoadingAlerts(false);
      const inputCity = window.prompt(
        'No pudimos detectar tu ubicación.\n\n¿En qué ciudad querés recibir alertas?\nEjemplo: Buenos Aires, Córdoba, Avellaneda',
      );
      if (!inputCity?.trim()) return;
      detectedCity = inputCity.trim();
      setLoadingAlerts(true);
    }

    try {
      await api.users.updateMe({ helperMode: true, alertCity: detectedCity });
      setAlertsActive(true);
      setCity(detectedCity);
      showToast(`¡Listo! Te avisamos cuando reporten casos en ${detectedCity}.`);
    } catch {
      showToast('Error al activar. Intentá de nuevo.');
    } finally {
      setLoadingAlerts(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Quiero ayudar</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Cada acción cuenta. Elegí cómo querés contribuir hoy.
        </p>
      </div>

      <div className="flex flex-col gap-4">

        {/* ── Reportar avistamiento ── */}
        <Link
          href="/reportar/avistamiento"
          className="card flex items-start gap-4 hover:shadow-md transition-shadow"
        >
          <div className="rounded-xl p-3 bg-blue-50 text-blue-600 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">Reportar un avistamiento</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              ¿Viste un perro perdido en la calle? Subí una foto y marcá la ubicación.
            </p>
          </div>
        </Link>

        {/* ── Importar de redes sociales ── */}
        <Link
          href="/reportar/red-social"
          className="card flex items-start gap-4 hover:shadow-md transition-shadow"
        >
          <div className="rounded-xl p-3 bg-purple-50 text-purple-600 shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">Importar de redes sociales</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Compartí un post de perro perdido que viste en Facebook o Instagram.
            </p>
          </div>
        </Link>

        {/* ── Recibir alertas de tu zona (unificado) ── */}
        <button
          onClick={toggleAlerts}
          disabled={loadingAlerts}
          className={`card flex items-start gap-4 transition-all text-left w-full ${
            alertsActive
              ? 'border-2 border-orange-400 bg-orange-50'
              : 'hover:shadow-md'
          }`}
        >
          <div className={`rounded-xl p-3 shrink-0 ${alertsActive ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Recibir alertas de tu zona</h2>
              {alertsActive && (
                <span className="text-[10px] bg-orange-500 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Activo
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              {alertsActive && city
                ? `Recibís avisos cuando reportan perros perdidos en ${city}. Tocá para desactivar.`
                : 'Te avisamos al instante cuando alguien reporte un perro perdido cerca tuyo.'}
            </p>
          </div>
          {loadingAlerts && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0 self-center" />}
        </button>

        {/* ── Ayudar a compartir ── */}
        <div className="card border-2 border-brand-100 bg-brand-50/40">
          <div className="flex items-start gap-4 mb-3">
            <div className="rounded-xl p-3 bg-brand-50 text-brand-600 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800 text-sm">Ayudá a compartir</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Cuanta más gente conozca la app, más rápido se reúnen los perros con sus familias.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#1ebe5d] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#1877F2] text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#166fe5] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </a>
          </div>
        </div>

      </div>

      <div className="mt-8 p-4 bg-brand-50 rounded-2xl border border-brand-100">
        <p className="text-brand-700 text-xs font-medium leading-relaxed">
          Cada reporte y cada compartido puede ser la clave que una familia estaba esperando.
          Gracias por ser parte de esta red 🐾
        </p>
      </div>
    </div>
  );
}
