"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { QK } from "@/lib/queryKeys";
import {
  listConversations,
  getHistory,
  searchConversation,
  ConversationSummary,
  ConvMessage,
} from "@/lib/api/conversations";
import { listPlants, Plant } from "@/lib/api/plants";
import { listBuds, Bud } from "@/lib/api/buds";
import { MarkdownText } from "@/lib/markdown";

// ── helpers ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// ── tree data model ───────────────────────────────────────────

interface TreeItem {
  key: string;          // unique key for selection
  conv: ConversationSummary;
  label: string;
  icon: "global" | "calendar" | "plant" | "concern" | "schedule";
  indent: number;       // visual indent only: 0=root/plant, 1=bud
  nodeType: "root" | "plant" | "bud";
  plantId?: string;
  dimmed?: boolean;     // disappeared buds
}

function buildTree(
  convs: ConversationSummary[],
  plants: Plant[],
  buds: Bud[],
  filterQuery: string
): TreeItem[] {
  const q = filterQuery.trim().toLowerCase();

  const byScope = new Map<string, ConversationSummary>();
  for (const c of convs) {
    byScope.set(`${c.scope}:${c.scope_id ?? ""}`, c);
  }

  const budById   = new Map(buds.map((b) => [b.id, b]));

  const items: TreeItem[] = [];

  // ── Global ──────────────────────────────────────────────────
  const global = byScope.get("global:");
  if (global) {
    const item: TreeItem = { key: global.id, conv: global, label: "전체 대화", icon: "global", indent: 0, nodeType: "root" };
    if (!q || matchesFilter(item, q)) items.push(item);
  }

  // ── Calendar ────────────────────────────────────────────────
  const cal = byScope.get("calendar:");
  if (cal) {
    const item: TreeItem = { key: cal.id, conv: cal, label: "캘린더", icon: "calendar", indent: 0, nodeType: "root" };
    if (!q || matchesFilter(item, q)) items.push(item);
  }

  // ── Per-plant ────────────────────────────────────────────────
  // Determine which plants have any conversations
  const plantIdsWithConvs = new Set<string>();
  for (const c of convs) {
    if (c.scope === "plant" && c.scope_id) plantIdsWithConvs.add(c.scope_id);
    if (c.scope === "bud" && c.scope_id) {
      const bud = budById.get(c.scope_id);
      if (bud) plantIdsWithConvs.add(bud.plant_id);
    }
  }

  // Sort plants by most-recently-active conversation
  const plantsSorted = [...plants].sort((a, b) => {
    const aConv = byScope.get(`plant:${a.id}`);
    const bConv = byScope.get(`plant:${b.id}`);
    const aTime = aConv?.updated_at ?? "0";
    const bTime = bConv?.updated_at ?? "0";
    return bTime.localeCompare(aTime);
  });

  for (const plant of plantsSorted) {
    if (!plantIdsWithConvs.has(plant.id)) continue;

    const plantConv = byScope.get(`plant:${plant.id}`) ?? null;
    const budConvs: TreeItem[] = buds
      .filter((b) => b.plant_id === plant.id)
      .reduce<TreeItem[]>((acc, bud) => {
        const c = byScope.get(`bud:${bud.id}`);
        if (!c) return acc;
        const item: TreeItem = {
          key: c.id,
          conv: c,
          label: bud.title,
          icon: bud.type,
          indent: 1,
          nodeType: "bud",
          plantId: plant.id,
          dimmed: !!bud.disappeared_at,
        };
        if (!q || matchesFilter(item, q, plant.name)) acc.push(item);
        return acc;
      }, [])
      .sort((a, b) => b.conv.updated_at.localeCompare(a.conv.updated_at));

    const plantItem: TreeItem | null = plantConv
      ? {
          key: plantConv.id,
          conv: plantConv,
          label: plant.name,
          icon: "plant",
          indent: 0,
          nodeType: "plant",
          plantId: plant.id,
        }
      : null;

    if (!q) {
      // No filter — show plant header always if it has any relevant conversations
      if (plantItem) items.push(plantItem);
      else {
        // Plant has bud convs but no plant-level conv → show ghost header
        if (budConvs.length > 0) {
          items.push({
            key: `ghost-plant-${plant.id}`,
            conv: budConvs[0].conv, // proxy for display
            label: plant.name,
            icon: "plant",
            indent: 0,
            nodeType: "plant",
            plantId: plant.id,
          });
        }
      }
      items.push(...budConvs);
    } else {
      // With filter: only include plant header if plantItem matches OR has matching buds
      const plantMatches = plantItem && matchesFilter(plantItem, q);
      if (plantMatches || budConvs.length > 0) {
        if (plantItem) items.push(plantItem);
        items.push(...budConvs);
      }
    }
  }

  return items;
}

