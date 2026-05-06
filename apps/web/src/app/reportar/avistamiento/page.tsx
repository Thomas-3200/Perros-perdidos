'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, MapPin, ChevronLeft, Check, LocateFixed, Loader2, Heart, Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { PhotoPicker } from '@/components/ui/PhotoPicker';

const DOG_STATUS_OPTIONS = [
  { value: 'still_there', label: '📍 Sigue ahí',   desc: 'El perro todavía está en ese lugar' },
  { value: 'gone',        label: '🏃 Ya se fue',   desc: 'Vi al perro pero ya no está' },
  { value: 'retained',    label: '🏠 Lo tengo yo', desc: 'Tengo al perro conmigo o lo guardé' },
  { value: 'injured',     label: '🩹 Está herido',  desc: 'El perro parece estar lastimado' },
  { value: 'unknown',     label: '❓ No sé',         desc: 'No puedo confirmarlo' },
];

/* ── Opciones de tiempo con claves fijas ────────────────────────────────── */
type TimeKey = 'now' | '1h' | '2h' | 'yesterday' | 'custom';

const TIME_OPTIONS: { key: TimeKey; label: string }[] = [
  { key: 'now',       label: '🟢 Ahora mismo'        },
  { key: '1h',        label: '🕐 Hace 1 hora aprox'  },
  { key: '2h',        label: '🕒 Más de 2 horas'     },
  { key: 'yesterday', label: '📅 Ayer'                },
  { key: 'custom',    label: '📆 Otro momento'        },
];

function timeKeyToISO(key: TimeKey, customDate: string): string {
  const now = new Date();
  switch (key) {
    case 'now':       return now.toISOString();
    case '1h':        return new Date(now.getTime() - 3_600_000).toISOString();
    case '2h':        return new Date(now.getTime() - 7_200_000).toISOString();
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      y.setHours(12, 0, 0, 0);
      return y.toISOString();
    }
    case 'custom':    return new Date(customDate).toISOString();
  }
}

/* ── Reverse geocoding con Nominatim (gratuito) ─────────────────────────── */
async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; address: string }> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } },
    );
    const data = await res.json();
    const a    = data.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? '';
    const neighbourhood = a.neighbourhood ?? a.suburb ?? a.quarter ?? '';
    const address = neighbourhood
      ? `${neighbourhood}, ${city}`
      : (data.display_name?.split(',').slice(0, 2).join(',').trim() ?? '');
    return { city, address };
  } catch {
    return { city: '', address: '' };
  }
}

const TOTAL_STEPS = 3;

