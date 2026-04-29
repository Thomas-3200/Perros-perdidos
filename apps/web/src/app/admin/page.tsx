'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import {
  ShieldCheck, AlertCircle, CheckCircle, XCircle,
  Clock, MapPin, Users, Search, BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

interface PendingMatch {
  id: string;
  totalScore: number;
  geoScore: number;
  timeScore: number;
  attributeScore: number;
  createdAt: string;
  lostCase: {
    id: string;
    lastSeenCity?: string;
    dog: {
      name: string;
      breed?: string;
      color: string[];
      size: string;
      photos: string[];
    };
    owner: { name: string; email: string };
  };
  sighting: {
    photos: string[];
    locationCity?: string;
    seenAt: string;
    dogStatus: string;
    description?: string;
    reporter: { name: string };
  };
}

interface AdminStats {
  users:     { total: number };
  cases:     { total: number; active: number; found: number };
  sightings: { total: number };
  matches:   { total: number; pendingMedium: number; pendingHigh: number; confirmed: number; rejected: number };
  reunions:  { total: number };
}

const DOG_STATUS_LABELS: Record<string, string> = {
  still_there: 'Sigue ahí', gone: 'Se fue', retained: 'Lo tengo',
  injured: 'Herido', unknown: 'Desconocido',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-400 rounded-full" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function AdminPage() {
  const router  = useRouter();
  const [page, setPage]       = useState(1);
  const [acting, setActing]   = useState<string | null>(null);
  const [toast, setToast]     = useState('');

  const { data: meData, isLoading: meLoading } = useSWR(
    isLoggedIn() ? 'admin-me' : null,
    () => api.users.me() as Promise<{ data: { id: string; name: string; email: string; role: string } }>,
  );
  const user = meData?.data;

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }
  }, [router]);

  useEffect(() => {
    if (!meLoading && user && user.role !== 'admin' && user.role !== 'moderator') {
      router.replace('/perfil');
    }
  }, [meLoading, user, router]);

  const { data: matchData, isLoading: matchLoading } = useSWR(
    `admin-pending-${page}`,
    () => api.admin.pendingMatches(page) as Promise<{ data: PendingMatch[]; meta: { total: number } }>,
  );

  const { data: statsData } = useSWR(
    'admin-stats',
    () => api.admin.stats() as Promise<{ data: AdminStats }>,
  );

  async function handleDecision(matchId: string, decision: 'approve' | 'reject') {
    setActing(matchId);
    try {
      await api.matches.review(matchId, decision);
      setToast(decision === 'approve' ? '✅ Match aprobado — dueño notificado' : '❌ Match rechazado');
      mutate(`admin-pending-${page}`);
      mutate('admin-stats');
    } catch {
      setToast('Error al procesar. Intenta de nuevo.');
    } finally {
      setActing(null);
      setTimeout(() => setToast(''), 3000);
    }
  }

  if (meLoading || !user) return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Verificando permisos...</p>
      </div>
    </div>
  );
  if (user.role !== 'admin' && user.role !== 'moderator') return null;

  const stats   = statsData?.data;
  const matches = matchData?.data ?? [];
  const total   = matchData?.meta.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-brand-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-xs text-gray-400">Moderación de matches y estadísticas</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-gray-800 text-white text-sm px-4 py-3 rounded-xl">
          {toast}
        </div>
      )}

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card text-center py-3">
            <div className="flex justify-center mb-1"><Users className="w-4 h-4 text-brand-400" /></div>
            <div className="text-xl font-bold text-gray-800">{stats.users.total}</div>
            <div className="text-xs text-gray-400">Usuarios</div>
          </div>
          <div className="card text-center py-3">
            <div className="flex justify-center mb-1"><Search className="w-4 h-4 text-red-400" /></div>
            <div className="text-xl font-bold text-gray-800">{stats.cases.active}</div>
            <div className="text-xs text-gray-400">Casos activos</div>
          </div>
          <div className="card text-center py-3">
            <div className="flex justify-center mb-1"><AlertCircle className="w-4 h-4 text-yellow-400" /></div>
            <div className="text-xl font-bold text-gray-800">{stats.matches.pendingMedium}</div>
            <div className="text-xs text-gray-400">Para revisar</div>
          </div>
          <div className="card text-center py-3">
            <div className="flex justify-center mb-1"><BarChart3 className="w-4 h-4 text-green-400" /></div>
            <div className="text-xl font-bold text-gray-800">{stats.reunions.total}</div>
            <div className="text-xs text-gray-400">Reunificados</div>
          </div>
        </div>
      )}

      {/* Cola de revisión */}
      <div>
        <h2 className="font-bold text-gray-800 mb-3">
          Matches pendientes de revisión
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({total} total)</span>}
        </h2>

        {matchLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-16 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!matchLoading && matches.length === 0 && (
          <div className="card text-center py-10">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">Sin matches pendientes</p>
            <p className="text-gray-400 text-sm mt-1">La cola de moderación está vacía.</p>
          </div>
        )}

        <div className="space-y-4">
          {matches.map(m => (
            <div key={m.id} className="card border border-yellow-100 bg-yellow-50/30 space-y-4">
              {/* Score total */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">
                  {Math.round(m.totalScore * 100)}% similitud
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  Media confianza
                </span>
              </div>

              {/* Imágenes lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">Perro perdido</p>
                  <div className="relative w-full h-28 rounded-xl overflow-hidden bg-gray-100">
                    {m.lostCase.dog.photos[0] ? (
                      <Image src={m.lostCase.dog.photos[0]} alt={m.lostCase.dog.name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-3xl">🐕</div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 mt-1.5">{m.lostCase.dog.name}</p>
                  {m.lostCase.dog.breed && <p className="text-xs text-gray-400">{m.lostCase.dog.breed}</p>}
                  <p className="text-xs text-gray-400">Dueño: {m.lostCase.owner.name}</p>
                  {m.lostCase.lastSeenCity && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{m.lostCase.lastSeenCity}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">Avistamiento</p>
                  <div className="relative w-full h-28 rounded-xl overflow-hidden bg-gray-100">
                    {m.sighting.photos[0] ? (
                      <Image src={m.sighting.photos[0]} alt="Avistamiento" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-3xl">📍</div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 mt-1.5">
                    {DOG_STATUS_LABELS[m.sighting.dogStatus] ?? m.sighting.dogStatus}
                  </p>
                  <p className="text-xs text-gray-400">Reportado por: {m.sighting.reporter.name}</p>
                  {m.sighting.locationCity && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{m.sighting.locationCity}
                    </p>
                  )}
                  {m.sighting.description && (
                    <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">{m.sighting.description}</p>
                  )}
                </div>
              </div>

              {/* Scores */}
              <div className="space-y-1.5">
                <ScoreBar label="Geo"    value={m.geoScore}       />
                <ScoreBar label="Tiempo" value={m.timeScore}      />
                <ScoreBar label="Atribs" value={m.attributeScore} />
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleDecision(m.id, 'approve')}
                  disabled={acting === m.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                             text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {acting === m.id ? 'Procesando...' : 'Aprobar'}
                </button>
                <button
                  onClick={() => handleDecision(m.id, 'reject')}
                  disabled={acting === m.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-red-50
                             text-red-600 border border-red-200 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </button>
              </div>

              {/* Ver caso */}
              <a
                href={`/casos/${m.lostCase.id}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-brand-500 hover:underline"
              >
                Ver caso completo →
              </a>
            </div>
          ))}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
