'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Clock, Eye, ChevronLeft, Camera, X,
  ChevronRight, RefreshCw, AlertCircle, Sparkles, MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface SightingItem {
  id:               string;
  locationCity?:    string;
  locationAddress?: string;
  seenAt:           string;
  createdAt:        string;
  photos:           string[];
  dogStatus:        string;
  description?:     string;
  source:           string;
  matchCount?:      number;
  reporter?: {
    name: string;
    avatarUrl?: string;
    phone?: string;
  };
}

const STATUS: Record<string, { label: string; color: string }> = {
  still_there: { label: '📍 Sigue ahí', color: 'bg-green-100 text-green-700'   },
  gone:        { label: '🏃 Ya se fue', color: 'bg-yellow-100 text-yellow-700' },
  retained:    { label: '🏠 Lo tienen', color: 'bg-blue-100 text-blue-700'     },
  injured:     { label: '🚨 Lastimado', color: 'bg-red-100 text-red-700'       },
  // 'unknown' eliminado — no se muestra badge si no hay estado confirmado
};

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'justo ahora';
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/* ── Lightbox de imagen a pantalla completa ──────────────────────────────── */
function Lightbox({ photos, startIdx, onClose }: { photos: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, photos.length]);

  // Interceptar el botón "atrás" del navegador/celular para cerrar el lightbox
  // en vez de navegar a la página anterior. Empujamos un estado al historial al
  // montar y, cuando el usuario hace back, capturamos popstate y cerramos.
  useEffect(() => {
    let popped = false;
    window.history.pushState({ lightbox: true }, '');
    const handle = () => { popped = true; onClose(); };
    window.addEventListener('popstate', handle);
    return () => {
      window.removeEventListener('popstate', handle);
      // Si el lightbox se cierra por X o ESC (no por back), removemos el state
      // que empujamos para no dejar entradas zombi en el history.
      if (!popped) window.history.back();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Imagen */}
      <div className="relative w-full h-full" onClick={e => e.stopPropagation()}>
        <Image
          src={photos[idx]}
          alt="Foto completa"
          fill
          className="object-contain"
          sizes="100vw"
        />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2.5 hover:bg-black/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Navegación si hay más de 1 foto */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-3 hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIdx(i => (i + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-3 hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Contador */}
        {photos.length > 1 && (
          <span className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
            {idx + 1} / {photos.length}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Modal de detalle ───────────────────────────────────────────────────── */
function SightingModal({ s, onClose }: { s: SightingItem; onClose: () => void }) {
  const st = STATUS[s.dogStatus] ?? null;
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  // Re-fetchear el avistamiento para obtener el phone actualizado del reporter
  const [fresh, setFresh] = useState<SightingItem | null>(null);
  const data = fresh ?? s;

  useEffect(() => {
    api.sightings.get(s.id)
      .then((res: unknown) => {
        const r = res as { data: SightingItem };
        if (r?.data) setFresh(r.data);
      })
      .catch(() => {}); // silencioso — usa los datos base si falla
  }, [s.id]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  // Botón atrás del navegador/celular cierra el modal en vez de navegar fuera
  useEffect(() => {
    let popped = false;
    window.history.pushState({ sightingModal: true }, '');
    const handle = () => { popped = true; onClose(); };
    window.addEventListener('popstate', handle);
    return () => {
      window.removeEventListener('popstate', handle);
      if (!popped) window.history.back();
    };
  }, [onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const location = [data.locationAddress, data.locationCity].filter(Boolean).join(', ');

  return (
    <>
    {lightbox && data.photos.length > 0 && (
      <Lightbox photos={data.photos} startIdx={idx} onClose={() => setLightbox(false)} />
    )}
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Foto */}
        <div className="relative w-full h-64 bg-gray-100 flex-shrink-0">
          {data.photos.length > 0 ? (
            <>
              {/* Área clickeable para abrir lightbox */}
              <button
                className="absolute inset-0 z-10 w-full h-full cursor-zoom-in"
                onClick={() => setLightbox(true)}
                aria-label="Ver imagen completa"
              />
              <Image src={data.photos[idx]} alt="Avistamiento" fill className="object-cover" />
              {data.photos.length > 1 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + data.photos.length) % data.photos.length); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 z-20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % data.photos.length); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 z-20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                    {data.photos.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
              {/* Hint "toca para ampliar" */}
              <span className="absolute bottom-2 right-2 z-20 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md pointer-events-none">
                🔍 Ampliar
              </span>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-6xl">🐕</div>
          )}

          <button onClick={onClose} className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 z-20">
            <X className="w-4 h-4" />
          </button>

          {data.source === 'social_import' && (
            <span className="absolute top-3 left-3 text-xs bg-purple-600 text-white px-2 py-1 rounded-lg font-medium flex items-center gap-1 z-20">
              <Sparkles className="w-3 h-3" /> Red social
            </span>
          )}
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Estado + matches */}
          <div className="flex items-center gap-2 flex-wrap">
            {st && (
              <span className={`text-sm font-semibold px-3 py-1 rounded-xl ${st.color}`}>
                {st.label}
              </span>
            )}
            {(data.matchCount ?? 0) > 0 && (
              <span className="text-xs bg-brand-50 text-brand-600 px-2 py-1 rounded-lg font-semibold">
                🔍 {data.matchCount} caso{data.matchCount !== 1 ? 's' : ''} coincidente{data.matchCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Descripción */}
          {data.description && (
            <p className="text-sm text-gray-700 leading-relaxed">{data.description}</p>
          )}

          {/* Datos */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
            {location && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                <span>{location}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-brand-500 shrink-0" />
              <span>Visto {timeAgo(data.seenAt)} · Reportado {timeAgo(data.createdAt)}</span>
            </div>
          </div>

          {/* Botón de contacto con el reporter */}
          {data.reporter?.name && (
            data.reporter.phone ? (
              <a
                href={`https://wa.me/${data.reporter.phone!.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${data.reporter.name}, vi tu avistamiento en Perros Perdidos y me gustaría consultarte sobre el perro que reportaste.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20c05c] text-white font-semibold text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar mensaje a {data.reporter.name.split(' ')[0]}
              </a>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <MessageCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Reportado por {data.reporter.name}</p>
                  <p className="text-xs text-gray-400">No tiene teléfono cargado en su perfil</p>
                </div>
              </div>
            )
          )}

          <div className="space-y-2">
            <Link
              href="/reportar/avistamiento"
              className="btn-primary flex items-center justify-center gap-2 w-full"
              onClick={onClose}
            >
              <Camera className="w-4 h-4" />
              Reportar otro avistamiento
            </Link>
            <Link
              href="/buscar"
              className="btn-secondary flex items-center justify-center gap-2 w-full text-sm"
              onClick={onClose}
            >
              Ver casos activos →
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

/* ── Filtros de tiempo (por cuándo fue REPORTADO, no cuándo se vio) ──────── */
type FilterKey = 'today' | '3d' | '7d' | 'all';
const FILTERS: { key: FilterKey; label: string; days: number | null }[] = [
  { key: 'today', label: 'Hoy',            days: 1    },
  { key: '3d',    label: 'Últimos 3 días', days: 3    },
  { key: '7d',    label: 'Últimos 7 días', days: 7    },
  { key: 'all',   label: 'Todo',           days: null },
];

/* ── Página principal ───────────────────────────────────────────────────── */
export default function AvistamientosPage() {
  const [sightings,  setSightings]  = useState<SightingItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [filter,     setFilter]     = useState<FilterKey>('7d');
  const [selected,   setSelected]   = useState<SightingItem | null>(null);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const LIMIT = 30;

  const load = useCallback(async (f: FilterKey, p: number) => {
    setLoading(true);
    setError('');
    try {
      const filterDef = FILTERS.find(x => x.key === f)!;
      const params: Record<string, string | number> = { limit: LIMIT, page: p };

      // Filtrar por createdAt (cuándo fue reportado), no seenAt
      if (filterDef.days !== null) {
        const since = new Date(Date.now() - filterDef.days * 86_400_000).toISOString();
        params.since = since;
      }

      const res = await api.sightings.list(params) as {
        data: SightingItem[];
        meta: { total: number };
      };
      if (p === 1) {
        setSightings(res.data);
      } else {
        setSightings(prev => [...prev, ...res.data]);
      }
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      setError('No se pudieron cargar los avistamientos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    load(filter, 1);
  }, [filter, load]);

  function handleFilterChange(f: FilterKey) {
    setFilter(f);
    setSightings([]);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    load(filter, next);
  }

  const hasMore = sightings.length < total;

  return (
    <div className="min-h-screen bg-gray-50">

      {selected && <SightingModal s={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-500" />
            Avistamientos
          </h1>
          <p className="text-xs text-gray-400 truncate">Perros vistos y reportados por la comunidad</p>
        </div>
        <Link
          href="/reportar/avistamiento"
          className="text-xs bg-brand-500 text-white px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 shrink-0"
        >
          <Camera className="w-3.5 h-3.5" /> Reportar
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors whitespace-nowrap ${
                filter === f.key
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Contador */}
        {!loading && !error && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {total === 0
                ? 'Sin avistamientos'
                : `${total} avistamiento${total !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => load(filter, 1)}
              className="text-xs text-brand-600 flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Actualizar
            </button>
          </div>
        )}

        {/* Skeleton loading */}
        {loading && sightings.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card flex gap-4 animate-pulse">
                <div className="w-24 h-24 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card flex items-center gap-3 text-red-600 bg-red-50 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
              <p className="text-xs text-red-400 mt-0.5">El servidor puede estar despertando, intentá de nuevo en unos segundos.</p>
            </div>
            <button onClick={() => load(filter, 1)} className="text-xs underline font-medium">Reintentar</button>
          </div>
        )}

        {/* Lista */}
        {sightings.length > 0 && (
          <div className="space-y-3">
            {sightings.map(s => {
              const st = STATUS[s.dogStatus] ?? null;
              const location = s.locationAddress ?? s.locationCity ?? '';
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="card flex gap-4 w-full text-left hover:shadow-md active:scale-[0.99] transition-all"
                >
                  {/* Foto */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {s.photos[0] ? (
                      <Image src={s.photos[0]} alt="Perro avistado" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-3xl">🐕</div>
                    )}
                    {/* Indicador de foto */}
                    {s.photos.length > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                        +{s.photos.length - 1}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Badges superiores */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {st && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${st.color}`}>
                          {st.label}
                        </span>
                      )}
                      {s.source === 'social_import' && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg font-medium flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Red social
                        </span>
                      )}
                      {(s.matchCount ?? 0) > 0 && (
                        <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-lg font-semibold">
                          🔍 {s.matchCount} coincidencia{s.matchCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Descripción */}
                    {s.description ? (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-1.5">{s.description}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic mb-1.5">Sin descripción</p>
                    )}

                    {/* Ubicación y tiempo */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                      {location && (
                        <span className="flex items-center gap-1 truncate max-w-[180px]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {timeAgo(s.createdAt)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Cargar más */}
        {hasMore && !loading && (
          <button
            onClick={loadMore}
            className="w-full btn-secondary text-sm py-3"
          >
            Cargar más avistamientos
          </button>
        )}

        {/* Carga adicional (paginación) */}
        {loading && sightings.length > 0 && (
          <div className="text-center py-4 text-sm text-gray-400">Cargando más...</div>
        )}

        {/* Empty state */}
        {!loading && !error && sightings.length === 0 && (
          <div className="card text-center py-14 space-y-4">
            <div className="text-5xl">🐕</div>
            <div>
              <h2 className="font-bold text-gray-800">Sin avistamientos</h2>
              <p className="text-sm text-gray-500 mt-1">
                {filter === 'today'
                  ? 'Todavía no hay reportes de hoy.'
                  : `No hay reportes en este período.`}
              </p>
            </div>
            <div className="space-y-2">
              <Link href="/reportar/avistamiento" className="btn-primary inline-block">
                📍 Reportar un avistamiento
              </Link>
              <br />
              <Link href="/reportar/red-social" className="btn-secondary inline-block text-sm">
                📸 Vi un post en redes sociales
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
