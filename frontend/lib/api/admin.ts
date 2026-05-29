import { apiGet, apiPatch, apiPost } from "./client";

export interface AdminStats {
  total_users: number;
  admin_count: number;
  total_plants: number;
  total_buds: number;
  total_ai_sessions: number;
  recent_ai_sessions_7d: number;
  total_token_estimate: number;
}

export interface AdminUser {
  id: string;
  email: string | null;
  nickname: string | null;
  role: "user" | "admin";
  tone: string;
  ai_model: string;
  created_at: string;
  plant_count: number;
  bud_count: number;
  ai_session_count: number;
}

export interface AdminUserDetail {
  profile: AdminUser;
  plants: unknown[];
  buds: unknown[];
  conversation_count: number;
  ai_session_count: number;
  token_estimate: number;
}

export interface LogMeta {
  filename: string;
  timestamp: string | null;
  user_id: string | null;
  user_input: string;
  llm_call_count: number;
  skill_call_count: number;
  skill_names: string[];
  token_estimate: number;
  error?: string;
}

export interface LogDetail {
  timestamp: string;
  user_id: string;
  user_input: string;
  system_prompt: string;
  history: unknown[];
  llm_calls: LlmCall[];
  skill_calls: SkillCall[];
  final_response: string;
  events: LogEvent[];
}

export interface LlmCall {
  call: number;
  messages_count: number;
  tools_count: number;
  messages: unknown[];
  result_text?: string;
  result_tool_use?: unknown;
}

export interface SkillCall {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  message: string;
  data: Record<string, unknown>;
}

export interface LogEvent {
  time: string;
  type: string;
  detail: string;
}

export const getAdminStats = () =>
  apiGet<AdminStats>("/admin/stats");

export const listAdminUsers = () =>
  apiGet<{ items: AdminUser[] }>("/admin/users");

export const getAdminUserDetail = (userId: string) =>
  apiGet<AdminUserDetail>(`/admin/users/${userId}`);

export const updateUserRole = (userId: string, role: "user" | "admin") =>
  apiPatch<AdminUser>(`/admin/users/${userId}/role`, { role });

export const overrideUserSettings = (userId: string, fields: Record<string, unknown>) =>
  apiPatch<AdminUser>(`/admin/users/${userId}/settings`, fields);

export const listLogs = (params?: { user_id?: string; date?: string; limit?: number; offset?: number }) => {
  const q = new URLSearchParams();
  if (params?.user_id) q.set("user_id", params.user_id);
  if (params?.date) q.set("date", params.date);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiGet<{ total: number; items: LogMeta[] }>(`/admin/logs${qs ? `?${qs}` : ""}`);
};

export const getLogDetail = (filename: string) =>
  apiGet<LogDetail>(`/admin/logs/${encodeURIComponent(filename)}`);

export const sendNotification = (userIds: string[], message: string, kind = "admin_message") =>
  apiPost<{ sent_to: number }>("/admin/notifications", { user_ids: userIds, message, kind });

export const getNotificationHistory = () =>
  apiGet<{ items: unknown[] }>("/admin/notifications/history");

// ── Controller API ─────────────────────────────────────────────────────────

export interface RuntimeSetting {
  value: unknown;
  default: unknown;
  modified: boolean;
}

export interface ControllerSettings {
  settings: Record<string, RuntimeSetting>;
  available_models: string[];
}

export interface SqlResult {
  rows: Record<string, unknown>[];
  total: number;
  type: "select" | "dml";
  affected: number;
  truncated: boolean;
}

export interface TableInfo {
  table: string;
  row_count: number | null;
  error?: string;
}

export const getControllerSettings = () =>
  apiGet<ControllerSettings>("/admin/controller/settings");

export const updateControllerSettings = (
  updates: Record<string, unknown>,
  persist = false
) => apiPatch<{ skipped: string[]; persisted: boolean }>(
  "/admin/controller/settings",
  { updates, persist }
);

export const resetControllerSettings = () =>
  apiPost<Record<string, never>>("/admin/controller/settings/reset", {});

export const executeSql = (query: string, maxRows = 200) =>
  apiPost<SqlResult>("/admin/controller/sql", { query, max_rows: maxRows });

export const triggerScheduler = () =>
  apiPost<{ message: string }>("/admin/controller/scheduler/trigger", {});

export const setUserModel = (userId: string, aiModel: string) =>
  apiPatch<AdminUser>(`/admin/controller/users/${userId}/model`, { ai_model: aiModel });

export const listTables = () =>
  apiGet<{ tables: TableInfo[] }>("/admin/controller/tables");

// ── Time Travel ────────────────────────────────────────────────────────────

export interface VirtualTime {
  virtual_now: string;
  real_now: string;
  offset_seconds: number;
  offset_days: number;
  offset_hours: number;
}

export const getVirtualTime = () =>
  apiGet<VirtualTime>("/admin/controller/time");

export const setTimeOffset = (body: {
  offset_seconds?: number;
  add_days?: number;
  add_hours?: number;
  reset?: boolean;
}) => apiPatch<{ virtual_now: string; offset_seconds: number; offset_days: number }>(
  "/admin/controller/time",
  body
);
