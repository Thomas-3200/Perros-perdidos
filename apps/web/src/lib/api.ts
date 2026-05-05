/**
 * Cliente API — wrapper sobre fetch para el backend Fastify.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('pp_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...(options.headers as Record<string, string>),
      },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    return json;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verificá tu conexión e intentá de nuevo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────
export const api = {
  users: {
    register: (data: unknown) => request('/api/v1/users/register', { method: 'POST', body: JSON.stringify(data) }),
    login:    (data: unknown) => request('/api/v1/users/login',    { method: 'POST', body: JSON.stringify(data) }),
    me:       ()              => request('/api/v1/users/me'),
  },

  // ─── Casos perdidos ─────────────────────────────────────────────────────────
  cases: {
    list:       (params?: Record<string, string | number>) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request(`/api/v1/cases${qs}`);
    },
    mine:       () => request('/api/v1/cases/mine'),
    get:        (id: string)   => request(`/api/v1/cases/${id}`),
    create:     (data: unknown) => request('/api/v1/cases', { method: 'POST', body: JSON.stringify(data) }),
    setStatus:  (id: string, status: string) =>
      request(`/api/v1/cases/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },

  // ─── Avistamientos ───────────────────────────────────────────────────────────
  sightings: {
    list:   (params?: Record<string, string | number>) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request(`/api/v1/sightings${qs}`);
    },
    get:    (id: string) => request(`/api/v1/sightings/${id}`),
    // Para avistamientos usamos FormData (con fotos), no JSON
    create: (formData: FormData) =>
      fetch(`${API_URL}/api/v1/sightings`, {
        method:  'POST',
        headers: { ...getAuthHeader() },
        body:    formData,
      }).then(r => r.json()),
  },

  // ─── Matches ─────────────────────────────────────────────────────────────────
  matches: {
    forCase:  (caseId: string) => request(`/api/v1/matches/case/${caseId}`),
    confirm:  (id: string)     => request(`/api/v1/matches/${id}/confirm`, { method: 'PATCH' }),
    reject:   (id: string)     => request(`/api/v1/matches/${id}/reject`,  { method: 'PATCH' }),
    review:   (id: string, decision: 'approve' | 'reject') =>
      request(`/api/v1/matches/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision }) }),
  },

  // ─── Ingesta Human API ───────────────────────────────────────────────────────
  ingest: {
    submitLink:    (rawInput: string) =>
      request('/api/v1/ingest/social', { method: 'POST', body: JSON.stringify({ sourceType: 'link', rawInput }) }),
    submitText:    (rawInput: string) =>
      request('/api/v1/ingest/social', { method: 'POST', body: JSON.stringify({ sourceType: 'text', rawInput }) }),
    submitImage:   (formData: FormData) =>
      fetch(`${API_URL}/api/v1/ingest/social`, {
        method:  'POST',
        headers: { ...getAuthHeader() },
        body:    formData,
      }).then(r => r.json()),
    myImports: () => request('/api/v1/ingest'),
  },

  // ─── Apoyo emocional ─────────────────────────────────────────────────────────
  support: {
    status:       () => request('/api/v1/support/status'),
    startSession: (caseId: string) =>
      request('/api/v1/support/sessions', { method: 'POST', body: JSON.stringify({ caseId }) }),
    chat: (sessionId: string, message: string) =>
      request(`/api/v1/support/sessions/${sessionId}/chat`, {
        method: 'POST',
        body:   JSON.stringify({ message }),
      }),
    getSession: (sessionId: string) => request(`/api/v1/support/sessions/${sessionId}`),
  },

  // ─── Reuniones ───────────────────────────────────────────────────────────────
  reunion: {
    feed:   (page = 1) => request(`/api/v1/reunion/feed?page=${page}`),
    get:    (id: string) => request(`/api/v1/reunion/${id}`),
    create: (formData: FormData) =>
      fetch(`${API_URL}/api/v1/reunion`, {
        method:  'POST',
        headers: { ...getAuthHeader() },
        body:    formData,
      }).then(r => r.json()),
  },

  // ─── Admin ───────────────────────────────────────────────────────────────────
  admin: {
    pendingMatches: (page = 1) => request(`/api/v1/admin/pending-matches?page=${page}`),
    stats:          ()         => request('/api/v1/admin/stats'),
  },

  // ─── Estadísticas ────────────────────────────────────────────────────────────
  stats: {
    get: () => request<{ success: boolean; data: {
      totalCases: number; activeCases: number; totalSightings: number;
      totalMatches: number; reunions: number;
    } }>('/api/v1/stats'),
  },
};
