'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, MapPin, Phone, ChevronRight, ChevronLeft,
  Check, Loader2, LocateFixed, Plus, X, ImageIcon, Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import clsx from 'clsx';

const STEPS = ['Fotos', 'Descripción', 'Ubicación', 'Contacto'];

type LastSeenTimeKey = 'today' | 'yesterday' | '2days' | 'week' | 'custom';

const LOST_TIME_OPTIONS: { key: LastSeenTimeKey; label: string }[] = [
  { key: 'today',     label: '🟢 Hoy'            },
  { key: 'yesterday', label: '📅 Ayer'            },
  { key: '2days',     label: '📅 Hace 2 días'     },
  { key: 'week',      label: '📅 Hace una semana' },
  { key: 'custom',    label: '📆 Otra fecha'      },
];

function timeKeyToISO(key: LastSeenTimeKey, customDate: string): string {
  const now = new Date();
  switch (key) {
    case 'today':     return now.toISOString();
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
    case '2days': {
      const d = new Date(now); d.setDate(d.getDate() - 2); d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
    case 'custom': return new Date(customDate).toISOString();
  }
}

interface FormState {
  photos:          File[];
  name:            string;
  breed:           string;
  color:           string;
  size:            string;
  sex:             string;
  description:     string;
  lastSeenLat:     number | '';
  lastSeenLng:     number | '';
  lastSeenAddress: string;
  lastSeenCity:    string;
  lastSeenTimeKey: LastSeenTimeKey;
  lastSeenCustom:  string;
  contactMethod:   string;
  contactValue:    string;
  reward:          string;
  behaviorNotes:   string;
}

const INITIAL: FormState = {
  photos: [], name: '', breed: '', color: '', size: 'medium', sex: 'unknown', description: '',
  lastSeenLat: '', lastSeenLng: '', lastSeenAddress: '', lastSeenCity: '',
  lastSeenTimeKey: 'today',
  lastSeenCustom:  new Date().toISOString().slice(0, 16),
  contactMethod: 'whatsapp', contactValue: '', reward: '', behaviorNotes: '',
};

function validateStep(step: number, form: FormState): string {
  if (step === 0 && form.photos.length === 0)    return 'Agregá al menos una foto de tu perro';
  if (step === 1 && !form.name.trim())            return 'El nombre del perro es obligatorio';
  if (step === 1 && !form.color.trim())           return 'Indicá al menos un color';
  // Ubicación: con GPS coords ó con ciudad ó con dirección — cualquiera alcanza
  if (step === 2) {
    const hasGps     = form.lastSeenLat !== '';
    const hasCity    = form.lastSeenCity.trim().length > 0;
    const hasAddress = form.lastSeenAddress.trim().length > 0;
    if (!hasGps && !hasCity && !hasAddress)
      return 'Ingresá la dirección o la ciudad donde fue visto por última vez';
  }
  if (step === 3 && !form.contactValue.trim())    return 'El dato de contacto es obligatorio';
  return '';
}

const MAX_PHOTOS = 3;
const PHOTO_LABELS = ['Frente', 'Lado', 'Otra'];

// ── Selector de fotos — solo galería ─────────────────────────────────────────
function PhotoSlots({ photos, onChange }: { photos: File[]; onChange: (photos: File[]) => void }) {
  const galleryRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleFile(slot: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const next = [...photos];
    next[slot] = file;
    onChange(next);
  }

  function remove(i: number) {
    const next = [...photos];
    next.splice(i, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const file = photos[i];
          const url  = file ? URL.createObjectURL(file) : null;
          return (
            <div key={i} className="aspect-square relative">
              {/* Input galería */}
              <input
                ref={galleryRefs[i]}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => handleFile(i, e)}
              />

              {url ? (
                <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-brand-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={PHOTO_LABELS[i]} className="w-full h-full object-cover" />
                  {/* Quitar */}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {/* Reemplazar */}
                  <button
                    type="button"
                    onClick={() => galleryRefs[i].current?.click()}
                    className="absolute inset-0 w-full h-full opacity-0"
                    aria-label={`Reemplazar foto ${PHOTO_LABELS[i]}`}
                  />
                  <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-bold text-white bg-black/40 rounded-lg py-0.5">
                    {PHOTO_LABELS[i]}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => galleryRefs[i].current?.click()}
                  className="w-full h-full rounded-2xl border-2 border-dashed border-gray-300
                             hover:border-brand-400 hover:bg-brand-50 transition-colors
                             flex flex-col items-center justify-center gap-1 active:scale-95"
                >
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-400">{PHOTO_LABELS[i]}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Tocá cada recuadro para elegir una foto de tu galería · Máximo {MAX_PHOTOS} fotos
      </p>
    </div>
  );
}

export default function ReportarPerdidoPage() {
  const router = useRouter();
  const [step,       setStep]       = useState(0);
  const [form,       setForm]       = useState<FormState>(INITIAL);
  const [loading,    setLoading]    = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [showAuth,   setShowAuth]   = useState(false);
  const [success,    setSuccess]    = useState(false);

  const set = (field: keyof FormState, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  function goNext() {
    const err = validateStep(step, form);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  const geolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('lastSeenLat', pos.coords.latitude);
        set('lastSeenLng', pos.coords.longitude);
        setGeoLoading(false);
        setError('');
      },
      () => {
        setError('No se pudo obtener la ubicación automática. Ingresá la dirección manualmente.');
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  async function submitCase() {
    setLoading(true);
    setError('');
    try {
      const lastSeenAt = timeKeyToISO(form.lastSeenTimeKey, form.lastSeenCustom);

      const res = await api.cases.create({
        dog: {
          name:        form.name.trim(),
          breed:       form.breed.trim() || undefined,
          color:       form.color.split(',').map(c => c.trim()).filter(Boolean),
          size:        form.size,
          sex:         form.sex,
          description: form.description.trim() || undefined,
        },
        lastSeenLat:     form.lastSeenLat !== '' ? Number(form.lastSeenLat) : -34.6037,
        lastSeenLng:     form.lastSeenLng !== '' ? Number(form.lastSeenLng) : -58.3816,
        lastSeenAddress: form.lastSeenAddress.trim() || undefined,
        lastSeenCity:    form.lastSeenCity.trim()    || undefined,
        lastSeenAt,
        reward:          form.reward ? Number(form.reward) : undefined,
        contactMethod:   form.contactMethod,
        contactValue:    form.contactValue.trim(),
        behaviorNotes:   form.behaviorNotes.trim() || undefined,
      }) as { data: { id: string } };

      const caseId = res.data.id;

      // Mostrar éxito antes de subir fotos (la subida puede tardar)
      setSuccess(true);
      setLoading(false);

      // Subir fotos — error no bloquea la navegación
      if (form.photos.length > 0) {
        const fd = new FormData();
        form.photos.forEach(f => fd.append('files', f));
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cases/${caseId}/photos`, {
            method:  'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('pp_token') ?? ''}` },
            body:    fd,
          });
        } catch {
          // silencioso — las fotos pueden subirse después
        }
      }

      router.push(`/casos/${caseId}?nuevo=true`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al publicar el reporte');
      setLoading(false);
    }
  }

  function handleSubmit() {
    const err = validateStep(step, form);
    if (err) { setError(err); return; }
    if (!isLoggedIn()) { setShowAuth(true); return; }
    submitCase();
  }

  // ── Pantalla de éxito (mientras se suben fotos y se navega) ──────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Búsqueda creada!</h2>
          <p className="text-gray-500 text-sm">
            Tu reporte está publicado. La comunidad ya puede ayudarte a encontrar a tu perro.
          </p>
        </div>
        <div className="flex items-center gap-2 text-brand-600 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparando tu caso...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && (
        <AuthModal
          onSuccess={() => { setShowAuth(false); submitCase(); }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => step > 0 ? (setStep(s => s - 1), setError('')) : router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">Reportar perro perdido</h1>
          <p className="text-xs text-gray-400">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>
        </div>
      </header>

      {/* Barra de progreso */}
      <div className="w-full h-1 bg-gray-200">
        <div
          className="h-1 bg-brand-500 transition-all duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── Paso 0: Fotos ────────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center">
              <Camera className="w-12 h-12 text-brand-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Fotos de tu perro</h2>
              <p className="text-gray-500 text-sm mt-1">
                Elegí hasta 3 fotos de tu galería · JPG, PNG o WEBP
              </p>
            </div>

            <PhotoSlots
              photos={form.photos}
              onChange={files => { set('photos', files); setError(''); }}
            />

            {form.photos.length > 0 && (
              <p className="text-sm text-brand-600 font-semibold text-center">
                {form.photos.length} de {MAX_PHOTOS} foto{form.photos.length > 1 ? 's' : ''} agregada{form.photos.length > 1 ? 's' : ''} ✓
              </p>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
              💡 Tip: frente, perfil y cuerpo completo aumentan mucho las chances de que alguien lo reconozca
            </p>
          </div>
        )}

        {/* ── Paso 1: Descripción ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Describí a tu perro</h2>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre *</label>
              <input className="input" placeholder="¿Cómo se llama?" autoFocus
                value={form.name} onChange={e => { set('name', e.target.value); setError(''); }} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Raza</label>
              <input className="input" placeholder="Ej: Labrador, mestizo, Beagle"
                value={form.breed} onChange={e => set('breed', e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Colores *</label>
              <input className="input" placeholder="Separados por coma: marrón, blanco"
                value={form.color} onChange={e => { set('color', e.target.value); setError(''); }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Tamaño</label>
                <select className="input" value={form.size} onChange={e => set('size', e.target.value)}>
                  <option value="small">Pequeño</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                  <option value="extra_large">Muy grande</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Sexo</label>
                <select className="input" value={form.sex} onChange={e => set('sex', e.target.value)}>
                  <option value="unknown">Desconocido</option>
                  <option value="male">Macho</option>
                  <option value="female">Hembra</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Señas particulares
              </label>
              <textarea className="input resize-none h-24"
                placeholder="Mancha negra en la oreja izquierda, collar rojo, cicatriz en el lomo..."
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── Paso 2: Ubicación + Cuándo ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 mb-2">
              <MapPin className="w-8 h-8 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-bold">¿Dónde y cuándo se perdió?</h2>
                <p className="text-gray-500 text-sm">La ubicación ayuda a la comunidad a buscar en el área correcta</p>
              </div>
            </div>

            {/* Botón GPS */}
            <button
              type="button"
              onClick={geolocate}
              disabled={geoLoading}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-colors',
                form.lastSeenLat !== ''
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100',
              )}
            >
              {geoLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación...</>
                : form.lastSeenLat !== ''
                  ? <><Check className="w-4 h-4" /> Ubicación detectada ✓</>
                  : <><LocateFixed className="w-4 h-4" /> Usar mi ubicación actual (opcional)</>
              }
            </button>

            {/* Dirección exacta */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Dirección exacta
              </label>
              <input
                className="input"
                placeholder="Ej: Av. Corrientes 1234, esquina Larrea"
                value={form.lastSeenAddress}
                onChange={e => { set('lastSeenAddress', e.target.value); setError(''); }}
              />
            </div>

            {/* Ciudad */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Ciudad
                {(form.lastSeenAddress.trim() || form.lastSeenLat !== '')
                  ? <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  : <span className="text-red-400 ml-1"> *</span>
                }
              </label>
              <input
                className="input"
                placeholder="Ej: Buenos Aires"
                value={form.lastSeenCity}
                onChange={e => { set('lastSeenCity', e.target.value); setError(''); }}
              />
            </div>

            {/* ── Cuándo se perdió ── */}
            <div className="space-y-2 pt-1">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" /> ¿Cuándo se perdió?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LOST_TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { set('lastSeenTimeKey', opt.key); setError(''); }}
                    className={clsx(
                      'py-3 px-3 rounded-xl border-2 text-sm font-medium text-left transition-all',
                      form.lastSeenTimeKey === opt.key
                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50/50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Picker solo si eligió "Otra fecha" */}
              {form.lastSeenTimeKey === 'custom' && (
                <input
                  className="input mt-1"
                  type="datetime-local"
                  value={form.lastSeenCustom}
                  max={new Date().toISOString().slice(0, 16)}
                  onChange={e => set('lastSeenCustom', e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Paso 3: Contacto ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 mb-2">
              <Phone className="w-8 h-8 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-bold">¿Cómo te contactamos?</h2>
                <p className="text-gray-500 text-sm">Los colaboradores podrán comunicarse con vos</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Medio de contacto</label>
              <select className="input" value={form.contactMethod} onChange={e => set('contactMethod', e.target.value)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Teléfono</option>
                <option value="email">Email</option>
                <option value="in_app">Solo por la app</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {form.contactMethod === 'email' ? 'Tu email *' : 'Tu número de teléfono *'}
              </label>
              <input
                className="input"
                type={form.contactMethod === 'email' ? 'email' : 'tel'}
                placeholder={form.contactMethod === 'email' ? 'nombre@email.com' : '+54 9 11 1234-5678'}
                value={form.contactValue}
                onChange={e => { set('contactValue', e.target.value); setError(''); }}
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Recompensa <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="flex gap-2">
                <span className="input w-16 text-center text-gray-500 shrink-0">$</span>
                <input className="input" type="number" min="0" placeholder="5000"
                  value={form.reward} onChange={e => set('reward', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Notas de comportamiento <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea className="input resize-none h-24"
                placeholder="Asustadizo con extraños. Responde al nombre Max. Le gusta correr..."
                value={form.behaviorNotes} onChange={e => set('behaviorNotes', e.target.value)} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Botones de navegación */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => { setStep(s => s - 1); setError(''); }}
              className="btn-secondary flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button onClick={goNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
              Siguiente <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Publicando...</>
                : <><Check className="w-5 h-5" /> Publicar reporte</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
