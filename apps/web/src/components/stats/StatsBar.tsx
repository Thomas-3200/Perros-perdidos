'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';

const STATS = [
  { key: 'reunions',      label: 'Perros reunificados', href: '/reuniones'    },
  { key: 'activeCases',   label: 'Casos activos hoy',   href: '/buscar'       },
  { key: 'totalSightings',label: 'Avistamientos',        href: '/avistamientos'},
] as const;

export function StatsBar() {
  const { data } = useSWR('stats', () => api.stats.get(), {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const s = data?.data;

  return (
    <section className="bg-white border-b border-gray-100 py-6 px-4">
      <div className="max-w-2xl mx-auto grid grid-cols-3 text-center gap-4">
        {STATS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col items-center gap-0.5 rounded-xl py-2 hover:bg-brand-50 transition-colors"
          >
            <span className="text-2xl font-bold text-brand-600 group-hover:text-brand-700 transition-colors">
              {s ? (s as Record<string, number>)[key].toLocaleString('es-AR') : '—'}
            </span>
            <span className="text-xs text-gray-500 group-hover:text-brand-600 transition-colors">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
