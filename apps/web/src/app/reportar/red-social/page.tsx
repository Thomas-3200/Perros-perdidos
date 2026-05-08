'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ChevronLeft, Check, Loader2, AlertTriangle, XCircle } from 'lucide-react';
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

type ResultState = 'processed' | 'rejected' | 'pending' | null;

const MAX_IMAGES = 2;

export default function ReportarRedSocialPage() {
  const router  = useRouter();
  const [images,    setImages]    = useState<File[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ResultState>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [error,     setError]     = useState('');
  const [showAuth,  setShowAuth]  = useState(false);

  const [loadingHint, setLoadingHint] = useState('');

  function addImages(newFiles: File[]) {
    setImages(prev => [...prev, ...newFiles].slice(0, MAX_IMAGES));
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

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

      if (images.length === 0) throw new Error('Subí al menos una captura de pantalla');

      // 2️⃣ Comprimir TODAS las imágenes en paralelo (de 3-5MB a ~300KB c/u)
      setLoadingHint('Preparando imágenes…');
      const compressed = await Promise.all(images.map(img => compressImage(img)));
      setLoadingHint('Analizando con IA… (puede tardar hasta 30 seg)');

      // 3️⃣ Subir todas como FormData multipart — el backend acepta múltiples
      // archivos en el campo 'files' y los procesa juntos.
      const fd = new FormData();
      compressed.forEach(file => fd.append('files', file));
      fd.append('sourceType', 'screenshot');
      res = await api.ingest.submitImage(fd) as typeof res;

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

  const canSubmit = images.length > 0;

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

          {/* Compartir — solo si fue exitoso */}
          {isSuccess && (() => {
            const shareText  = `🐾 Acabo de cargar un caso en Perros Perdidos para ayudar a un perrito a volver a casa.\n\nLa app cruza con IA cualquier avistamiento que reporte la gente y avisa al dueño automáticamente. Sumate:\nhttps://perros-perdidos-web.vercel.app`;
            const shareUrl   = 'https://perros-perdidos-web.vercel.app';
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
            const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
            return (
              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-brand-700">📣 Ayudanos a llegar a más gente</p>
                <p className="text-xs text-brand-600 leading-relaxed">
                  Cuanta más gente conozca la app, más rápido se reúnen los perros con sus familias.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#1ebe5d] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-[#1877F2] text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#166fe5] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                </div>
              </div>
            );
          })()}

          {/* Botones */}
          <div className="space-y-3">
            {isSuccess && (
              <button onClick={() => router.push('/avistamientos')} className="btn-primary w-full">
                Ver en Avistados →
              </button>
            )}
            {isRejected && (
              <button
                onClick={() => { setResult(null); setImages([]); }}
                className="btn-primary w-full"
              >
                Intentar de nuevo
              </button>
            )}
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
              Subí <strong>1 o 2 capturas</strong> del post (Facebook, Instagram o WhatsApp).
              La IA cruza la información para extraer la ubicación lo más precisa posible.
            </p>
          </div>
        </div>

        {/* Upload de capturas (hasta 2) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-700">
              Capturas de pantalla del post
            </label>
            <span className="text-xs text-gray-400">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            💡 Si la dirección no está en la misma captura que la foto del perro,
            agregá una segunda con la info que falta (dirección, contacto, etc.).
          </p>

          {/* Previews de las imágenes ya subidas */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`captura ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {i + 1}
                  </span>
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow hover:bg-white transition-colors"
                    type="button"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Botón para agregar más (oculto si ya alcanzamos el máximo) */}
          {images.length < MAX_IMAGES && (
            <PhotoPicker
              key={images.length /* fuerza remount al agregar */}
              galleryOnly
              multiple
              galleryLabel={
                images.length === 0
                  ? 'Subir captura de pantalla'
                  : 'Agregar otra captura'
              }
              onFile={f => addImages([f])}
              onFiles={fs => addImages(fs)}
            />
          )}
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
