'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import {
  User, MapPin, Clock, ShieldCheck, AlertCircle,
  PlusCircle, LogOut, ChevronRight, Trash2, Eye, Share2,
  Camera, Pencil, X, Loader2, Check, Heart, Bell,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser, clearSession, isLoggedIn, saveSession } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';

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
  extractedData?: {
    description?: string;
    city?: string;
    address?: string;
    date?: string;
    photos?: string[];
    [key: string]: unknown;
  };
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

// ── Modal de edición de perfil ────────────────────────────────────────────────
function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: { name: string; phone?: string; locationCity?: string; avatarUrl?: string };
  onClose: () => void;
  onSaved: (updated: { name: string; phone?: string; locationCity?: string; avatarUrl?: string }) => void;
}) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [name,       setName]       = useState(user.name);
  const [phone,      setPhone]      = useState(user.phone ?? '');
  const [city,       setCity]       = useState(user.locationCity ?? '');
  const [avatarUrl,  setAvatarUrl]  = useState(user.avatarUrl ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let newAvatarUrl = user.avatarUrl ?? '';

      // 1. Subir avatar si cambió
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const avatarRes = await api.users.uploadAvatar(fd) as { data: { avatarUrl: string } };
        newAvatarUrl = avatarRes.data.avatarUrl;
      }

      // 2. Actualizar datos de perfil
      const updated = await api.users.updateMe({
        name:         name.trim(),
        phone:        phone.trim() || undefined,
        locationCity: city.trim()  || undefined,
      }) as { data: { name: string; phone?: string; locationCity?: string; avatarUrl?: string } };

      onSaved({ ...updated.data, avatarUrl: newAvatarUrl || updated.data.avatarUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Editar perfil</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-brand-100 group"
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <User className="w-9 h-9 text-brand-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center
                              opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-brand-500 font-medium hover:underline flex items-center gap-1">
              <Camera className="w-3 h-3" /> Cambiar foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              required
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Teléfono</label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej: +54 11 1234-5678"
            />
          </div>

          {/* Ciudad */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Ciudad</label>
            <input
              className="input"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ej: Buenos Aires"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

// ── Opciones de estado del perro ──────────────────────────────────────────────
const SIGHTING_STATUS_OPTIONS = [
  { value: 'still_there', label: '📍 Sigue ahí'   },
  { value: 'gone',        label: '🏃 Ya se fue'   },
  { value: 'retained',    label: '🏠 Lo tienen'    },
  { value: 'injured',     label: '🚨 Lastimado'    },
  { value: 'unknown',     label: '❓ No sé'          },
];

// ── Modal de edición de avistamiento ─────────────────────────────────────────
function EditSightingModal({
  sighting,
  onClose,
  onSaved,
}: {
  sighting: MySighting;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dogStatus,    setDogStatus]    = useState(sighting.dogStatus ?? 'unknown');
  const [description,  setDescription]  = useState(sighting.description ?? '');
  const [city,         setCity]         = useState(sighting.locationCity ?? '');
  const [address,      setAddress]      = useState(sighting.locationAddress ?? '');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.sightings.update(sighting.id, {
        dogStatus,
        description:     description.trim() || undefined,
        locationCity:    city.trim()         || undefined,
        locationAddress: address.trim()      || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Editar avistamiento</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Estado del perro */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Estado del perro</label>
            <div className="grid grid-cols-1 gap-1.5">
              {SIGHTING_STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDogStatus(opt.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    dogStatus === opt.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-brand-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ciudad */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Ciudad</label>
            <input
              className="input"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ej: Buenos Aires"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Dirección / Zona</label>
            <input
              className="input"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ej: Av. Corrientes 1234, Palermo"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripción</label>
            <textarea
              className="input resize-none h-24"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Color, tamaño, collar, comportamiento..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de detalle de importación ───────────────────────────────────────────
function ImportDetailModal({
  imp,
  onClose,
}: {
  imp: MyImport;
  onClose: () => void;
}) {
  const st = IMPORT_STATUS[imp.status] ?? IMPORT_STATUS.pending;
  const isImageUrl = imp.rawInput.startsWith('http') &&
    (imp.sourceType === 'screenshot' || imp.sourceType === 'photo');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Detalle de importación</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Estado y tipo */}
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-semibold capitalize">
            {imp.sourceType === 'link' ? '🔗 Link' : imp.sourceType === 'text' ? '📝 Texto' : '📸 Imagen'}
          </span>
          <span className={`text-sm font-medium ${st.className}`}>{st.text}</span>
          <span className="text-xs text-gray-400 ml-auto">{daysAgo(imp.createdAt)}</span>
        </div>

        {/* Contenido */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contenido</p>
          {isImageUrl ? (
            <img
              src={imp.rawInput}
              alt="Imagen importada"
              className="w-full rounded-lg object-contain max-h-52 bg-white"
            />
          ) : imp.sourceType === 'link' ? (
            <a
              href={imp.rawInput}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 break-all hover:underline"
            >
              {imp.rawInput}
            </a>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {imp.rawInput}
            </p>
          )}
        </div>

        {/* Datos extraídos por IA */}
        {imp.extractedData && Object.keys(imp.extractedData).length > 0 && (
          <div className="bg-brand-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Datos extraídos por IA</p>
            <div className="space-y-1 text-sm text-gray-700">
              {imp.extractedData.description && (
                <p><span className="font-medium text-gray-500">Descripción:</span> {String(imp.extractedData.description)}</p>
              )}
              {imp.extractedData.city && (
                <p><span className="font-medium text-gray-500">Ciudad:</span> {String(imp.extractedData.city)}</p>
              )}
              {imp.extractedData.address && (
                <p><span className="font-medium text-gray-500">Dirección:</span> {String(imp.extractedData.address)}</p>
              )}
              {imp.extractedData.date && (
                <p><span className="font-medium text-gray-500">Fecha:</span> {String(imp.extractedData.date)}</p>
              )}
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-secondary w-full">Cerrar</button>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function PerfilPage() {
  const router = useRouter();
  // localUser empieza null para evitar mismatch SSR/cliente (localStorage no existe en servidor)
  const [localUser,      setLocalUser]      = useState<import('@/lib/auth').StoredUser | null>(null);
  const [ready,          setReady]          = useState(false);
  const [activeTab,      setActiveTab]      = useState<'casos' | 'avistamientos' | 'importaciones'>('casos');
  const [editingProfile, setEditingProfile] = useState(false);

  // Modal de confirmación
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modales de edición / detalle
  const [editingSighting, setEditingSighting] = useState<MySighting | null>(null);
  const [viewingImport,   setViewingImport]   = useState<MyImport   | null>(null);

  // Solo en cliente: leer localStorage una vez montado
  useEffect(() => {
    const user = getUser();
    if (user && isLoggedIn()) {
      setLocalUser(user);
    }
    // si no hay user → localUser queda null, se muestra AuthModal
    setReady(true);
  }, []);

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
    () => api.users.me() as Promise<{ data: {
      name: string; email: string; role: string; createdAt: string;
      avatarUrl?: string; phone?: string; locationCity?: string; locationCountry?: string;
    } }>,
  );

  // Mientras leemos localStorage mostramos spinner
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No logueado → modal de auth
  if (!localUser) {
    return (
      <AuthModal
        onSuccess={() => {
          setLocalUser(getUser());
        }}
        onClose={() => router.replace('/')}
      />
    );
  }

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

      {/* Modal de edición de perfil */}
      {editingProfile && me && (
        <EditProfileModal
          user={me}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            // Actualizar caché SWR y localStorage
            mutate('user-me');
            if (localUser) {
              const newUser = { ...localUser, name: updated.name };
              setLocalUser(newUser);
              saveSession(localStorage.getItem('pp_token') ?? '', newUser);
            }
            setEditingProfile(false);
          }}
        />
      )}

      {/* Modal de edición de avistamiento */}
      {editingSighting && (
        <EditSightingModal
          sighting={editingSighting}
          onClose={() => setEditingSighting(null)}
          onSaved={() => {
            mutate('sightings-mine');
            setEditingSighting(null);
          }}
        />
      )}

      {/* Modal de detalle de importación */}
      {viewingImport && (
        <ImportDetailModal
          imp={viewingImport}
          onClose={() => setViewingImport(null)}
        />
      )}

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
        <Link href="/notificaciones" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-brand-500">
          <Bell className="w-5 h-5" />
        </Link>
      </div>

      {/* Tarjeta de usuario */}
      <div className="card flex items-center gap-4">
        {/* Avatar */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-brand-100 shrink-0">
          {me?.avatarUrl ? (
            <Image src={me.avatarUrl} alt={me.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <User className="w-8 h-8 text-brand-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{me?.name ?? localUser.name}</p>
          <p className="text-sm text-gray-500 truncate">{me?.email ?? localUser.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {me?.locationCity && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3" />{me.locationCity}
              </span>
            )}
            {me?.role && me.role !== 'owner' && (
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium capitalize">
                {me.role}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditingProfile(true)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-brand-500 transition-colors"
            title="Editar perfil"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
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

      {/* ── Alertas de coincidencias ─────────────────────────────────────── */}
      {cases.filter(c => c.status === 'active' && c._count.matches > 0).map(c => (
        <Link
          key={c.id}
          href={`/casos/${c.id}`}
          className="flex items-start gap-3 bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3 hover:bg-green-100 transition-colors"
        >
          <div className="text-2xl shrink-0">🐾</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-green-800 text-sm leading-tight">
              Encontramos {c._count.matches} posible{c._count.matches > 1 ? 's' : ''} coincidencia{c._count.matches > 1 ? 's' : ''} para {c.dog.name}
            </p>
            <p className="text-green-700 text-xs mt-0.5 leading-tight">
              Este perro coincide con la información que cargaste. ¡Entrá a chequearlo!
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
        </Link>
      ))}

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
                  {c.status === 'active' && (
                    <Link href={`/casos/${c.id}/editar`}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                      title="Editar caso">
                      <Pencil className="w-4 h-4" />
                    </Link>
                  )}
                  {c.status === 'active' && (
                    <Link href={`/casos/${c.id}/encontre`}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors"
                      title="¡Lo encontré!">
                      <Heart className="w-4 h-4" />
                    </Link>
                  )}
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
              {/* Foto — clickeable para editar */}
              <button
                onClick={() => setEditingSighting(s)}
                className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0"
              >
                {s.photos?.[0]
                  ? <Image src={s.photos[0]} alt="Avistamiento" fill className="object-cover" />
                  : <div className="flex items-center justify-center h-full text-3xl">👁️</div>}
              </button>

              {/* Info — clickeable para editar */}
              <button
                onClick={() => setEditingSighting(s)}
                className="flex-1 min-w-0 text-left"
              >
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
              </button>

              {/* Acciones */}
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => setEditingSighting(s)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                  title="Editar avistamiento">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteSighting(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar avistamiento">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
                {/* Miniatura — clickeable para ver detalle */}
                <button
                  onClick={() => setViewingImport(imp)}
                  className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0"
                >
                  {isImage && imp.rawInput.startsWith('http')
                    ? <Image src={imp.rawInput} alt="Post importado" fill className="object-cover" />
                    : <div className="flex items-center justify-center h-full text-2xl">
                        {imp.sourceType === 'text' ? '📝' : imp.sourceType === 'link' ? '🔗' : '📸'}
                      </div>}
                </button>

                {/* Info — clickeable para ver detalle */}
                <button
                  onClick={() => setViewingImport(imp)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 capitalize">{imp.sourceType}</span>
                    <span className={`text-xs font-medium ${st.className}`}>{st.text}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{daysAgo(imp.createdAt)}</p>
                  {imp.sourceType === 'text' && (
                    <p className="text-xs text-gray-500 truncate mt-1">{imp.rawInput.slice(0, 60)}…</p>
                  )}
                </button>

                {/* Acciones */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setViewingImport(imp)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                    title="Ver detalle">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteImport(imp.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    title="Eliminar importación">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Donar */}
      <Link
        href="/donar"
        className="card flex items-center gap-3 hover:shadow-md transition-shadow border-hope-200 bg-hope-50"
      >
        <Heart className="w-5 h-5 text-hope-500 fill-current shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-gray-800 text-sm">Apoyá la plataforma</p>
          <p className="text-xs text-gray-500">Donaciones voluntarias para mantener la app gratuita</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
      </Link>

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
