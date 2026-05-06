'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, Sparkles, ChevronLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { PhotoPicker } from '@/components/ui/PhotoPicker';
import clsx from 'clsx';

type InputMode = 'image' | 'text';

export default function ReportarRedSocialPage() {
  const router  = useRouter();
  const [mode,    setMode]    = useState<InputMode>('image');
  const [text,    setText]    = useState('');
  const [image,   setImage]   = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [showAuth,  setShowAuth]  = useState(false);

  async function handleSubmit() {
    if (!isLoggedIn()) { setShowAuth(true); return; }
    setLoading(true);
    setError('');
    try {
      if (mode === 'image' && image) {
        const fd = new FormData();
        fd.append('files', image);
        fd.append('sourceType', 'screenshot');
        await api.ingest.submitImage(fd);
      } else if (mode === 'text') {
        await api.ingest.submitText(text);
      }
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSuccess() {
    setShowAuth(false);
    await handleSubmit();
  }

  const canSubmit = (mode === 'image' && image) || (mode === 'text' && text.trim().length > 10);

  /* ── Pantalla de éxito ────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 bg-hope-50 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-hope-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Gracias por ayudar! 🐾</h2>
          <p className="text-gray-500 leading-relaxed">
            La IA está procesando la información. En unos segundos va a aparecer como un nuevo
            avistamiento en la sección <strong className="text-gray-700">Avistados</strong>.
          </p>
          <div className="bg-brand-50 rounded-2xl px-4 py-3 text-left border border-brand-100">
            <p className="text-brand-700 text-xs font-medium">¿Qué pasa después?</p>
            <ul className="text-brand-600 text-xs mt-1.5 space-y-1">
              <li>✅ La IA extrae los datos del post automáticamente</li>
              <li>✅ Se cruza con los casos de perros perdidos activos</li>
              <li>✅ Si hay coincidencia, el dueño recibe una notificación</li>
            </ul>
          </div>
          <div className="space-y-3">
            <button onClick={() => router.push('/avistamientos')} className="btn-primary w-full">
              Ver en Avistados →
            </button>
            <button onClick={() => router.push('/reportar/red-social')} className="btn-secondary w-full">
              Reportar otro caso
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && (
        <AuthModal onSuccess={handleAuthSuccess} onClose={() => setShowAuth(false)} />
      )}

      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Importar de redes sociales</h1>
          <p className="text-xs text-gray-400">La IA extrae y estructura los datos por vos</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Info banner */}
        <div className="bg-brand-50 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-700">¿Viste un post de perro perdido?</p>
            <p className="text-xs text-brand-600 mt-1">
              Sacá un screenshot o pegá el texto del post.
              La IA extrae automáticamente todos los datos importantes.
            </p>
          </div>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('image')}
            className={clsx(
              'flex flex-col items-center gap-2 py-4 rounded-2xl border-2 text-sm font-semibold transition-colors relative',
              mode === 'image'
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
            )}
          >
            {/* Badge recomendado */}
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-hope-500 text-white font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              ⭐ Recomendado
            </span>
            <ImageIcon className="w-6 h-6" />
            📸 Screenshot del post
          </button>

          <button
            type="button"
            onClick={() => setMode('text')}
            className={clsx(
              'flex flex-col items-center gap-2 py-4 rounded-2xl border-2 text-sm font-semibold transition-colors',
              mode === 'text'
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
            )}
          >
            <FileText className="w-6 h-6" />
            📝 Pegar texto
          </button>
        </div>

        {/* Input según modo */}
        {mode === 'image' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 text-center">
              Sacá captura de pantalla del post de Facebook, WhatsApp o Instagram y subila acá
            </p>
            {image && (
              <div className="rounded-2xl overflow-hidden border border-gray-200">
                <img
                  src={URL.createObjectURL(image)}
                  alt="preview"
                  className="w-full max-h-64 object-contain bg-gray-50"
                />
              </div>
            )}
            <PhotoPicker onFile={f => setImage(f)} />
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Pegá el texto del post
            </label>
            <textarea
              className="input resize-none h-44"
              placeholder="Copiá y pegá acá el texto completo del post con la descripción del perro perdido, nombre, zona, contacto..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Incluí toda la info que puedas: nombre, raza, color, zona, teléfono de contacto.
            </p>
          </div>
        )}

        {/* Aviso: links de Facebook no funcionan */}
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-700">
            <strong>¿Tenés solo el link?</strong> Los links de Facebook e Instagram requieren login y la IA no puede leerlos.
            Usá screenshot o copiá el texto del post en su lugar.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando a la IA…</>
            : <><Sparkles className="w-5 h-5" /> Enviar a la IA</>
          }
        </button>
      </div>
    </div>
  );
}
