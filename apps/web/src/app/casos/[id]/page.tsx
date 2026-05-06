'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Clock, Phone, ChevronLeft, AlertCircle,
  CheckCircle, ShieldCheck, MessageCircle, PartyPopper, Heart,
  Share2, Copy, Check as CheckIcon, Eye, Zap, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

/* ── Tipos ──────────────────────────────────────────────────────────────── */
interface Match {
  id: string;
  totalScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  visualScore: number;
  geoScore: number;
  status: string;
  sighting: {
    photos:      string[];
    locationLat: number;
    locationLng: number;
    seenAt:      string;
  };
}

interface CaseDetail {
  id:              string;
  status:          string;
  lastSeenCity?:   string;
  lastSeenAddress?: string;
  lastSeenAt:      string;
  lastSeenLat:     number;
  lastSeenLng:     number;
  reward?:         number;
  rewardCurrency?: string;
  behaviorNotes?:  string;
  contactMethod:   string;
  contactValue:    string;
  dog: {
    name:         string;
    breed?:       string;
    color:        string[];
    size:         string;
    sex:          string;
    age?:         number;
    neutered?:    boolean;
    description?: string;
    photos:       string[];
  };
  owner: { id: string; name: string; avatarUrl?: string };
  matches: Match[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const CONFIDENCE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  high:   { label: 'Alta confianza',  color: 'text-green-700 bg-green-50 border-green-200',    icon: ShieldCheck },
  medium: { label: 'Media confianza', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: AlertCircle },
  low:    { label: 'Baja confianza',  color: 'text-gray-600 bg-gray-50 border-gray-200',       icon: AlertCircle },
};
const SIZE_LABELS: Record<string, string> = {
  small: 'Pequeño', medium: 'Mediano', large: 'Grande', extra_large: 'Extra grande',
};
const SEX_LABELS: Record<string, string> = { male: 'Macho', female: 'Hembra', unknown: 'Desconocido' };

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

function hoursAgo(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `hace ${m} min`;
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)} días`;
}

/* ── Badge de estado del caso ───────────────────────────────────────────── */
function CaseStatusBadge({ c }: { c: CaseDetail }) {
  if (c.status !== 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-hope-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
        <CheckCircle className="w-3.5 h-3.5" /> Reunificado
      </span>
    );
  }
  const highMatches   = c.matches.filter(m => m.confidenceLevel === 'high').length;
  const mediumMatches = c.matches.filter(m => m.confidenceLevel === 'medium').length;

  if (highMatches > 0) return (
    <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
      <Zap className="w-3.5 h-3.5" /> Alta coincidencia encontrada
    </span>
  );
  if (mediumMatches > 0) return (
    <span className="inline-flex items-center gap-1.5 bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
      <Eye className="w-3.5 h-3.5" /> Posible avistaje
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      Buscando activamente
    </span>
  );
}

/* ── Panel de difusión ──────────────────────────────────────────────────── */
function SharePanel({ c, onShare }: { c: CaseDetail; onShare: () => void }) {
  const [copied, setCopied] = useState(false);

  const publicUrl = `https://perros-perdidos-web.vercel.app/casos/${c.id}`;
  const location  = c.lastSeenAddress || c.lastSeenCity || 'zona sin especificar';
  const breed     = c.dog.breed ? `${c.dog.breed}, ` : '';
  const colors    = c.dog.color.join(' y ');
  const contact   = c.contactMethod === 'whatsapp'
    ? `WhatsApp: ${c.contactValue}` : `Tel: ${c.contactValue}`;
  const reward    = c.reward
    ? `\n💰 Recompensa: $${c.reward.toLocaleString()} ${c.rewardCurrency ?? ''}` : '';

  const shareText =
`🐾 *PERRO PERDIDO — ${c.dog.name.toUpperCase()}*

${breed}${colors}, ${SIZE_LABELS[c.dog.size]?.toLowerCase() ?? ''}
📍 Visto por última vez en: ${location}
🕐 ${daysAgo(c.lastSeenAt)}${reward}

Si lo viste contactá al dueño:
📞 ${contact}

🔗 Ver foto y más info: ${publicUrl}

🙏 Por favor compartí — puede marcar la diferencia`;

  function copyText() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      onShare();
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;

  return (
    <div id="share-panel" className="card space-y-4 border-2 border-brand-100 bg-brand-50/40">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-brand-500" />
        <h2 className="font-bold text-gray-900">Difundir este caso</h2>
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        Compartí en grupos de Facebook y WhatsApp. Cuanto más se difunde, más rápido aparece.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShare}
          className="flex items-center justify-center gap-2 bg-[#25D366] text-white
                     font-semibold text-sm py-3 px-4 rounded-xl hover:bg-[#1ebe5d] transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShare}
          className="flex items-center justify-center gap-2 bg-[#1877F2] text-white
                     font-semibold text-sm py-3 px-4 rounded-xl hover:bg-[#166fe5] transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </a>
      </div>

      <button
        onClick={copyText}
        className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 bg-white
                   text-gray-700 font-semibold text-sm py-3 px-4 rounded-xl hover:border-gray-300 transition-colors"
      >
        {copied
          ? <><CheckIcon className="w-4 h-4 text-hope-500" /><span className="text-hope-600">¡Texto copiado!</span></>
          : <><Copy className="w-4 h-4" /> Copiar texto para grupos</>}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        El link lleva directo a esta página — sin necesidad de tener la app instalada
      </p>
    </div>
  );
}

