"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useChatStore, MIN_CHAT_W, MAX_CHAT_W } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { streamChat } from "@/lib/api/client";
import { getHistory, deleteConversation } from "@/lib/api/conversations";
import { getPlant, listPlants, Plant } from "@/lib/api/plants";
import { getBud } from "@/lib/api/buds";
import { QK } from "@/lib/queryKeys";

// ── types ───────────────────────────────────────────────────

type SystemKind = "plants_list" | "skills_list" | "cmd_result";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  pending?: boolean;
  fromHistory?: boolean;
  kind?: SystemKind;
  plantsData?: Plant[];
}

// ── constants ───────────────────────────────────────────────

const QUICK_ASKS = [
  "오늘 뭘 먼저 해야 할까?",
  "일정 정리해줘",
  "식물 상태 보여줘",
];

const COMMANDS = [
  { cmd: "/clear",    label: "화면 지우기", desc: "화면의 대화 내용만 비웁니다 (기록은 유지)" },
  { cmd: "/delete",   label: "기록 완전 삭제", desc: "현재 세션의 대화 기록을 영구 삭제합니다" },
  { cmd: "/compact",  label: "대화 요약", desc: "지금까지 대화를 핵심만 요약합니다" },
  { cmd: "/plants",   label: "식물 보기", desc: "내 식물 목록을 표시합니다" },
  { cmd: "/new",      label: "새 봉우리", desc: "AI 안내로 봉우리를 만듭니다" },
  { cmd: "/settings", label: "설정",      desc: "설정 페이지로 이동합니다" },
  { cmd: "/skills",   label: "스킬 목록", desc: "AI 스킬 전체를 봅니다" },
  { cmd: "/use",      label: "스킬 실행", desc: "/use 스킬명 으로 직접 실행" },
];

const SKILLS_INFO = [
  { name: "think",                desc: "복잡 작업 사고 계획" },
  { name: "match_plant",          desc: "유사 식물 검색" },
  { name: "create_plant",         desc: "새 식물(분야) 생성" },
  { name: "delete_plant",         desc: "식물 삭제" },
  { name: "create_bud",           desc: "봉우리(고민/일정) 추가" },
  { name: "create_calendar_event", desc: "캘린더 단순 일정 추가 (봉우리 없이)" },
  { name: "update_calendar_event", desc: "일반 일정 수정" },
  { name: "delete_calendar_event", desc: "일반 일정 삭제" },
  { name: "update_bud_status",    desc: "봉우리 상태 변경" },
  { name: "update_bud_progress",  desc: "봉우리 진행률 변경" },
  { name: "set_deadline",         desc: "마감일 설정" },
  { name: "abandon_bud",          desc: "봉우리 포기" },
  { name: "harvest_bud",          desc: "봉우리 수확" },
  { name: "list_plants",          desc: "식물 목록 조회" },
  { name: "list_buds",            desc: "봉우리 목록 조회" },
  { name: "list_calendar_events", desc: "일반 일정(캘린더) 조회" },
  { name: "get_statistics",       desc: "통계 데이터 조회" },
  { name: "get_garden_briefing",  desc: "정원 브리핑 생성" },
  { name: "search_conversation",  desc: "대화 검색" },
];

const SKILL_INVALIDATIONS: Record<string, string[]> = {
  create_plant:          ["plants", "stats", "briefing"],
  delete_plant:          ["plants", "buds", "stats", "briefing"],
  create_bud:            ["buds", "plants", "stats", "briefing", "calendar"],
  create_calendar_event: ["calendar"],
  update_calendar_event: ["calendar"],
  delete_calendar_event: ["calendar"],
  update_bud_status:   ["buds", "plants", "stats", "briefing", "bud"],
  update_bud_progress: ["buds", "bud"],
  harvest_bud:         ["buds", "plants", "stats", "briefing", "bud"],
  abandon_bud:         ["buds", "plants", "stats", "briefing", "bud"],
  set_deadline:        ["buds", "bud", "calendar", "stats"],
};

// ── inline renderers ────────────────────────────────────────

