import { apiGet, apiPost, ApiResult } from "./client";

export interface ConvMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  at: string;
}

export interface ConvHistory {
  messages: ConvMessage[];
}

export function getHistory(
  scope = "global",
  scopeId?: string,
  limit = 40
): Promise<ApiResult<ConvHistory>> {
  const params = new URLSearchParams({ scope, limit: String(limit) });
  if (scopeId) params.set("scope_id", scopeId);
  return apiGet<ConvHistory>(`/conversations?${params}`);
}

export function searchConversation(
  query: string,
  scope = "global",
  scopeId?: string,
  limit = 20
): Promise<ApiResult<ConvHistory>> {
  return apiPost<ConvHistory>("/conversations/search", { query, scope, scope_id: scopeId, limit });
}
