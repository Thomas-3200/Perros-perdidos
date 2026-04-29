'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export function StatsBar() {
  const { data } = useSWR('stats', () => api.stats.get(), {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const s = data?.data;

  return (
    <section className="bg-white border-b border-gray-100 py-6 px-4">
      <div className="max-w-2xl mx-auto grid grid-cols-3 text-center gap-4">
        <div>
          <div className="text-2xl font-bold text-brand-600">
            {s ? s.reunions.toLocaleString('es-AR') : '—'}
          </div>
          <div className="text-xs text-gray-500">Perros reunificados</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-brand-600">
            {s ? s.activeCases.toLocaleString('es-AR') : '—'}
          </div>
          <div className="text-xs text-gray-500">Casos activos hoy</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-brand-600">
            {s ? s.totalSightings.toLocaleString('es-AR') : '—'}
          </div>
          <div className="text-xs text-gray-500">Avistamientos</div>
        </div>
      </div>
    </section>
  );
}
