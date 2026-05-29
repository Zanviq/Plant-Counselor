"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminUsers,
  deleteUserConversations,
  deleteAllConversations,
  deleteAllLogFiles,
  adminDeleteUserAccount,
  listLogs,
  type AdminUser,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

// ── Shared styles ─────────────────────────────────────────────────────────────

const dark: React.CSSProperties = {
  background: "#1a1f2e",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "20px 24px",
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block",
};

function DangerBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 14px", borderRadius: 7, border: "none",
        background: "rgba(239,68,68,0.12)", color: "#f87171",
        fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function WarnBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 14px", borderRadius: 7, border: "none",
        background: "rgba(245,158,11,0.1)", color: "#f59e0b",
        fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title, description, confirmLabel, danger,
  onConfirm, onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#1a1f2e", borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.13)",
          padding: "28px 32px", width: 440, maxWidth: "92vw",
          boxShadow: "0 28px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
          {danger && <span style={{ color: "#f87171", marginRight: 8 }}>⚠</span>}
          {title}
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.75,
          whiteSpace: "pre-line",
        }}>
          {description}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "rgba(255,255,255,0.6)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px", borderRadius: 7, border: "none",
              background: danger ? "#dc2626" : "#3b82f6",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Result Banner ─────────────────────────────────────────────────────────────

