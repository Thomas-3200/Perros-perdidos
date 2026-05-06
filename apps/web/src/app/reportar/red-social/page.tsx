'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, Sparkles, ChevronLeft, Check, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { PhotoPicker } from '@/components/ui/PhotoPicker';
import clsx from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function compressImage(file: File, maxPx = 1600, quality = 0.85): Promise<File> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round((height * maxPx) / width); width = maxPx; }
        else                 { width  = Math.round((width  * maxPx) / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', quality,
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

async function warmUp(): Promise<void> {
  try { await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(45_000) }); } catch {}
}

type InputMode   = 'image' | 'text';
type ResultState = 'processed' | 'rejected' | 'pending' | null;

export default function ReportarRedSocialPage() {
  const router  = useRouter();
  const [mode,      setMode]      = useState<InputMode>('image');
  const [text,      setText]      = useState('');
  const [image,     setImage]     = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ResultState>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [error,     setError]     = useState('');
  const [showAuth,  setShowAuth]  = useState(false);

  const [loadingHint, setLoadingHint] = useState('');

  async function handleSubmit() {
    if (!isLoggedIn()) { setShowAuth(true); return; }
    setLoading(true);
    setError('');
    setDebugInfo('');
    setLoadingHint('Conectando con el servidor…');

    try {
      // 1️⃣ Pre-calentar el servidor
      await warmUp();
      setLoadingHint('');

      let res: { aiProcessed?: boolean; aiError?: string; message?: string; data?: { status?: string } } = {};

      if (mode === 'image' && image) {
        // 2️⃣ Comprimir imagen (de 3-5MB a ~300KB) antes de enviar
        setLoadingHint('Preparando imagen…');
        const compressed = await compressImage(image);
        setLoadingHint('Analizando con IA… (puede tardar hasta 30 seg)');

        const fd = new FormData();
        fd.append('files', compressed);
        fd.append('sourceType', 'screenshot');
        res = await api.ingest.submitImage(fd) as typeof res;
      } else if (mode === 'text') {
        setLoadingHint('Analizando con IA…');
        res = await api.ingest.submitText(text) as typeof res;
      }

      if (res?.aiError) setDebugInfo(res.aiError);
      const status = (res?.data as { status?: string })?.status ?? 'pending';
      setResult(status as ResultState);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setLoading(false);
      setLoadingHint('');
    }
  }

  async function handleAuthSuccess() {
    setShowAuth(false);
    await handleSubmit();
  }

  const canSubmit = (mode === 'image' && image) || (mode === 'text' && text.trim().length > 10);

  /* ── Pantalla de resultado ────────────────────────────────────────────────── */
  if (result !== null) {
    const isSuccess = result === 'processed';
    const isRejected = result === 'rejected';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          {/* Ícono */}
          <div className={clsx(
            'w-20 h-20 rounded-full flex items-center justify-center mx-auto',
            isSuccess  ? 'bg-green-100' : isRejected ? 'bg-yellow-50' : 'bg-brand-50',
          )}>
            {isSuccess  ? <Check     className="w-10 h-10 text-green-500" /> :
             isRejected ? <AlertTriangle className="w-10 h-10 text-yellow-500" /> :
                          <Loader2  className="w-10 h-10 text-brand-500 animate-spin" />}
          </div>

          {/* Título */}
          <h2 className="text-2xl font-bold text-gray-900">
            {isSuccess  ? '¡Gracias por ayudar! 🐾' :
             isRejected ? 'No pudimos extraer datos' :
                          'Procesando…'}
          </h2>

          {/* Descripción */}
          <p className="text-gray-500 leading-relaxed text-sm">
            {isSuccess
              ? 'La IA analizó el contenido y creó un avistamiento automáticamente. Podés verlo en la sección Avistados.'
              : isRejected
                ? 'La IA no encontró suficiente información sobre un perro perdido en el contenido. Probá con una imagen más clara o pegá el texto completo del post.'
                : 'Tu contenido fue recibido y está siendo procesado. Revisá Avistados en unos minutos.'}
          </p>

          {/* Detalle si fue exitoso */}
          {isSuccess && (
            <div className="bg-green-50 rounded-2xl px-4 py-3 text-left border border-green-100">
              <p className="text-green-700 text-xs font-medium">¿Qué hizo la IA?</p>
              <ul className="text-green-600 text-xs mt-1.5 space-y-1">
                <li>✅ Extrajo descripción, ubicación y datos del perro</li>
                <li>✅ Creó un avistamiento en la plataforma</li>
                <li>✅ Lo cruzó contra los casos activos de perros perdidos</li>
              </ul>
            </div>
          )}

          {/* Sugerencia si fue rechazado */}
          {isRejected && (
            <div className="bg-yellow-50 rounded-2xl px-4 py-3 text-left border border-yellow-100">
              <p className="text-yellow-700 text-xs font-medium">Consejos para mejores resultados:</p>
              <ul className="text-yellow-600 text-xs mt-1.5 space-y-1">
                <li>📸 Usá capturas nítidas donde se lea bien el texto del post</li>
                <li>📝 O pegá el texto completo del post directamente</li>
                <li>🐶 Asegurate de que el post hable de un perro perdido o encontrado</li>
              </ul>
            </div>
          )}

          {/* Error técnico para debug */}
          {isRejected && debugInfo && (
            <details className="text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Ver detalle del error técnico
              </summary>
              <p className="mt-1 text-xs text-red-500 bg-red-50 rounded-lg p-2 font-mono break-all">
                {debugInfo}
              </p>
            </details>
          )}

          {/* Botones */}
          <div className="space-y-3">
            {isSuccess && (
              <button onClick={() => router.push('/avistamientos')} className="btn-primary w-full">
                Ver en Avistados →
              </button>
            )}
            <button
              onClick={() => { setResult(null); setImage(null); setText(''); }}
              className={isSuccess ? 'btn-secondary w-full' : 'btn-primary w-full'}
            >
              {isRejected ? 'Intentar de nuevo' : 'Reportar otro caso'}
            </button>
            <button onClick={() => router.push('/')} className="btn-secondary w-full text-gray-500">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario ───────────────────────────────────────────────────────────── */
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
              <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                <img
                  src={URL.createObjectURL(image)}
                  alt="preview"
                  className="w-full max-h-64 object-contain bg-gray-50"
                />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            )}
            {!image && <PhotoPicker onFile={f => setImage(f)} />}
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

        {/* Hint de carga progresivo */}
        {loading && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin shrink-0" />
            <div>
              <p className="text-brand-700 text-sm font-semibold">
                {loadingHint || 'Procesando…'}
              </p>
              <p className="text-brand-600 text-xs mt-0.5">No cierres la pantalla.</p>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-50"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Analizando con IA…</>
            : <><Sparkles className="w-5 h-5" /> Enviar a la IA</>
          }
        </button>
      </div>
    </div>
  );
}
