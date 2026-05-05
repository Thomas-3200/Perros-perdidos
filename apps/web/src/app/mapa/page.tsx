'use client';

import { useEffect, useState, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl';
import { MapPin, X, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface CaseItem {
  id:              string;
  lastSeenLat:     number;
  lastSeenLng:     number;
  lastSeenCity?:   string;
  lastSeenAt:      string;
  reward?:         number;
  rewardCurrency?: string;
  dog: {
    name:   string;
    breed?: string;
    size:   string;
    color:  string[];
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

export default function MapaPage() {
  const [cases,    setCases]    = useState<CaseItem[]>([]);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [viewState, setViewState] = useState({
    longitude: -63.6167,
    latitude:  -38.4161,
    zoom:      4.2,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.cases.list({ limit: 200 }) as {
          data: CaseItem[];
        };
        setCases(res.data ?? []);

        // Si hay casos, centrar en el primero
        if (res.data?.length > 0) {
          const c = res.data[0];
          setViewState(v => ({
            ...v,
            longitude: c.lastSeenLng,
            latitude:  c.lastSeenLat,
            zoom:      9,
          }));
        }
      } catch {
        setError('No se pudieron cargar los casos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleMarkerClick = useCallback((c: CaseItem) => {
    setSelected(c);
    setViewState(v => ({
      ...v,
      longitude: c.lastSeenLng,
      latitude:  c.lastSeenLat,
    }));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Cargando casos en el mapa…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 80px)' }}>

      {/* Contador flotante */}
      <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm
                      rounded-2xl shadow-md px-4 py-2 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-brand-500" />
        <span className="text-sm font-semibold text-gray-800">
          {cases.length === 0
            ? 'Sin casos activos'
            : `${cases.length} caso${cases.length !== 1 ? 's' : ''} activo${cases.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <Map
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelected(null)}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
        />

        {/* Markers */}
        {cases.map(c => (
          <Marker
            key={c.id}
            longitude={c.lastSeenLng}
            latitude={c.lastSeenLat}
            anchor="bottom"
            onClick={e => { e.originalEvent.stopPropagation(); handleMarkerClick(c); }}
          >
            <div className="cursor-pointer group">
              <div className={`
                w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden
                bg-brand-500 flex items-center justify-center
                transition-transform group-hover:scale-110
                ${selected?.id === c.id ? 'scale-125 ring-2 ring-brand-400' : ''}
              `}>
                {c.dog.photos[0] ? (
                  <Image
                    src={c.dog.photos[0]}
                    alt={c.dog.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-lg">🐕</span>
                )}
              </div>
              {/* Punta del pin */}
              <div className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '7px solid white',
                }}
              />
            </div>
          </Marker>
        ))}

        {/* Popup */}
        {selected && (
          <Popup
            longitude={selected.lastSeenLng}
            latitude={selected.lastSeenLat}
            anchor="top"
            offset={20}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setSelected(null)}
            maxWidth="280px"
          >
            <div className="p-1 min-w-[220px]">
              {/* Botón cerrar */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Foto */}
              <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gray-100 mb-2">
                {selected.dog.photos[0] ? (
                  <Image
                    src={selected.dog.photos[0]}
                    alt={selected.dog.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-5xl">🐕</div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="badge-active text-[10px] px-2 py-0.5">● Activo</span>
                </div>
                {selected.reward && (
                  <div className="absolute top-2 right-2 bg-brand-500 text-white text-[10px]
                                  font-bold px-1.5 py-0.5 rounded-md">
                    ${selected.reward.toLocaleString()} {selected.rewardCurrency}
                  </div>
                )}
              </div>

              {/* Info */}
              <h3 className="font-bold text-gray-900 text-sm">{selected.dog.name}</h3>
              {selected.dog.breed && (
                <p className="text-xs text-gray-500">
                  {selected.dog.breed} · {SIZE_LABELS[selected.dog.size] ?? selected.dog.size}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                {selected.lastSeenCity && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selected.lastSeenCity}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {daysAgo(selected.lastSeenAt)}
                </span>
              </div>

              <Link
                href={`/casos/${selected.id}`}
                className="mt-2 w-full btn-primary text-xs py-2 flex items-center justify-center gap-1"
              >
                Ver caso completo <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </Popup>
        )}
      </Map>

      {/* Estado vacío */}
      {cases.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center
                        gap-3 pointer-events-none">
          <div className="bg-white/95 rounded-2xl shadow-xl px-8 py-6 text-center max-w-xs">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="font-semibold text-gray-800">Sin casos activos</p>
            <p className="text-xs text-gray-500 mt-1">
              Cuando alguien reporte un perro perdido aparecerá aquí en el mapa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
