'use client';

/**
 * Componente que pregunta al usuario si quiere activar notificaciones push.
 * Maneja todos los estados: no soportado, denegado, activable, activado.
 *
 * Uso:
 *   <PushNotificationsPrompt /> en cualquier página visible para usuarios logueados
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2, X } from 'lucide-react';
import { isLoggedIn } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type State =
  | 'unsupported'  // Navegador no soporta push
  | 'unknown'      // Aún no chequeamos
  | 'default'      // Permiso default — podemos pedirlo
  | 'granted'      // Permiso ok pero no estamos suscritos
  | 'subscribed'   // Activo y funcionando
  | 'denied';      // Usuario lo bloqueó

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pp_token') : null;
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
}

interface Props {
  /**
   * Variante de presentación:
   * - 'banner' (default): tarjeta naranja prominente para mostrar en la home
   * - 'inline': fila simple para perfil o settings
   */
  variant?: 'banner' | 'inline';
  /** Cuando se cierra el banner, no volver a mostrarlo en esta sesión */
  onDismiss?: () => void;
}

export function PushNotificationsPrompt({ variant = 'banner', onDismiss }: Props) {
  const [state, setState]     = useState<State>('unknown');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Detectar estado al montar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (sessionStorage.getItem('pp_push_dismissed') === '1') {
      setDismissed(true);
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }

    if (!isLoggedIn()) {
      setState('unknown');
      return;
    }

    const perm = Notification.permission;
    if (perm === 'denied')  { setState('denied');  return; }
    if (perm === 'default') { setState('default'); return; }

    // permission === 'granted' → verificar si estamos suscritos
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) {
        setState('granted'); // permiso ok pero no service worker → re-suscribir
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'subscribed' : 'granted');
    });
  }, []);

  async function activar() {
    setLoading(true);
    try {
      // 1. Pedir permiso del navegador (o usar el ya otorgado)
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default');
        return;
      }

      // 2. Registrar service worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Obtener VAPID public key del backend
      const vapidRes = await fetch(`${API_URL}/api/v1/push/vapid-public-key`).then(r => r.json());
      const vapidKey = vapidRes?.data?.publicKey;
      if (!vapidKey) throw new Error('VAPID key no disponible en el servidor');

      // 4. Crear subscription (cast a BufferSource para satisfacer
      //    el tipado más estricto de TS que viene con lib.dom recientes)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      // 5. Enviar al backend
      const subJson = sub.toJSON();
      const res = await fetch(`${API_URL}/api/v1/push/subscribe`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          endpoint:  subJson.endpoint,
          keys:      subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error(`Backend rechazó la suscripción: HTTP ${res.status}`);

      setState('subscribed');

      // 6. Mandarle un push de prueba para validar
      fetch(`${API_URL}/api/v1/push/test`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      }).catch(() => {});

    } catch (err) {
      console.error('[push] Error activando:', err);
      alert('No pudimos activar las notificaciones. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function desactivar() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { setState('default'); return; }

      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Avisar al backend para borrar la subscription
        await fetch(`${API_URL}/api/v1/push/subscribe`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});

        await sub.unsubscribe();
      }
      setState('granted');
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem('pp_push_dismissed', '1');
    setDismissed(true);
    onDismiss?.();
  }

  // ── Casos donde no mostramos nada ───────────────────────────────────────
  if (state === 'unknown' || state === 'unsupported') return null;
  if (dismissed && state !== 'subscribed') return null; // si ya está activado lo dejamos visible para mostrar status

  // ── Variante inline (perfil/settings) ───────────────────────────────────
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          state === 'subscribed' ? 'bg-hope-100 text-hope-600' : 'bg-brand-100 text-brand-600'
        }`}>
          {state === 'subscribed' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">
            {state === 'subscribed' ? 'Notificaciones activadas' : 'Notificaciones push'}
          </p>
          <p className="text-xs text-gray-500 leading-snug">
            {state === 'subscribed' && 'Te avisaremos al instante en este dispositivo.'}
            {state === 'granted'    && 'Activá para recibir alertas en este dispositivo.'}
            {state === 'default'    && 'Activá para recibir alertas en este dispositivo.'}
            {state === 'denied'     && 'Bloqueadas por el navegador. Cambiá los permisos del sitio para reactivarlas.'}
          </p>
        </div>
        {state === 'subscribed' ? (
          <button onClick={desactivar} disabled={loading}
            className="text-xs font-semibold text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Desactivar'}
          </button>
        ) : (state === 'default' || state === 'granted') ? (
          <button onClick={activar} disabled={loading}
            className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activar'}
          </button>
        ) : null}
      </div>
    );
  }

  // ── Variante banner (home) ──────────────────────────────────────────────
  // Si ya está suscrito, no mostramos nada en home
  if (state === 'subscribed') return null;

  return (
    <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-5 text-white shadow-lg">
      <button onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-white/20 transition-colors"
        aria-label="Cerrar">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight">Activá las notificaciones</h3>
          <p className="text-sm text-white/90 mt-1 leading-snug">
            Te avisamos al instante en tu celular si alguien ve a tu perro.
          </p>

          {state === 'denied' && (
            <p className="text-xs text-white/80 mt-2">
              ⚠️ Tu navegador las tiene bloqueadas. Cambiá los permisos del sitio para reactivarlas.
            </p>
          )}

          {(state === 'default' || state === 'granted') && (
            <button onClick={activar} disabled={loading}
              className="mt-3 inline-flex items-center gap-2 bg-white text-brand-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-60">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Activando…</>
                : <>🔔 Activar notificaciones</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Banner pequeño que solo se muestra si el user está logueado y aún no
 * activó las notificaciones. Inteligente: no aparece si ya las tiene.
 */
export function PushBannerSmart() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) return;
    if (sessionStorage.getItem('pp_push_dismissed') === '1') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      // Chequear si está suscrito; si sí, no mostrar
      navigator.serviceWorker?.getRegistration().then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!sub) setShow(true);
      });
      return;
    }
    if (Notification.permission === 'default') setShow(true);
  }, []);

  if (!show) return null;
  return <PushNotificationsPrompt variant="banner" onDismiss={() => setShow(false)} />;
}