export default function ReportarAvistamientoPage() {
  const router = useRouter();

  const [step,       setStep]       = useState(0);
  const [photo,      setPhoto]      = useState<File | null>(null);
  const [status,     setStatus]     = useState('unknown');
  const [lat,        setLat]        = useState('');
  const [lng,        setLng]        = useState('');
  const [city,       setCity]       = useState('');
  const [address,    setAddress]    = useState('');   // barrio / zona
  const [exactAddr,  setExactAddr]  = useState('');   // calle y número exactos
  const [desc,       setDesc]       = useState('');
  const [timeKey,    setTimeKey]    = useState<TimeKey>('now');
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 16));
  const [loading,    setLoading]    = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [showAuth,   setShowAuth]   = useState(false);
  const [done,       setDone]       = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  /* ── Manejo del botón back del navegador / móvil ─────────────────────── */
  useEffect(() => {
    if (step === 0) return; // en paso 0 el back nativo puede salir

    // Empujamos un estado al historial para interceptar el back
    window.history.pushState({ step }, '', window.location.href);

    const handlePop = () => {
      setStep(s => {
        if (s > 0) return s - 1;
        return s;
      });
    };

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [step]);

  const geolocate = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setLat(String(latitude));
        setLng(String(longitude));

        const geo = await reverseGeocode(latitude, longitude);
        if (geo.city)    setCity(geo.city);
        if (geo.address) setAddress(geo.address);

        setLocationConfirmed(true);
        setGeoLoading(false);
      },
      () => {
        setError('No se pudo obtener la ubicación. Ingresá la ciudad manualmente.');
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  function goNext() {
    setError('');
    setStep(s => s + 1);
  }

  async function doSubmit() {
    setLoading(true);
    setError('');
    try {
      const seenAtISO = timeKeyToISO(timeKey, customDate);

      // Armar descripción de dirección completa para la API
      const fullAddress = [exactAddr, address].filter(Boolean).join(', ');

      const fd = new FormData();
      if (photo) fd.append('files', photo);
      fd.append('locationLat',     lat || '-34.6037');
      fd.append('locationLng',     lng || '-58.3816');
      fd.append('locationAddress', fullAddress);
      fd.append('locationCity',    city);
      fd.append('seenAt',          seenAtISO);
      fd.append('dogStatus',       status);
      fd.append('description',     desc);

      await api.sightings.create(fd);
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar el avistamiento');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (!isLoggedIn()) { setShowAuth(true); return; }
    doSubmit();
  }

  /* ── Éxito ────────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Heart className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Gracias! 🐾</h2>
          <p className="text-gray-500 text-base leading-relaxed">
            Tu avistamiento fue enviado. Esto puede ayudar a alguien a encontrar a su perro.
          </p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">
            Volver al inicio
          </button>
          <button onClick={() => { setDone(false); setStep(0); setPhoto(null); setCity(''); setAddress(''); setExactAddr(''); setDesc(''); setTimeKey('now'); setLocationConfirmed(false); }}
            className="btn-secondary w-full">
            Reportar otro avistamiento
          </button>
        </div>
      </div>
    );
  }

  /* ── Formulario ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && (
        <AuthModal
          onSuccess={() => { setShowAuth(false); doSubmit(); }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Reportar avistamiento</h1>
          <p className="text-xs text-gray-400">Paso {step + 1} de {TOTAL_STEPS}</p>
        </div>
      </header>

      {/* Barra de progreso */}
      <div className="w-full h-1 bg-gray-200">
        <div
          className="h-1 bg-brand-500 transition-all duration-300"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── PASO 0: Foto ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center">
              <Camera className="w-12 h-12 text-brand-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Foto del perro que viste</h2>
              <p className="text-gray-500 text-sm mt-1">
                La foto ayuda a comparar con los casos activos
              </p>
            </div>

            {photo && (
              <div className="rounded-2xl overflow-hidden border border-gray-200">
                <img
                  src={URL.createObjectURL(photo)}
                  alt="preview"
                  className="w-full max-h-64 object-contain bg-gray-50"
                />
              </div>
            )}

            <PhotoPicker onFile={f => setPhoto(f)} />

            <button onClick={goNext} className="btn-primary w-full py-4">
              {photo ? 'Siguiente →' : 'Continuar sin foto →'}
            </button>
          </div>
        )}

        {/* ── PASO 1: Ubicación + Cuándo + Estado ──────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <MapPin className="w-8 h-8 text-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold">¿Dónde y cuándo lo viste?</h2>
                <p className="text-gray-500 text-sm">La ubicación es clave para conectarlo con el dueño</p>
              </div>
            </div>

            {/* ── Ubicación ── */}
            <div className="space-y-3">
              {/* GPS primero */}
              <button
                type="button"
                onClick={geolocate}
                disabled={geoLoading}
                className={`w-full flex items-center justify-center gap-3 py-4 px-4 rounded-2xl
                  border-2 font-semibold text-sm transition-colors ${
                  locationConfirmed
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100'
                }`}
              >
                {geoLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Obteniendo ubicación...</>
                ) : locationConfirmed ? (
                  <><Check className="w-5 h-5" /> Ubicación detectada automáticamente</>
                ) : (
                  <><LocateFixed className="w-5 h-5" /> Usar mi ubicación actual (recomendado)</>
                )}
              </button>

              {/* Mapa mini de confirmación */}
              {locationConfirmed && lat && lng && (
                <div className="rounded-2xl overflow-hidden border border-green-200 bg-green-50">
                  <iframe
                    title="Ubicación detectada"
                    width="100%"
                    height="160"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng)-0.005},${Number(lat)-0.005},${Number(lng)+0.005},${Number(lat)+0.005}&layer=mapnik&marker=${lat},${lng}`}
                    className="border-0"
                  />
                  <div className="px-3 py-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700 font-medium truncate">
                      {address || city || 'Ubicación obtenida'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">— o ingresá la dirección manualmente —</p>

              {/* Ciudad */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Ciudad <span className="text-red-400">*</span>
                </label>
                <input
                  className="input"
                  placeholder="Ej: Buenos Aires, Córdoba, Rosario..."
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>

              {/* Dirección exacta */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Dirección exacta
                </label>
                <input
                  className="input"
                  placeholder="Ej: Av. Corrientes 1234, esquina Larrea"
                  value={exactAddr}
                  onChange={e => setExactAddr(e.target.value)}
                />
              </div>

              {/* Barrio / referencia */}
              <input
                className="input"
                placeholder="Barrio o referencia (ej: Palermo, frente a la plaza)"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            {/* ── Cuándo ── */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" /> ¿Cuándo lo viste?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTimeKey(opt.key)}
                    className={`py-3 px-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                      timeKey === opt.key
                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Picker sólo si eligió "Otro momento" */}
              {timeKey === 'custom' && (
                <input
                  className="input mt-1"
                  type="datetime-local"
                  value={customDate}
                  max={new Date().toISOString().slice(0, 16)}
                  onChange={e => setCustomDate(e.target.value)}
                />
              )}
            </div>

            {/* ── Estado del perro ── */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                ¿Cómo estaba el perro?
              </label>
              <div className="space-y-2">
                {DOG_STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      status === opt.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-brand-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>
            )}

            <button
              onClick={goNext}
              disabled={!city}
              className="btn-primary w-full py-4 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* ── PASO 2: Descripción + Enviar ─────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">¿Algo más que recordás?</h2>
            <p className="text-gray-500 text-sm">
              Opcional — pero ayuda mucho para identificarlo
            </p>
            <textarea
              className="input resize-none h-32"
              placeholder="Color, tamaño, collar, si estaba asustado o manso, si tenía heridas, si tenía nombre en la chapa..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />

            {/* Resumen de lo que se va a enviar */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1 text-sm">
              <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Resumen</p>
              {city && <p className="text-gray-600">📍 {[exactAddr, address, city].filter(Boolean).join(', ')}</p>}
              <p className="text-gray-600">🕐 {TIME_OPTIONS.find(o => o.key === timeKey)?.label ?? 'No especificado'}</p>
              <p className="text-gray-600">🐕 {DOG_STATUS_OPTIONS.find(o => o.value === status)?.label ?? 'No especificado'}</p>
              {photo && <p className="text-gray-600">📸 Foto adjunta</p>}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                : <><Check className="w-5 h-5" /> Enviar avistamiento</>
              }
            </button>

            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="btn-secondary w-full text-sm"
            >
              ← Volver y editar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