function PlantsListCard({ plants, onChat, onView }: {
  plants: Plant[]; onChat: (id: string) => void; onView: (id: string) => void;
}) {
  if (plants.length === 0)
    return <div className="t-caption" style={{ color: "var(--fg-muted)", padding: "4px 0" }}>식물이 없습니다.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {plants.map((p) => (
        <div
          key={p.id}
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
            <div className="t-caption" style={{ color: "var(--fg-muted)" }}>활성 {p.stats?.active_bud_count ?? 0}개</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onChat(p.id)}>상담</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onView(p.id)}>보기</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsListCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 4 }}>
        스킬 {SKILLS_INFO.length}개
      </div>
      {SKILLS_INFO.map((s) => (
        <div
          key={s.name}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 8px", borderRadius: "var(--r-sm)",
            background: "var(--bg-subtle)",
          }}
        >
          <code className="t-mono" style={{ color: "var(--accent)", flexShrink: 0 }}>{s.name}</code>
          <span className="t-caption" style={{ color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.desc}</span>
        </div>
      ))}
      <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
        /use 스킬명 으로 직접 실행할 수 있습니다.
      </div>
    </div>
  );
}

// ── scope suggestion banner ─────────────────────────────────

interface ScopeSuggestion {
  targetScope: "plant" | "bud" | "global";
  targetId?: string;
  targetName: string;
  /** The user message that triggered the suggestion — carried into the new session. */
  carryText: string;
}

function ScopeSuggestionBanner({
  suggestion,
  onConfirm,
  onDismiss,
}: {
  suggestion: ScopeSuggestion;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="animate-in"
      style={{
        margin: "0 16px 10px",
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        background: "color-mix(in srgb, var(--accent) 8%, var(--bg-subtle))",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 120 }}>
        <span className="t-body-sm" style={{ color: "var(--fg)" }}>
          <strong style={{ color: "var(--accent-fg)" }}>{suggestion.targetName}</strong>
          {" "}식물에 관한 내용이에요. 대화 세션을 변경해 드릴까요?
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onDismiss}>현재 유지</button>
        <button
          className="btn btn-sm"
          onClick={onConfirm}
          style={{ background: "var(--accent)", color: "var(--accent-contrast)", border: "none" }}
        >
          변경하기
        </button>
      </div>
    </div>
  );
}

// ── breadcrumb ──────────────────────────────────────────────

