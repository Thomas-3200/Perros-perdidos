/**
 * Home — Pantalla principal
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin, Users, PawPrint, Eye, Share2, Clock } from 'lucide-react';
import { ActiveCasesFeed } from '@/components/cases/ActiveCasesFeed';
import { ReunionFeed }     from '@/components/reunion/ReunionFeed';
import { StatsBar }        from '@/components/stats/StatsBar';
import { PushBannerSmart } from '@/components/notifications/PushNotificationsPrompt';
import { api }             from '@/lib/api';

/* ── Mini feed de avistamientos recientes ──────────────────────────────── */
interface Sighting {
  id:           string;
  locationCity?: string;
  seenAt:       string;
  createdAt?:   string;
  photos:       string[];
  dogStatus:    string;
}

/**
 * Devuelve "hace X" usando la fecha más reciente entre createdAt y seenAt.
 *
 * Por qué: cuando se importa de redes sociales, la IA a veces lee fechas
 * viejas del post (ej: "se perdió el 8/01" → 2025) y las pone en seenAt.
 * Eso hace que aparezca "hace 484 días" aunque el reporte sea de hoy.
 * Usamos createdAt (cuándo se reportó EN LA APP) como verdad de referencia.
 */
function timeAgo(s: Sighting): string {
  // Preferimos createdAt; caemos a seenAt si no está
  const reference = s.createdAt
    ? new Date(s.createdAt).getTime()
    : new Date(s.seenAt).getTime();

  const diff  = Date.now() - reference;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days} días`;
}

const STATUS_DOT: Record<string, string> = {
  still_there: 'bg-green-500',
  retained:    'bg-blue-500',
  injured:     'bg-red-500',
  gone:        'bg-yellow-500',
  unknown:     'bg-gray-400',
};

function RecentSightings() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    api.sightings.list({ limit: 6, page: 1 })
      .then((res: unknown) => {
        const r = res as { data: Sighting[] };
        setSightings(r.data?.slice(0, 5) ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-28 h-28 rounded-2xl bg-gray-200 animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (!sightings.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
      {sightings.map(s => (
        <Link
          key={s.id}
          href="/avistamientos"
          className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 group"
        >
          {s.photos[0] ? (
            <Image
              src={s.photos[0]}
              alt="Avistamiento"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-4xl">🐕</div>
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Status dot — solo si tiene estado conocido */}
          {STATUS_DOT[s.dogStatus] && s.dogStatus !== 'unknown' && (
            <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_DOT[s.dogStatus]}`} />
          )}
          {/* Time */}
          <span className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[10px] font-semibold leading-tight">
            {s.locationCity ? `${s.locationCity} · ` : ''}{timeAgo(s)}
          </span>
        </Link>
      ))}
      <Link
        href="/avistamientos"
        className="w-28 h-28 rounded-2xl bg-brand-50 border-2 border-dashed border-brand-200
                   flex flex-col items-center justify-center flex-shrink-0 hover:bg-brand-100 transition-colors"
      >
        <Eye className="w-6 h-6 text-brand-400 mb-1" />
        <span className="text-brand-500 text-xs font-semibold text-center px-1">Ver todos</span>
      </Link>
    </div>
  );
}

