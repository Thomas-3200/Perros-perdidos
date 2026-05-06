'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { saveSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code       = searchParams.get('code');
    const tokenParam = searchParams.get('token'); // backward compat (no debería llegar)
    const error      = searchParams.get('error');

    if (!code && !tokenParam) {
      router.replace(`/?error=${error ?? 'unknown'}`);
      return;
    }

    async function handleCallback() {
      let token = tokenParam;

      // Canjear el código de un solo uso por el JWT real
      if (code) {
        try {
          const res  = await fetch(`${API_URL}/api/v1/users/auth/exchange?code=${code}`);
          const json = await res.json() as { success: boolean; data?: { token: string } };
          if (!json?.data?.token) {
            router.replace('/?error=exchange_failed');
            return;
          }
          token = json.data.token;
        } catch {
          router.replace('/?error=exchange_failed');
          return;
        }
      }

      if (!token) {
        router.replace('/?error=no_token');
        return;
      }

      // Guardar token y buscar perfil completo
      localStorage.setItem('pp_token', token);

      try {
        const r   = await fetch(`${API_URL}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await r.json() as { data?: { id: string; name: string; email: string; role: string } };
        if (res?.data) saveSession(token, res.data);
      } catch {
        // Si falla el fetch de perfil, redirigir igual (el token ya está guardado)
      }

      const returnTo = sessionStorage.getItem('pp_return_to') ?? '/perfil';
      sessionStorage.removeItem('pp_return_to');
      router.replace(returnTo);
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Iniciando sesión…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
