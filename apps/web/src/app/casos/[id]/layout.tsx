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
  const photo    = c.dog?.photos?.[0] ?? null;
  const contact  = c.contactValue ?? '';

  const title       = `🐾 ${name} está perdido — ¿Lo viste?`;
  const description = `${name}${breed} fue visto por última vez en ${location}. Si lo viste o tenés información, por favor contactá al dueño${contact ? ` (${contact})` : ''}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:   'article',
      locale: 'es_AR',
      url:    `https://perros-perdidos-web.vercel.app/casos/${id}`,
      images: photo
        ? [{ url: photo, width: 800, height: 600, alt: `${name} — perro perdido` }]
        : [{ url: 'https://perros-perdidos-web.vercel.app/og-default.png', width: 800, height: 600 }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      photo ? [photo] : [],
    },
  };
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
