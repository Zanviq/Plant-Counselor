"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { listLogs, getLogDetail, type LogMeta, type LogDetail, type LlmCall, type SkillCall, type LlmError } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

function LogDetailView({ filename, onClose }: { filename: string; onClose: () => void }) {
  const { accessToken } = useAuthStore();
  const [activeSection, setActiveSection] = useState<"overview" | "prompt" | "llm" | "skills" | "events" | "errors">("overview");

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "log", filename],
    queryFn: () => getLogDetail(filename),
    enabled: !!accessToken && !!filename,
  });

  const log: LogDetail | null = res?.ok ? res.data : null;
  const llmErrors: LlmError[] = log?.llm_errors ?? [];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
      zIndex: 50, padding: 0,
    }}>
      <div style={{
        width: "55%", height: "100vh",
        background: "#0f1117", borderLeft: "1px solid rgba(255,255,255,0.1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18 }}>✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {log?.user_input || filename}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              {log?.timestamp?.slice(0, 19).replace("T", " ")} · {log?.user_id?.slice(0, 8)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 16px" }}>
          {[
            { id: "overview", label: "개요", danger: false },
            { id: "prompt", label: "시스템 프롬프트", danger: false },
            { id: "llm", label: `LLM 호출 (${log?.llm_calls?.length ?? 0})`, danger: false },
            { id: "skills", label: `스킬 (${log?.skill_calls?.length ?? 0})`, danger: false },
            { id: "events", label: "이벤트", danger: false },
            ...(llmErrors.length > 0
              ? [{ id: "errors", label: `오류 (${llmErrors.length})`, danger: true }]
              : []),
          ].map(({ id, label, danger }) => {
            const active = activeSection === id;
            const color = danger ? "#f87171" : active ? "#60a5fa" : "rgba(255,255,255,0.4)";
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id as typeof activeSection)}
                style={{
                  padding: "10px 14px", background: "none", border: "none",
                  color: active || danger ? color : "rgba(255,255,255,0.4)",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  borderBottom: active ? `2px solid ${danger ? "#f87171" : "#60a5fa"}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {isLoading && <p style={{ color: "rgba(255,255,255,0.4)" }}>로딩 중...</p>}
          {log && (
            <>
              {activeSection === "overview" && (
                <div>
                  {llmErrors.length > 0 && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>
                        이 세션에서 LLM 오류 {llmErrors.length}건 발생
                      </div>
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
                        {llmErrors[llmErrors.length - 1].cause}
                      </div>
                      <button
                        onClick={() => setActiveSection("errors")}
                        style={{ marginTop: 6, background: "none", border: "none", color: "#f87171", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      >
                        오류 상세 보기 →
                      </button>
                    </div>
                  )}
                  <Section title="사용자 입력">
                    <pre style={preStyle}>{log.user_input}</pre>
                  </Section>
                  <Section title="최종 응답">
                    <pre style={preStyle}>{log.final_response}</pre>
                  </Section>
                  <Section title="대화 히스토리">
                    {(log.history as { role: string; content: string }[]).map((m, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: m.role === "user" ? "rgba(59,130,246,0.1)" : "rgba(52,211,153,0.07)" }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{m.role}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap" }}>
                          {typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2)}
                        </div>
                      </div>
                    ))}
                  </Section>
                </div>
              )}

              {activeSection === "prompt" && (
                <Section title="시스템 프롬프트">
                  <pre style={{ ...preStyle, maxHeight: "none" }}>{log.system_prompt}</pre>
                </Section>
              )}

              {activeSection === "llm" && (
                <div>
                  {log.llm_calls.map((call: LlmCall, i: number) => (
                    <div key={i} style={{ marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
                        LLM 호출 #{call.call} · {call.messages_count}개 메시지 · {call.tools_count}개 도구
                      </div>
                      {call.result_text && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>응답 텍스트</div>
                          <pre style={preStyle}>{call.result_text}</pre>
                        </div>
                      )}
                      {!!call.result_tool_use && (
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>도구 사용</div>
                          <pre style={preStyle}>{JSON.stringify(call.result_tool_use as object, null, 2)}</pre>
                        </div>
                      )}
                      <details>
                        <summary style={{ fontSize: 11, color: "#60a5fa", cursor: "pointer" }}>전체 메시지 보기</summary>
                        <pre style={{ ...preStyle, marginTop: 8 }}>{JSON.stringify(call.messages, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "skills" && (
                <div>
                  {log.skill_calls.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>스킬 호출 없음</p>}
                  {log.skill_calls.map((s: SkillCall, i: number) => (
                    <div key={i} style={{ marginBottom: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#34d399", fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 999, background: s.ok ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", color: s.ok ? "#34d399" : "#f87171" }}>
                          {s.ok ? "성공" : "실패"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{s.message}</div>
                      <details>
                        <summary style={{ fontSize: 11, color: "#60a5fa", cursor: "pointer" }}>인수/결과</summary>
                        <pre style={{ ...preStyle, marginTop: 6 }}>{JSON.stringify({ args: s.args, data: s.data }, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "events" && (
                <div>
                  {log.events.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>{e.time?.slice(11, 19)}</div>
                      <div style={{ fontSize: 11, color: e.type?.startsWith("llm_error") ? "#f87171" : "#60a5fa", whiteSpace: "nowrap" }}>{e.type}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{e.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "errors" && (
                <div>
                  {llmErrors.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>오류 없음</p>}
                  {llmErrors.map((err, i) => (
                    <div key={i} style={{ marginBottom: 14, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: "rgba(239,68,68,0.18)", color: "#f87171", fontWeight: 700 }}>
                          {ERROR_KIND_LABEL[err.kind] ?? err.kind}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>LLM 호출 #{err.call} · {err.time?.slice(11, 19)}</span>
                      </div>
                      {err.cause && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>원인</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{err.cause}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>원문 (upstream)</div>
                        <pre style={{ ...preStyle, color: "#fca5a5" }}>{err.error}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const ERROR_KIND_LABEL: Record<string, string> = {
  overloaded: "서버 과부하 (503)",
  rate_limit: "한도 초과 (429)",
  auth: "인증 오류",
  model_not_found: "모델 없음",
  timeout: "시간 초과",
  other: "기타 오류",
};

const preStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 11,
  color: "rgba(255,255,255,0.7)",
  overflow: "auto",
  maxHeight: 300,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  fontFamily: "monospace",
};

function LogsContent() {
  const { accessToken } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<string | null>(searchParams.get("file"));
  const [filterUserId, setFilterUserId] = useState(searchParams.get("user_id") ?? "");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 30;

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "logs", filterUserId, filterDate, page],
    queryFn: () => listLogs({
      user_id: filterUserId || undefined,
      date: filterDate.replace(/-/g, "") || undefined,
      limit: LIMIT,
      offset: page * LIMIT,
    }),
    enabled: !!accessToken,
  });

  const logs: LogMeta[] = res?.ok ? res.data.items : [];
  const total = res?.ok ? res.data.total : 0;

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>AI 채팅 로그</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          총 {total}개 세션 · AI 프롬프트, LLM 호출, 스킬 사용 기록
        </p>
      </header>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={filterUserId}
          onChange={(e) => { setFilterUserId(e.target.value); setPage(0); }}
          placeholder="사용자 ID 필터..."
          style={inputStyle}
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setPage(0); }}
          style={{ ...inputStyle, colorScheme: "dark" }}
        />
        {(filterUserId || filterDate) && (
          <button
            onClick={() => { setFilterUserId(""); setFilterDate(""); setPage(0); }}
            style={{ padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}
          >
            초기화
          </button>
        )}
      </div>

      {/* Log table */}
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.4)" }}>로딩 중...</p>
      ) : (
        <div style={{ background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                {["시각", "사용자", "입력", "LLM", "스킬", "~토큰", "상태"].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "20px 14px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>로그 없음</td>
                </tr>
              )}
              {logs.map((log, i) => (
                <tr
                  key={log.filename}
                  onClick={() => setSelectedFile(log.filename)}
                  style={{
                    borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    cursor: "pointer",
                    background: selectedFile === log.filename ? "rgba(96,165,250,0.06)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (selectedFile !== log.filename) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)"; }}
                  onMouseLeave={(e) => { if (selectedFile !== log.filename) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                    {log.timestamp?.slice(0, 19).replace("T", " ") ?? "—"}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: "monospace", color: "#60a5fa" }}>
                    {log.user_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: "rgba(255,255,255,0.75)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.user_input || "(없음)"}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                    {log.llm_call_count}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {log.skill_names?.slice(0, 2).join(", ")}{(log.skill_names?.length ?? 0) > 2 ? "…" : ""}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "#f59e0b" }}>
                    ~{log.token_estimate}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 11, whiteSpace: "nowrap" }}>
                    {(log.error_count ?? 0) > 0 ? (
                      <span
                        title={log.last_error ?? ""}
                        style={{ padding: "1px 8px", borderRadius: 999, background: "rgba(239,68,68,0.15)", color: "#f87171", fontWeight: 600 }}
                      >
                        오류 {log.error_count}
                      </span>
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={paginBtnStyle}>이전</button>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "6px 10px" }}>{page + 1} / {Math.ceil(total / LIMIT)}</span>
          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * LIMIT >= total} style={paginBtnStyle}>다음</button>
        </div>
      )}

      {/* Detail panel */}
      {selectedFile && (
        <LogDetailView filename={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 7,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", fontSize: 12, outline: "none", minWidth: 200,
};

const paginBtnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 7,
  background: "rgba(255,255,255,0.06)", border: "none",
  color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
};

export default function AdminLogsPage() {
  return (
    <Suspense fallback={<div style={{ color: "rgba(255,255,255,0.4)", padding: 40 }}>로딩 중...</div>}>
      <LogsContent />
    </Suspense>
  );
}
