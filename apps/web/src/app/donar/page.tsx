'use client';

import Link from 'next/link';
import { ChevronLeft, ExternalLink } from 'lucide-react';

// Configurar estos links en Vercel → Environment Variables
// MP: ir a mercadopago.com.ar → Tu negocio → Cobros → Crear link de pago
const MP_URL    = process.env.NEXT_PUBLIC_MP_DONATION_URL ?? '';
const KOFI_URL  = process.env.NEXT_PUBLIC_KOFI_URL        ?? '';
const PAYPAL_URL = process.env.NEXT_PUBLIC_PAYPAL_URL     ?? '';

export default function DonarPage() {
  const donationUrl = MP_URL || KOFI_URL || PAYPAL_URL;

  return (
    <div className="max-w-lg mx-auto pb-10">

      {/* Header */}
      <div className="bg-gradient-to-br from-hope-500 to-orange-500 text-white px-4 pt-10 pb-10 relative">
        <Link href="/" className="absolute top-4 left-4 bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="text-center space-y-3 pt-4">
          <div className="text-5xl">🐾</div>
          <h1 className="text-2xl font-bold">Apoyá esta causa</h1>
          <p className="text-orange-100 text-sm leading-relaxed max-w-xs mx-auto">
            Perros Perdidos es 100% gratuito para todos. Tu donación nos ayuda a
            mantener los servidores encendidos y la IA funcionando.
          </p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">

        {/* ── Impacto ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { emoji: '🐶', number: '100%', label: 'gratuito para todos' },
            { emoji: '🤝', number: 'Comunidad', label: 'lo sostiene' },
            { emoji: '❤️', number: 'Cada peso', label: 'va a la plataforma' },
          ].map((item, i) => (
            <div key={i} className="card py-4 px-2">
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-sm font-bold text-gray-900 leading-tight">{item.number}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-tight">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── Donar con Mercado Pago ────────────────────────────────────────── */}
        {MP_URL && (
          <section className="space-y-3">
            <h2 className="font-bold text-gray-900">Elegí el monto que quieras</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Podés donar desde $100 o lo que tengas ganas. Cada peso va directo
              a mantener la plataforma y la IA funcionando.
            </p>
            <a
              href={MP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold
                         text-white text-base transition-colors"
              style={{ backgroundColor: '#009ee3' }}
            >
              {/* Logo MP */}
              <svg viewBox="0 0 28 28" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 0C6.268 0 0 6.268 0 14s6.268 14 14 14 14-6.268 14-14S21.732 0 14 0zm6.435 10.01l-1.74 8.167c-.13.6-.48.75-.97.468l-2.68-1.975-1.293 1.244c-.143.143-.263.263-.54.263l.192-2.727 4.96-4.48c.216-.192-.047-.298-.333-.106l-6.128 3.858-2.638-.822c-.573-.18-.585-.573.12-.848l10.29-3.967c.476-.18.893.106.76.926z"/>
              </svg>
              Donar con Mercado Pago
            </a>
          </section>
        )}

        {/* ── Opciones internacionales ──────────────────────────────────────── */}
        {(KOFI_URL || PAYPAL_URL) && (
          <section className="space-y-3">
            <h2 className="font-bold text-gray-900">Otras formas de apoyar</h2>
            <div className="space-y-2">
              {KOFI_URL && (
                <a
                  href={KOFI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-4 rounded-2xl
                             border-2 border-gray-200 hover:border-gray-300 bg-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">☕</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Ko-fi</p>
                      <p className="text-xs text-gray-500">Donación internacional en USD</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}
              {PAYPAL_URL && (
                <a
                  href={PAYPAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-4 rounded-2xl
                             border-2 border-gray-200 hover:border-gray-300 bg-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🅿️</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">PayPal</p>
                      <p className="text-xs text-gray-500">Donación rápida en USD</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}
            </div>
          </section>
        )}

        {/* Mensaje si no hay ningún link configurado */}
        {!donationUrl && (
          <div className="card text-center py-8 space-y-2 border-2 border-dashed border-gray-200">
            <p className="text-3xl">🔧</p>
            <p className="font-semibold text-gray-700">Donaciones próximamente</p>
            <p className="text-xs text-gray-400">Estamos configurando los métodos de pago.</p>
          </div>
        )}

        {/* ── Otras formas de ayudar ────────────────────────────────────────── */}
        <section className="bg-brand-50 rounded-2xl p-5 space-y-3 border border-brand-100">
          <h2 className="font-bold text-gray-900 text-sm">¿No podés donar? También podés ayudar</h2>
          <div className="space-y-2">
            {[
              { emoji: '📢', text: 'Compartí casos en tus grupos de WhatsApp' },
              { emoji: '👁️', text: 'Reportá avistamientos cuando veas un perro solo' },
              { emoji: '⭐', text: 'Recomendá la app a quienes tengan mascotas' },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-start gap-2">
                <span className="text-base shrink-0">{emoji}</span>
                <p className="text-sm text-gray-700">{text}</p>
              </div>
            ))}
          </div>
          <Link href="/ayudar" className="btn-primary w-full text-center text-sm block">
            Ver cómo ayudar →
          </Link>
        </section>

        {/* Gracias */}
        <div className="text-center space-y-1 pb-2">
          <p className="text-2xl">🙏</p>
          <p className="text-sm font-semibold text-gray-700">¡Gracias por apoyar!</p>
          <p className="text-xs text-gray-400">
            Cada donación, grande o chica, hace que más perros vuelvan a casa.
          </p>
        </div>

      </div>
    </div>
  );
}
