import { apiGet } from "./client";

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
  plant_id: string;
}

export const getSummary = () => apiGet<SummaryStats>("/stats/summary");

export const getBriefing = () => apiGet<{ briefing: string }>("/briefing/today");

export const getCalendar = (from: string, to: string) =>
  apiGet<{ events: Record<string, CalEvent[]> }>(
    `/calendar?from=${from}&to=${to}`
  );
