'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock, Eye } from 'lucide-react';
import { api } from '@/lib/api';

interface CaseItem {
  id:              string;
  lastSeenCity?:   string;
  lastSeenAt:      string;
  reward?:         number;
  rewardCurrency?: string;
  matchCount?:     number;
  dog: {
    name:    string;
    breed?:  string;
    color:   string[];
    photos:  string[];
  };
}

function urgencyLabel(lastSeenAt: string): { label: string; color: string } {
  const days = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000);
  if (days === 0) return { label: '¡Perdido hoy!',    color: 'bg-red-500 text-white' };
  if (days <= 2)  return { label: `${days}d perdido`, color: 'bg-orange-500 text-white' };
  return              { label: `${days}d perdido`,    color: 'bg-gray-600 text-white' };
}

export function ActiveCasesFeed() {
  const { data, error, isLoading } = useSWR(
    'cases-active',
    () => api.cases.list({ limit: 6 }) as Promise<{ data: CaseItem[] }>,
  );

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="w-full h-36 bg-gray-200 rounded-xl mb-3" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="text-center text-gray-500 py-8 text-sm">
      No se pudieron cargar los casos.
    </div>
  );

  const cases: CaseItem[] = data?.data ?? [];

  if (cases.length === 0) return (
    <div className="card text-center py-10 space-y-2">
      <div className="text-4xl">🐾</div>
      <p className="text-gray-500 text-sm">No hay casos activos por ahora.</p>
      <Link href="/reportar/perdido" className="btn-primary inline-block text-sm mt-1">
        Reportar un perro perdido
      </Link>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cases.map((c) => {
        const urgency = urgencyLabel(c.lastSeenAt);
        return (
          <Link key={c.id} href={`/casos/${c.id}`}
            className="card hover:shadow-md transition-all group active:scale-[0.98]">
            {/* Foto */}
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100 mb-3">
              {c.dog.photos[0] ? (
                <Image
                  src={c.dog.photos[0]}
                  alt={c.dog.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-5xl">🐕</div>
              )}
              {/* Urgency badge */}
              <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-lg ${urgency.color}`}>
                {urgency.label}
              </div>
              {/* Reward */}
              {c.reward && (
                <div className="absolute top-2 right-2 bg-brand-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                  ${c.reward.toLocaleString()} recompensa
                </div>
              )}
              {/* Gradient overlay bottom */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Datos */}
            <h3 className="font-bold text-gray-900 text-base">{c.dog.name}</h3>
            {c.dog.breed && (
              <p className="text-sm text-gray-500">{c.dog.breed}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {c.lastSeenCity && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {c.lastSeenCity}
                  </span>
                )}
              </div>
              {/* Avistajes indicator */}
              {(c.matchCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-xs text-brand-600 font-semibold bg-brand-50 px-2 py-0.5 rounded-full">
                  <Eye className="w-3 h-3" /> {c.matchCount} avistaje{c.matchCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
