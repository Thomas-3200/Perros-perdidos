'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock, Phone } from 'lucide-react';
import { api } from '@/lib/api';

interface CaseItem {
  id:              string;
  lastSeenCity?:   string;
  lastSeenAt:      string;
  reward?:         number;
  rewardCurrency?: string;
  dog: {
    name:    string;
    breed?:  string;
    color:   string[];
    photos:  string[];
  };
}

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
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
    <div className="text-center text-gray-500 py-8">
      No se pudieron cargar los casos. ¿El servidor está corriendo?
    </div>
  );

  const cases: CaseItem[] = data?.data ?? [];

  if (cases.length === 0) return (
    <div className="text-center text-gray-500 py-8">
      No hay casos activos en tu zona por ahora 🐾
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cases.map((c) => (
        <Link key={c.id} href={`/casos/${c.id}`} className="card hover:shadow-md transition-shadow group">
          {/* Foto del perro */}
          <div className="relative w-full h-36 rounded-xl overflow-hidden bg-gray-100 mb-3">
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
            <div className="absolute top-2 left-2">
              <span className="badge-active">● Activo</span>
            </div>
            {c.reward && (
              <div className="absolute top-2 right-2 bg-brand-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                ${c.reward.toLocaleString()} {c.rewardCurrency}
              </div>
            )}
          </div>

          {/* Datos */}
          <h3 className="font-bold text-gray-900">{c.dog.name}</h3>
          {c.dog.breed && (
            <p className="text-sm text-gray-500">{c.dog.breed} · {c.dog.color.join(', ')}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {c.lastSeenCity && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {c.lastSeenCity}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {daysAgo(c.lastSeenAt)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
