// ─── Tipos de respuesta API genéricos ────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Paginación ───────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── Filtros geográficos ──────────────────────────────────────────────────────
export interface GeoQuery {
  lat: number;
  lng: number;
  radiusKm: number;
}
