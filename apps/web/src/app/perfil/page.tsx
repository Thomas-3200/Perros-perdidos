'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import {
  User, MapPin, Clock, ShieldCheck, AlertCircle,
  PlusCircle, LogOut, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser, clearSession, isLoggedIn } from '@/lib/auth';

interface MyCaseItem {
  id: string;
  status: 'active' | 'found' | 'closed';
  lastSeenCity?: string;
  lastSeenAt: string;
  createdAt: string;
  dog: {
    name: string;
    breed?: string;
    color: string[];
    size: string;
    photos: string[];
  };
  _count: { matches: number };
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  active: { text: 'Activo',       className: 'bg-red-50   text-red-700'   },
  found:  { text: 'Reunificado',  className: 'bg-green-50 text-green-700' },
  closed: { text: 'Cerrado',      className: 'bg-gray-100 text-gray-500'  },
};

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

export default function PerfilPage() {
  const router = useRouter();
  const [localUser, setLocalUser] = useState(getUser());

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/');
  }, [router]);

  const { data, isLoading, error } = useSWR(
    localUser ? 'cases-mine' : null,
    () => api.cases.mine() as Promise<{ data: MyCaseItem[] }>,
  );

  const { data: meData } = useSWR(
    localUser ? 'user-me' : null,
    () => api.users.me() as Promise<{ data: { name: string; email: string; role: string; createdAt: string } }>,
  );

  function handleLogout() {
    clearSession();
    router.push('/');
  }

  if (!localUser) return null;

  const me = meData?.data;
  const cases = data?.data ?? [];
  const activeCases  = cases.filter(c => c.status === 'active').length;
  const totalMatches = cases.reduce((sum, c) => sum + c._count.matches, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Salir
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
          <div className="text-xs text-gray-500 mt-0.5">Casos totales</div>
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

      {/* Mis casos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800">Mis casos</h2>
          <Link href="/reportar/perdido" className="flex items-center gap-1 text-brand-500 text-sm font-medium hover:underline">
            <PlusCircle className="w-4 h-4" /> Nuevo caso
          </Link>
        </div>

        {isLoading && (
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
        )}

        {error && (
          <div className="card flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">No se pudieron cargar tus casos.</p>
          </div>
        )}

        {!isLoading && cases.length === 0 && (
          <div className="card text-center py-8 space-y-3">
            <p className="text-gray-500 text-sm">Todavía no reportaste ningún caso.</p>
            <Link href="/reportar/perdido" className="btn-primary inline-flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              Reportar perro perdido
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {cases.map(c => {
            const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.closed;
            return (
              <Link key={c.id} href={`/casos/${c.id}`} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                {/* Foto */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {c.dog.photos[0] ? (
                    <Image src={c.dog.photos[0]} alt={c.dog.name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-3xl">🐕</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 truncate">{c.dog.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.className}`}>
                      {st.text}
                    </span>
                  </div>
                  {c.dog.breed && (
                    <p className="text-xs text-gray-400 truncate">{c.dog.breed}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {c.lastSeenCity && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {c.lastSeenCity}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {daysAgo(c.lastSeenAt)}
                    </span>
                    {c._count.matches > 0 && (
                      <span className="flex items-center gap-1 text-brand-500 font-medium">
                        <ShieldCheck className="w-3 h-3" /> {c._count.matches} match{c._count.matches > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Acceso rápido admin (solo para moderadores/admin) */}
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
