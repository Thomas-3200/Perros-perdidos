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
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (!token) {
      router.replace(`/?error=${error ?? 'unknown'}`);
      return;
    }

    // Guardar token inmediatamente y luego buscar perfil completo
    localStorage.setItem('pp_token', token);

    fetch(`${API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((res: { data: { id: string; name: string; email: string; role: string } }) => {
        if (res?.data) {
          saveSession(token, res.data);
        }
        const returnTo = sessionStorage.getItem('pp_return_to') ?? '/perfil';
        sessionStorage.removeItem('pp_return_to');
        router.replace(returnTo);
      })
      .catch(() => {
        // Si falla el fetch, redirigir igual
        const returnTo = sessionStorage.getItem('pp_return_to') ?? '/perfil';
        sessionStorage.removeItem('pp_return_to');
        router.replace(returnTo);
      });
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
