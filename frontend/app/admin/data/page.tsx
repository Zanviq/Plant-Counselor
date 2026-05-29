"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminUsers,
  getUserConversations, deleteConversation,
  getUserPlants,      deletePlant,
  getUserBuds,        deleteBud,
  deleteUserConversations, deleteAllConversations, deleteAllLogFiles,
  adminDeleteUserAccount,
  type AdminUser, type ConversationItem, type PlantItem, type BudItem,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

// ── Shared ────────────────────────────────────────────────────────────────────

const BUD_STATUS_COLOR: Record<string, string> = {
  seed: "#60a5fa", bud: "#34d399", flower: "#f59e0b",
  fruit: "#a78bfa", harvested: "#6b7280", wilting: "#fb923c", rot: "#f87171",
};

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 600,
      background: `${color ?? "#6b7280"}20`, color: color ?? "#9ca3af",
    }}>{children}</span>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title, description, confirmLabel = "삭제",
  onConfirm, onCancel,
}: {
  title: string; description: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}
    >
      <div
        style={{ background: "#1a1f2e", borderRadius: 14, border: "1px solid rgba(255,255,255,0.13)", padding: "26px 30px", width: 420, maxWidth: "92vw", boxShadow: "0 28px 80px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
          <span style={{ color: "#f87171", marginRight: 8 }}>⚠</span>{title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 22, lineHeight: 1.75, whiteSpace: "pre-line" }}>
          {description}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}>
            취소
          </button>
          <button onClick={onConfirm} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline confirm helper ─────────────────────────────────────────────────────

function useConfirm() {
  const [state, setState] = useState<{ title: string; description: string; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null);
  function confirm(title: string, description: string, confirmLabel = "삭제"): Promise<boolean> {
    return new Promise((resolve) => setState({ title, description, confirmLabel, resolve }));
  }
  function modal() {
    if (!state) return null;
    return (
      <ConfirmModal
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        onConfirm={() => { state.resolve(true); setState(null); }}
        onCancel={() => { state.resolve(false); setState(null); }}
      />
    );
  }
  return { confirm, modal };
}

// ── Result banner ─────────────────────────────────────────────────────────────

