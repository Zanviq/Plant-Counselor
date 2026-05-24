import { apiGet, apiPost } from "./client";

export interface Notification {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export const listNotifications = () =>
  apiGet<{ items: Notification[] }>("/notifications");

export const ackNotification = (id: string) =>
  apiPost(`/notifications/${id}/ack`);
