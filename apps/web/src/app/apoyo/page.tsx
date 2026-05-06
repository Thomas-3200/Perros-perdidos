'use client';

/**
 * Pantalla: Apoyo Emocional
 * Chat con IA empática (Claude) para dueños que aún buscan a su perro.
 *
 * Flujo:
 * 1. Si llega con ?caseId=xxx → auto-inicia la sesión para ese caso
 * 2. Si tiene casos activos propios → muestra lista para elegir
 * 3. Si no tiene casos → sugiere reportar uno primero
 */
import { useState, useRef, useEffect, Suspense } from 'react';
import { Heart, Send, ChevronLeft, AlertCircle, Clock, Dog } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LostCase {
  id: string;
  status: string;
  dog: { name: string; breed: string; photos: string[] };
  lastSeenCity: string;
  lastSeenAt: string;
}

async function fetchMyCases(): Promise<LostCase[]> {
  try {
    const res = await api.cases.mine() as { data: LostCase[] };
    return (res.data ?? []).filter(c => c.status === 'active');
  } catch {
    return [];
  }
}

// Wrapper con Suspense requerido por Next.js cuando se usa useSearchParams()
export default function ApoyoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Heart className="w-10 h-10 text-brand-400 animate-pulse" /></div>}>
      <ApoyoContent />
    </Suspense>
  );
}

function ApoyoContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlCaseId    = searchParams.get('caseId') ?? '';

  const [sessionId, setSessionId] = useState('');
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [phase,     setPhase]     = useState<'setup' | 'chat'>('setup');
  const [selectedCase, setSelectedCase] = useState<LostCase | null>(null);
  const [startError,   setStartError]   = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Estado del módulo IA
  const { data: statusData, isLoading: statusLoading } = useSWR(
    'support-status',
    () => api.support.status() as Promise<{ data: { available: boolean } }>,
    { revalidateOnFocus: false },
  );
  const aiAvailable = statusData?.data?.available ?? true;

  // Casos activos del usuario
  const { data: myCases, isLoading: casesLoading } = useSWR(
    'my-active-cases',
    fetchMyCases,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Si viene con ?caseId y tenemos los casos, auto-selecciona
  useEffect(() => {
    if (urlCaseId && myCases && myCases.length > 0 && !selectedCase) {
      const found = myCases.find(c => c.id === urlCaseId);
      if (found) setSelectedCase(found);
    }
  }, [urlCaseId, myCases, selectedCase]);

  // Auto-inicia sesión cuando hay un caso seleccionado por URL
  useEffect(() => {
    if (selectedCase && urlCaseId && phase === 'setup' && !loading && !sessionId) {
      startSession(selectedCase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCase, urlCaseId]);

  async function startSession(lostCase: LostCase) {
    setStartError('');
    setLoading(true);
    try {
      const res = await api.support.startSession(lostCase.id) as { data: { id: string } };
      setSessionId(res.data.id);
      setSelectedCase(lostCase);
      setPhase('chat');
      const daysMissing = Math.floor(
        (Date.now() - new Date(lostCase.lastSeenAt).getTime()) / 86_400_000
      );
      const intro = daysMissing === 0
        ? `💙 Hola. Estoy aquí para acompañarte. Cuéntame, ¿cómo te sentís desde que ${lostCase.dog.name} se perdió?`
        : `💙 Hola. Sé que llevan ${daysMissing} día${daysMissing !== 1 ? 's' : ''} buscando a ${lostCase.dog.name}. Eso debe ser muy difícil. Cuéntame, ¿cómo estás?`;
      setMessages([{ role: 'assistant', content: intro }]);
    } catch {
      setStartError('No se pudo iniciar la sesión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const res = await api.support.chat(sessionId, userMsg) as { data: { reply: string } };
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error. Por favor intentá de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  }

  // ── IA no disponible ───────────────────────────────────────────────────────
  if (!statusLoading && !aiAvailable) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header onBack={() => router.back()} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm py-12">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Próximamente</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              El asistente de apoyo emocional está en preparación y estará disponible muy pronto.
            </p>
            <div className="bg-brand-50 rounded-2xl px-4 py-3 text-sm text-brand-700">
              Mientras tanto, contactá refugios y veterinarias de tu zona.
            </div>
            <button onClick={() => router.back()} className="btn-secondary w-full">Volver</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat activo ────────────────────────────────────────────────────────────
  if (phase === 'chat') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header onBack={() => router.back()}>
          {selectedCase && (
            <span className="text-xs text-gray-400 font-normal">
              Hablando sobre <strong className="text-gray-600">{selectedCase.dog.name}</strong>
            </span>
          )}
        </Header>
        <Disclaimer />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-lg mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx(
                'max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-brand-500 text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm',
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <div className="max-w-lg mx-auto flex gap-2">
            <input
              className="input flex-1"
              placeholder="Escribe aquí..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-brand-500 hover:bg-brand-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup: elegir caso ─────────────────────────────────────────────────────
  const isLoadingSetup = statusLoading || casesLoading || loading;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header onBack={() => router.back()} />
      <Disclaimer />

      <div className="max-w-md mx-auto px-4 py-10 space-y-6 w-full">
        {/* Hero */}
        <div className="text-center space-y-2">
          <Heart className="w-14 h-14 text-brand-500 mx-auto fill-current opacity-80" />
          <h2 className="text-2xl font-bold text-gray-800">Estamos contigo</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Este espacio es para acompañarte mientras buscás a tu compañero.
            Elegí el caso sobre el que querés hablar.
          </p>
        </div>

        {/* Lista de casos */}
        {isLoadingSetup && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoadingSetup && myCases && myCases.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600">Tus casos activos:</p>
            {myCases.map(c => {
              const daysMissing = Math.floor(
                (Date.now() - new Date(c.lastSeenAt).getTime()) / 86_400_000
              );
              return (
                <button
                  key={c.id}
                  onClick={() => startSession(c)}
                  disabled={loading}
                  className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 hover:border-brand-300 hover:bg-brand-50 rounded-2xl p-4 transition-all text-left disabled:opacity-50"
                >
                  {c.dog.photos?.[0] ? (
                    <img
                      src={c.dog.photos[0]}
                      alt={c.dog.name}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Dog className="w-7 h-7 text-brand-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{c.dog.name}</p>
                    <p className="text-sm text-gray-500">{c.dog.breed} · {c.lastSeenCity}</p>
                    <p className="text-xs text-brand-600 font-medium mt-0.5">
                      {daysMissing === 0
                        ? 'Perdido hoy'
                        : `${daysMissing} día${daysMissing !== 1 ? 's' : ''} buscando`}
                    </p>
                  </div>
                  <div className="text-brand-500 text-sm font-semibold">Hablar →</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Sin casos activos */}
        {!isLoadingSetup && myCases && myCases.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-3">
            <Dog className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-gray-600 font-medium">No tenés casos activos</p>
            <p className="text-gray-400 text-sm">
              El apoyo emocional está disponible para dueños con un reporte activo de perro perdido.
            </p>
            <button onClick={() => router.push('/reportar/perdido')} className="btn-primary w-full">
              Reportar perro perdido
            </button>
          </div>
        )}

        {startError && (
          <p className="text-red-500 text-sm text-center">{startError}</p>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Header({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
      <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <Heart className="w-5 h-5 text-brand-500" />
        <div>
          <h1 className="font-bold text-gray-900">Apoyo emocional</h1>
          {children ?? (
            <p className="text-xs text-gray-400">Asistente IA empático · No reemplaza terapia profesional</p>
          )}
        </div>
      </div>
    </header>
  );
}

function Disclaimer() {
  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p className="text-xs text-amber-700">
        Este espacio es de contención y guía práctica. Si estás en crisis, buscá apoyo profesional.
      </p>
    </div>
  );
}
