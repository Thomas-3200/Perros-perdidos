'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, PlusCircle, User, Users } from 'lucide-react';
import clsx from 'clsx';

const LINKS = [
  { href: '/',                 label: 'Inicio',   icon: Home        },
  { href: '/buscar',           label: 'Buscar',   icon: Search      },
  { href: '/reportar/perdido', label: 'Reportar', icon: PlusCircle  },
  { href: '/perfil',           label: 'Perfil',   icon: User        },
  { href: '/ayudar',           label: 'Ayudar',   icon: Users       },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50
                    flex items-center justify-around px-2 pb-safe-bottom
                    shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-3 px-3 rounded-xl transition-colors min-w-[56px]',
              active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <Icon className={clsx('w-6 h-6', active && 'stroke-[2.5px]')} />
            <span className={clsx('text-[10px] font-medium', active && 'font-semibold')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
