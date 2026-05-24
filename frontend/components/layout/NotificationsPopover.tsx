"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, ackNotification, Notification } from "@/lib/api/notifications";

const KIND_LABEL: Record<string, string> = {
  bud_wilting: "봉우리가 시들기 시작했어요",
  bud_rot: "봉우리가 썩었어요",
  deadline_warning: "마감일이 임박했어요",
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  const { data: res } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    staleTime: 10_000,
  });
  const items: Notification[] = res?.ok ? res.data.items : [];

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
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleAckAll() {
    await Promise.all(items.map((n) => ackNotification(n.id)));
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div
      ref={ref}
      className="card animate-in"
      style={{
        position: "fixed",
        left: "calc(var(--sidebar-w) + 8px)",
        bottom: 60,
        width: 320,
        maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        boxShadow: "var(--shadow-lg)",
        zIndex: 50,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <header style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="t-h3" style={{ color: "var(--fg)" }}>알림</div>
        {items.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleAckAll}>모두 읽음</button>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div className="t-body-sm" style={{ color: "var(--fg-muted)" }}>새 알림이 없습니다.</div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((n) => {
              const title = (n.payload?.title as string) ?? "";
              const deadline = n.payload?.deadline as string | undefined;
              return (
                <li
                  key={n.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                >
                  <span
                    className="dot"
                    style={{
                      background: n.kind === "bud_rot" ? "var(--danger)" :
                                  n.kind === "deadline_warning" ? "var(--info)" :
                                  "var(--warning)",
                      marginTop: 6,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500 }}>
                      {KIND_LABEL[n.kind] ?? n.kind}
                    </div>
                    {title && (
                      <div className="t-caption" style={{ color: "var(--fg-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {title}{deadline ? ` · ${deadline}` : ""}
                      </div>
                    )}
                    <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleAck(n.id)} aria-label="읽음 처리">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
