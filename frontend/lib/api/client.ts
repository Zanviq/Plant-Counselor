import { getGeminiKey } from "@/lib/geminiKey";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResult<T> = ApiOk<T> | ApiErr;

/**
 * Auth: the backend keeps the session in an httpOnly cookie, so every request
 * is sent with `credentials: "include"` and no token is handled in JS.
 */

/** Normalise FastAPI (`{detail}`) and app (`{ok:false,error}`) error bodies. */
function toApiError(status: number, statusText: string, body: unknown): ApiErr["error"] {
  const b = body as { error?: ApiErr["error"]; detail?: unknown } | null;
  if (b?.error) return b.error;
  if (typeof b?.detail === "string") return { code: String(status), message: b.detail };
  if (Array.isArray(b?.detail)) return { code: String(status), message: "입력값을 확인해주세요." };
  return { code: String(status), message: statusText };
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  // Wrap every fetch in try-catch — a network error (server down / CORS /
  // uvicorn reload) throws TypeError which must be caught and surfaced cleanly.
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  } catch (networkErr) {
    return { ok: false, error: { code: "network", message: `네트워크 오류: 서버에 연결할 수 없습니다. (${String(networkErr)})` } };
  }

  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    return { ok: false, error: toApiError(res.status, res.statusText, body) };
  }

  const body = await res.json();
  return body as ApiResult<T>;
}

export async function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, data?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined });
}

export async function apiPatch<T>(path: string, data?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined });
}

export async function apiPut<T>(path: string, data?: unknown) {
  return apiFetch<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined });
}

export async function apiDelete<T>(path: string, data?: unknown) {
  return apiFetch<T>(path, { method: "DELETE", body: data ? JSON.stringify(data) : undefined });
}

/**
 * Download a file from an authenticated endpoint and trigger a browser save.
 * Fetching the blob keeps the cookie-authenticated download inside the app.
 */
export async function downloadFile(path: string, suggestedName: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, { credentials: "include" });
    if (!res.ok) return { ok: false, error: `다운로드 실패 (${res.status})` };
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${String(e)}` };
  }
}

export function streamChat(
  payload: {
    text: string;
    scope?: string;
    scope_id?: string;
    current_screen?: string;
    require_confirmation?: boolean;
    confirmed_actions?: { name: string; args: Record<string, unknown> }[];
  },
  callbacks: {
    onStart?: (id: string) => void;
    onToken?: (text: string) => void;
    onToolCall?: (name: string, args: unknown) => void;
    onToolResult?: (name: string, result: unknown) => void;
    onConfirmationRequired?: (intended: unknown) => void;
    onError?: (code: string, message: string) => void;
    onDone?: () => void;
  }
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // The user's own Gemini key (localStorage only) — forwarded per request, never stored server-side.
  const geminiKey = getGeminiKey();
  if (geminiKey) headers["X-Gemini-Api-Key"] = geminiKey;

  let doneFired = false;
  const fireDone = () => {
    if (doneFired) return;
    doneFired = true;
    callbacks.onDone?.();
  };

  fetch(`${BASE}/chat/message`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  }).then(async (res) => {
    if (!res.body) { fireDone(); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (!event) continue;
        try {
          const parsed = JSON.parse(data);
          if (event === "start") callbacks.onStart?.(parsed.message_id);
          else if (event === "token") callbacks.onToken?.(parsed.text);
          else if (event === "tool_call") callbacks.onToolCall?.(parsed.name, parsed.args);
          else if (event === "tool_result") callbacks.onToolResult?.(parsed.name, parsed.result);
          else if (event === "confirmation_required") callbacks.onConfirmationRequired?.(parsed);
          else if (event === "error") callbacks.onError?.(parsed.code, parsed.message);
          else if (event === "done") fireDone();
        } catch {}
      }
    }
    // Fallback: if the server closes the stream without sending `done`, still fire.
    fireDone();
  }).catch((e) => {
    callbacks.onError?.("network", String(e));
    // Ensure onDone fires on network errors too, so UI loading state clears.
    fireDone();
  });
}
