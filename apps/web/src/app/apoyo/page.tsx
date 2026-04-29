'use client';

/**
 * Pantalla: Apoyo Emocional
 * Chat con IA empática (Claude) para dueños que aún buscan a su perro.
 */
import { useState, useRef, useEffect } from 'react';
import { Heart, Send, ChevronLeft, AlertCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ApoyoPage() {
  const router = useRouter();
  const [caseId,    setCaseId]    = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [phase,     setPhase]     = useState<'setup' | 'chat'>('setup');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: statusData, isLoading: statusLoading } = useSWR(
    'support-status',
    () => api.support.status() as Promise<{ data: { available: boolean } }>,
    { revalidateOnFocus: false },
  );
  const aiAvailable = statusData?.data?.available ?? true; // optimistic until confirmed

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function startSession() {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await api.support.startSession(caseId) as { data: { id: string } };
      setSessionId(res.data.id);
      setPhase('chat');
      // Mensaje de bienvenida inicial
      setMessages([{
        role: 'assistant',
        content: '💙 Hola. Estoy aquí para acompañarte en este momento difícil. Cuéntame, ¿cómo te estás sintiendo? Puedes escribir con libertad, sin apuros.',
      }]);
    } catch {
      alert('No se pudo iniciar la sesión. Verifica el ID del caso.');
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error. Por favor intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-brand-500" />
          <div>
            <h1 className="font-bold text-gray-900">Apoyo emocional</h1>
            <p className="text-xs text-gray-400">Asistente IA empático · No reemplaza terapia profesional</p>
          </div>
        </div>
      </header>

      {/* Módulo deshabilitado (sin API key) */}
      {!statusLoading && !aiAvailable && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm py-12">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Próximamente</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              El asistente de apoyo emocional está en preparación.
              Estará disponible muy pronto para acompañarte en la búsqueda de tu compañero.
            </p>
            <div className="bg-brand-50 rounded-2xl px-4 py-3 text-sm text-brand-700">
              Mientras tanto, te recomendamos buscar grupos de ayuda locales
              y contactar refugios y veterinarias de tu zona.
            </div>
            <button onClick={() => router.back()} className="btn-secondary w-full">
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer (solo cuando está disponible) */}
      {(statusLoading || aiAvailable) && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Este espacio es de contención y guía práctica. Si estás en crisis, busca apoyo profesional.
          </p>
        </div>
      )}

      {(statusLoading || aiAvailable) && (
        phase === 'setup' ? (
          <div className="max-w-md mx-auto px-4 py-12 space-y-5">
            <div className="text-center">
              <Heart className="w-14 h-14 text-brand-500 mx-auto mb-4 fill-current opacity-80" />
              <h2 className="text-2xl font-bold text-gray-800">Estamos contigo</h2>
              <p className="text-gray-500 mt-2">
                Este espacio es para acompañarte mientras buscas a tu compañero.
                Ingresa el ID del caso para comenzar.
              </p>
            </div>
            <input className="input" placeholder="ID del caso (ej: cm3abc123)"
              value={caseId} onChange={e => setCaseId(e.target.value)} />
            <button onClick={startSession} disabled={!caseId || loading}
              className="btn-primary w-full">
              {loading ? 'Iniciando...' : 'Comenzar sesión de apoyo'}
            </button>
            <p className="text-center text-xs text-gray-400">
              Encuentra el ID del caso en tu reporte o en las notificaciones
            </p>
          </div>
        ) : (
          <>
            {/* Chat */}
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

            {/* Input */}
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
                <button onClick={sendMessage} disabled={!input.trim() || loading}
                  className="bg-brand-500 hover:bg-brand-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
