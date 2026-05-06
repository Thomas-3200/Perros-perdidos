'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser, isLoggedIn } from '@/lib/auth';

const SIZES  = [
  { value: 'small',       label: 'Pequeño (hasta 10 kg)' },
  { value: 'medium',      label: 'Mediano (10–25 kg)' },
  { value: 'large',       label: 'Grande (25–45 kg)' },
  { value: 'extra_large', label: 'Extra grande (+ 45 kg)' },
];
const SEXES  = [
  { value: 'male',    label: 'Macho' },
  { value: 'female',  label: 'Hembra' },
  { value: 'unknown', label: 'Desconocido' },
];
const CONTACT_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone',    label: 'Teléfono' },
  { value: 'email',    label: 'Email' },
];

interface CaseData {
  id:              string;
  status:          string;
  lastSeenAt:      string;
  lastSeenAddress?: string;
  lastSeenCity?:   string;
  lastSeenCountry?: string;
  reward?:         number;
  rewardCurrency?: string;
  behaviorNotes?:  string;
  contactMethod:   string;
  contactValue:    string;
  owner: { id: string };
  dog: {
    name:         string;
    breed?:       string;
    color:        string[];
    size:         string;
    sex:          string;
    age?:         number;
    description?: string;
  };
}

export default function EditCasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  // Datos del perro
  const [dogName,   setDogName]   = useState('');
  const [dogBreed,  setDogBreed]  = useState('');
  const [dogColor,  setDogColor]  = useState('');
  const [dogSize,   setDogSize]   = useState('medium');
  const [dogSex,    setDogSex]    = useState('unknown');
  const [dogAge,    setDogAge]    = useState('');
  const [dogDesc,   setDogDesc]   = useState('');

  // Datos del caso
  const [address,    setAddress]    = useState('');
  const [city,       setCity]       = useState('');
  const [country,    setCountry]    = useState('');
  const [lastSeenAt, setLastSeenAt] = useState('');
  const [reward,     setReward]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [contactM,   setContactM]   = useState('whatsapp');
  const [contactV,   setContactV]   = useState('');

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/'); return; }

    api.cases.get(id)
      .then((res: unknown) => {
        const c = (res as { data: CaseData }).data;
        if (!c) { router.replace('/perfil'); return; }

        // Verificar que el usuario es el dueño
        const me = getUser();
        if (me?.id !== c.owner.id) { router.replace(`/casos/${id}`); return; }

        // Rellenar form
        setDogName(c.dog.name);
        setDogBreed(c.dog.breed ?? '');
        setDogColor(c.dog.color.join(', '));
        setDogSize(c.dog.size);
        setDogSex(c.dog.sex);
        setDogAge(c.dog.age?.toString() ?? '');
        setDogDesc(c.dog.description ?? '');
        setAddress(c.lastSeenAddress ?? '');
        setCity(c.lastSeenCity ?? '');
        setCountry(c.lastSeenCountry ?? '');
        setLastSeenAt(c.lastSeenAt.slice(0, 16)); // yyyy-MM-ddTHH:mm
        setReward(c.reward?.toString() ?? '');
        setNotes(c.behaviorNotes ?? '');
        setContactM(c.contactMethod);
        setContactV(c.contactValue);
      })
      .catch(() => router.replace('/perfil'))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const colors = dogColor.split(',').map(s => s.trim()).filter(Boolean);
      await (api.cases as unknown as { update: (id: string, data: unknown) => Promise<unknown> })
        .update(id, {
          dogName:    dogName.trim(),
          dogBreed:   dogBreed.trim() || undefined,
          dogColor:   colors,
          dogSize,
          dogSex,
          dogAge:         dogAge ? Number(dogAge) : undefined,
          dogDescription: dogDesc.trim() || undefined,
          lastSeenAddress: address.trim() || undefined,
          lastSeenCity:    city.trim() || undefined,
          lastSeenCountry: country.trim() || undefined,
          lastSeenAt:      lastSeenAt ? new Date(lastSeenAt).toISOString() : undefined,
          reward:          reward ? Number(reward) : null,
          behaviorNotes:   notes.trim() || undefined,
          contactMethod:   contactM,
          contactValue:    contactV.trim(),
        });
      setSuccess(true);
      setTimeout(() => router.replace(`/casos/${id}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Caso actualizado</h2>
        <p className="text-gray-500 text-sm">Los cambios se guardaron correctamente.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Editar caso</h1>
          <p className="text-xs text-gray-400">Actualizá la información del caso</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="px-4 py-6 space-y-6">

        {/* ── Datos del perro ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Datos del perro</h2>

          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={dogName} onChange={e => setDogName(e.target.value)} required placeholder="Ej: Luna" />
          </div>

          <div>
            <label className="label">Raza</label>
            <input className="input" value={dogBreed} onChange={e => setDogBreed(e.target.value)} placeholder="Ej: Labrador" />
          </div>

          <div>
            <label className="label">Colores</label>
            <input className="input" value={dogColor} onChange={e => setDogColor(e.target.value)}
              placeholder="Ej: marrón, blanco (separados por coma)" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tamaño</label>
              <select className="input" value={dogSize} onChange={e => setDogSize(e.target.value)}>
                {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sexo</label>
              <select className="input" value={dogSex} onChange={e => setDogSex(e.target.value)}>
                {SEXES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Edad (años)</label>
            <input className="input" type="number" min={0} max={25} value={dogAge}
              onChange={e => setDogAge(e.target.value)} placeholder="Ej: 3" />
          </div>

          <div>
            <label className="label">Descripción y señas particulares</label>
            <textarea className="input resize-none h-24" value={dogDesc}
              onChange={e => setDogDesc(e.target.value)}
              placeholder="Collar, cicatrices, comportamiento especial…" />
          </div>
        </section>

        {/* ── Datos del caso ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Último avistamiento</h2>

          <div>
            <label className="label">Dirección</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Ej: Av. Santa Fe 1234" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Buenos Aires" />
            </div>
            <div>
              <label className="label">País</label>
              <input className="input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Argentina" />
            </div>
          </div>

          <div>
            <label className="label">Fecha y hora de pérdida</label>
            <input className="input" type="datetime-local" value={lastSeenAt}
              onChange={e => setLastSeenAt(e.target.value)} />
          </div>

          <div>
            <label className="label">Notas de comportamiento</label>
            <textarea className="input resize-none h-20" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Asustadizo, sociable, tiende a esconderse…" />
          </div>

          <div>
            <label className="label">Recompensa (ARS)</label>
            <input className="input" type="number" min={0} value={reward}
              onChange={e => setReward(e.target.value)} placeholder="Ej: 50000 (dejar vacío si no hay)" />
          </div>
        </section>

        {/* ── Contacto ─────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Contacto</h2>

          <div>
            <label className="label">Método de contacto</label>
            <select className="input" value={contactM} onChange={e => setContactM(e.target.value)}>
              {CONTACT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Número / Email *</label>
            <input className="input" value={contactV} onChange={e => setContactV(e.target.value)}
              required placeholder="Ej: +54 11 1234-5678" />
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => router.back()}
            className="flex-1 btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !dogName.trim() || !contactV.trim()}
            className="flex-1 btn-primary flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              : <><Check className="w-4 h-4" /> Guardar cambios</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}