/* ── Recordatorio de re-difusión ────────────────────────────────────────── */
function ReshareReminder({ caseId, onDismiss }: { caseId: string; onDismiss: () => void }) {
  const key    = `pp_shared_${caseId}`;
  const lastTs = typeof window !== 'undefined' ? Number(localStorage.getItem(key) ?? 0) : 0;
  if (!lastTs) return null;

  const hoursElapsed = Math.floor((Date.now() - lastTs) / 3_600_000);
  if (hoursElapsed < 2) return null;

  function scrollToShare() {
    document.getElementById('share-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onDismiss();
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-amber-800 text-sm font-semibold">
          ⏰ Hace {hoursElapsed}h que no difundís este caso
        </p>
        <p className="text-amber-600 text-xs mt-0.5">
          Compartir regularmente aumenta las chances de encontrarlo
        </p>
      </div>
      <button
        onClick={scrollToShare}
        className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl
                   hover:bg-amber-600 transition-colors whitespace-nowrap"
      >
        Difundir →
      </button>
    </div>
  );
}

/* ── Sticky share CTA (mobile) ──────────────────────────────────────────── */
function StickyShareCTA({ c, onShare }: { c: CaseDetail; onShare: () => void }) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const panel = document.getElementById('share-panel');
    if (!panel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(panel);
    return () => obs.disconnect();
  }, []);

  if (!visible || c.status !== 'active') return null;

  const publicUrl  = `https://perros-perdidos-web.vercel.app/casos/${c.id}`;
  const shareText  = `🐾 PERRO PERDIDO — ${c.dog.name} — ${c.lastSeenCity ?? ''}\nVer foto y contacto: ${publicUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 sm:hidden">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-3 flex gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white
                     font-bold text-sm py-3 rounded-xl"
        >
          <Share2 className="w-4 h-4" /> Difundir por WhatsApp
        </a>
        <button
          onClick={() => document.getElementById('share-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Panel de actividad del caso ────────────────────────────────────────── */
function CaseActivity({ c }: { c: CaseDetail }) {
  const sightingsCount = c.matches.length;
  const lastMatch      = c.matches[0];
  const lastActivity   = lastMatch?.sighting.seenAt ?? c.lastSeenAt;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 text-center shadow-sm">
        <div className="text-2xl font-bold text-brand-600">{sightingsCount}</div>
        <div className="text-xs text-gray-500 mt-0.5">avistajes</div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 text-center shadow-sm">
        <div className="text-2xl font-bold text-gray-700">
          {Math.floor((Date.now() - new Date(c.lastSeenAt).getTime()) / 86_400_000)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">días perdido</div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 text-center shadow-sm">
        <Users className="w-5 h-5 text-hope-500 mx-auto mb-0.5" />
        <div className="text-xs text-gray-500">comunidad<br />buscando</div>
      </div>

      {/* Última actividad */}
      <div className="col-span-3 bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-hope-400 animate-pulse flex-shrink-0" />
        <span className="text-xs text-gray-500">
          Última actividad: <span className="font-medium text-gray-700">{daysAgo(lastActivity)}</span>
        </span>
      </div>
    </div>
  );
}

/* ── Detalle del caso ───────────────────────────────────────────────────── */
function CaseDetail() {
  const { id }         = useParams<{ id: string }>();
  const searchParams   = useSearchParams();
  const isNew          = searchParams.get('nuevo') === 'true';
  const [showReminder, setShowReminder] = useState(true);

  const { data, error, isLoading } = useSWR(
    id ? `case-${id}` : null,
    () => api.cases.get(id) as Promise<{ data: CaseDetail }>,
  );

  function handleShare() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pp_shared_${id}`, String(Date.now()));
    }
  }

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
      {/* Banner caso nuevo */}
      {isNew && (
        <div className="bg-green-500 text-white px-4 py-4 flex items-start gap-3">
          <PartyPopper className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">
              ¡Caso publicado! Ahora <strong>compartilo en grupos de WhatsApp y Facebook</strong> para que más gente lo vea.
            </p>
            <p className="text-xs text-green-100 mt-0.5">
              Cuanto más se difunde, más rápido aparece.
            </p>
          </div>
        </div>
      )}

      {/* Foto hero */}
      <div className="relative w-full h-72 bg-gray-100">
        {c.dog.photos[0] ? (
          <Image src={c.dog.photos[0]} alt={c.dog.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-7xl">🐕</div>
        )}
        <Link href="/"
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </Link>
        {/* Status badge en foto */}
        <div className="absolute top-4 right-4">
          <CaseStatusBadge c={c} />
        </div>
        {/* Gradient bottom */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="px-4 py-6 space-y-5">

        {/* Nombre + chips */}
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

        {/* Indicadores de actividad */}
        <CaseActivity c={c} />

        {/* Recordatorio re-difusión */}
        {showReminder && c.status === 'active' && (
          <ReshareReminder caseId={c.id} onDismiss={() => setShowReminder(false)} />
        )}

        {/* Ubicación */}
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
                💰 Recompensa: ${c.reward.toLocaleString()} {c.rewardCurrency}
              </span>
            </div>
          )}
        </div>

        {/* Descripción */}
        {(c.dog.description || c.behaviorNotes) && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 text-sm mb-2">Descripción</h2>
            {c.dog.description && <p className="text-sm text-gray-600 mb-2">{c.dog.description}</p>}
            {c.behaviorNotes && <p className="text-sm text-gray-500 italic">{c.behaviorNotes}</p>}
          </div>
        )}

        {/* ── DIFUNDIR ── */}
        {c.status === 'active' && <SharePanel c={c} onShare={handleShare} />}

        {/* Contacto */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Contactar al dueño</h2>
          <p className="text-xs text-gray-500 mb-3">
            Publicado por <span className="font-medium text-gray-700">{c.owner.name}</span>
          </p>
          <a
            href={c.contactMethod === 'whatsapp'
              ? `https://wa.me/${c.contactValue.replace(/\D/g, '')}`
              : `tel:${c.contactValue}`}
            className="btn-primary flex items-center justify-center gap-2 w-full"
          >
            {c.contactMethod === 'whatsapp'
              ? <><MessageCircle className="w-4 h-4" /> Contactar por WhatsApp</>
              : <><Phone className="w-4 h-4" /> Llamar al dueño</>}
          </a>
        </div>

        {/* Vi a este perro */}
        <Link
          href={`/reportar/avistamiento?caseId=${c.id}`}
          className="btn-secondary flex items-center justify-center gap-2 w-full"
        >
          <MapPin className="w-4 h-4" />
          Vi a este perro — reportar avistamiento
        </Link>

        {/* ¡Lo encontré! — solo el dueño */}
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
              : 'Sin coincidencias aún'}
          </h2>

          {c.matches.length === 0 && c.status === 'active' && (
            <div className="card text-center py-8 space-y-2 bg-gray-50">
              <Eye className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-gray-500 text-sm">La comunidad sigue buscando.</p>
              <p className="text-xs text-gray-400">Te avisamos cuando haya novedades.</p>
            </div>
          )}

          {c.matches.length > 0 && (
            <div className="space-y-3">
              {c.matches.map((m) => {
                const conf     = CONFIDENCE_LABELS[m.confidenceLevel];
                const ConfIcon = conf.icon;
                return (
                  <div key={m.id} className={`card border ${conf.color}`}>
                    <div className="flex items-start gap-3">
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

        {/* CTA comunitario */}
        <div className="bg-gradient-to-br from-brand-50 to-orange-50 rounded-2xl p-5 border border-brand-100 text-center space-y-3">
          <Users className="w-8 h-8 text-brand-400 mx-auto" />
          <h3 className="font-bold text-brand-800">Ayudá aunque no lo conozcas</h3>
          <p className="text-sm text-brand-700 leading-relaxed">
            Compartir este caso a grupos de tu zona puede ser la clave.
            La comunidad ya encontró perros solo gracias a un compartido más.
          </p>
          <button
            onClick={() => document.getElementById('share-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="inline-block bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors"
          >
            Difundir ahora →
          </button>
        </div>

        {/* Apoyo emocional */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-1">¿Necesitás apoyo?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Buscar a tu compañero puede ser muy difícil. Estamos acá para ayudarte.
          </p>
          <Link
            href="/apoyo"
            className="inline-flex items-center gap-2 bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-900 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Hablar con el asistente
          </Link>
        </div>

      </div>

      {/* Sticky share CTA mobile */}
      <StickyShareCTA c={c} onShare={handleShare} />
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
