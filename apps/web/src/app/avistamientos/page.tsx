'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock, Eye, ChevronLeft, Camera } from 'lucide-react';
import { api } from '@/lib/api';

interface SightingItem {
  id:              string;
  locationCity?:   string;
  locationAddress?: string;
  seenAt:          string;
  photos:          string[];
  dogStatus:       string;
  description?:    string;
  source:          string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  still_there: { label: '📍 Sigue ahí',     color: 'bg-green-100 text-green-700'  },
  gone:        { label: '🏃 Se fue',         color: 'bg-yellow-100 text-yellow-700' },
  retained:    { label: '🏠 Lo tienen',      color: 'bg-blue-100 text-blue-700'    },
  injured:     { label: '🚨 Lastimado',       color: 'bg-red-100 text-red-700'      },
  unknown:     { label: '❓ Sin confirmar',   color: 'bg-gray-100 text-gray-600'    },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

type FilterDays = 1 | 3 | 7;

export default function AvistamientosPage() {
  const [sightings, setSightings] = useState<SightingItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [days,      setDays]      = useState<FilterDays>(7);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.sightings.list({ limit: 50, page: 1 }) as {
          data: SightingItem[];
        };

        // Filtrar por días seleccionados
        const cutoff = Date.now() - days * 86_400_000;
        const filtered = res.data.filter(
          s => new Date(s.seenAt).getTime() >= cutoff,
        );
        setSightings(filtered);
      } catch {
        setError('No se pudo cargar. ¿El servidor está activo?');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [days]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-500" />
            Avistamientos recientes
          </h1>
          <p className="text-xs text-gray-400">Perros vistos por la comunidad</p>
        </div>
        <Link href="/reportar/avistamiento"
          className="text-xs bg-brand-500 text-white px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Reportar
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Filtro de días */}
        <div className="flex gap-2">
          {([1, 3, 7] as FilterDays[]).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                days === d
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {d === 1 ? 'Hoy' : `Últimos ${d} días`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse flex gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Sin resultados */}
        {!loading && !error && sightings.length === 0 && (
          <div className="card text-center py-14 space-y-3">
            <div className="text-5xl">🐕</div>
            <h2 className="font-bold text-gray-800">Sin avistamientos recientes</h2>
            <p className="text-sm text-gray-500">
              No se reportaron perros {days === 1 ? 'hoy' : `en los últimos ${days} días`}.
            </p>
            <Link href="/reportar/avistamiento" className="btn-primary inline-block mt-2">
              Reportar un avistamiento
            </Link>
          </div>
        )}

        {/* Lista */}
        {!loading && sightings.length > 0 && (
          <>
            <p className="text-sm text-gray-500">
              {sightings.length} avistamiento{sightings.length !== 1 ? 's' : ''}{' '}
              {days === 1 ? 'de hoy' : `de los últimos ${days} días`}
            </p>

            <div className="space-y-3">
              {sightings.map(s => {
                const status = STATUS_LABELS[s.dogStatus] ?? STATUS_LABELS.unknown;
                return (
                  <div key={s.id} className="card flex gap-4">
                    {/* Foto */}
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {s.photos[0] ? (
                        <Image src={s.photos[0]} alt="Perro avistado" fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-3xl">🐕</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${status.color}`}>
                          {status.label}
                        </span>
                        {s.source === 'social_import' && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-lg font-medium">
                            Red social
                          </span>
                        )}
                      </div>

                      {s.description && (
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">{s.description}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        {(s.locationCity || s.locationAddress) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {s.locationAddress ?? s.locationCity}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {timeAgo(s.seenAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
