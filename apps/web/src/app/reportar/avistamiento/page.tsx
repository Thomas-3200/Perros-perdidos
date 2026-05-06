'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, MapPin, ChevronLeft, Check, LocateFixed, Loader2, Heart,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';

const DOG_STATUS_OPTIONS = [
  { value: 'still_there', label: '📍 Sigue ahí',   desc: 'El perro todavía está en ese lugar' },
  { value: 'gone',        label: '🏃 Ya se fue',   desc: 'Vi al perro pero ya no está' },
  { value: 'retained',   label: '🏠 Lo tengo yo',  desc: 'Tengo al perro conmigo o lo guardé' },
  { value: 'injured',    label: '🩹 Está herido',  desc: 'El perro parece estar lastimado' },
  { value: 'unknown',    label: '❓ No sé',          desc: 'No puedo confirmarlo' },
];

export default function ReportarAvistamientoPage() {
  const router = useRouter();
  const [step,       setStep]       = useState(0);
  const [photo,      setPhoto]      = useState<File | null>(null);
  const [status,     setStatus]     = useState('unknown');
  const [lat,        setLat]        = useState('');
  const [lng,        setLng]        = useState('');
  const [city,       setCity]       = useState('');
  const [address,    setAddress]    = useState('');
  const [desc,       setDesc]       = useState('');
  const [seenAt,     setSeenAt]     = useState(new Date().toISOString().slice(0, 16));
  const [loading,    setLoading]    = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [showAuth,   setShowAuth]   = useState(false);
  const [done,       setDone]       = useState(false);

  const geolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
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

  async function doSubmit() {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      if (photo) fd.append('files', photo);
      fd.append('locationLat',     lat || '-34.6037');
      fd.append('locationLng',     lng || '-58.3816');
      fd.append('locationAddress', address);
      fd.append('locationCity',    city);
      fd.append('seenAt',          new Date(seenAt).toISOString());
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

  // Pantalla de éxito
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Heart className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Gracias!</h2>
          <p className="text-gray-500 text-base leading-relaxed">
            Gracias. Esto puede ayudar a alguien a encontrar a su perro.
          </p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">
            Volver al inicio
          </button>
          <button onClick={() => router.push('/reportar/avistamiento')} className="btn-secondary w-full">
            Reportar otro avistamiento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && (
        <AuthModal
          onSuccess={() => { setShowAuth(false); doSubmit(); }}
          onClose={() => setShowAuth(false)}
        />
      )}

      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Reportar avistamiento</h1>
          <p className="text-xs text-gray-400">Paso {step + 1} de 3</p>
        </div>
      </header>

      <div className="w-full h-1 bg-gray-200">
        <div
          className="h-1 bg-brand-500 transition-all duration-300"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── Paso 0: Foto ────────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center">
              <Camera className="w-12 h-12 text-brand-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Foto del perro que viste</h2>
              <p className="text-gray-500 text-sm mt-1">
                La foto ayuda a comparar con los casos activos
              </p>
            </div>

            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 hover:border-brand-400 rounded-2xl p-10 text-center transition-colors">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(photo)}
                    alt="preview"
                    className="w-full max-h-64 object-contain rounded-xl mx-auto"
                  />
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-500">Toca para tomar o elegir una foto</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>

            <button onClick={() => setStep(1)} className="btn-primary w-full">
              {photo ? 'Siguiente →' : 'Continuar sin foto →'}
            </button>
          </div>
        )}

        {/* ── Paso 1: Ubicación + Estado ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-8 h-8 text-brand-500" />
              <div>
                <h2 className="text-xl font-bold">¿Dónde lo viste?</h2>
                <p className="text-gray-500 text-sm">La ubicación es clave para conectarlo con el dueño</p>
              </div>
            </div>

            {/* Botón GPS */}
            <button
              type="button"
              onClick={geolocate}
              disabled={geoLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-colors ${
                lat
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              {geoLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación...</>
                : lat
                  ? <><Check className="w-4 h-4" /> Ubicación obtenida ({Number(lat).toFixed(4)}, {Number(lng).toFixed(4)})</>
                  : <><LocateFixed className="w-4 h-4" /> Usar mi ubicación actual</>
              }
            </button>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Ciudad *</label>
              <input
                className="input"
                placeholder="Ej: Buenos Aires"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>

            <input
              className="input"
              placeholder="Dirección o referencia (opcional)"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Latitud</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="-34.6037"
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Longitud</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="-58.3816"
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">¿Cuándo lo viste?</label>
              <input
                className="input"
                type="datetime-local"
                value={seenAt}
                onChange={e => setSeenAt(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">Estado del perro</label>
              <div className="space-y-2">
                {DOG_STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      status === opt.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
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
              onClick={() => setStep(2)}
              disabled={!city}
              className="btn-primary w-full"
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* ── Paso 2: Descripción + Enviar ────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">¿Algo más que quieras agregar?</h2>
            <p className="text-gray-500 text-sm">
              Esta parte es opcional pero ayuda a identificar mejor al perro
            </p>
            <textarea
              className="input resize-none h-32"
              placeholder="Color, tamaño aproximado, collar, comportamiento..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />

            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                : <><Check className="w-5 h-5" /> Enviar avistamiento</>
              }
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-secondary w-full text-sm text-gray-500"
            >
              Saltar descripción y enviar igualmente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
