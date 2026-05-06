'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { Bell, BellOff, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { isLoggedIn, getUser } from '@/lib/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  sentAt: string;
  data?: { matchId?: string; caseId?: string };
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days} días`;
}

export default function NotificacionesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [router]);

  const { data, isLoading } = useSWR(
    ready ? 'notifications-mine' : null,
    () => api.notifications.mine() as Promise<{ data: Notification[]; meta: { unreadCount: number } }>,
  );

  async function markAllRead() {
    await api.notifications.markAll();
    mutate('notifications-mine');
  }

  async function markRead(id: string) {
    await api.notifications.markRead(id);
    mutate('notifications-mine');
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const notifications = data?.data ?? [];
  const unreadCount   = data?.meta?.unreadCount ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>
          {unreadCount > 0 && (
            <span className="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-brand-500 font-medium hover:underline flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Marcar todas
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && notifications.length === 0 && (
        <div className="card text-center py-12 space-y-3">
          <BellOff className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 font-medium">Sin notificaciones</p>
          <p className="text-gray-400 text-sm">Cuando haya coincidencias para tus casos, te avisamos aquí.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {notifications.map(n => {
          const caseId = n.data?.caseId;
          const isMatch = n.type === 'match_high';

          const inner = (
            <div
              className={`card flex items-start gap-3 transition-colors cursor-pointer ${
                !n.read ? 'border-brand-200 bg-brand-50/30' : ''
              }`}
              onClick={() => {
                if (!n.read) markRead(n.id);
              }}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isMatch ? 'bg-green-100' : 'bg-brand-100'
              }`}>
                {isMatch ? '🐾' : <Bell className="w-5 h-5 text-brand-400" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(n.sentAt)}</p>
              </div>

              {/* Unread dot + arrow */}
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && (
                  <div className="w-2 h-2 bg-brand-500 rounded-full" />
                )}
                {caseId && <ChevronRight className="w-4 h-4 text-gray-300" />}
              </div>
            </div>
          );

          return caseId ? (
            <Link key={n.id} href={`/casos/${caseId}`}>
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
