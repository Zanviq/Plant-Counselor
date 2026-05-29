"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getControllerSettings, updateControllerSettings, resetControllerSettings,
  executeSql, triggerScheduler, setUserModel, listTables, listAdminUsers,
  type RuntimeSetting, type SqlResult,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

// ── Shared Styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#1a1f2e",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "20px 24px",
  marginBottom: 20,
};

const label: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "rgba(255,255,255,0.4)", marginBottom: 6,
  letterSpacing: "0.06em", textTransform: "uppercase",
};

const input: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 7,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", fontSize: 13, outline: "none",
};

const btn = (variant: "primary" | "danger" | "ghost" = "ghost"): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 7, border: "none",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
  background:
    variant === "primary" ? "#3b82f6" :
    variant === "danger"  ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)",
  color:
    variant === "primary" ? "#fff" :
    variant === "danger"  ? "#f87171" : "rgba(255,255,255,0.6)",
});

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ── Setting Row ───────────────────────────────────────────────────────────────

function SettingRow({
  name, setting, models, onSave,
}: {
  name: string;
  setting: RuntimeSetting;
  models?: string[];
  onSave: (key: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(setting.value ?? setting.default));

  const isModel = name === "llm_default_model";
  const isBool = typeof (setting.default) === "boolean";
  const isNum = typeof (setting.default) === "number";

  const displayVal = String(setting.value ?? setting.default);

  function commit() {
    let parsed: unknown = draft;
    if (isBool) parsed = draft === "true";
    else if (isNum) parsed = Number(draft);
    onSave(name, parsed);
    setEditing(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#60a5fa" }}>{name}</span>
        {setting.modified && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: 999 }}>
            수정됨
          </span>
        )}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
          기본값: {String(setting.default)}
        </div>
      </div>

      {editing ? (
        <>
          {isModel && models ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ ...input, minWidth: 200 }}
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : isBool ? (
            <select value={draft} onChange={(e) => setDraft(e.target.value)} style={{ ...input, minWidth: 120 }}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              type={isNum ? "number" : "text"}
              style={{ ...input, minWidth: 160 }}
              autoFocus
            />
          )}
          <button onClick={commit} style={btn("primary")}>저장</button>
          <button onClick={() => setEditing(false)} style={btn()}>취소</button>
        </>
      ) : (
        <>
          <span style={{ fontFamily: isModel ? "inherit" : "monospace", fontSize: 13, color: setting.modified ? "#f59e0b" : "rgba(255,255,255,0.7)", minWidth: 160, textAlign: "right" }}>
            {displayVal}
          </span>
          <button onClick={() => { setDraft(displayVal); setEditing(true); }} style={btn()}>수정</button>
        </>
      )}
    </div>
  );
}

// ── SQL Executor ──────────────────────────────────────────────────────────────

