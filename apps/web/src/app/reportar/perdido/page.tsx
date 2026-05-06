'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, MapPin, Phone, ChevronRight, ChevronLeft,
  Check, Loader2, LocateFixed, Plus, X, ImageIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import clsx from 'clsx';

const STEPS = ['Fotos', 'Descripción', 'Ubicación', 'Contacto'];

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
  lastSeenAt:      string;
  contactMethod:   string;
  contactValue:    string;
  reward:          string;
  behaviorNotes:   string;
}

const INITIAL: FormState = {
  photos: [], name: '', breed: '', color: '', size: 'medium', sex: 'unknown', description: '',
  lastSeenLat: '', lastSeenLng: '', lastSeenAddress: '', lastSeenCity: '',
  lastSeenAt: new Date().toISOString().slice(0, 16),
  contactMethod: 'whatsapp', contactValue: '', reward: '', behaviorNotes: '',
};

function validateStep(step: number, form: FormState): string {
  if (step === 0 && form.photos.length === 0) return 'Agregá al menos una foto de tu perro';
  if (step === 1 && !form.name.trim())         return 'El nombre del perro es obligatorio';
  if (step === 1 && !form.color.trim())        return 'Indicá al menos un color';
  if (step === 2 && !form.lastSeenCity.trim()) return 'La ciudad es obligatoria';
  if (step === 2 && form.lastSeenLat === '')   return 'Necesitamos la ubicación (usá el botón GPS o ingresá las coordenadas)';
  if (step === 3 && !form.contactValue.trim()) return 'El dato de contacto es obligatorio';
  return '';
}

const MAX_PHOTOS = 3;
const PHOTO_LABELS = ['Frente', 'Lado', 'Otra'];

