'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Clock, Phone, ChevronLeft, AlertCircle,
  CheckCircle, ShieldCheck, MessageCircle, PartyPopper, Heart,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

interface Match {
  id: string;
  totalScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  visualScore: number;
  geoScore: number;
  status: string;
  sighting: {
    photos: string[];
    locationLat: number;
    locationLng: number;
    seenAt: string;
  };
}

interface CaseDetail {
  id: string;
  status: string;
  lastSeenCity?: string;
  lastSeenAddress?: string;
  lastSeenAt: string;
  lastSeenLat: number;
  lastSeenLng: number;
  reward?: number;
  rewardCurrency?: string;
  behaviorNotes?: string;
  contactMethod: string;
  contactValue: string;
  dog: {
    name: string;
    breed?: string;
    color: string[];
    size: string;
    sex: string;
    age?: number;
    neutered?: boolean;
    description?: string;
    photos: string[];
  };
  owner: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  matches: Match[];
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  high:   { label: 'Alta confianza',   color: 'text-green-700 bg-green-50 border-green-200',  icon: ShieldCheck    },
  medium: { label: 'Media confianza',  color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: AlertCircle },
  low:    { label: 'Baja confianza',   color: 'text-gray-600 bg-gray-50 border-gray-200',      icon: AlertCircle  },
};

