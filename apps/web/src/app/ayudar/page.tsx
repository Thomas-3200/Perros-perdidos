'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Camera, Share2, Bell, X, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

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
  const [helperMode,    setHelperMode]    = useState(false);
  const [alertActive,   setAlertActive]   = useState(false);
  const [city,          setCity]          = useState('');
  const [loadingHelper, setLoadingHelper] = useState(false);
  const [loadingAlert,  setLoadingAlert]  = useState(false);
  const [loggedIn,      setLoggedIn]      = useState(false);

  // Leer estado actual del usuario
  useEffect(() => {
    const logged = isLoggedIn();
    setLoggedIn(logged);
    if (!logged) return;

    api.users.me()
      .then((res: unknown) => {
        const r = res as { data: { helperMode?: boolean; alertCity?: string } };
        if (r.data.helperMode)  setHelperMode(true);
        if (r.data.alertCity)   { setAlertActive(true); setCity(r.data.alertCity); }
      })
      .catch(() => {});
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  }

  /* ── Activar / desactivar modo búsqueda (geolocalización) ── */
  async function toggleHelperMode() {
    if (!loggedIn) {
      showToast('Iniciá sesión para activar el modo búsqueda.');
      return;
    }

    if (helperMode) {
      // Desactivar
      setLoadingHelper(true);
      try {
        await api.users.updateMe({ helperMode: false });
        setHelperMode(false);
        showToast('Modo búsqueda desactivado.');
      } catch { showToast('Error al desactivar. Intentá de nuevo.'); }
      finally { setLoadingHelper(false); }
      return;
    }

    // Activar — pedir ubicación
    setLoadingHelper(true);
    try {
      let detectedCity = city;

      if (!detectedCity) {
        // Intentar geolocalización
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
          );
          // Reverse geocode con nominatim (gratis, sin key)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const geoData = await geoRes.json() as { address?: { city?: string; town?: string; village?: string; county?: string } };
          detectedCity = geoData.address?.city
            ?? geoData.address?.town
            ?? geoData.address?.village
            ?? geoData.address?.county
            ?? '';
        } catch {
          // Si falla geolocalización, usar ciudad del perfil o pedir
          detectedCity = '';
        }
      }

      if (!detectedCity) {
        showToast('No pudimos detectar tu ubicación. Primero suscribite a alertas con tu ciudad.');
        setLoadingHelper(false);
        return;
      }

      await api.users.updateMe({ helperMode: true, alertCity: detectedCity });
      setHelperMode(true);
      setAlertActive(true);
      setCity(detectedCity);
      showToast(`Modo búsqueda activo en ${detectedCity}. Te avisamos cuando haya casos cerca.`);
    } catch { showToast('Error al activar. Intentá de nuevo.'); }
    finally { setLoadingHelper(false); }
  }

  /* ── Suscribirse / desuscribirse a alertas de zona ── */
  async function toggleAlerts() {
    if (!loggedIn) {
      showToast('Iniciá sesión para suscribirte a alertas.');
      return;
    }

    if (alertActive) {
      // Desactivar
      setLoadingAlert(true);
      try {
        await api.users.updateMe({ helperMode: false, alertCity: '' });
        setAlertActive(false);
        setHelperMode(false);
        setCity('');
        showToast('Alertas desactivadas.');
      } catch { showToast('Error al desactivar. Intentá de nuevo.'); }
      finally { setLoadingAlert(false); }
      return;
    }

    // Activar — pedir ciudad
    const inputCity = window.prompt('¿En qué ciudad querés recibir alertas?\nEjemplo: Buenos Aires, Córdoba, Rosario');
    if (!inputCity?.trim()) return;

    setLoadingAlert(true);
    try {
      const trimmedCity = inputCity.trim();
      await api.users.updateMe({ helperMode: true, alertCity: trimmedCity });
      setAlertActive(true);
      setHelperMode(true);
      setCity(trimmedCity);
      showToast(`¡Listo! Te avisamos cuando reporten casos en ${trimmedCity}.`);
    } catch { showToast('Error al guardar. Intentá de nuevo.'); }
    finally { setLoadingAlert(false); }
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

        {/* ── Activar modo búsqueda ── */}
        <button
          onClick={toggleHelperMode}
          disabled={loadingHelper}
          className={`card flex items-start gap-4 transition-all text-left w-full ${
            helperMode
              ? 'border-2 border-orange-400 bg-orange-50'
              : 'hover:shadow-md'
          }`}
        >
          <div className={`rounded-xl p-3 shrink-0 ${helperMode ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'}`}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Activar modo búsqueda</h2>
              {helperMode
                ? <span className="text-[10px] bg-orange-500 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Activo
                  </span>
                : null
              }
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              {helperMode && city
                ? `Recibís alertas de casos en ${city}. Tocá para desactivar.`
                : 'Recibí alertas de casos cercanos a vos usando tu ubicación.'}
            </p>
          </div>
          {loadingHelper && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0 self-center" />}
        </button>

        {/* ── Suscribirse a alertas ── */}
        <button
          onClick={toggleAlerts}
          disabled={loadingAlert}
          className={`card flex items-start gap-4 transition-all text-left w-full ${
            alertActive
              ? 'border-2 border-green-400 bg-green-50'
              : 'hover:shadow-md'
          }`}
        >
          <div className={`rounded-xl p-3 shrink-0 ${alertActive ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Suscribirse a alertas</h2>
              {alertActive
                ? <span className="text-[10px] bg-green-500 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Activo
                  </span>
                : null
              }
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              {alertActive && city
                ? `Notificaciones activas para ${city}. Tocá para desactivar.`
                : 'Elegí tu ciudad y te avisamos cuando reporten casos nuevos.'}
            </p>
          </div>
          {loadingAlert && <Loader2 className="w-4 h-4 animate-spin text-green-500 shrink-0 self-center" />}
        </button>

      </div>

      <div className="mt-8 p-4 bg-brand-50 rounded-2xl border border-brand-100">
        <p className="text-brand-700 text-xs font-medium">
          Las alertas llegan al ícono de notificaciones en tu perfil.
          Cada reporte puede ser la clave que una familia estaba esperando. Gracias por ser parte de esta red.
        </p>
      </div>
    </div>
  );
}
