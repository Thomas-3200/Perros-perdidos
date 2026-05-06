'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';

interface ReunionItem {
  id:               string;
  aiGeneratedStory?: string;
  storyText?:        string;
  photos:            string[];
  publishedAt?:      string;
  lostCase: {
    lastSeenCity?: string;
    lastSeenAt:    string;
    dog: {
      name:   string;
      breed?: string;
      photos: string[];
    };
  };
}

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

export default function ReunionesPage() {
  const { data, isLoading, error } = useSWR(
    'reunion-feed-all',
    () => api.reunion.feed(1) as Promise<{ data: ReunionItem[] }>,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-hope-500 fill-current" />
            Reunificaciones
          </h1>
          <p className="text-xs text-gray-400">Historias de perros que volvieron a casa</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Loading skeleton */}
        {isLoading && (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded-xl mb-4" />
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-full mb-1" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="card text-center py-10 space-y-3">
            <p className="text-gray-500">No se pudo cargar.</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary text-sm"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Sin historias */}
        {!isLoading && !error && (!data?.data?.length) && (
          <div className="card text-center py-16 space-y-3">
            <div className="text-6xl">🐾</div>
            <h2 className="font-bold text-gray-800">Pronto habrá historias aquí</h2>
            <p className="text-sm text-gray-500">
              Las primeras reunificaciones aparecerán cuando un caso se cierre exitosamente.
            </p>
            <Link href="/buscar" className="btn-primary inline-block mt-2">
              Ver casos activos
            </Link>
          </div>
        )}

        {/* Feed de reuniones */}
        {!isLoading && data?.data?.map((s) => {
          const photo   = s.photos[0] ?? s.lostCase.dog.photos[0];
          const story   = s.storyText ?? s.aiGeneratedStory ?? '';
          const excerpt = story.length > 200 ? story.slice(0, 200) + '…' : story;

          return (
            <Link
              key={s.id}
              href={`/reuniones/${s.id}`}
              className="card hover:shadow-md transition-shadow block group"
            >
              {/* Foto */}
              <div className="relative w-full h-52 rounded-xl overflow-hidden bg-gray-100 mb-4">
                {photo ? (
                  <Image
                    src={photo}
                    alt={s.lostCase.dog.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-6xl">🐶</div>
                )}
                <div className="absolute top-3 left-3 bg-hope-500 text-white text-xs font-bold
                                px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 fill-current" /> Reunificado
                </div>
              </div>

              {/* Info */}
              <h2 className="font-bold text-gray-900 text-lg mb-1">
                {s.lostCase.dog.name} volvió a casa 🎉
              </h2>
              {s.lostCase.dog.breed && (
                <p className="text-sm text-gray-500 mb-2">{s.lostCase.dog.breed}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                {s.lostCase.lastSeenCity && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {s.lostCase.lastSeenCity}
                  </span>
                )}
                <span>Reunificado {daysAgo(s.publishedAt ?? s.lostCase.lastSeenAt)}</span>
              </div>
              {excerpt && (
                <p className="text-sm text-gray-600 leading-relaxed">{excerpt}</p>
              )}
              <p className="text-brand-600 text-sm font-medium mt-3">Leer historia completa →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