const SIZE_LABELS: Record<string, string> = {
  small: 'Pequeño', medium: 'Mediano', large: 'Grande', extra_large: 'Extra grande',
};
const SEX_LABELS:  Record<string, string> = { male: 'Macho', female: 'Hembra', unknown: 'Desconocido' };

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isNew = searchParams.get('nuevo') === 'true';
  const { data, error, isLoading } = useSWR(
    id ? `case-${id}` : null,
    () => api.cases.get(id) as Promise<{ data: CaseDetail }>,
  );

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
    </div>
  );

  if (error || !data?.data) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4">
      <AlertCircle className="w-10 h-10 text-gray-400" />
      <p className="text-gray-500">No se pudo cargar el caso.</p>
      <Link href="/" className="text-brand-600 underline text-sm">Volver al inicio</Link>
    </div>
  );

  const c = data.data;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner de éxito: caso recién creado */}
      {isNew && (
        <div className="bg-green-500 text-white px-4 py-4 flex items-start gap-3">
          <PartyPopper className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Tu caso fue creado. La comunidad puede ayudarte ahora.</p>
            <p className="text-xs text-green-100 mt-0.5">Te notificaremos cuando haya novedades.</p>
          </div>
        </div>
      )}

      {/* Header foto */}
      <div className="relative w-full h-72 bg-gray-100">
        {c.dog.photos[0] ? (
          <Image src={c.dog.photos[0]} alt={c.dog.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-7xl">🐕</div>
        )}
        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </Link>
        {/* Status badge */}
        <div className="absolute top-4 right-4">
          {c.status === 'active' ? (
            <span className="badge-active">● Activo</span>
          ) : (
            <span className="badge-found flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Reunificado
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Info principal */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{c.dog.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {c.dog.breed && <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full text-gray-600">{c.dog.breed}</span>}
            {c.dog.color.map(col => (
              <span key={col} className="text-xs bg-gray-100 px-2.5 py-1 rounded-full text-gray-600">{col}</span>
            ))}
            <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full text-gray-600">{SIZE_LABELS[c.dog.size]}</span>
            <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full text-gray-600">{SEX_LABELS[c.dog.sex]}</span>
          </div>
        </div>

        {/* Ubicación y tiempo */}
        <div className="card space-y-2">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Último avistamiento</h2>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            <span>{c.lastSeenAddress || c.lastSeenCity || 'Sin dirección especificada'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-brand-500 shrink-0" />
            <span>Perdido {daysAgo(c.lastSeenAt)}</span>
          </div>
          {c.reward && (
            <div className="mt-3 flex items-center gap-2 bg-brand-50 rounded-xl px-3 py-2">
              <span className="text-brand-700 text-sm font-semibold">
                Recompensa: ${c.reward.toLocaleString()} {c.rewardCurrency}
              </span>
            </div>
          )}
        </div>

        {/* Descripción / comportamiento */}
        {(c.dog.description || c.behaviorNotes) && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 text-sm mb-2">Descripción</h2>
            {c.dog.description && <p className="text-sm text-gray-600 mb-2">{c.dog.description}</p>}
            {c.behaviorNotes && (
              <p className="text-sm text-gray-500 italic">{c.behaviorNotes}</p>
            )}
          </div>
        )}

        {/* Contacto */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Contactar al dueño</h2>
          <p className="text-xs text-gray-500 mb-3">
            Publicado por <span className="font-medium text-gray-700">{c.owner.name}</span>
          </p>
          <a
            href={
              c.contactMethod === 'whatsapp'
                ? `https://wa.me/${c.contactValue.replace(/\D/g, '')}`
                : `tel:${c.contactValue}`
            }
            className="btn-primary flex items-center justify-center gap-2 w-full"
          >
            {c.contactMethod === 'whatsapp' ? (
              <>
                <MessageCircle className="w-4 h-4" />
                Contactar por WhatsApp
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Llamar al dueño
              </>
            )}
          </a>
        </div>

        {/* Reportar avistamiento */}
        <Link
          href={`/reportar/avistamiento?caseId=${c.id}`}
          className="btn-secondary flex items-center justify-center gap-2 w-full"
        >
          <MapPin className="w-4 h-4" />
          Vi a este perro — reportar avistamiento
        </Link>

        {/* Botón ¡Lo encontré! — solo visible para el dueño del caso */}
        {c.status === 'active' && getUser()?.id === c.owner.id && (
          <Link
            href={`/casos/${c.id}/encontre`}
            className="flex items-center justify-center gap-2 w-full py-4 px-5 rounded-2xl
                       bg-hope-500 text-white font-bold text-base hover:bg-hope-600 transition-colors"
          >
            <Heart className="w-5 h-5 fill-current" />
            ¡Lo encontré! Cerrar caso
          </Link>
        )}

        {/* Matches */}
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">
            {c.matches.length > 0
              ? `Posibles coincidencias (${c.matches.length})`
              : 'Coincidencias'}
          </h2>

          {c.matches.length === 0 && c.status === 'active' && (
            <div className="card text-center py-8 space-y-1">
              <p className="text-gray-500 text-sm">No hay coincidencias aún.</p>
              <p className="text-xs text-gray-400">La comunidad sigue buscando. Te avisamos cuando haya novedades.</p>
            </div>
          )}

          {c.matches.length > 0 && (
            <div className="space-y-3">
              {c.matches.map((m) => {
                const conf = CONFIDENCE_LABELS[m.confidenceLevel];
                const ConfIcon = conf.icon;
                return (
                  <div key={m.id} className={`card border ${conf.color}`}>
                    <div className="flex items-start gap-3">
                      {/* Foto del avistamiento */}
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {m.sighting.photos[0] ? (
                          <Image src={m.sighting.photos[0]} alt="Avistamiento" fill className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-2xl">📍</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${conf.color} mb-2`}>
                          <ConfIcon className="w-3 h-3" />
                          {conf.label}
                        </div>
                        <div className="text-sm font-bold text-gray-800">
                          {Math.round(m.totalScore * 100)}% similitud
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>Visual: {Math.round(m.visualScore * 100)}%</span>
                          <span>Geo: {Math.round(m.geoScore * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          Avistado {daysAgo(m.sighting.seenAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Apoyo emocional */}
        <div className="bg-gradient-to-br from-brand-50 to-orange-50 rounded-2xl p-5 border border-brand-100">
          <h3 className="font-semibold text-brand-800 mb-1">¿Necesitás apoyo?</h3>
          <p className="text-sm text-brand-700 mb-3">
            Buscar a tu compañero puede ser muy difícil. Estamos acá para ayudarte.
          </p>
          <Link
            href="/apoyo"
            className="inline-flex items-center gap-2 bg-brand-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-600 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Hablar con el asistente de apoyo
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-72 bg-gray-200" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    }>
      <CaseDetail />
    </Suspense>
  );
}
