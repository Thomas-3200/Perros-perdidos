export type NotificationType = 'match_high' | 'match_medium' | 'sighting_nearby' | 'case_update' | 'reunion' | 'helper_alert' | 'support_checkin';
export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    read: boolean;
    sentAt: Date;
}
//# sourceMappingURL=notification.d.ts.map