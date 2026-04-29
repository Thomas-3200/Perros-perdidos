/**
 * Home — Pantalla principal
 * - CTA rápidos: Reportar perdido / Vi un perro / Quiero ayudar
 * - Feed de casos activos cercanos
 * - Últimas reunificaciones exitosas
 */
import Link from 'next/link';
import { Heart, MapPin, Search, PawPrint, Users, Sparkles } from 'lucide-react';
import { ActiveCasesFeed } from '@/components/cases/ActiveCasesFeed';
import { ReunionFeed }     from '@/components/reunion/ReunionFeed';
import { StatsBar }        from '@/components/stats/StatsBar';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-brand-500 to-brand-700 text-white py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <PawPrint className="w-14 h-14 text-white/80" />
          </div>
          <h1 className="text-3xl font-bold mb-3">
            Reunimos perros perdidos con sus familias
          </h1>
          <p className="text-brand-100 text-lg mb-8">
            Comunidad + IA trabajando juntos para que cada perro vuelva a casa.
          </p>

          {/* ── CTAs principales ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/reportar/perdido"
              className="bg-white text-brand-600 font-bold py-4 px-5 rounded-2xl
                         flex flex-col items-center gap-2 hover:bg-brand-50 transition-colors"
            >
              <Heart className="w-7 h-7" />
              <span>Mi perro se perdió</span>
            </Link>

            <Link
              href="/reportar/avistamiento"
              className="bg-brand-600 text-white font-bold py-4 px-5 rounded-2xl
                         flex flex-col items-center gap-2 border-2 border-white/30
                         hover:bg-brand-800 transition-colors"
            >
              <MapPin className="w-7 h-7" />
              <span>Vi un perro</span>
            </Link>

            <Link
              href="/ayudar"
              className="bg-white/20 text-white font-bold py-4 px-5 rounded-2xl
                         flex flex-col items-center gap-2 border-2 border-white/30
                         hover:bg-white/30 transition-colors"
            >
              <Users className="w-7 h-7" />
              <span>Quiero ayudar</span>
            </Link>
          </div>

          {/* ── Human API ─────────────────────────────────────────────────── */}
          <div className="mt-4">
            <Link
              href="/reportar/red-social"
              className="inline-flex items-center gap-2 text-brand-100 hover:text-white
                         text-sm font-medium underline underline-offset-4"
            >
              <Sparkles className="w-4 h-4" />
              Vi un post en redes sociales — reportar aquí
            </Link>
          </div>
        </div>
      </section>

      {/* ── Estadísticas rápidas ──────────────────────────────────────────── */}
      <StatsBar />

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Casos activos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-500" />
              Casos activos cerca tuyo
            </h2>
            <Link href="/mapa" className="text-brand-500 text-sm font-medium hover:underline">
              Ver mapa →
            </Link>
          </div>
          <ActiveCasesFeed />
        </section>

        {/* Reuniones exitosas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Heart className="w-5 h-5 text-hope-500 fill-current" />
              Reunificaciones recientes
            </h2>
            <Link href="/reuniones" className="text-brand-500 text-sm font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <ReunionFeed limit={3} />
        </section>
      </div>
    </main>
  );
}
