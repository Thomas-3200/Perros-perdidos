'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Camera, Share2, Bell, X } from 'lucide-react';

/* ── Toast ─────────────────────────────────────────────────────────────── */
function ComingSoonToast({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-gray-900 text-white rounded-2xl px-5 py-4 flex items-start gap-3 shadow-xl">
        <div className="text-2xl">🚧</div>
        <div className="flex-1">
          <p className="font-semibold text-sm">¡Próximamente!</p>
          <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">
            Esta función estará disponible muy pronto. ¡Gracias por tu entusiasmo!
          </p>
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
  const [showToast, setShowToast] = useState(false);

  function handleComingSoon() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {showToast && <ComingSoonToast onClose={() => setShowToast(false)} />}

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
              Viste un perro suelto? Sube una foto y marcá la ubicación.
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

        {/* ── Activar modo búsqueda (próximamente) ── */}
        <button
          onClick={handleComingSoon}
          className="card flex items-start gap-4 hover:shadow-md transition-shadow text-left w-full"
        >
          <div className="rounded-xl p-3 bg-orange-50 text-orange-600 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Activar modo búsqueda</h2>
              <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                Próximamente
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              Recibí alertas de casos cercanos a vos mientras caminás por el barrio.
            </p>
          </div>
        </button>

        {/* ── Suscribirse a alertas (próximamente) ── */}
        <button
          onClick={handleComingSoon}
          className="card flex items-start gap-4 hover:shadow-md transition-shadow text-left w-full"
        >
          <div className="rounded-xl p-3 bg-green-50 text-green-600 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Suscribirse a alertas</h2>
              <span className="text-[10px] bg-green-100 text-green-600 font-semibold px-2 py-0.5 rounded-full">
                Próximamente
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              Habilitá las notificaciones para enterarte cuando reportan casos en tu zona.
            </p>
          </div>
        </button>

      </div>

      <div className="mt-8 p-4 bg-brand-50 rounded-2xl border border-brand-100">
        <p className="text-brand-700 text-xs font-medium">
          Cada reporte puede ser la clave que una familia estaba esperando.
          Gracias por ser parte de esta red.
        </p>
      </div>
    </div>
  );
}