function Breadcrumb({ scopeKind, plantName, budTitle }: { scopeKind: string; plantName?: string; budTitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {scopeKind === "calendar" ? (
        <Crumb active icon="📅" text="캘린더 일정" />
      ) : (
        <>
          <Crumb active={scopeKind === "global"} icon="🏠" text="전체" />
          {(scopeKind === "plant" || scopeKind === "bud") && (
            <>
              <Sep />
              <Crumb active={scopeKind === "plant"} icon="🌿" text={plantName ?? "식물"} />
            </>
          )}
          {scopeKind === "bud" && (
            <>
              <Sep />
              <Crumb active icon="●" text={budTitle ?? "봉우리"} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Crumb({ active, icon, text }: { active: boolean; icon: string; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--r-pill)",
        fontSize: 11.5, fontWeight: 500,
        background: active ? "var(--accent-muted)" : "var(--bg-subtle)",
        color: active ? "var(--accent-fg)" : "var(--fg-muted)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)"}`,
        maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 10 }}>{icon}</span>
      {text}
    </span>
  );
}

function Sep() {
  return <span style={{ fontSize: 10, color: "var(--fg-subtle)" }}>›</span>;
}

// ── ChatPanel ───────────────────────────────────────────────

export default function ChatPanel() {
  const router = useRouter();
  const { open, close, scope, openWith, chatWidth, setChatWidth,
          pendingPrefill, pendingSend, clearPending } = useChatStore();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [scopeSuggestion, setScopeSuggestion] = useState<ScopeSuggestion | null>(null);

  // Resolve breadcrumb labels from cache (instant — no extra network round-trips).
  const plantScopeId = scope.kind === "plant" ? scope.id : undefined;
  const budScopeId   = scope.kind === "bud"   ? scope.id : undefined;
  const { data: _plantRes } = useQuery({
    queryKey: QK.plant(plantScopeId ?? ""),
    queryFn: () => getPlant(plantScopeId!),
    enabled: !!plantScopeId,
    staleTime: 5 * 60_000,
  });
  const { data: _budRes } = useQuery({
    queryKey: QK.bud(budScopeId ?? ""),
    queryFn: () => getBud(budScopeId!),
    enabled: !!budScopeId,
    staleTime: 5 * 60_000,
  });
  const _budPlantId = _budRes?.ok ? _budRes.data.bud.plant_id : undefined;
  const { data: _budPlantRes } = useQuery({
    queryKey: QK.plant(_budPlantId ?? ""),
    queryFn: () => getPlant(_budPlantId!),
    enabled: !!_budPlantId,
    staleTime: 5 * 60_000,
  });
  const breadcrumbPlantName =
    (_plantRes?.ok    ? _plantRes.data.name    : undefined) ??
    (_budPlantRes?.ok ? _budPlantRes.data.name : undefined);
  const breadcrumbBudTitle = _budRes?.ok ? _budRes.data.bud.title : undefined;

  const dirtySkills = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevScopeKey = useRef("");

  const scopeKey = `${scope.kind}:${scope.id ?? ""}`;

  // ── resize handle ────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidth;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      // dragging LEFT → bigger panel (right edge is fixed)
      const delta = startX - ev.clientX;
      const newW = Math.max(MIN_CHAT_W, Math.min(MAX_CHAT_W, startW + delta));
      setChatWidth(newW);
    }
    function onUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [chatWidth, setChatWidth]);

  const filteredCmds = COMMANDS.filter((c) =>
    input.startsWith("/") && c.cmd.startsWith(input.split(" ")[0])
  );

  // Load history when scope changes
  useEffect(() => {
    if (!open) return;
    if (prevScopeKey.current === scopeKey && historyLoaded) return;
    prevScopeKey.current = scopeKey;
    setHistoryLoaded(false);
    setMessages([]);

    getHistory(scope.kind, scope.id, 40).then((res) => {
      if (res.ok && res.data.messages.length > 0) {
        setMessages(
          res.data.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              text: m.text,
              fromHistory: true,
            }))
        );
      }
      setHistoryLoaded(true);
    });
  }, [open, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear scope suggestion when scope changes.
  useEffect(() => {
    setScopeSuggestion(null);
  }, [scopeKey]);

  // Breadcrumb names are now resolved via useQuery above — no useEffect needed.

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Auto-send a prompt dispatched from other components (e.g. bud drawer quick actions).
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) sendText(detail);
    }
    window.addEventListener("pc-chat-prompt", handler);
    return () => window.removeEventListener("pc-chat-prompt", handler);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── command handling ─────────────────────────────────────

  const runCommand = useCallback(async (cmdLine: string) => {
    const parts = cmdLine.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    setInput("");
    setShowPalette(false);

    if (cmd === "/clear") {
      setMessages([]);
      setHistoryLoaded(true);
      return;
    }
    if (cmd === "/delete") {
      const confirmed = window.confirm(
        "현재 세션의 대화 기록을 완전히 삭제할까요?\n저장된 기록과 메시지가 영구 삭제되며 되돌릴 수 없습니다."
      );
      if (!confirmed) return;
      const r = await deleteConversation(scope.kind, scope.id);
      setHistoryLoaded(true);
      qc.invalidateQueries({ queryKey: QK.conversations() });
      setMessages([{
        id: `cmd-delete-${Date.now()}`,
        role: "system",
        kind: "cmd_result",
        text: r.ok
          ? "이 세션의 대화 기록을 완전히 삭제했어요."
          : `삭제 중 오류가 발생했어요: ${r.error.message}`,
      }]);
      return;
    }
    if (cmd === "/settings") {
      close();
      router.push("/settings");
      return;
    }
    if (cmd === "/plants") {
      const res = await listPlants();
      setMessages((prev) => [...prev, {
        id: `cmd-plants-${Date.now()}`,
        role: "system", text: "",
        kind: "plants_list",
        plantsData: res.ok ? res.data.items : [],
      }]);
      return;
    }
    if (cmd === "/skills") {
      setMessages((prev) => [...prev, {
        id: `cmd-skills-${Date.now()}`,
        role: "system", text: "", kind: "skills_list",
      }]);
      return;
    }
    if (cmd === "/compact") {
      const textHistory = messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.text)
        .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.text}`)
        .join("\n");
      if (!textHistory) return;
      sendText(`다음 대화를 핵심만 3~5문장으로 요약해줘. 요약만 출력해줘:\n\n${textHistory}`);
      return;
    }
    if (cmd === "/new") {
      sendText("봉우리를 새로 만들고 싶습니다. 다음 항목을 하나씩 물어봐서 수집한 뒤 create_bud를 호출해주세요: ① 어떤 식물에 추가할까요? ② 봉우리 제목은요? ③ 고민인가요 일정인가요? ④ 세부 내용이 있나요? (없으면 넘어가도 됩니다) ⑤ 마감일이 있나요? (없으면 넘어가도 됩니다) — 지금 ①번 질문부터 시작해주세요.");
      return;
    }
    if (cmd === "/use") {
      const skillName = parts[1] ?? "";
      if (!skillName) {
        setMessages((prev) => [...prev, {
          id: `cmd-use-err-${Date.now()}`,
          role: "system",
          text: "사용법: /use 스킬명\n예: /use get_garden_briefing\n\n/skills 로 전체 목록을 확인하세요.",
          kind: "cmd_result",
        }]);
        return;
      }
      sendText(`${skillName} 스킬을 지금 바로 실행해줘. 필요한 파라미터가 있으면 나에게 물어봐줘.`);
      return;
    }
  }, [messages, close, router, scope, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── send / stream ────────────────────────────────────────

  const sendText = useCallback((text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    const asstId = (Date.now() + 1).toString();
    const asstMsg: Message = { id: asstId, role: "assistant", text: "", pending: true };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setLoading(true);

    setScopeSuggestion(null);
    dirtySkills.current.clear();
    let accumulated = "";
    streamChat(
      { text, scope: scope.kind, scope_id: scope.id, current_screen: scope.kind === "calendar" ? "캘린더" : "웹" },
      {
        onToken: (chunk) => {
          accumulated += chunk;
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, text: accumulated } : m));
        },
        onToolResult: (name, result) => {
          dirtySkills.current.add(name);
          if (name === "suggest_scope_change") {
            const r = result as { ok?: boolean; data?: Record<string, unknown> } | undefined;
            if (r?.ok && r?.data?.suggest_scope_change) {
              setScopeSuggestion({
                targetScope: (r.data.target_scope as "plant" | "bud" | "global") ?? "plant",
                targetId: r.data.target_id as string | undefined,
                targetName: (r.data.target_name as string) ?? "",
                carryText: text,  // carry the user's original message into the new session
              });
            }
          }
        },
        onDone: () => {
          setMessages((prev) => prev.map((m) =>
            m.id === asstId
              ? { ...m, text: m.text || "응답이 비어있어요. 다시 시도해 주세요.", pending: false }
              : m
          ));
          setLoading(false);
          if (dirtySkills.current.size > 0) {
            const keys = new Set<string>();
            dirtySkills.current.forEach((skill) =>
              (SKILL_INVALIDATIONS[skill] ?? []).forEach((k) => keys.add(k))
            );
            keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            dirtySkills.current.clear();
          }
        },
        onError: (_, msg) => {
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, text: `⚠ ${msg}`, pending: false } : m));
          setLoading(false);
        },
      }
    );
  }, [scope, qc]);

  const send = useCallback((text?: string) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setInput("");
    setShowPalette(false);
    if (t.startsWith("/")) { runCommand(t); return; }
    sendText(t);
  }, [input, loading, runCommand, sendText]);

  // Consume one-shot pending actions set by openWith():
  //  - pendingPrefill → drop the carried-over text into the input (user presses Enter)
  //  - pendingSend    → auto-send once the new session's history has loaded
  useEffect(() => {
    if (pendingPrefill) {
      setInput(pendingPrefill);
      clearPending();
      setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }
    if (pendingSend && historyLoaded) {
      const t = pendingSend;
      clearPending();
      sendText(t);
    }
  }, [pendingPrefill, pendingSend, historyLoaded, clearPending, sendText]);

  if (!open) return null;


  return (
    <aside
      className="animate-in-right"
      style={{
        position: "fixed", right: 0, top: 0, bottom: 0,
        width: chatWidth, zIndex: 40,
        display: "flex", flexDirection: "column",
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* ── Resize handle ── drag this left/right to change panel width */}
      <div
        onMouseDown={handleResizeStart}
        title="드래그해서 크기 조절"
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
          cursor: "col-resize", zIndex: 1,
          background: "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 40%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {/* Row 1 — session breadcrumb  +  온라인 badge  +  닫기 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Breadcrumb scopeKind={scope.kind} plantName={breadcrumbPlantName} budTitle={breadcrumbBudTitle} />
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>
            <span className="dot" style={{ background: "var(--positive)" }} />
            온라인
          </span>
          <button
            onClick={close}
            className="btn btn-ghost btn-sm"
            aria-label="닫기"
            style={{ width: 26, height: 26, padding: 0, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
        {/* Row 2 — icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 12px" }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: "var(--r-md)",
              background: "var(--accent)", color: "var(--accent-contrast)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.5A8 8 0 1121 12z" />
            </svg>
          </div>
          <div className="t-h3" style={{ color: "var(--fg)" }}>AI 정원사</div>
        </div>
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
        {!historyLoaded && (
          <div style={{ paddingTop: 20, textAlign: "center" }}>
            <span className="t-caption animate-pulse" style={{ color: "var(--fg-muted)" }}>대화 이력 불러오는 중…</span>
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <div style={{ paddingTop: 8 }}>
            <div
              className="card"
              style={{ padding: "14px 16px", marginBottom: 16, background: "var(--accent-muted)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}
            >
              <div className="t-h3" style={{ color: "var(--accent-fg)" }}>
                안녕하세요{user?.nickname ? `, ${user.nickname}님` : ""}
              </div>
              <div className="t-body-sm" style={{ color: "var(--accent-fg)", marginTop: 4, lineHeight: 1.55, opacity: 0.85 }}>
                고민, 일정, 식물 관리를 도와드립니다. 자유롭게 말씀해 주세요.
              </div>
            </div>
            <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 8 }}>빠른 시작</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUICK_ASKS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="card"
                  style={{
                    padding: "10px 12px", textAlign: "left", cursor: "pointer",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "var(--bg-subtle)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
                >
                  <span className="t-body-sm" style={{ color: "var(--fg)" }}>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {historyLoaded && messages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, i) => {
              if (msg.role === "system") {
                if (msg.kind === "plants_list") {
                  return (
                    <div key={msg.id} className="animate-in">
                      <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 6 }}>식물 목록</div>
                      <PlantsListCard
                        plants={msg.plantsData ?? []}
                        onChat={(id) => openWith({ kind: "plant", id })}
                        onView={(id) => { close(); router.push(`/plants/${id}`); }}
                      />
                    </div>
                  );
                }
                if (msg.kind === "skills_list") {
                  return <div key={msg.id} className="animate-in"><SkillsListCard /></div>;
                }
                if (msg.kind === "cmd_result") {
                  return (
                    <div key={msg.id} className="animate-in"
                      style={{
                        padding: "10px 12px", borderRadius: "var(--r-md)",
                        background: "var(--bg-subtle)", border: "1px solid var(--border)",
                        whiteSpace: "pre-wrap", fontSize: 12.5, color: "var(--fg-secondary)", lineHeight: 1.55,
                      }}
                    >
                      {msg.text}
                    </div>
                  );
                }
                return null;
              }

              return (
                <div key={msg.id} className={msg.fromHistory ? "" : "animate-in"} style={{ opacity: msg.fromHistory ? 0.65 : 1 }}>
                  <div
                    className="t-caption"
                    style={{ color: "var(--fg-muted)", marginBottom: 4, textAlign: msg.role === "user" ? "right" : "left", fontWeight: 600 }}
                  >
                    {msg.role === "user" ? "나" : "AI 정원사"}
                  </div>
                  <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "86%", padding: "9px 12px",
                        borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                        background: msg.role === "user" ? "var(--accent)" : "var(--bg-subtle)",
                        color: msg.role === "user" ? "var(--accent-contrast)" : "var(--fg)",
                        border: msg.role === "user" ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {msg.pending && !msg.text
                        ? <span className="animate-pulse" style={{ color: "var(--fg-muted)" }}>생각 중…</span>
                        : msg.text}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Scope suggestion banner */}
      {scopeSuggestion && (
        <ScopeSuggestionBanner
          suggestion={scopeSuggestion}
          onConfirm={() => {
            const { targetScope, targetId, carryText } = scopeSuggestion;
            // Carry the original question into the new session's input box so the
            // user only needs to press Enter to re-run it in the correct scope.
            const opts = carryText ? { prefill: carryText } : undefined;
            if (targetScope === "plant") {
              openWith({ kind: "plant", id: targetId }, opts);
            } else if (targetScope === "bud") {
              openWith({ kind: "bud", id: targetId }, opts);
            } else {
              openWith({ kind: "global" }, opts);
            }
            setScopeSuggestion(null);
          }}
          onDismiss={() => setScopeSuggestion(null)}
        />
      )}

      {/* Input */}
      <div style={{ padding: "12px 16px 14px", borderTop: "1px solid var(--border)", position: "relative", flexShrink: 0 }}>
        {showPalette && filteredCmds.length > 0 && (
          <div
            className="card"
            style={{
              position: "absolute", left: 16, right: 16, bottom: "100%", marginBottom: 6,
              boxShadow: "var(--shadow-lg)", overflow: "hidden", zIndex: 50,
              padding: 0,
            }}
          >
            <div className="t-label" style={{ color: "var(--fg-muted)", padding: "8px 12px 4px" }}>명령어</div>
            {filteredCmds.map((c, idx) => (
              <button
                key={c.cmd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPaletteIdx(idx);
                  if (c.cmd === "/use") { setInput("/use "); setShowPalette(false); inputRef.current?.focus(); return; }
                  send(c.cmd);
                }}
                onMouseEnter={() => setPaletteIdx(idx)}
                style={{
                  width: "100%", textAlign: "left", border: "none",
                  padding: "8px 12px", cursor: "pointer",
                  background: idx === paletteIdx ? "var(--bg-hover)" : "transparent",
                  display: "flex", alignItems: "center", gap: 10, transition: "background 0.1s",
                }}
              >
                <code className="t-mono" style={{ color: "var(--accent)", minWidth: 64 }}>{c.cmd}</code>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-body-sm" style={{ color: "var(--fg)" }}>{c.label}</div>
                  <div className="t-caption" style={{ color: "var(--fg-muted)" }}>{c.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex", gap: 8, alignItems: "flex-end",
            background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", padding: "8px 8px 8px 12px",
            transition: "border-color 0.12s, box-shadow 0.12s",
          }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)"; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              setShowPalette(v.startsWith("/"));
              setPaletteIdx(0);
            }}
            onKeyDown={(e) => {
              if (showPalette && filteredCmds.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, filteredCmds.length - 1)); return; }
                if (e.key === "ArrowUp")   { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); return; }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault();
                  const c = filteredCmds[paletteIdx];
                  if (c.cmd === "/use") { setInput("/use "); setShowPalette(false); return; }
                  send(c.cmd);
                  return;
                }
                if (e.key === "Escape") { setShowPalette(false); return; }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="발화를 입력하세요… (/ 로 명령어)"
            rows={1}
            disabled={loading}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", fontFamily: "var(--font-sans)",
              fontSize: 13.5, color: "var(--fg)", lineHeight: 1.55, maxHeight: 100,
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 100) + "px";
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="보내기"
            style={{
              width: 30, height: 30, borderRadius: "var(--r-md)",
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: input.trim() ? "var(--accent)" : "var(--bg-muted)",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
              transition: "background 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={input.trim() ? "var(--accent-contrast)" : "var(--fg-muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 12V2M2 7l5-5 5 5" />
            </svg>
          </button>
        </div>
        <div className="t-caption" style={{ color: "var(--fg-subtle)", textAlign: "center", marginTop: 6 }}>
          <span className="kbd">Enter</span> 전송 · <span className="kbd">/</span> 명령어 · <span className="kbd">⇧</span><span className="kbd">Enter</span> 줄바꿈
        </div>
      </div>
    </aside>
  );
}
