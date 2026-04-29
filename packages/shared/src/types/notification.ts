// ─── Notificaciones ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'match_high'        // Match de alta confianza
  | 'match_medium'      // Match moderado (requiere revisión)
  | 'sighting_nearby'   // Avistamiento cercano a caso activo
  | 'case_update'       // Actualización en un caso que sigo
  | 'reunion'           // Historia de reunificación publicada
  | 'helper_alert'      // Alerta para helpers en la zona
  | 'support_checkin';  // Check-in de apoyo emocional

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>; // Payload adicional (caseId, matchId, etc.)
  read: boolean;
  sentAt: Date;
}