function Result({ ok, msg, onDismiss }: { ok: boolean; msg: string; onDismiss: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 8, marginBottom: 14, background: ok ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${ok ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`, fontSize: 12 }}>
      <span style={{ color: ok ? "#34d399" : "#f87171", fontWeight: 700 }}>{ok ? "✓" : "✗"}</span>
      <span style={{ color: "rgba(255,255,255,0.65)", flex: 1 }}>{msg}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0 }}>✕</button>
    </div>
  );
}

// ── Conversations panel ───────────────────────────────────────────────────────

function ConversationsPanel({ userId, onResult }: { userId: string; onResult: (r: { ok: boolean; msg: string }) => void }) {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const { confirm, modal } = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "data", "convs", userId],
    queryFn: () => getUserConversations(userId),
    enabled: !!accessToken,
  });
  const items: ConversationItem[] = res?.ok ? res.data.items : [];

  async function handleDelete(conv: ConversationItem) {
    const scopeLabel = conv.scope === "global" ? "전체" : conv.scope === "calendar" ? "캘린더" : `식물/봉우리`;
    const ok = await confirm(
      "대화 기록 삭제",
      `스코프: ${scopeLabel}\n메시지 ${conv.message_count}개를 포함한 이 대화 기록이 영구 삭제됩니다.\n\n되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    setDeleting(conv.id);
    const r = await deleteConversation(conv.id);
    setDeleting(null);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["admin", "data", "convs", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onResult({ ok: true, msg: "대화 기록이 삭제됐습니다." });
    } else {
      onResult({ ok: false, msg: "삭제 실패" });
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm(
      "이 사용자의 모든 대화 기록 삭제",
      `${items.length}개의 대화 기록과 모든 메시지가 영구 삭제됩니다.\n\n되돌릴 수 없습니다.`,
      "전체 삭제",
    );
    if (!ok) return;
    const r = await deleteUserConversations(userId, false);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["admin", "data", "convs", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onResult({ ok: true, msg: `대화 ${r.data.deleted_conversations ?? 0}개 삭제됨` });
    } else {
      onResult({ ok: false, msg: "전체 삭제 실패" });
    }
  }

  if (isLoading) return <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>로딩 중...</p>;

  return (
    <>
      {modal()}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{items.length}개의 대화</span>
        {items.length > 0 && (
          <button onClick={handleDeleteAll} style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            전체 삭제
          </button>
        )}
      </div>
      {items.length === 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>대화 없음</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>
        {items.map((conv) => (
          <div key={conv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <Tag color="#60a5fa">{conv.scope}</Tag>
                {conv.scope_id && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>{conv.scope_id.slice(0, 8)}</span>}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                메시지 {conv.message_count}개 · {conv.updated_at?.slice(0, 16).replace("T", " ")}
              </div>
            </div>
            <button
              onClick={() => handleDelete(conv)}
              disabled={deleting === conv.id}
              style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
            >
              {deleting === conv.id ? "…" : "삭제"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Plants panel ──────────────────────────────────────────────────────────────

function PlantsPanel({ userId, onResult }: { userId: string; onResult: (r: { ok: boolean; msg: string }) => void }) {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const { confirm, modal } = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "data", "plants", userId],
    queryFn: () => getUserPlants(userId),
    enabled: !!accessToken,
  });
  const items: PlantItem[] = res?.ok ? res.data.items : [];

  async function handleDelete(plant: PlantItem) {
    const ok = await confirm(
      `'${plant.name}' 식물 삭제`,
      `이 식물과 연결된 봉우리 ${plant.bud_count}개, 봉우리 기록이 모두 영구 삭제됩니다.\n\n되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    setDeleting(plant.id);
    const r = await deletePlant(plant.id);
    setDeleting(null);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["admin", "data", "plants", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "data", "buds", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onResult({ ok: true, msg: `'${plant.name}' 식물이 삭제됐습니다.` });
    } else {
      onResult({ ok: false, msg: "삭제 실패" });
    }
  }

  if (isLoading) return <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>로딩 중...</p>;

  return (
    <>
      {modal()}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{items.length}개의 식물 (archived 포함)</div>
      {items.length === 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>식물 없음</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>
        {items.map((plant) => (
          <div key={plant.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{plant.name}</span>
                <Tag color={plant.status === "active" ? "#34d399" : plant.status === "archived" ? "#6b7280" : "#f59e0b"}>
                  {plant.status}
                </Tag>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                봉우리 {plant.bud_count}개 · {plant.created_at?.slice(0, 10)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(plant)}
              disabled={deleting === plant.id}
              style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
            >
              {deleting === plant.id ? "…" : "삭제"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Buds panel ────────────────────────────────────────────────────────────────

function BudsPanel({ userId, onResult }: { userId: string; onResult: (r: { ok: boolean; msg: string }) => void }) {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const { confirm, modal } = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "data", "buds", userId],
    queryFn: () => getUserBuds(userId),
    enabled: !!accessToken,
  });
  const items: BudItem[] = res?.ok ? res.data.items : [];

  async function handleDelete(bud: BudItem) {
    const ok = await confirm(
      `'${bud.title}' 봉우리 삭제`,
      `이 봉우리와 봉우리 기록(이력)이 영구 삭제됩니다.\n\n되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    setDeleting(bud.id);
    const r = await deleteBud(bud.id);
    setDeleting(null);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["admin", "data", "buds", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onResult({ ok: true, msg: `'${bud.title}' 봉우리가 삭제됐습니다.` });
    } else {
      onResult({ ok: false, msg: "삭제 실패" });
    }
  }

  if (isLoading) return <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>로딩 중...</p>;

  return (
    <>
      {modal()}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{items.length}개의 봉우리</div>
      {items.length === 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>봉우리 없음</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>
        {items.map((bud) => (
          <div key={bud.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{bud.title}</span>
                <Tag color={BUD_STATUS_COLOR[bud.status]}>{bud.status}</Tag>
                <Tag color="#a78bfa">{bud.type}</Tag>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                진행률 {bud.progress}% · {bud.deadline ? `마감 ${bud.deadline}` : "마감 없음"} · {bud.created_at?.slice(0, 10)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(bud)}
              disabled={deleting === bud.id}
              style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
            >
              {deleting === bud.id ? "…" : "삭제"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── User row (expandable) ─────────────────────────────────────────────────────

type DataTab = "conversations" | "plants" | "buds";

function UserRow({ user, onResult }: { user: AdminUser; onResult: (r: { ok: boolean; msg: string }) => void }) {
  const { confirm, modal } = useConfirm();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DataTab>("conversations");

  async function handleDeleteAll() {
    const ok = await confirm(
      `${user.email} 계정 완전 삭제`,
      [
        "모든 데이터가 영구 삭제됩니다:",
        `• 식물 ${user.plant_count}개 (봉우리·기록 포함)`,
        "• 모든 대화 기록",
        "• AI 로그 파일",
        "• Supabase Auth 계정",
        "",
        "되돌릴 수 없습니다.",
      ].join("\n"),
      "계정 완전 삭제",
    );
    if (!ok) return;
    const r = await adminDeleteUserAccount(user.id);
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["admin"] });
      const d = r.data.deleted ?? {};
      onResult({ ok: true, msg: `${user.email} 삭제 완료 · 식물 ${d.plants ?? 0}, 봉우리 ${d.buds ?? 0}, 대화 ${d.conversations ?? 0}` });
    } else {
      onResult({ ok: false, msg: "삭제 실패" });
    }
  }

  const TABS: { id: DataTab; label: string }[] = [
    { id: "conversations", label: "대화 기록" },
    { id: "plants", label: "식물" },
    { id: "buds", label: "봉우리" },
  ];

  return (
    <>
      {modal()}
      <div style={{ background: "#1a1f2e", borderRadius: 10, border: `1px solid ${expanded ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.07)"}`, overflow: "hidden", marginBottom: 10 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
          <span style={{ fontSize: 14, color: expanded ? "#60a5fa" : "rgba(255,255,255,0.5)", transition: "color 0.15s" }}>
            {expanded ? "▼" : "▶"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{user.nickname ?? "(닉네임 없음)"}</span>
              <Tag color={user.role === "admin" ? "#f87171" : "#6b7280"}>
                {user.role === "admin" ? "관리자" : "일반"}
              </Tag>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {user.email}
              <span style={{ margin: "0 6px", opacity: 0.4 }}>·</span>
              식물 {user.plant_count} · 봉우리 {user.bud_count} · AI {user.ai_session_count}세션
            </div>
          </div>
          {user.role !== "admin" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteAll(); }}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            >
              계정 삭제
            </button>
          )}
        </div>

        {/* Expanded content */}
        {expanded && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    padding: "7px 14px", background: "none", border: "none",
                    color: activeTab === id ? "#60a5fa" : "rgba(255,255,255,0.35)",
                    fontSize: 12, fontWeight: activeTab === id ? 700 : 400,
                    cursor: "pointer",
                    borderBottom: activeTab === id ? "2px solid #60a5fa" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "conversations" && <ConversationsPanel userId={user.id} onResult={onResult} />}
            {activeTab === "plants"        && <PlantsPanel        userId={user.id} onResult={onResult} />}
            {activeTab === "buds"          && <BudsPanel          userId={user.id} onResult={onResult} />}
          </div>
        )}
      </div>
    </>
  );
}

// ── Global ops ────────────────────────────────────────────────────────────────

function GlobalOps({ onResult }: { onResult: (r: { ok: boolean; msg: string }) => void }) {
  const { confirm, modal } = useConfirm();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  async function allConvs() {
    const ok = await confirm("전체 대화 기록 삭제 (DB)", "모든 사용자의 대화 기록과 메시지가 DB에서 영구 삭제됩니다.\n\n되돌릴 수 없습니다.", "전체 삭제");
    if (!ok) return;
    setRunning(true);
    const r = await deleteAllConversations(false);
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["admin"] });
    onResult(r.ok ? { ok: true, msg: `전체 대화 ${r.data.deleted_conversations ?? 0}개 삭제됨` } : { ok: false, msg: "실패" });
  }

  async function allLogs() {
    const ok = await confirm("AI 로그 파일 전체 삭제", "backend/logs/chat/ 의 JSON 파일만 삭제됩니다.\nDB의 대화 기록은 유지됩니다.\n\n되돌릴 수 없습니다.", "파일 삭제");
    if (!ok) return;
    setRunning(true);
    const r = await deleteAllLogFiles();
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["admin"] });
    onResult(r.ok ? { ok: true, msg: `로그 파일 ${r.data.deleted_log_files ?? 0}개 삭제됨` } : { ok: false, msg: "실패" });
  }

  return (
    <>
      {modal()}
      <div style={{ background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          전체 일괄 작업
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={allConvs} disabled={running} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            전체 대화 기록 삭제 (DB)
          </button>
          <button onClick={allLogs} disabled={running} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            AI 로그 파일만 삭제 (파일 전용)
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(255,255,255,0.4)" }}>대화 기록(DB)</strong> = conversations 테이블 · 사용자가 /history에서 보는 기록<br />
          <strong style={{ color: "rgba(255,255,255,0.4)" }}>AI 로그 파일</strong> = backend/logs/chat/*.json · 관리자 AI 로그 페이지에서 보는 파일
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminDataPage() {
  const { accessToken } = useAuthStore();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: !!accessToken,
  });
  const users: AdminUser[] = usersRes?.ok ? usersRes.data.items : [];

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>데이터 관리</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          대화 기록(DB) · AI 로그 파일 · 식물 · 봉우리 개별 삭제
        </p>
      </header>

      {result && <Result ok={result.ok} msg={result.msg} onDismiss={() => setResult(null)} />}

      <GlobalOps onResult={setResult} />

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
        사용자별 상세 관리
      </div>

      {isLoading && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>로딩 중...</p>}
      {users.map((u) => (
        <UserRow key={u.id} user={u} onResult={setResult} />
      ))}
    </div>
  );
}
