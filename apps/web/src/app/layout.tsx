import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BottomNav } from '@/components/layout/BottomNav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default:  'Perros Perdidos — Red de Reunificación Canina',
    template: '%s | Perros Perdidos',
  },
  description: 'Comunidad + IA ayudando a reunir perros perdidos con sus familias en Argentina.',
  metadataBase: new URL('https://perros-perdidos-web.vercel.app'),
  openGraph: {
    siteName:    'Perros Perdidos',
    title:       'Perros Perdidos — Red de Reunificación Canina',
    description: 'Comunidad + IA ayudando a reunir perros perdidos con sus familias.',
    type:        'website',
    locale:      'es_AR',
    url:         'https://perros-perdidos-web.vercel.app',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Perros Perdidos — Red de Reunificación Canina',
    description: 'Comunidad + IA ayudando a reunir perros perdidos con sus familias.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
