'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Heart, Camera, ChevronLeft, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('pp_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EncontreePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [photo,   setPhoto]   = useState<File | null>(null);
  const [story,   setStory]   = useState('');
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('caseId', id);
      fd.append('storyText', story);
      fd.append('publishConsent', String(publish));
      if (photo) fd.append('files', photo);

      const res = await fetch(`${API_URL}/api/v1/reunion`, {
        method:  'POST',
        headers: { ...getAuthHeader() },
        body:    fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-24 h-24 bg-hope-50 rounded-full flex items-center justify-center mx-auto">
            <Heart className="w-12 h-12 text-hope-500 fill-current" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Qué alegría! 🎉</h2>
          <p className="text-gray-500">
            El caso fue cerrado exitosamente.
            {publish
              ? ' Tu historia de reunificación será visible en el feed para inspirar a otros.'
              : ' Guardamos el registro de la reunificación.'}
          </p>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => router.push('/reuniones')}
              className="btn-primary w-full"
            >
              Ver reunificaciones
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary w-full"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">¡Lo encontré!</h1>
          <p className="text-xs text-gray-400">Cerrar el caso y compartir la historia</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Celebración */}
        <div className="bg-hope-50 rounded-2xl p-5 text-center border border-green-100">
          <div className="text-4xl mb-2">🐾❤️</div>
          <h2 className="font-bold text-hope-700 text-lg">¡Qué noticia tan hermosa!</h2>
          <p className="text-hope-600 text-sm mt-1">
            Cerrá el caso y contale a la comunidad que tu perro volvió a casa.
          </p>
        </div>

        {/* Foto de la reunión (opcional) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Foto del reencuentro <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 hover:border-hope-400 rounded-2xl p-6 text-center transition-colors">
              {photo ? (
                <div className="space-y-2">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt="Reunión"
                    className="max-h-52 object-contain rounded-xl mx-auto"
                  />
                  <p className="text-xs text-gray-400">Toca para cambiar la foto</p>
                </div>
              ) : (
                <>
                  <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Subí una foto del reencuentro</p>
                  <p className="text-xs text-gray-400 mt-1">Inspira a otros dueños que todavía buscan</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={e => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Historia (opcional) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Contanos cómo fue <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            className="input resize-none h-32"
            placeholder="¿Cómo lo encontraste? ¿Quién te ayudó? ¿Cuánto tiempo estuvo perdido?..."
            value={story}
            onChange={e => setStory(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            Si no escribís nada, la IA generará una historia automáticamente con los datos del caso.
          </p>
        </div>

        {/* Publicar en el feed */}
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              className="sr-only"
              checked={publish}
              onChange={e => setPublish(e.target.checked)}
            />
            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
              publish ? 'bg-hope-500 border-hope-500' : 'border-gray-300'
            }`}>
              {publish && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Publicar en el feed de reunificaciones</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Tu historia inspirará a otras familias que están buscando. Podés desactivarlo si preferís que sea privado.
            </p>
          </div>
        </label>

        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Botones */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Cerrando el caso…</>
              : <><Heart className="w-5 h-5 fill-current" /> Confirmar reunificación</>
            }
          </button>

          <button
            onClick={() => router.back()}
            className="btn-secondary w-full text-sm"
          >
            Todavía no lo encontré — volver
          </button>
        </div>
      </div>
    </div>
  );
}