function ResultBanner({ ok, msg, onDismiss }: { ok: boolean; msg: string; onDismiss: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
      background: ok ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
      border: `1px solid ${ok ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`,
      fontSize: 12,
    }}>
      <span style={{ color: ok ? "#34d399" : "#f87171", fontWeight: 700 }}>{ok ? "✓" : "✗"}</span>
      <span style={{ color: "rgba(255,255,255,0.65)", flex: 1 }}>{msg}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0, fontSize: 14 }}>✕</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminDataPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();

  const [modal, setModal] = useState<{
    title: string; description: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: usersRes } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: !!accessToken,
  });
  const { data: logsRes } = useQuery({
    queryKey: ["admin", "logs", "recent"],
    queryFn: () => listLogs({ limit: 5 }),
    enabled: !!accessToken,
  });

  const users: AdminUser[] = usersRes?.ok ? usersRes.data.items : [];
  const recentLogs = logsRes?.ok ? logsRes.data : { total: 0, items: [] };

  function ask(cfg: typeof modal) {
    setModal(cfg);
  }

  async function runModal() {
    if (!modal) return;
    const action = modal.onConfirm;
    setModal(null);
    setRunning(true);
    setResult(null);
    try {
      await action();
    } catch (e) {
      setResult({ ok: false, msg: `오류: ${e}` });
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
    }
  }

  // ── Action helpers ─────────────────────────────────────────────────────────

  function deleteConvsForUser(u: AdminUser) {
    ask({
      title: `${u.email}의 대화 기록 삭제`,
      description: `${u.nickname ?? u.email}의 모든 대화 기록, 메시지, AI 채팅 로그 파일이 영구적으로 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`,
      confirmLabel: "삭제",
      danger: true,
      onConfirm: async () => {
        const res = await deleteUserConversations(u.id, true);
        setResult(res.ok
          ? { ok: true, msg: `${u.email}: 대화 ${res.data.deleted_conversations ?? 0}개, 로그 파일 ${res.data.deleted_log_files ?? 0}개 삭제됨` }
          : { ok: false, msg: "삭제 실패" });
      },
    });
  }

  function deleteAccountForUser(u: AdminUser) {
    ask({
      title: `${u.email} 계정 완전 삭제`,
      description: [
        `${u.nickname ?? u.email}의 모든 데이터가 삭제됩니다:`,
        "• 식물, 봉우리, 봉우리 기록",
        "• 대화 기록, 메시지",
        "• 알림, 정원 상태",
        "• AI 로그 파일",
        "• Supabase Auth 계정",
        "",
        "이 작업은 되돌릴 수 없습니다.",
      ].join("\n"),
      confirmLabel: "계정 완전 삭제",
      danger: true,
      onConfirm: async () => {
        const res = await adminDeleteUserAccount(u.id);
        if (res.ok) {
          const d = res.data.deleted ?? {};
          setResult({
            ok: true,
            msg: `${u.email} 삭제 완료 · 식물 ${d.plants ?? 0}, 봉우리 ${d.buds ?? 0}, 대화 ${d.conversations ?? 0}, 로그 ${d.log_files ?? 0}`,
          });
        } else {
          setResult({ ok: false, msg: "삭제 실패" });
        }
      },
    });
  }

  function deleteAllConvs() {
    ask({
      title: "전체 대화 기록 삭제",
      description: "모든 사용자의 대화 기록, 메시지, AI 채팅 로그 파일이 영구 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.",
      confirmLabel: "전체 삭제",
      danger: true,
      onConfirm: async () => {
        const res = await deleteAllConversations(true);
        setResult(res.ok
          ? { ok: true, msg: `전체 대화 ${res.data.deleted_conversations ?? 0}개, 로그 파일 ${res.data.deleted_log_files ?? 0}개 삭제됨` }
          : { ok: false, msg: "삭제 실패" });
      },
    });
  }

  function deleteAllLogs() {
    ask({
      title: "AI 로그 파일 전체 삭제",
      description: "backend/logs/chat/ 의 모든 JSON 파일이 삭제됩니다.\n대화 기록(DB)은 유지됩니다.\n\n이 작업은 되돌릴 수 없습니다.",
      confirmLabel: "파일 삭제",
      danger: true,
      onConfirm: async () => {
        const res = await deleteAllLogFiles();
        setResult(res.ok
          ? { ok: true, msg: `로그 파일 ${res.data.deleted_log_files ?? 0}개 삭제됨` }
          : { ok: false, msg: "삭제 실패" });
      },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      {modal && (
        <ConfirmModal
          {...modal}
          onConfirm={runModal}
          onCancel={() => setModal(null)}
        />
      )}

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>데이터 관리</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          대화 기록, AI 로그 파일, 사용자 계정 데이터 삭제
        </p>
      </header>

      {result && <ResultBanner ok={result.ok} msg={result.msg} onDismiss={() => setResult(null)} />}

      {/* ── Overview ── */}
      <div style={dark}>
        <span style={labelStyle}>현황</span>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "총 사용자", value: users.length },
            { label: "AI 로그 파일", value: recentLogs.total },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Global Ops ── */}
      <div style={dark}>
        <span style={labelStyle}>전체 일괄 작업</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <DangerBtn onClick={deleteAllConvs} disabled={running}>
            전체 대화 기록 삭제 (DB + 로그 파일)
          </DangerBtn>
          <DangerBtn onClick={deleteAllLogs} disabled={running}>
            AI 로그 파일만 삭제 (DB 유지)
          </DangerBtn>
        </div>
      </div>

      {/* ── Per-user ── */}
      <div style={dark}>
        <span style={labelStyle}>사용자별 데이터</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.length === 0 && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>사용자 없음</p>
          )}
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                    {u.nickname ?? "(닉네임 없음)"}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 999,
                    background: u.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
                    color: u.role === "admin" ? "#f87171" : "rgba(255,255,255,0.4)",
                    fontWeight: 600,
                  }}>
                    {u.role === "admin" ? "관리자" : "일반"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                  {u.email}
                  <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                  식물 {u.plant_count} · 봉우리 {u.bud_count} · AI {u.ai_session_count}세션
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <WarnBtn
                  onClick={() => deleteConvsForUser(u)}
                  disabled={running}
                >
                  대화 기록 삭제
                </WarnBtn>
                <DangerBtn
                  onClick={() => deleteAccountForUser(u)}
                  disabled={running || u.role === "admin"}
                >
                  계정 완전 삭제
                </DangerBtn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Logs ── */}
      <div style={dark}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={labelStyle}>최근 AI 로그 (최신 5건)</span>
          <a href="/admin/logs" style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none" }}>
            로그 브라우저 →
          </a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentLogs.items.length === 0 && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>로그 없음</p>
          )}
          {recentLogs.items.map((log) => (
            <div key={log.filename} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "9px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
              fontSize: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {log.user_input || "(입력 없음)"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  {log.timestamp?.slice(0, 16).replace("T", " ")} · {log.user_id?.slice(0, 8)}
                </div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                LLM {log.llm_call_count} · 스킬 {log.skill_call_count} · ~{log.token_estimate}tok
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
