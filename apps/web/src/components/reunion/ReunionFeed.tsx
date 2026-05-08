'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin } from 'lucide-react';
import { api } from '@/lib/api';

interface ReunionItem {
  id:               string;
  aiGeneratedStory?: string;
  storyText?:        string;
  photos:            string[];
  publishedAt?:      string;
  createdAt?:        string;
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

export function ReunionFeed({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, error } = useSWR(
    'reunion-feed',
    () => api.reunion.feed(1) as Promise<{ data: ReunionItem[] }>,
  );

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="w-full h-44 bg-gray-200 rounded-xl mb-3" />
          <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>
      ))}
    </div>
  );

  if (error || !data?.data?.length) return (
    <div className="card text-center py-10 space-y-2 border-2 border-dashed border-hope-200">
      <div className="text-4xl">🐾</div>
      <p className="text-gray-500 text-sm font-medium">Las primeras historias aparecerán aquí.</p>
      <p className="text-xs text-gray-400">¡Sé parte de la primera reunificación! 🎉</p>
    </div>
  );

  const stories = data.data.slice(0, limit);

  return (
    <div className="space-y-4">
      {stories.map((s) => {
        const photo   = s.photos[0] ?? s.lostCase.dog.photos[0];
        const story   = s.storyText ?? s.aiGeneratedStory ?? '';
        const excerpt = story.length > 140 ? story.slice(0, 140) + '…' : story;
        const reunionDate = s.publishedAt ?? s.createdAt ?? s.lostCase.lastSeenAt;

        return (
          <Link
            key={s.id}
            href={`/reuniones/${s.id}`}
            className="card block hover:shadow-md transition-all group active:scale-[0.99]"
          >
            {/* Foto grande */}
            <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100 mb-4">
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
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {/* Badge con tiempo transcurrido */}
              <div className="absolute top-3 left-3 bg-hope-500 text-white text-xs font-bold
                              px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                <Heart className="w-3.5 h-3.5 fill-current" />
                {daysAgo(reunionDate)}
              </div>
              {/* Nombre sobre imagen */}
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white font-bold text-lg drop-shadow-md leading-tight">
                  {s.lostCase.dog.name} volvió a casa 🎉
                </h3>
                {(s.lostCase.lastSeenCity || s.lostCase.dog.breed) && (
                  <p className="text-white/80 text-xs mt-0.5 flex items-center gap-1">
                    {s.lostCase.lastSeenCity && (
                      <><MapPin className="w-3 h-3" /> {s.lostCase.lastSeenCity}</>
                    )}
                    {s.lostCase.dog.breed && (
                      <span>{s.lostCase.lastSeenCity ? ' · ' : ''}{s.lostCase.dog.breed}</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Historia */}
            {excerpt && (
              <p className="text-sm text-gray-600 leading-relaxed italic">"{excerpt}"</p>
            )}
            <p className="text-brand-600 text-xs font-semibold mt-2 group-hover:underline">
              Leer historia completa →
            </p>
          </Link>
        );
      })}
    </div>
  );
}
