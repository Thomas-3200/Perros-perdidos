'use client';

/**
 * Pantalla: Human API — Importar caso desde redes sociales
 * Permite:
 *   - Pegar un link
 *   - Escribir texto copiado de un post
 *   - Subir un screenshot
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, FileText, Image as ImageIcon, Sparkles, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import clsx from 'clsx';

type InputMode = 'link' | 'text' | 'image';

export default function ReportarRedSocialPage() {
  const router  = useRouter();
  const [mode,    setMode]    = useState<InputMode>('link');
  const [link,    setLink]    = useState('');
  const [text,    setText]    = useState('');
  const [image,   setImage]   = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [showAuth,  setShowAuth]  = useState(false);

  async function handleSubmit() {
    // Verificar sesión antes de enviar
    if (!isLoggedIn()) {
      setShowAuth(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'link') {
        await api.ingest.submitLink(link);
      } else if (mode === 'text') {
        await api.ingest.submitText(text);
      } else if (mode === 'image' && image) {
        const fd = new FormData();
        fd.append('files', image);
        fd.append('sourceType', 'screenshot');
        await api.ingest.submitImage(fd);
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
    // Continuar con el envío después del login
    await handleSubmit();
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 bg-hope-50 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-hope-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Gracias por ayudar! 🐾</h2>
          <p className="text-gray-500">
            La IA procesará la información en los próximos minutos y la cruzará con los casos activos.
            Si encuentra una coincidencia, el dueño recibirá una notificación.
          </p>
          <div className="space-y-3">
            <button onClick={() => router.push('/reportar/red-social')}
              className="btn-secondary w-full">
              Reportar otro caso
            </button>
            <button onClick={() => router.push('/')} className="btn-primary w-full">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Caso de red social</h1>
          <p className="text-xs text-gray-400">La IA extrae y estructura los datos por ti</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="bg-brand-50 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-700">¿Viste un post de perro perdido?</p>
            <p className="text-xs text-brand-600 mt-1">
              Envíanos el link, copia el texto o sube un screenshot.
              Nuestro sistema lo convierte automáticamente en un caso estructurado.
            </p>
          </div>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'link',  label: 'Link',        icon: Link2     },
            { id: 'text',  label: 'Texto',        icon: FileText  },
            { id: 'image', label: 'Screenshot',   icon: ImageIcon },
          ] as { id: InputMode; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button"
              onClick={() => setMode(id)}
              className={clsx(
                'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-colors',
                mode === id
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Área de input según modo */}
        {mode === 'link' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">URL del post</label>
            <input className="input" type="url"
              placeholder="https://facebook.com/groups/... o https://instagram.com/..."
              value={link} onChange={e => setLink(e.target.value)} />
            <p className="text-xs text-gray-400">
              ⚠️ Los posts privados de Facebook no se pueden leer automáticamente.
              Si el post es privado, usá la opción <strong>Texto</strong> (pegá el contenido) o <strong>Screenshot</strong>.
            </p>
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pega el texto del post</label>
            <textarea className="input resize-none h-40"
              placeholder="Copia y pega aquí el contenido del post con la descripción del perro perdido..."
              value={text} onChange={e => setText(e.target.value)} />
          </div>
        )}

        {mode === 'image' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Screenshot del post</label>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-2xl p-8 text-center transition-colors">
                {image ? (
                  <img src={URL.createObjectURL(image)} alt="preview"
                    className="max-h-52 object-contain rounded-xl mx-auto" />
                ) : (
                  <>
                    <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Toca para subir screenshot</p>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="sr-only"
                onChange={e => setImage(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || (mode === 'link' && !link) || (mode === 'text' && !text) || (mode === 'image' && !image)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
            : <><Sparkles className="w-5 h-5" /> Enviar a la IA</>
          }
        </button>
      </div>
    </div>
  );
}
