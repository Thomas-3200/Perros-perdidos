'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import {
  User, MapPin, Clock, ShieldCheck, AlertCircle,
  PlusCircle, LogOut, ChevronRight, Trash2, Eye, Share2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser, clearSession, isLoggedIn } from '@/lib/auth';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface MyCaseItem {
  id: string;
  status: 'active' | 'found' | 'closed';
  lastSeenCity?: string;
  lastSeenAt: string;
  createdAt: string;
  dog: { name: string; breed?: string; color: string[]; size: string; photos: string[] };
  _count: { matches: number };
}

interface MySighting {
  id: string;
  locationCity?: string;
  locationAddress?: string;
  seenAt: string;
  createdAt: string;
  photos: string[];
  description?: string;
  dogStatus?: string;
  source?: string;
}

interface MyImport {
  id: string;
  sourceType: string;
  status: 'pending' | 'processed' | 'rejected';
  createdAt: string;
  rawInput: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  active: { text: 'Activo',      className: 'bg-red-50   text-red-700'   },
  found:  { text: 'Reunificado', className: 'bg-green-50 text-green-700' },
  closed: { text: 'Cerrado',     className: 'bg-gray-100 text-gray-500'  },
};

const IMPORT_STATUS: Record<string, { text: string; className: string }> = {
  processed: { text: '✅ Procesado', className: 'text-green-600' },
  rejected:  { text: '⚠️ Rechazado', className: 'text-yellow-600' },
  pending:   { text: '⏳ Pendiente', className: 'text-gray-500'  },
};

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

