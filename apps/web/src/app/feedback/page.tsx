'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { ThumbsUp, Plus, Lightbulb, Trash2, ChevronLeft, Loader2, CheckCircle2, Clock, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { isLoggedIn, getUser } from '@/lib/auth';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface FeedbackItem {
  id: string;
  type: 'add' | 'remove';
  title: string;
  description?: string;
  votes: number;
  voterIds: string[];
  status: 'open' | 'reviewing' | 'done' | 'dismissed';
  createdAt: string;
  user?: { name: string };
}

type TabType = 'add' | 'remove';

// ── Badge de estado ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  open:      { label: 'Abierto',    className: 'bg-blue-50  text-blue-700',  icon: Clock        },
  reviewing: { label: 'En revisión',className: 'bg-amber-50 text-amber-700', icon: Clock        },
  done:      { label: 'Listo',      className: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  dismissed: { label: 'Descartado', className: 'bg-gray-100 text-gray-500',  icon: X            },
};

// ── Card de sugerencia ─────────────────────────────────────────────────────────
function FeedbackCard({ item, currentUserId }: { item: FeedbackItem; currentUserId?: string }) {
  const [loading, setLoading] = useState(false);
  const hasVoted  = currentUserId ? item.voterIds.includes(currentUserId) : false;
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
  const StatusIcon = statusCfg.icon;

  async function handleVote() {
    if (!isLoggedIn()) { alert('Tenés que iniciar sesión para votar'); return; }
    setLoading(true);
    try {
      await api.feedback.vote(item.id);
      mutate('feedback-add');
      mutate('feedback-remove');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al votar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4">
      {/* Botón de votos */}
      <div className="flex flex-col items-center gap-1 min-w-[52px]">
        <button
          onClick={handleVote}
          disabled={loading}
          className={clsx(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all border',
            hasVoted
              ? 'bg-brand-50 border-brand-200 text-brand-600'
              : 'border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-500',
          )}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <ThumbsUp className={clsx('w-4 h-4', hasVoted && 'fill-brand-500')} />
          }
          <span className="text-xs font-bold leading-none">{item.votes}</span>
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{item.title}</h3>
          <span className={clsx(
            'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
            statusCfg.className,
          )}>
            <StatusIcon className="w-2.5 h-2.5" />
            {statusCfg.label}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
        )}
        {item.user?.name && (
          <p className="text-[10px] text-gray-400 mt-1.5">por {item.user.name}</p>
        )}
      </div>
    </div>
  );
}

// ── Formulario de nueva sugerencia ────────────────────────────────────────────
function NewFeedbackForm({ type, onClose, onSuccess }: {
  type: TabType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    setLoading(true);
    setError('');
    try {
      await api.feedback.create({ type, title: title.trim(), description: description.trim() || undefined });
      mutate('feedback-add');
      mutate('feedback-remove');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          {type === 'add' ? '💡 Nueva sugerencia para sumar' : '🗑️ Cosa para quitar'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={type === 'add' ? 'Ej: Notificaciones por email' : 'Ej: El paso de confirmación duplicado'}
            maxLength={120}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Descripción <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="Contanos un poco más..."
            maxLength={500}
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
          <p className="text-right text-[10px] text-gray-400 mt-0.5">{description.length}/500</p>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white
                     font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Enviar sugerencia
        </button>
      </form>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function FeedbackPage() {
  const router          = useRouter();
  const [tab, setTab]   = useState<TabType>('add');
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Obtener userId para saber qué votó el usuario actual
  const currentUserId = getUser()?.id;

  const { data: addData, isLoading: addLoading } = useSWR(
    'feedback-add',
    () => api.feedback.list('add') as Promise<{ success: boolean; data: FeedbackItem[] }>,
  );

  const { data: removeData, isLoading: removeLoading } = useSWR(
    'feedback-remove',
    () => api.feedback.list('remove') as Promise<{ success: boolean; data: FeedbackItem[] }>,
  );

  const items   = tab === 'add' ? (addData?.data ?? []) : (removeData?.data ?? []);
  const loading = tab === 'add' ? addLoading : removeLoading;

  function handleSuccess() {
    setShowForm(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 p-1 -ml-1 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Ideas y mejoras</h1>
            <p className="text-xs text-gray-500">Sugerí qué sumar o qué quitar de la app</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Toast de éxito */}
        {submitted && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700
                          rounded-xl px-4 py-3 mb-4 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            ¡Gracias! Tu sugerencia fue enviada.
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 mb-4">
          <button
            onClick={() => { setTab('add'); setShowForm(false); }}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
              tab === 'add'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Lightbulb className="w-4 h-4" />
            💡 Sumar
          </button>
          <button
            onClick={() => { setTab('remove'); setShowForm(false); }}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
              tab === 'remove'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Trash2 className="w-4 h-4" />
            🗑️ Quitar
          </button>
        </div>

        {/* Descripción de tab */}
        <p className="text-xs text-gray-500 mb-4">
          {tab === 'add'
            ? '¿Qué funcionalidad te gustaría ver en la app? Votá las ideas de otros o agregá la tuya.'
            : '¿Algo de la app que sea confuso, molesto o innecesario? Contanos qué quitarías.'}
        </p>

        {/* Formulario */}
        {showForm && (
          <NewFeedbackForm
            type={tab}
            onClose={() => setShowForm(false)}
            onSuccess={handleSuccess}
          />
        )}

        {/* Botón agregar */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed',
              'text-sm font-semibold transition-colors mb-4',
              tab === 'add'
                ? 'border-brand-300 text-brand-600 hover:bg-brand-50'
                : 'border-red-300 text-red-600 hover:bg-red-50',
            )}
          >
            <Plus className="w-4 h-4" />
            {tab === 'add' ? 'Agregar sugerencia' : 'Reportar problema o cosa a quitar'}
          </button>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">{tab === 'add' ? '💡' : '🗑️'}</p>
            <p className="font-medium text-gray-500">Todavía no hay sugerencias</p>
            <p className="text-sm mt-1">¡Sé el primero en agregar una!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <FeedbackCard key={item.id} item={item} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