function matchesFilter(item: TreeItem, q: string, parentName?: string): boolean {
  return (
    item.label.toLowerCase().includes(q) ||
    (item.conv.last_message ?? "").toLowerCase().includes(q) ||
    (parentName ?? "").toLowerCase().includes(q)
  );
}

// ── ScopeTag for thread header ────────────────────────────────

function ScopeTag({ item, plants }: { item: TreeItem; plants: Plant[] }) {
  const plant = item.plantId ? plants.find((p) => p.id === item.plantId) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {plant && (
        <>
          <span style={{
            fontSize: 11.5, fontWeight: 500,
            padding: "2px 8px", borderRadius: 999,
            background: "var(--bg-subtle)", color: "var(--fg-muted)",
            border: "1px solid var(--border)",
          }}>
            {plant.name}
          </span>
          {item.nodeType === "bud" && <span style={{ fontSize: 10, color: "var(--fg-subtle)" }}>›</span>}
        </>
      )}
      <span style={{
        fontSize: 11.5, fontWeight: 500,
        padding: "2px 8px", borderRadius: 999,
        background: "var(--accent-muted)", color: "var(--accent-fg)",
        border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
      }}>
        {item.label}
      </span>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ConvMessage }) {
  if (msg.role === "tool") return null;
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: "80%" }}>
        <div
          className="t-caption"
          style={{ color: "var(--fg-muted)", marginBottom: 3, textAlign: isUser ? "right" : "left", fontWeight: 600 }}
        >
          {isUser ? "나" : "AI 정원사"}
          <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>
            {relativeTime(msg.at)}
          </span>
        </div>
        <div
          style={{
            padding: "9px 12px",
            borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            fontSize: 13.5, lineHeight: 1.55,
            // User text is plain (preserve newlines); AI text renders as markdown.
            whiteSpace: isUser ? "pre-wrap" : "normal",
            background: isUser ? "var(--accent)" : "var(--bg-subtle)",
            color: isUser ? "var(--accent-contrast)" : "var(--fg)",
            border: isUser ? "none" : "1px solid var(--border)",
            overflowWrap: "anywhere",
          }}
        >
          {isUser ? msg.text : <MarkdownText text={msg.text} />}
        </div>
      </div>
    </div>
  );
}

// ── Chevron (expand/collapse) ─────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "block" }}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TreeIcon({ kind }: { kind: TreeItem["icon"] }) {
  const common = {
    width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, "aria-hidden": true,
  };

  if (kind === "global") {
    return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>;
  }
  if (kind === "calendar" || kind === "schedule") {
    return <svg {...common}><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="17" rx="2" /></svg>;
  }
  if (kind === "plant") {
    return <svg {...common}><path d="M12 22v-8M7 10c-2.8 0-5-2.2-5-5 2.8 0 5 2.2 5 5ZM17 14c2.8 0 5-2.2 5-5-2.8 0-5 2.2-5 5ZM12 14c-3.3 0-6-2.7-6-6 3.3 0 6 2.7 6 6ZM12 18c3.3 0 6-2.7 6-6-3.3 0-6 2.7-6 6Z" /></svg>;
  }
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "block" }} />;
}

// ── TreeRow ───────────────────────────────────────────────────

