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

export interface ConversationSummary {
  id: string;
  scope: "global" | "plant" | "bud" | "calendar";
  scope_id: string | null;
  message_count: number;
  last_message: string | null;
  last_role: "user" | "assistant" | null;
  updated_at: string;
  created_at: string;
}

export interface ConversationList {
  conversations: ConversationSummary[];
}

export function listConversations(): Promise<ApiResult<ConversationList>> {
  return apiGet<ConversationList>("/conversations/list");
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
