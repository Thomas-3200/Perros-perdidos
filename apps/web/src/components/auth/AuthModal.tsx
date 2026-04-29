'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { saveSession, type StoredUser } from '@/lib/auth';

interface Props {
  onSuccess: () => void;
  onClose:   () => void;
}

type Mode = 'login' | 'register';

export function AuthModal({ onSuccess, onClose }: Props) {
  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res: { data: { token: string; user: StoredUser } };

      if (mode === 'login') {
        res = await api.users.login({ email }) as typeof res;
      } else {
        res = await api.users.register({ email, name, phone: phone || undefined, role: 'owner' }) as typeof res;
      }

      saveSession(res.data.token, res.data.user);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación';
      if (mode === 'login' && msg.includes('no encontrado')) {
        setMode('register');
        setError('No tenés cuenta todavía. Completá tu nombre para registrarte.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'login' ? 'Ingresá para continuar' : 'Creá tu cuenta'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? 'Necesitamos saber quién publica el reporte'
              : 'Es rápido, solo necesitamos tu nombre y email'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              className="input"
              placeholder="Tu nombre *"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          )}

          <input
            className="input"
            type="email"
            placeholder="Tu email *"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus={mode === 'login'}
          />

          {mode === 'register' && (
            <input
              className="input"
              type="tel"
              placeholder="Teléfono (opcional)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          )}

          {error && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || (mode === 'register' && !name)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Continuar' : 'Crear cuenta y publicar'}
          </button>

          <p className="text-center text-xs text-gray-400">
            {mode === 'login' ? (
              <>¿No tenés cuenta?{' '}
                <button type="button" onClick={() => { setMode('register'); setError(''); }}
                  className="text-brand-600 font-medium underline">Registrate</button>
              </>
            ) : (
              <>¿Ya tenés cuenta?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(''); }}
                  className="text-brand-600 font-medium underline">Iniciá sesión</button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
