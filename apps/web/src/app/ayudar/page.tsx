'use client';

import Link from 'next/link';
import { MapPin, Camera, Share2, Bell } from 'lucide-react';

const WAYS_TO_HELP = [
  {
    icon: Camera,
    title: 'Reportar un avistamiento',
    description: 'Viste un perro suelto? Sube una foto y marcá la ubicación.',
    href: '/reportar/avistamiento',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Share2,
    title: 'Importar de redes sociales',
    description: 'Compartí un post de perro perdido que viste en Facebook o Instagram.',
    href: '/reportar/red-social',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: MapPin,
    title: 'Activar modo búsqueda',
    description: 'Recibí alertas de casos cercanos a vos mientras caminás por el barrio.',
    href: '#',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Bell,
    title: 'Suscribirse a alertas',
    description: 'Habilitá las notificaciones para enterarte cuando reportan casos en tu zona.',
    href: '#',
    color: 'bg-green-50 text-green-600',
  },
];

export default function AyudarPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Quiero ayudar</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Cada acción cuenta. Elegí cómo querés contribuir hoy.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {WAYS_TO_HELP.map(({ icon: Icon, title, description, href, color }) => (
          <Link
            key={title}
            href={href}
            className="card flex items-start gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`rounded-xl p-3 ${color} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 p-4 bg-brand-50 rounded-2xl border border-brand-100">
        <p className="text-brand-700 text-xs font-medium">
          Cada reporte puede ser la clave que una familia estaba esperando.
          Gracias por ser parte de esta red.
        </p>
      </div>
    </div>
  );
}