// ── Componente selector de 3 fotos ────────────────────────────────────────────
// Cada slot tiene 2 inputs: uno con capture="environment" (cámara) y otro sin (galería).
// Al tocar un slot vacío se muestra una action sheet para elegir origen.
function PhotoSlots({
  photos,
  onChange,
}: {
  photos: File[];
  onChange: (photos: File[]) => void;
}) {
  // 3 refs para la cámara + 3 refs para la galería
  const cameraRefs  = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const galleryRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Slot activo para mostrar la action sheet (null = cerrada)
  const [actionSlot, setActionSlot] = useState<number | null>(null);

  function handleFile(slot: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const next = [...photos];
    next[slot] = file;
    onChange(next);
    setActionSlot(null);
  }

  function remove(i: number) {
    const next = [...photos];
    next.splice(i, 1);
    onChange(next);
  }

  function openCamera(slot: number) {
    setActionSlot(null);
    // pequeño delay para que el estado se cierre antes de abrir el input nativo
    setTimeout(() => cameraRefs[slot].current?.click(), 50);
  }

  function openGallery(slot: number) {
    setActionSlot(null);
    setTimeout(() => galleryRefs[slot].current?.click(), 50);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const file = photos[i];
          const url  = file ? URL.createObjectURL(file) : null;
          return (
            <div key={i} className="aspect-square relative">

              {/* Input cámara (capture="environment") */}
              <input
                ref={cameraRefs[i]}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={e => handleFile(i, e)}
              />
              {/* Input galería (sin capture) */}
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
                  {/* Botón quitar */}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {/* Toca para reemplazar → abre action sheet */}
                  <button
                    type="button"
                    onClick={() => setActionSlot(i)}
                    className="absolute inset-0 w-full h-full opacity-0"
                    aria-label={`Reemplazar foto ${PHOTO_LABELS[i]}`}
                  />
                  {/* Label ángulo */}
                  <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-bold text-white bg-black/40 rounded-lg py-0.5">
                    {PHOTO_LABELS[i]}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActionSlot(i)}
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
        Tocá cada recuadro para agregar una foto · Máximo {MAX_PHOTOS} fotos
      </p>

      {/* ── Action sheet: elegir cámara o galería ───────────────────────── */}
      {actionSlot !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setActionSlot(null)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-5 space-y-3 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-center text-sm font-semibold text-gray-500 mb-1">
              Foto — {PHOTO_LABELS[actionSlot]}
            </p>

            <button
              type="button"
              onClick={() => openCamera(actionSlot)}
              className="w-full flex items-center gap-3 py-4 px-4 rounded-2xl bg-brand-50 hover:bg-brand-100 transition-colors text-brand-700 font-semibold"
            >
              <Camera className="w-5 h-5" />
              Sacar foto ahora
            </button>

            <button
              type="button"
              onClick={() => openGallery(actionSlot)}
              className="w-full flex items-center gap-3 py-4 px-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-semibold"
            >
              <ImageIcon className="w-5 h-5" />
              Elegir de la galería
            </button>

            <button
              type="button"
              onClick={() => setActionSlot(null)}
              className="w-full py-3 text-sm text-gray-400 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
        setError('No se pudo obtener la ubicación. Ingresá las coordenadas manualmente.');
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  async function submitCase() {
    setLoading(true);
    setError('');
    try {
      const res = await api.cases.create({
        dog: {
          name:        form.name.trim(),
          breed:       form.breed.trim() || undefined,
          color:       form.color.split(',').map(c => c.trim()).filter(Boolean),
          size:        form.size,
          sex:         form.sex,
          description: form.description.trim() || undefined,
        },
        lastSeenLat:     Number(form.lastSeenLat),
        lastSeenLng:     Number(form.lastSeenLng),
        lastSeenAddress: form.lastSeenAddress.trim() || undefined,
        lastSeenCity:    form.lastSeenCity.trim() || undefined,
        lastSeenAt:      new Date(form.lastSeenAt).toISOString(),
        reward:          form.reward ? Number(form.reward) : undefined,
        contactMethod:   form.contactMethod,
        contactValue:    form.contactValue.trim(),
        behaviorNotes:   form.behaviorNotes.trim() || undefined,
      }) as { data: { id: string } };

      const caseId = res.data.id;

      if (form.photos.length > 0) {
        const fd = new FormData();
        form.photos.forEach(f => fd.append('files', f));
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cases/${caseId}/photos`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('pp_token') ?? ''}` },
          body:    fd,
        });
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
    if (!isLoggedIn()) {
      setShowAuth(true);
      return;
    }
    submitCase();
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
                Agregá hasta 3 fotos en diferentes ángulos · JPG, PNG o WEBP
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
              💡 Tip: frente, perfil y una foto de cuerpo completo aumentan mucho las chances de que alguien lo reconozca
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

        {/* ── Paso 2: Ubicación ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 mb-2">
              <MapPin className="w-8 h-8 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xl font-bold">¿Dónde fue visto por última vez?</h2>
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
                  ? <><Check className="w-4 h-4" /> Ubicación obtenida ({Number(form.lastSeenLat).toFixed(4)}, {Number(form.lastSeenLng).toFixed(4)})</>
                  : <><LocateFixed className="w-4 h-4" /> Usar mi ubicación actual</>
              }
            </button>

            <input className="input" placeholder="Dirección (calle y número)"
              value={form.lastSeenAddress} onChange={e => set('lastSeenAddress', e.target.value)} />

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Ciudad *</label>
              <input className="input" placeholder="Ej: Buenos Aires"
                value={form.lastSeenCity} onChange={e => { set('lastSeenCity', e.target.value); setError(''); }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Latitud</label>
                <input className="input" type="number" step="any" placeholder="-34.6037"
                  value={form.lastSeenLat}
                  onChange={e => { set('lastSeenLat', e.target.value === '' ? '' : Number(e.target.value)); setError(''); }} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Longitud</label>
                <input className="input" type="number" step="any" placeholder="-58.3816"
                  value={form.lastSeenLng}
                  onChange={e => { set('lastSeenLng', e.target.value === '' ? '' : Number(e.target.value)); setError(''); }} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Fecha y hora en que se perdió
              </label>
              <input className="input" type="datetime-local"
                value={form.lastSeenAt} onChange={e => set('lastSeenAt', e.target.value)} />
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
