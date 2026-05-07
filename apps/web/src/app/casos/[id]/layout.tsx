import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchCase(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/cases/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const c = await fetchCase(id);

  if (!c) {
    return {
      title: 'Caso no encontrado — Perros Perdidos',
      description: 'Este caso no existe o fue eliminado.',
    };
  }

  const name     = c.dog?.name ?? 'Perro';
  const breed    = c.dog?.breed ? ` · ${c.dog.breed}` : '';
  const location = c.lastSeenAddress || c.lastSeenCity || 'zona desconocida';
  const isFound  = c.status === 'found';
  const reward   = c.reward;

  const title = isFound
    ? `🏠 ${name} volvió a casa — Perros Perdidos`
    : `🚨 ${name} está perdido en ${c.lastSeenCity || 'Argentina'} — ¿Lo viste?`;

  const baseDesc = isFound
    ? `${name}${breed} fue reunificado gracias a la comunidad. ¡Cada reporte cuenta!`
    : `${name}${breed} fue visto por última vez en ${location}.${reward ? ` Recompensa $${reward.toLocaleString('es-AR')}.` : ''} Si lo viste, reportalo en la app — la IA cruza tu reporte con el dueño automáticamente.`;

  return {
    title,
    description: baseDesc,
    openGraph: {
      title,
      description: baseDesc,
      type:   'article',
      locale: 'es_AR',
      url:    `https://perros-perdidos-web.vercel.app/casos/${id}`,
      // No incluimos `images` aquí: Next.js usa automáticamente
      // `opengraph-image.tsx` que genera una imagen dinámica rica
      // (foto + nombre + ciudad + recompensa) por caso.
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description: baseDesc,
    },
  };
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
