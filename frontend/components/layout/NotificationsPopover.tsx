"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  ackNotification,
  ackAllNotifications,
  Notification,
} from "@/lib/api/notifications";
import { QK } from "@/lib/queryKeys";

// ── kind metadata ───────────────────────────────────────────

interface KindMeta {
  label: string;
  color: string; // CSS var for the dot / accent
}

const KIND_META: Record<string, KindMeta> = {
  bud_wilting:      { label: "봉우리가 시들기 시작했어요", color: "var(--warning)" },
  bud_rot:          { label: "봉우리가 썩었어요",          color: "var(--danger)" },
  deadline_warning: { label: "마감일이 임박했어요",        color: "var(--info)" },
  admin_message:    { label: "관리자 메시지",              color: "var(--info)" },
  announcement:     { label: "공지사항",                  color: "var(--positive)" },
  warning:          { label: "경고",                      color: "var(--warning)" },
};

const NOTIFICATION_LIST_MAX_H = 210;

function kindMeta(kind: string): KindMeta {
  return KIND_META[kind] ?? { label: kind, color: "var(--fg-muted)" };
}

/** Extract the human-readable body of a notification from its payload. */
function notifBody(n: Notification): string {
  const p = n.payload ?? {};
  // Admin-sent notifications carry the text in `message`.
  if (typeof p.message === "string" && p.message) return p.message;
  // System notifications carry a `title` (+ optional deadline).
  const title = typeof p.title === "string" ? p.title : "";
  const deadline = typeof p.deadline === "string" ? p.deadline : "";
  if (title && deadline) return `${title} · 마감 ${deadline}`;
  return title;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function fullTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── notification row (expandable) ────────────────────────────

function NotificationRow({
  n, expanded, onToggle, onAck,
}: {
  n: Notification;
  expanded: boolean;
  onToggle: () => void;
  onAck?: (id: string) => void;
}) {
  const meta = kindMeta(n.kind);
  const body = notifBody(n);
  const isRead = !!n.acked_at;

  return (
    <li
      style={{
        borderBottom: "1px solid var(--border)",
        background: expanded ? "var(--bg-subtle)" : "transparent",
        opacity: isRead && !expanded ? 0.6 : 1,
        transition: "background 0.12s, opacity 0.12s",
      }}
    >
      <div
        onClick={onToggle}
        style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
      >
        <span className="dot" style={{ background: meta.color, marginTop: 6, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500 }}>
              {meta.label}
            </span>
            {isRead && (
              <span className="t-caption" style={{ color: "var(--fg-subtle)", fontSize: 10, border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: "0 5px" }}>
                읽음
              </span>
            )}
          </div>
          {body && (
            <div
              className="t-caption"
              style={{
                color: "var(--fg-secondary)", marginTop: 2,
                ...(expanded
                  ? { whiteSpace: "pre-wrap", wordBreak: "break-word" }
                  : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
              }}
            >
              {body}
            </div>
          )}
          <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
            {expanded ? fullTime(n.created_at) : timeAgo(n.created_at)}
          </div>
        </div>
        {onAck && !isRead && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onAck(n.id); }}
            aria-label="읽음 처리"
            style={{ flexShrink: 0 }}
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

// ── popover ──────────────────────────────────────────────────

type Tab = "unread" | "all";

export default function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("unread");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Unread list — shared cache key with the Sidebar badge. Polls for near-real-time.
  const { data: unreadRes } = useQuery({
    queryKey: QK.notifications(),
    queryFn: () => listNotifications(false),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  // Full history — only fetched while the "전체" tab is active.
  const { data: allRes } = useQuery({
    queryKey: QK.notificationsAll(),
    queryFn: () => listNotifications(true, 100),
    enabled: tab === "all",
    staleTime: 10_000,
  });

  const unread: Notification[] = unreadRes?.ok ? unreadRes.data.items : [];
  const all: Notification[] = allRes?.ok ? allRes.data.items : [];
  const items = tab === "unread" ? unread : all;

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: QK.notifications() });
    qc.invalidateQueries({ queryKey: QK.notificationsAll() });
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function handleAck(id: string) {
    await ackNotification(id);
    invalidateAll();
  }

  async function handleAckAll() {
    await ackAllNotifications();
    invalidateAll();
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  const tabBtn = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: "7px 0",
    background: "none",
    border: "none",
    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
    color: tab === t ? "var(--fg)" : "var(--fg-muted)",
    fontSize: 12.5,
    fontWeight: tab === t ? 700 : 500,
    cursor: "pointer",
    marginBottom: -1,
  });

  return (
    <div
      ref={ref}
      className="card animate-in"
      style={{
        position: "fixed",
        left: "calc(var(--sidebar-w) + 8px)",
        bottom: 60,
        width: 340,
        maxHeight: "72vh",
        display: "flex", flexDirection: "column",
        boxShadow: "var(--shadow-lg)",
        zIndex: 50,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <header style={{ padding: "10px 14px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="t-h3" style={{ color: "var(--fg)" }}>알림</div>
          {unread.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={handleAckAll}>모두 읽음</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={tabBtn("unread")} onClick={() => { setTab("unread"); setExpandedId(null); }}>
            안 읽음{unread.length > 0 ? ` (${unread.length})` : ""}
          </button>
          <button style={tabBtn("all")} onClick={() => { setTab("all"); setExpandedId(null); }}>
            전체 기록
          </button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, maxHeight: NOTIFICATION_LIST_MAX_H, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
              {tab === "unread" ? "새 알림이 없습니다." : "알림 기록이 없습니다."}
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                expanded={expandedId === n.id}
                onToggle={() => toggleExpand(n.id)}
                onAck={handleAck}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
