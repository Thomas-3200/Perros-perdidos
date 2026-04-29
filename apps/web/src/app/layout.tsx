import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BottomNav } from '@/components/layout/BottomNav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Perros Perdidos — Red de Reunificación Canina',
  description: 'Ayudamos a reunir perros perdidos con sus familias usando comunidad + IA.',
  openGraph: {
    title:       'Perros Perdidos',
    description: 'Red distribuida de reunificación canina',
    type:        'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <main className="pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
