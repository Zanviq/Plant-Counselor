import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

export interface SummaryStats {
  active_concerns: number;
  active_schedules: number;
  harvested_this_month: number;
  wilting_count: number;
  rot_count: number;
  total_plants: number;
}

export interface CalEvent {
  id: string;
  title: string;
  status: string;
  type: string;
  detail: string;
  plant_name: string;
  plant_id: string | null;
  /** "bud" = derived from a bud deadline · "event" = standalone calendar event */
  source: "bud" | "event";
}

export const getSummary = () => apiGet<SummaryStats>("/stats/summary");

export const getBriefing = () => apiGet<{ briefing: string }>("/briefing/today");

export const getCalendar = (from: string, to: string) =>
  apiGet<{ events: Record<string, CalEvent[]> }>(
    `/calendar?from=${from}&to=${to}`
  );

// ── Standalone calendar events (not buds) ────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  detail: string;
  date: string;
  plant_id: string | null;
}

export const createCalendarEvent = (body: {
  title: string;
  date: string;
  plant_id?: string | null;
  detail?: string;
}) => apiPost<CalendarEvent>("/calendar/events", body);

export const updateCalendarEvent = (
  id: string,
  body: { title?: string; date?: string; plant_id?: string | null; detail?: string }
) => apiPatch<CalendarEvent>(`/calendar/events/${id}`, body);

export const deleteCalendarEvent = (id: string) =>
  apiDelete<{ deleted_id: string }>(`/calendar/events/${id}`);
