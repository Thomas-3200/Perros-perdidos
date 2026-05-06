import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Perros Perdidos',
    short_name:       'Perros Perdidos',
    description:      'Red de reunificación canina — Comunidad + IA para encontrar perros perdidos',
    start_url:        '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#f97316',
    orientation:      'portrait-primary',
    categories:       ['pets', 'social', 'utilities'],
    lang:             'es',
    icons: [
      {
        src:     '/icon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name:      'Reportar perro perdido',
        short_name: 'Reportar',
        url:       '/reportar/perdido',
        description: 'Crear un nuevo caso de perro perdido',
      },
      {
        name:      'Ver casos activos',
        short_name: 'Buscar',
        url:       '/buscar',
        description: 'Explorar perros perdidos cercanos',
      },
    ],
  };
}
