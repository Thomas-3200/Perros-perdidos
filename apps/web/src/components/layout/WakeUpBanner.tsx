'use client';

/**
 * Detecta el cold-start del free tier de Render (~30-60s) y muestra
 * un banner amigable que explica al usuario qué pasa, en vez de
 * dejarlo viendo una pantalla en blanco.
 */
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Status = 'idle' | 'showing' | 'success' | 'error';

export function WakeUpBanner() {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    // Timeout: si después de 3s no respondió → mostrar banner
    const showTimer = setTimeout(() => {
      setStatus(curr => curr === 'idle' ? 'showing' : curr);
    }, 3000);

    const start = Date.now();

    fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(90_000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        clearTimeout(showTimer);
        const elapsed = Date.now() - start;
        // Si tardó más de 3s, fue cold-start: mostrar success brevemente
        if (elapsed > 3000) {
          setStatus('success');
          setTimeout(() => setStatus('idle'), 2500);
        } else {
          setStatus('idle');
        }
      })
      .catch(() => {
        clearTimeout(showTimer);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      });

    return () => clearTimeout(showTimer);
  }, []);

  if (status === 'idle') return null;

  const config = {
    showing: {
      bg:   'bg-amber-50 border-amber-200 text-amber-800',
      icon: <Loader2 className="w-4 h-4 animate-spin shrink-0" />,
      text: '🐾 Despertando el servidor… (menos de un minuto). Estamos en plan gratuito ayudando perros, gracias por la paciencia.',
    },
    success: {
      bg:   'bg-green-50 border-green-200 text-green-800',
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
      text: '✓ Listo, todo funcionando',
    },
    error: {
      bg:   'bg-red-50 border-red-200 text-red-700',
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
      text: 'No pudimos conectar al servidor. Revisá tu conexión y refrescá la página.',
    },
  } as const;

  const c = config[status as keyof typeof config];

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-3 pt-3 pointer-events-none">
      <div className={`max-w-md mx-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-sm ${c.bg}`}>
        {c.icon}
        <p className="text-xs leading-snug font-medium">{c.text}</p>
      </div>
    </div>
  );
}
