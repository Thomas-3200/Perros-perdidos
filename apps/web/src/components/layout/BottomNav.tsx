'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, PlusCircle, User, Eye } from 'lucide-react';
import clsx from 'clsx';
import useSWR from 'swr';
import { isLoggedIn } from '@/lib/auth';
import { api } from '@/lib/api';

const LINKS = [
  { href: '/',                 label: 'Inicio',   icon: Home       },
  { href: '/buscar',           label: 'Buscar',   icon: Search     },
  { href: '/reportar/perdido', label: 'Reportar', icon: PlusCircle },
  { href: '/avistamientos',    label: 'Avistados', icon: Eye       },
  { href: '/perfil',           label: 'Perfil',   icon: User       },
];

function useUnreadCount() {
  const { data } = useSWR(
    typeof window !== 'undefined' && isLoggedIn() ? 'notifications-mine' : null,
    () => api.notifications.mine() as Promise<{ meta: { unreadCount: number } }>,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  return data?.meta?.unreadCount ?? 0;
}

export function BottomNav() {
  const pathname    = usePathname();
  const unreadCount = useUnreadCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50
                    flex items-center justify-around px-2 pb-safe-bottom
                    shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active   = pathname === href || (href !== '/' && pathname.startsWith(href));
        const isPerfil = href === '/perfil';

        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-3 px-3 rounded-xl transition-colors min-w-[56px]',
              active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {/* Icono con badge en perfil */}
            <div className="relative">
              <Icon className={clsx('w-6 h-6', active && 'stroke-[2.5px]')} />
              {isPerfil && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white
                                 text-[9px] font-bold rounded-full flex items-center justify-center px-0.5
                                 leading-none border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className={clsx('text-[10px] font-medium', active && 'font-semibold')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
