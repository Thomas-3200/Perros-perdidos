'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';

interface ReunionItem {
  id:              string;
  aiGeneratedStory?: string;
  storyText?:       string;
  photos:           string[];
  publishedAt?:     string;
  lostCase: {
    lastSeenCity?: string;
    dog: {
      name:   string;
      breed?: string;
      photos: string[];
    };
  };
}

export function ReunionFeed({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, error } = useSWR(
    'reunion-feed',
    () => api.reunion.feed(1) as Promise<{ data: ReunionItem[] }>,
  );

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="card animate-pulse flex gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );

  if (error || !data?.data?.length) return (
    <div className="text-center text-gray-400 py-6">
      Las primeras historias aparecerán aquí. ¡Sé el primero en cerrar un caso! 🎉
    </div>
  );

  const stories = data.data.slice(0, limit);

  return (
    <div className="space-y-4">
      {stories.map((s) => {
        const photo = s.photos[0] ?? s.lostCase.dog.photos[0];
        const story = s.storyText ?? s.aiGeneratedStory ?? '';
        const excerpt = story.length > 120 ? story.slice(0, 120) + '…' : story;

        return (
          <Link key={s.id} href={`/reuniones/${s.id}`} className="card flex gap-4 hover:shadow-md transition-shadow">
            {/* Foto */}
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              {photo ? (
                <Image src={photo} alt={s.lostCase.dog.name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-3xl">🐶</div>
              )}
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-hope-500 fill-current flex-shrink-0" />
                <span className="font-bold text-gray-900 truncate">
                  {s.lostCase.dog.name} volvió a casa
                </span>
              </div>
              {s.lostCase.lastSeenCity && (
                <p className="text-xs text-gray-400 mb-1">{s.lostCase.lastSeenCity}</p>
              )}
              {excerpt && (
                <p className="text-sm text-gray-600 line-clamp-2">{excerpt}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