function TreeRow({
  item,
  selected,
  onClick,
  onPrefetch,
  hasToggle,
  childCount,
}: {
  item: TreeItem;
  selected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
  hasToggle?: boolean;
  childCount?: number;
}) {
  const isGhost = item.key.startsWith("ghost-plant-");
  const meta = item.nodeType === "plant" && childCount
    ? `${childCount}개 봉우리 · ${relativeTime(item.conv.updated_at)}`
    : `${item.conv.message_count}개 메시지 · ${relativeTime(item.conv.updated_at)}`;
  return (
    <button
      onClick={isGhost ? undefined : onClick}
      disabled={isGhost}
      style={{
        width: "100%", textAlign: "left", border: "none",
        position: "relative",
        padding: `8px ${hasToggle ? 58 : 12}px 8px ${12 + item.indent * 22}px`,
        background: selected ? "var(--accent-muted)" : "transparent",
        cursor: isGhost ? "default" : "pointer",
        borderRadius: "var(--r-sm)",
        borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
        transition: "background 0.1s",
        opacity: item.dimmed ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (!selected && !isGhost) e.currentTarget.style.background = "var(--bg-hover)";
        if (!isGhost && onPrefetch) onPrefetch();
      }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      {item.nodeType === "bud" && (
        <span style={{
          position: "absolute", left: 18, top: 0, bottom: 0,
          width: 1, background: "var(--border)",
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{
          width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          color: selected ? "var(--accent)" : item.nodeType === "bud" ? "var(--fg-muted)" : "var(--accent)",
        }}>
          <TreeIcon kind={item.icon} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="t-body-sm"
            style={{
              color: selected ? "var(--accent-fg)" : isGhost ? "var(--fg-muted)" : "var(--fg)",
              fontWeight: item.nodeType === "bud" ? 400 : 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: item.nodeType === "bud" ? 12.5 : 13,
            }}
          >
            {item.label}
            {isGhost && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--fg-subtle)", fontWeight: 400 }}>식물</span>}
          </div>
          {!isGhost && (
            <div
              className="t-caption"
              style={{
                color: "var(--fg-subtle)", marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontSize: 11,
              }}
            >
              {meta}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── ThreadPanel ───────────────────────────────────────────────

function ThreadPanel({
  item,
  plants,
}: {
  item: TreeItem;
  plants: Plant[];
}) {
  const { openWith } = useChatStore();
  const router = useRouter();
  const [threadSearch, setThreadSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isSearch = submittedSearch.trim().length > 0;
  const isGhost  = item.key.startsWith("ghost-plant-");

  const { data: histRes, isLoading } = useQuery({
    queryKey: QK.historyThread(item.conv.scope, item.conv.scope_id),
    queryFn: () => getHistory(item.conv.scope, item.conv.scope_id ?? undefined, 200),
    enabled: !isGhost,
  });

  const { data: searchRes, isFetching: searching } = useQuery({
    queryKey: ["history-search", item.conv.scope, item.conv.scope_id, submittedSearch],
    queryFn: () => searchConversation(submittedSearch, item.conv.scope, item.conv.scope_id ?? undefined, 50),
    enabled: isSearch && !isGhost,
  });

  const messages = useMemo(() => {
    const raw = isSearch
      ? (searchRes?.ok ? searchRes.data.messages : [])
      : (histRes?.ok ? histRes.data.messages : []);
    return raw.filter((m) => m.role === "user" || m.role === "assistant");
  }, [isSearch, histRes, searchRes]);

  // scroll to bottom when thread loads
  useEffect(() => {
    if (!isSearch) bottomRef.current?.scrollIntoView();
  }, [item.key, isSearch, messages.length]);

  function handleContinue() {
    const scope = item.conv.scope as "global" | "plant" | "bud" | "calendar";
    if (scope === "global" || scope === "calendar") {
      openWith({ kind: scope });
    } else {
      openWith({ kind: scope, id: item.conv.scope_id ?? undefined });
    }
    router.push(scope === "bud" || scope === "plant" ? `/plants/${item.plantId ?? ""}` : scope === "calendar" ? "/calendar" : "/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Thread header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <ScopeTag item={item} plants={plants} />

        {/* Search within thread */}
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmittedSearch(threadSearch); }}
          style={{ display: "flex", gap: 6 }}
        >
          <input
            className="input"
            placeholder="이 대화에서 검색…"
            value={threadSearch}
            onChange={(e) => {
              setThreadSearch(e.target.value);
              if (!e.target.value) setSubmittedSearch("");
            }}
            style={{ flex: 1, fontSize: 12.5, padding: "5px 10px", height: 30 }}
          />
          {submittedSearch && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setThreadSearch(""); setSubmittedSearch(""); }}
            >
              ✕
            </button>
          )}
          <button type="submit" className="btn btn-secondary btn-sm" style={{ height: 30 }}>
            검색
          </button>
        </form>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {isLoading && (
          <div style={{ paddingTop: 40, textAlign: "center" }}>
            <span className="t-caption animate-pulse" style={{ color: "var(--fg-muted)" }}>
              대화 불러오는 중…
            </span>
          </div>
        )}

        {!isLoading && searching && (
          <div style={{ paddingTop: 20, textAlign: "center" }}>
            <span className="t-caption animate-pulse" style={{ color: "var(--fg-muted)" }}>검색 중…</span>
          </div>
        )}

        {!isLoading && !searching && messages.length === 0 && (
          <div style={{ paddingTop: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
              {isSearch ? `"${submittedSearch}"에 해당하는 메시지가 없습니다.` : "메시지가 없습니다."}
            </div>
          </div>
        )}

        {!isLoading && isSearch && messages.length > 0 && (
          <div
            className="t-caption"
            style={{ color: "var(--fg-muted)", marginBottom: 12, padding: "4px 0" }}
          >
            &quot;{submittedSearch}&quot; — {messages.length}개 결과
          </div>
        )}

        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Footer: continue button */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div className="t-caption" style={{ color: "var(--fg-muted)" }}>
          {item.conv.message_count}개 메시지 · {relativeTime(item.conv.updated_at)}
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleContinue}>
          이 대화 이어가기 →
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function HistoryPage() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  // plantIds whose bud conversations are expanded. Default: all collapsed.
  const [expandedPlants, setExpandedPlants] = useState<Set<string>>(new Set());
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();

  const togglePlant = useCallback((plantId: string) => {
    setExpandedPlants((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  }, []);

  const prefetchThread = useCallback((item: TreeItem) => {
    if (item.key.startsWith("ghost-")) return;
    qc.prefetchQuery({
      queryKey: QK.historyThread(item.conv.scope, item.conv.scope_id),
      queryFn: () => getHistory(item.conv.scope, item.conv.scope_id ?? undefined, 200),
      staleTime: 30_000,
    });
  }, [qc]);

  const { data: convsRes, isLoading: loadingConvs } = useQuery({
    queryKey: QK.conversations(),
    queryFn: listConversations,
    staleTime: 60_000,
    enabled: !!accessToken,
  });
  const { data: plantsRes } = useQuery({ queryKey: QK.plants(), queryFn: () => listPlants(), enabled: !!accessToken });
  const { data: budsRes }   = useQuery({ queryKey: QK.buds(),   queryFn: () => listBuds(),   enabled: !!accessToken });

  const conversations = useMemo(() => convsRes?.ok ? convsRes.data.conversations : [], [convsRes]);
  const plants        = useMemo(() => plantsRes?.ok ? plantsRes.data.items : [], [plantsRes]);
  const buds          = useMemo(() => budsRes?.ok ? budsRes.data.items : [], [budsRes]);

  const treeItems = useMemo(
    () => buildTree(conversations, plants, buds, filterQuery),
    [conversations, plants, buds, filterQuery]
  );

  // How many bud conversations sit under each plant (for the toggle chip).
  const budCountByPlant = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of treeItems) {
      if (it.nodeType === "bud" && it.plantId) m.set(it.plantId, (m.get(it.plantId) ?? 0) + 1);
    }
    return m;
  }, [treeItems]);

  // While filtering, force every plant open so matches are never hidden.
  const filtering = filterQuery.trim().length > 0;

  // Render the first real item by default without a state-setting effect.
  const firstReal = treeItems.find((i) => !i.key.startsWith("ghost-"));
  const effectiveSelectedKey = selectedKey ?? firstReal?.key ?? null;
  const selectedItem = treeItems.find((i) => i.key === effectiveSelectedKey) ?? null;

  const totalConvs = conversations.length;
  const totalMsgs  = conversations.reduce((s, c) => s + c.message_count, 0);

  return (
    // Full-viewport flex column so the grid fills exactly the remaining height
    // and the message list can scroll without the outer box growing.
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh",
      padding: "32px 36px 24px",
      maxWidth: 1200, margin: "0 auto",
      boxSizing: "border-box",
    }}>
      {/* Page header */}
      <header className="animate-in" style={{ marginBottom: 16, flexShrink: 0 }}>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>대화 기록</h1>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>
          {loadingConvs
            ? "불러오는 중…"
            : `${totalConvs}개 대화 스레드 · ${totalMsgs}개 메시지`}
        </p>
      </header>

      {/* Main grid — flex: 1 + minHeight: 0 makes it fill remaining height
          and prevents it from growing beyond the viewport. */}
      <div style={{
        flex: 1,
        minHeight: 0,   // ← essential: lets flex child shrink below content size
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 0,
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        background: "var(--bg-elevated)",
      }}>
        {/* ── Left: tree panel ── */}
        <div style={{
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          background: "var(--bg-subtle)",
          overflow: "hidden",   // clip to grid cell height
        }}>
          {/* Search */}
          <div style={{ padding: "12px 10px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", padding: "5px 10px",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg-muted)", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                placeholder="대화 검색…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  flex: 1, border: "none", outline: "none",
                  background: "transparent", fontSize: 12.5,
                  color: "var(--fg)",
                }}
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery("")} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "var(--fg-muted)", fontSize: 12 }}>✕</button>
              )}
            </div>
          </div>

          {/* Tree list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {loadingConvs && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 4px" }}>
                {[80, 60, 100, 70, 90, 60].map((w, i) => (
                  <div key={i} style={{
                    height: 40, borderRadius: "var(--r-sm)",
                    background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite",
                    animationDelay: `${i * 60}ms`,
                    marginLeft: i > 1 ? (i % 2 === 0 ? 0 : 16) : 0,
                  }} />
                ))}
              </div>
            )}

            {!loadingConvs && treeItems.length === 0 && (
              <div style={{ padding: "40px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                <div className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
                  {filterQuery ? "검색 결과가 없습니다." : "아직 대화 기록이 없습니다."}
                </div>
              </div>
            )}

            {treeItems.map((item) => {
              const isPlant = item.nodeType === "plant";
              const budCount = isPlant && item.plantId ? (budCountByPlant.get(item.plantId) ?? 0) : 0;
              const hasToggle = isPlant && budCount > 0;
              const open = !!item.plantId && (filtering || expandedPlants.has(item.plantId));

              // Hide a plant's bud rows while it's collapsed.
              if (item.nodeType === "bud" && item.plantId && !open) return null;

              return (
                <div key={item.key} style={{ position: "relative" }}>
                  <TreeRow
                    item={item}
                    selected={effectiveSelectedKey === item.key}
                    onClick={() => setSelectedKey(item.key)}
                    onPrefetch={() => prefetchThread(item)}
                    hasToggle={hasToggle}
                    childCount={budCount}
                  />
                  {hasToggle && (
                    <button
                      type="button"
                      onClick={() => togglePlant(item.plantId!)}
                      aria-expanded={open}
                      aria-label={open ? `${item.label} 봉우리 접기` : `${item.label} 봉우리 펼치기`}
                      title={open ? "봉우리 접기" : `봉우리 ${budCount}개 펼치기`}
                      style={{
                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                        display: "flex", alignItems: "center", gap: 3,
                        padding: "2px 6px", borderRadius: 999,
                        border: "1px solid var(--border)", background: "var(--bg-elevated)",
                        color: "var(--fg-muted)", cursor: filtering ? "default" : "pointer",
                        fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                        opacity: filtering ? 0.6 : 1,
                      }}
                      disabled={filtering}
                      onMouseEnter={(e) => { if (!filtering) e.currentTarget.style.color = "var(--accent-fg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-muted)"; }}
                    >
                      {budCount}
                      <Chevron open={open} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: thread panel ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedItem && !selectedItem.key.startsWith("ghost-") ? (
            <ThreadPanel item={selectedItem} plants={plants} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "var(--fg-muted)" }}>
              <div className="t-body-sm">왼쪽에서 대화를 선택하세요</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
