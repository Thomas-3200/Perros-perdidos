'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin, ChevronLeft, Clock } from 'lucide-react';
import { api } from '@/lib/api';

interface ReunionDetail {
  id:               string;
  photos:           string[];
  storyText?:       string;
  aiGeneratedStory?: string;
  publishedAt?:     string;
  lostCase: {
    lastSeenCity?:  string;
    lastSeenAt:     string;
    dog: {
      name:         string;
      breed?:       string;
      photos:       string[];
    };
  };
}

export default function ReunionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useSWR(
    id ? `reunion-${id}` : null,
    () => api.reunion.get(id) as Promise<{ data: ReunionDetail }>,
  );

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  );

  if (error || !data?.data) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4">
      <p className="text-gray-500">Historia no encontrada.</p>
      <Link href="/" className="text-brand-600 underline text-sm">Volver al inicio</Link>
    </div>
  );

  const s = data.data;
  const photo   = s.photos[0] ?? s.lostCase.dog.photos[0];
  const story   = s.storyText ?? s.aiGeneratedStory ?? '';
  const daysMissing = Math.round(
    Math.abs(Date.now() - new Date(s.lostCase.lastSeenAt).getTime()) / 86_400_000,
  );

  // "hace X días/horas" desde la reunificación
  function timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const ms = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(ms / 60_000);
    const hr  = Math.floor(ms / 3_600_000);
    const d   = Math.floor(ms / 86_400_000);
    if (min < 1)  return 'recién';
    if (min < 60) return `hace ${min} min`;
    if (hr  < 24) return `hace ${hr} h`;
    if (d   === 1) return 'ayer';
    return `hace ${d} días`;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Foto hero */}
      <div className="relative w-full h-72 bg-gray-100">
        {photo ? (
          <Image src={photo} alt={s.lostCase.dog.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-7xl">🐾</div>
        )}
        <Link href="/" className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div className="absolute top-4 right-4 bg-hope-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 fill-current" />
          {timeAgo(s.publishedAt)}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {s.lostCase.dog.name} volvió a casa
          </h1>
          {s.lostCase.dog.breed && (
            <p className="text-sm text-gray-500 mt-1">{s.lostCase.dog.breed}</p>
          )}
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            {s.lostCase.lastSeenCity && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {s.lostCase.lastSeenCity}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Encontrado después de {daysMissing} días
            </span>
          </div>
        </div>

        {story && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-hope-500 fill-current" /> Su historia
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{story}</p>
          </div>
        )}

        <div className="bg-hope-50 rounded-2xl p-5 text-center border border-green-100">
          <p className="text-hope-700 font-semibold text-sm">
            Gracias a la comunidad de Perros Perdidos
          </p>
          <p className="text-hope-700 text-xs mt-1 opacity-80">
            Cada reporte cuenta. Cada avistamiento importa.
          </p>
        </div>

        <Link href="/" className="btn-primary flex items-center justify-center gap-2 w-full">
          Ver más casos activos
        </Link>
      </div>
    </div>
  );
}