function SqlExecutor() {
  const { accessToken } = useAuthStore();
  const [query, setQuery] = useState("SELECT id, email, role FROM profiles LIMIT 10;");
  const [result, setResult] = useState<(SqlResult & { error?: string }) | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (!query.trim() || running) return;
    setRunning(true);
    setResult(null);
    const res = await executeSql(query);
    if (res.ok) setResult(res.data);
    else setResult({ rows: [], total: 0, type: "select", affected: 0, truncated: false, error: res.error.message });
    setRunning(false);
  }

  const cols = result?.rows?.length ? Object.keys(result.rows[0]) : [];

  return (
    <div style={card}>
      <SectionTitle>💾 SQL 실행기</SectionTitle>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } }}
        rows={4}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#e2e8f0", fontSize: 12, fontFamily: "monospace",
          resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
        }}
        placeholder="SELECT * FROM profiles;"
        spellCheck={false}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button onClick={run} disabled={running} style={btn("primary")}>
          {running ? "실행 중…" : "실행 (Ctrl+Enter)"}
        </button>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          SELECT/INSERT/UPDATE/DELETE/ALTER 모두 지원
        </span>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          {result.error ? (
            <div style={{ color: "#f87171", fontSize: 12, fontFamily: "monospace", background: "rgba(239,68,68,0.08)", padding: "10px 12px", borderRadius: 6 }}>
              오류: {result.error}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                {result.type === "select"
                  ? `${result.total}행 반환${result.truncated ? ` (최대 200행 표시)` : ""}`
                  : `${result.affected}행 영향받음`}
              </div>
              {cols.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {cols.map((c) => (
                          <th key={c} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", textAlign: "left", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          {cols.map((c) => (
                            <td key={c} style={{ padding: "5px 10px", color: "rgba(255,255,255,0.7)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                              {row[c] === null ? <span style={{ color: "rgba(255,255,255,0.25)" }}>NULL</span>
                                : typeof row[c] === "object" ? JSON.stringify(row[c])
                                : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table Overview ────────────────────────────────────────────────────────────

function TableOverview() {
  const { accessToken } = useAuthStore();
  const { data: res } = useQuery({
    queryKey: ["admin", "controller", "tables"],
    queryFn: listTables,
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });
  const tables = res?.ok ? res.data.tables : [];

  return (
    <div style={card}>
      <SectionTitle>📊 테이블 현황</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {tables.map((t) => (
          <div key={t.table} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#60a5fa", marginBottom: 4 }}>{t.table}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
              {t.error ? "?" : t.row_count?.toLocaleString() ?? 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User Model Overrides ──────────────────────────────────────────────────────

function UserModelSection({ models }: { models: string[] }) {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");

  const { data: usersRes } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: !!accessToken,
  });

  const modelMut = useMutation({
    mutationFn: ({ userId, model }: { userId: string; model: string }) =>
      setUserModel(userId, model),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setFeedback("모델 변경 완료");
      setTimeout(() => setFeedback(""), 2000);
    },
  });

  const users = usersRes?.ok ? usersRes.data.items : [];

  return (
    <div style={card}>
      <SectionTitle>🤖 사용자별 AI 모델 오버라이드</SectionTitle>
      {feedback && <div style={{ fontSize: 12, color: "#34d399", marginBottom: 10 }}>{feedback}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ flex: 1, fontSize: 13, color: "#fff" }}>
              {u.nickname ?? u.email}
              <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.email}</span>
            </div>
            <select
              defaultValue={u.ai_model ?? "gemini-2.5-flash"}
              onChange={(e) => modelMut.mutate({ userId: u.id, model: e.target.value })}
              style={{ ...input, minWidth: 200 }}
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ))}
        {users.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>사용자 없음</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminControllerPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("");

  const { data: settingsRes, isLoading } = useQuery({
    queryKey: ["admin", "controller", "settings"],
    queryFn: getControllerSettings,
    enabled: !!accessToken,
  });

  const updateMut = useMutation({
    mutationFn: ({ updates, persist }: { updates: Record<string, unknown>; persist: boolean }) =>
      updateControllerSettings(updates, persist),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "controller", "settings"] });
      const skipped = data.ok ? data.data.skipped : [];
      setFeedback(skipped.length > 0 ? `저장 완료 (건너뜀: ${skipped.join(", ")})` : "저장 완료");
      setTimeout(() => setFeedback(""), 2500);
    },
  });

  const resetMut = useMutation({
    mutationFn: resetControllerSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "controller", "settings"] });
      setFeedback("초기화 완료");
      setTimeout(() => setFeedback(""), 2000);
    },
  });

  const schedulerMut = useMutation({
    mutationFn: triggerScheduler,
    onSuccess: (data) => {
      setFeedback(data.ok ? data.data.message : "실패");
      setTimeout(() => setFeedback(""), 2000);
    },
  });

  const { settings, available_models } = settingsRes?.ok
    ? settingsRes.data
    : { settings: {}, available_models: [] };

  // Group settings by prefix
  const groups: Record<string, [string, RuntimeSetting][]> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (filter && !k.includes(filter)) continue;
    const prefix = k.split("_")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push([k, v]);
  }

  const GROUP_LABELS: Record<string, string> = {
    llm: "🤖 LLM 설정",
    scheduler: "⏱ 스케줄러",
    default: "🌱 시스템 기본값",
    system: "⚙ 시스템",
  };

  function handleSave(key: string, value: unknown, persist = false) {
    updateMut.mutate({ updates: { [key]: value }, persist });
  }

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>컨트롤러</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            런타임 변수 수정 · DB 직접 조회/수정 · 스케줄러 제어
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {feedback && <span style={{ fontSize: 12, color: "#34d399" }}>{feedback}</span>}
          <button onClick={() => schedulerMut.mutate()} disabled={schedulerMut.isPending} style={btn()}>
            {schedulerMut.isPending ? "실행 중…" : "▶ 전환 스캔 즉시 실행"}
          </button>
          <button
            onClick={() => { if (confirm("모든 런타임 설정을 기본값으로 초기화하시겠습니까?")) resetMut.mutate(); }}
            style={btn("danger")}
          >
            초기화
          </button>
        </div>
      </header>

      {/* Table overview */}
      <TableOverview />

      {/* Runtime settings */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>⚙ 런타임 설정</div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="설정 이름 검색..."
            style={{ ...input, fontSize: 12, width: 200 }}
          />
          <button
            onClick={() => updateMut.mutate({ updates: Object.fromEntries(
              Object.entries(settings).map(([k, v]) => [k, v.value ?? v.default])
            ), persist: true })}
            disabled={updateMut.isPending}
            style={btn("primary")}
          >
            💾 디스크에 저장
          </button>
        </div>

        {isLoading ? (
          <p style={{ color: "rgba(255,255,255,0.4)" }}>로딩 중...</p>
        ) : (
          Object.entries(groups).map(([prefix, entries]) => (
            <div key={prefix} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                {GROUP_LABELS[prefix] ?? prefix}
              </div>
              {entries.map(([k, v]) => (
                <SettingRow
                  key={k}
                  name={k}
                  setting={v}
                  models={k === "llm_default_model" ? available_models : undefined}
                  onSave={handleSave}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* User model overrides */}
      <UserModelSection models={available_models} />

      {/* SQL executor */}
      <SqlExecutor />
    </div>
  );
}