// ── Modal de confirmación ──────────────────────────────────────────────────────
function ConfirmModal({
  message, onConfirm, onCancel, loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-gray-900">¿Eliminar publicación?</p>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 btn-secondary">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50">
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function PerfilPage() {
  const router = useRouter();
  const [localUser, setLocalUser] = useState(getUser());
  const [activeTab, setActiveTab] = useState<'casos' | 'avistamientos' | 'importaciones'>('casos');

  // Modal de confirmación
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/');
  }, [router]);

  const { data: casesData, isLoading: casesLoading, error: casesError } = useSWR(
    localUser ? 'cases-mine' : null,
    () => api.cases.mine() as Promise<{ data: MyCaseItem[] }>,
  );
  const { data: sightingsData, isLoading: sightingsLoading } = useSWR(
    localUser ? 'sightings-mine' : null,
    () => api.sightings.mine() as Promise<{ data: MySighting[] }>,
  );
  const { data: importsData, isLoading: importsLoading } = useSWR(
    localUser ? 'imports-mine' : null,
    () => api.ingest.myImports() as Promise<{ data: MyImport[] }>,
  );
  const { data: meData } = useSWR(
    localUser ? 'user-me' : null,
    () => api.users.me() as Promise<{ data: { name: string; email: string; role: string; createdAt: string } }>,
  );

  if (!localUser) return null;

  const me       = meData?.data;
  const cases    = casesData?.data ?? [];
  const sightings = sightingsData?.data ?? [];
  const imports  = importsData?.data ?? [];

  const activeCases  = cases.filter(c => c.status === 'active').length;
  const totalMatches = cases.reduce((sum, c) => sum + c._count.matches, 0);

  function askDelete(message: string, action: () => Promise<void>) {
    setConfirmModal({ message, onConfirm: action });
  }

  async function runDelete() {
    if (!confirmModal) return;
    setDeleting(true);
    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  async function deleteCase(id: string, name: string) {
    askDelete(
      `Se eliminará el caso de ${name} junto con todos sus datos. Esta acción no se puede deshacer.`,
      async () => {
        await api.cases.delete(id);
        mutate('cases-mine');
      },
    );
  }

  async function deleteSighting(id: string) {
    askDelete(
      'Se eliminará este avistamiento y sus datos asociados. Esta acción no se puede deshacer.',
      async () => {
        await api.sightings.delete(id);
        mutate('sightings-mine');
      },
    );
  }

  async function deleteImport(id: string) {
    askDelete(
      'Se eliminará esta publicación importada. Esta acción no se puede deshacer.',
      async () => {
        await api.ingest.deleteImport(id);
        mutate('imports-mine');
      },
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* Modal de confirmación */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={runDelete}
          onCancel={() => setConfirmModal(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <button
          onClick={() => { clearSession(); router.push('/'); }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      {/* Tarjeta de usuario */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <User className="w-7 h-7 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{me?.name ?? localUser.name}</p>
          <p className="text-sm text-gray-500 truncate">{me?.email ?? localUser.email}</p>
          {me?.role && me.role !== 'owner' && (
            <span className="inline-block mt-1 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {me.role}
            </span>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card py-4">
          <div className="text-2xl font-bold text-brand-600">{cases.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Casos</div>
        </div>
        <div className="card py-4">
          <div className="text-2xl font-bold text-red-500">{activeCases}</div>
          <div className="text-xs text-gray-500 mt-0.5">Activos</div>
        </div>
        <div className="card py-4">
          <div className="text-2xl font-bold text-brand-600">{totalMatches}</div>
          <div className="text-xs text-gray-500 mt-0.5">Matches</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'casos',         label: `Mis casos (${cases.length})` },
          { key: 'avistamientos', label: `Avistamientos (${sightings.length})` },
          { key: 'importaciones', label: `Importaciones (${imports.length})` },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MIS CASOS ─────────────────────────────────────────────────── */}
      {activeTab === 'casos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link href="/reportar/perdido" className="flex items-center gap-1 text-brand-500 text-sm font-medium hover:underline">
              <PlusCircle className="w-4 h-4" /> Nuevo caso
            </Link>
          </div>

          {casesLoading && <Skeleton />}
          {casesError && <ErrorCard text="No se pudieron cargar tus casos." />}
          {!casesLoading && cases.length === 0 && (
            <div className="card text-center py-8 space-y-3">
              <p className="text-gray-500 text-sm">Todavía no reportaste ningún caso.</p>
              <Link href="/reportar/perdido" className="btn-primary inline-flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Reportar perro perdido
              </Link>
            </div>
          )}

          {cases.map(c => {
            const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.closed;
            return (
              <div key={c.id} className="card flex items-center gap-4">
                {/* Foto */}
                <Link href={`/casos/${c.id}`} className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {c.dog.photos[0]
                    ? <Image src={c.dog.photos[0]} alt={c.dog.name} fill className="object-cover" />
                    : <div className="flex items-center justify-center h-full text-3xl">🐕</div>}
                </Link>

                {/* Info */}
                <Link href={`/casos/${c.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 truncate">{c.dog.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.className}`}>
                      {st.text}
                    </span>
                  </div>
                  {c.dog.breed && <p className="text-xs text-gray-400 truncate">{c.dog.breed}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {c.lastSeenCity && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.lastSeenCity}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{daysAgo(c.lastSeenAt)}</span>
                    {c._count.matches > 0 && (
                      <span className="flex items-center gap-1 text-brand-500 font-medium">
                        <ShieldCheck className="w-3 h-3" />{c._count.matches} match{c._count.matches > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Acciones */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Link href={`/casos/${c.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Ver caso">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => deleteCase(c.id, c.dog.name)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    title="Eliminar caso">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: AVISTAMIENTOS ─────────────────────────────────────────────── */}
      {activeTab === 'avistamientos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link href="/reportar/avistamiento" className="flex items-center gap-1 text-brand-500 text-sm font-medium hover:underline">
              <PlusCircle className="w-4 h-4" /> Reportar avistamiento
            </Link>
          </div>

          {sightingsLoading && <Skeleton />}
          {!sightingsLoading && sightings.length === 0 && (
            <div className="card text-center py-8 space-y-3">
              <p className="text-gray-500 text-sm">No reportaste ningún avistamiento todavía.</p>
              <Link href="/reportar/avistamiento" className="btn-primary inline-flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Reportar avistamiento
              </Link>
            </div>
          )}

          {sightings.map(s => (
            <div key={s.id} className="card flex items-center gap-4">
              {/* Foto */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {s.photos?.[0]
                  ? <Image src={s.photos[0]} alt="Avistamiento" fill className="object-cover" />
                  : <div className="flex items-center justify-center h-full text-3xl">👁️</div>}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">
                  {s.locationCity ?? 'Ubicación no especificada'}
                </p>
                {s.locationAddress && (
                  <p className="text-xs text-gray-400 truncate">{s.locationAddress}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{daysAgo(s.createdAt)}</span>
                  {s.source === 'social_import' && (
                    <span className="flex items-center gap-1 text-blue-500"><Share2 className="w-3 h-3" />Red social</span>
                  )}
                </div>
                {s.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{s.description}</p>
                )}
              </div>

              {/* Eliminar */}
              <button
                onClick={() => deleteSighting(s.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                title="Eliminar avistamiento">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: IMPORTACIONES ─────────────────────────────────────────────── */}
      {activeTab === 'importaciones' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link href="/reportar/red-social" className="flex items-center gap-1 text-brand-500 text-sm font-medium hover:underline">
              <PlusCircle className="w-4 h-4" /> Importar post
            </Link>
          </div>

          {importsLoading && <Skeleton />}
          {!importsLoading && imports.length === 0 && (
            <div className="card text-center py-8 space-y-3">
              <p className="text-gray-500 text-sm">No importaste ningún post de redes sociales.</p>
              <Link href="/reportar/red-social" className="btn-primary inline-flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Importar de redes
              </Link>
            </div>
          )}

          {imports.map(imp => {
            const st = IMPORT_STATUS[imp.status] ?? IMPORT_STATUS.pending;
            const isImage = imp.sourceType === 'screenshot' || imp.sourceType === 'photo';
            return (
              <div key={imp.id} className="card flex items-center gap-4">
                {/* Miniatura si es imagen */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {isImage && imp.rawInput.startsWith('http')
                    ? <Image src={imp.rawInput} alt="Post importado" fill className="object-cover" />
                    : <div className="flex items-center justify-center h-full text-2xl">
                        {imp.sourceType === 'text' ? '📝' : imp.sourceType === 'link' ? '🔗' : '📸'}
                      </div>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 capitalize">{imp.sourceType}</span>
                    <span className={`text-xs font-medium ${st.className}`}>{st.text}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{daysAgo(imp.createdAt)}</p>
                  {imp.sourceType === 'text' && (
                    <p className="text-xs text-gray-500 truncate mt-1">{imp.rawInput.slice(0, 60)}…</p>
                  )}
                </div>

                {/* Eliminar */}
                <button
                  onClick={() => deleteImport(imp.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Eliminar importación">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Acceso admin */}
      {(me?.role === 'admin' || me?.role === 'moderator') && (
        <Link href="/admin" className="card flex items-center gap-3 hover:shadow-md transition-shadow border-brand-200">
          <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">Panel de administración</p>
            <p className="text-xs text-gray-500">Revisar matches pendientes y estadísticas</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </Link>
      )}
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="card animate-pulse flex gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div className="card flex items-center gap-3 text-red-600">
      <AlertCircle className="w-5 h-5 shrink-0" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