/* ── Pulso de actividad ─────────────────────────────────────────────────── */
function ActivityPulse() {
  return (
    <div className="flex items-center gap-2 justify-center py-3 bg-hope-50 rounded-2xl border border-hope-100">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hope-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-hope-500" />
        </span>
        <span className="text-hope-700 text-xs font-semibold">Comunidad activa buscando ahora</span>
      </div>
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-brand-500 to-brand-700 text-white pt-10 pb-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Marca */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <PawPrint className="w-8 h-8 text-white/80" />
            <span className="text-white/80 font-semibold text-sm tracking-wide uppercase">Perros Perdidos</span>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 leading-tight">
            Cada minuto importa.<br />
            <span className="text-brand-200">Juntos los encontramos.</span>
          </h1>
          <p className="text-brand-100 text-sm text-center mb-7 leading-relaxed">
            La comunidad + IA trabajando para reunir perros con sus familias.
            Reportá, difundí, ayudá.
          </p>

          {/* ── CTAs ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Link
              href="/reportar/perdido"
              className="bg-white text-brand-600 font-bold py-4 px-4 rounded-2xl
                         flex flex-col items-center gap-2 hover:bg-brand-50 transition-colors shadow-lg"
            >
              <Heart className="w-7 h-7 fill-current" />
              <span className="text-sm text-center">Mi perro<br />se perdió</span>
            </Link>

            <Link
              href="/reportar/avistamiento"
              className="bg-brand-600 text-white font-bold py-4 px-4 rounded-2xl
                         flex flex-col items-center gap-2 border-2 border-white/20
                         hover:bg-brand-800 transition-colors shadow-lg"
            >
              <MapPin className="w-7 h-7" />
              <span className="text-sm text-center">Vi un perro<br />perdido</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ayudar"
              className="bg-white/15 text-white font-semibold py-3 px-4 rounded-2xl
                         flex items-center justify-center gap-2 border border-white/20
                         hover:bg-white/25 transition-colors text-sm"
            >
              <Users className="w-5 h-5" />
              Quiero ayudar
            </Link>

            <Link
              href="/reportar/red-social"
              className="bg-white/15 text-white font-semibold py-3 px-4 rounded-2xl
                         flex items-center justify-center gap-2 border border-white/20
                         hover:bg-white/25 transition-colors text-sm"
            >
              <Share2 className="w-5 h-5" />
              Vi en redes sociales
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <StatsBar />

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-10">

        {/* Banner inteligente: solo aparece si está logueado y aún no activó push */}
        <PushBannerSmart />

        {/* Pulso de actividad */}
        <ActivityPulse />

        {/* Avistamientos recientes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-brand-500" />
              Vistos recientemente
            </h2>
            <Link href="/avistamientos" className="text-brand-500 text-sm font-medium hover:underline">
              Ver todos →
            </Link>
          </div>
          <RecentSightings />
        </section>

        {/* Casos activos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-500" />
              Búsquedas activas
            </h2>
            <Link href="/buscar" className="text-brand-500 text-sm font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <ActiveCasesFeed />
        </section>

        {/* Reunificaciones */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Heart className="w-5 h-5 text-hope-500 fill-current" />
              Volvieron a casa 🎉
            </h2>
            <Link href="/reuniones" className="text-brand-500 text-sm font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <ReunionFeed limit={3} />
        </section>

        {/* Donación */}
        <div className="bg-hope-50 border border-hope-200 rounded-3xl p-5 flex items-center gap-4">
          <div className="text-3xl shrink-0">❤️</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Es 100% gratuito</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
              Las donaciones van destinadas a la mejora de la plataforma.
            </p>
          </div>
          <Link
            href="/donar"
            className="shrink-0 bg-hope-500 hover:bg-hope-600 text-white font-bold
                       px-4 py-2.5 rounded-2xl transition-colors text-sm whitespace-nowrap"
          >
            Donar 🐾
          </Link>
        </div>

        {/* CTA final */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl p-6 text-white text-center space-y-3">
          <div className="text-3xl">🐾</div>
          <h3 className="font-bold text-lg">¿Podés ayudar ahora?</h3>
          <p className="text-brand-100 text-sm leading-relaxed">
            Cada avistamiento, cada post compartido, puede ser la clave
            que una familia estaba esperando.
          </p>
          <Link
            href="/buscar"
            className="inline-block bg-white text-brand-600 font-bold px-6 py-3 rounded-2xl
                       hover:bg-brand-50 transition-colors text-sm"
          >
            Ver casos cerca mío →
          </Link>
        </div>

      </div>
    </div>
  );
}
