'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, MapPin, Clock, X, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';

interface CaseItem {
  id:              string;
  lastSeenCity?:   string;
  lastSeenAt:      string;
  reward?:         number;
  rewardCurrency?: string;
  dog: {
    name:   string;
    breed?: string;
    color:  string[];
    size:   string;
    photos: string[];
  };
}

const SIZE_LABELS: Record<string, string> = {
  small: 'Pequeño', medium: 'Mediano', large: 'Grande', extra_large: 'Extra grande',
};

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

export default function BuscarPage() {
  const [city,    setCity]    = useState('');
  const [query,   setQuery]   = useState('');
  const [page,    setPage]    = useState(1);
  const [results, setResults] = useState<CaseItem[] | null>(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const LIMIT = 12;

  // Auto-carga todos los casos al entrar a la página
  useEffect(() => { search('', 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = useCallback(async (cityVal: string, pageVal: number) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { limit: LIMIT, page: pageVal };
      if (cityVal.trim()) params.city = cityVal.trim();

      const res = await api.cases.list(params) as {
        data: CaseItem[];
        meta: { total: number };
      };
      setResults(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      setError('No se pudo cargar. ¿El servidor está corriendo?');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setPage(1);
    setQuery(city);
    search(city, 1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    search(query, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearSearch() {
    setCity('');
    setQuery('');
    setResults(null);
    setTotal(0);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-brand-500" />
          Buscar casos
        </h1>
        <p className="text-sm text-gray-500 mt-1">Filtrá por ciudad o buscá todos los casos activos.</p>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9 pr-8"
            placeholder="Ciudad (ej: Buenos Aires, Córdoba...)"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
          {city && (
            <button type="button" onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button type="submit" disabled={loading}
          className="btn-primary px-5 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4" />
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* Acceso rápido — ciudades populares (solo antes de que el usuario filtre) */}
      {!query && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Búsquedas frecuentes
          </p>
          <div className="flex flex-wrap gap-2">
            {['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata'].map(c => (
              <button
                key={c}
                onClick={() => { setCity(c); setQuery(c); search(c, 1); setPage(1); }}
                className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5
                           hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => { setCity(''); setQuery(''); search('', 1); setPage(1); }}
              className="text-sm bg-brand-50 border border-brand-200 rounded-xl px-3 py-1.5
                         text-brand-600 hover:bg-brand-100 transition-colors"
            >
              Ver todos →
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-full h-36 bg-gray-200 rounded-xl mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Resultados */}
      {!loading && results !== null && (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {total === 0
                ? 'Sin resultados'
                : `${total} caso${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}${query ? ` en "${query}"` : ''}`}
            </span>
            {query && (
              <button onClick={clearSearch} className="text-brand-500 hover:underline text-xs">
                Limpiar filtro
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card text-center py-10 space-y-2">
              <p className="text-gray-500">No hay casos activos{query ? ` en "${query}"` : ''}.</p>
              <p className="text-xs text-gray-400">Probá con otra ciudad o buscá todos los casos.</p>
              <button
                onClick={() => { setCity(''); setQuery(''); search('', 1); }}
                className="btn-secondary text-sm mt-2"
              >
                Ver todos los casos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map(c => (
                <Link key={c.id} href={`/casos/${c.id}`}
                  className="card hover:shadow-md transition-shadow group">
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
                      <div className="absolute top-2 right-2 bg-brand-500 text-white text-xs
                                      font-bold px-2 py-1 rounded-lg">
                        ${c.reward.toLocaleString()} {c.rewardCurrency}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900">{c.dog.name}</h3>
                  {c.dog.breed && (
                    <p className="text-sm text-gray-500">{c.dog.breed} · {SIZE_LABELS[c.dog.size]}</p>
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
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
