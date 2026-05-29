import { apiGet, apiPost } from "./client";

export interface Notification {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  acked_at: string | null;
}

/** Unread notifications (default) or full history when includeRead is true. */
export const listNotifications = (includeRead = false, limit = 50) =>
  apiGet<{ items: Notification[] }>(
    `/notifications?include_read=${includeRead}&limit=${limit}`
  );

export const ackNotification = (id: string) =>
  apiPost(`/notifications/${id}/ack`);

export const ackAllNotifications = () =>
  apiPost<{ acked: number }>("/notifications/ack-all");
