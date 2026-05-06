'use client';

import { useState } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { saveSession, type StoredUser } from '@/lib/auth';

const API_URL   = process.env.NEXT_PUBLIC_API_URL       ?? 'http://localhost:3001';
const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? '';
const G_CLIENT  = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

interface Props {
  onSuccess: () => void;
  onClose:   () => void;
}

type Mode = 'login' | 'register';

// ── Google icon inline ─────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export function AuthModal({ onSuccess, onClose }: Props) {
  const [mode,          setMode]          = useState<Mode>('login');
  const [email,         setEmail]         = useState('');
  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res: { data: { token: string; user: StoredUser } };

      if (mode === 'login') {
        res = await api.users.login({ email, password: password || undefined }) as typeof res;
      } else {
        if (!password || password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }
        res = await api.users.register({
          email, name, phone: phone || undefined, password, role: 'owner',
        }) as typeof res;
      }

      saveSession(res.data.token, res.data.user);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación';
      if (mode === 'login' && msg.includes('no encontrado')) {
        setMode('register');
        setError('No tenés cuenta todavía. Completá tu nombre y contraseña para registrarte.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setPassword('');
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'login' ? 'Ingresá para continuar' : 'Creá tu cuenta'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? 'Necesitamos saber quién publica el reporte'
              : 'Es rápido, solo necesitamos tu nombre y email'}
          </p>
        </div>

        {/* ── Botones OAuth ──────────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          {/* Google */}
          {G_CLIENT && (
            <a
              href={`${API_URL}/api/v1/users/auth/google`}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-2xl
                         border-2 border-gray-200 text-gray-700 font-semibold text-sm
                         hover:bg-gray-50 transition-colors"
            >
              <GoogleIcon />
              Continuar con Google
            </a>
          )}

          {/* Facebook */}
          {FB_APP_ID && (
            <a
              href={`${API_URL}/api/v1/users/auth/facebook`}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-2xl
                         bg-[#1877F2] text-white font-semibold text-sm hover:bg-[#166FE5]
                         transition-colors"
            >
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.79-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.099 24 12.073z"/>
              </svg>
              Continuar con Facebook
            </a>
          )}
        </div>

        {/* Divider */}
        {(G_CLIENT || FB_APP_ID) && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">o con email y contraseña</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* ── Formulario email + contraseña ─────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-3">
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
            placeholder="Email *"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus={mode === 'login'}
          />

          {/* Contraseña */}
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'login' ? 'Contraseña' : 'Contraseña (mín. 6 caracteres) *'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required={mode === 'register'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

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
            disabled={loading || !email || (mode === 'register' && (!name || !password))}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>

          <p className="text-center text-xs text-gray-400">
            {mode === 'login' ? (
              <>¿No tenés cuenta?{' '}
                <button type="button" onClick={() => switchMode('register')}
                  className="text-brand-600 font-medium underline">Registrate</button>
              </>
            ) : (
              <>¿Ya tenés cuenta?{' '}
                <button type="button" onClick={() => switchMode('login')}
                  className="text-brand-600 font-medium underline">Iniciá sesión</button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
