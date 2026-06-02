"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { listNotifications } from "@/lib/api/notifications";
import NotificationsPopover from "./NotificationsPopover";
import { listPlants } from "@/lib/api/plants";
import { listBuds } from "@/lib/api/buds";
import { getSummary, getBriefing, getCalendar } from "@/lib/api/stats";
import { listConversations } from "@/lib/api/conversations";
import { QK } from "@/lib/queryKeys";

// ── icons ───────────────────────────────────────────────────

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <path
        d="M12 18V11.5M12 11.5C12 8 9.5 6 7.5 6c0 3 1 5.5 4.5 5.5zM12 11.5C12 8 14.5 6 16.5 6c0 3-1 5.5-4.5 5.5z"
        stroke="var(--accent-contrast)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

const stroke = "currentColor";

function HomeIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);}

function PlantsIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 15h10v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-4z" />
    <path d="M12 9a6 6 0 0 0-6-6H3v2a6 6 0 0 0 6 6h3" />
    <path d="M12 12a6 6 0 0 1 6-6h3v1a6 6 0 0 1-6 6h-3" />
    <path d="M12 15V9" />
  </svg>
);}

function CalendarIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);}

function SettingsIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.9 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);}

function HistoryIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v6h6" />
    <path d="M12 7v5l4 2" />
  </svg>
);}

function ChatIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);}

function BellIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
);}

// ── primitives ──────────────────────────────────────────────

function NavLink({ href, label, active, children, onPrefetch }: {
  href: string; label: string; active: boolean; children: React.ReactNode;
  onPrefetch?: () => void;
}) {
  return (
    <Link
      href={href}
      className={"sidebar-icon-btn" + (active ? " active" : "")}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onMouseEnter={onPrefetch}
    >
      {children}
      <span className="sidebar-tip">{label}</span>
    </Link>
  );
}

function IconButton({
  label, active, onClick, badge, children,
}: {
  label: string; active?: boolean; onClick?: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={"sidebar-icon-btn" + (active ? " active" : "")} aria-label={label}>
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            position: "absolute", top: 3, right: 3,
            minWidth: 14, height: 14, padding: "0 3px",
            borderRadius: 999, background: "var(--danger)", color: "white",
            fontSize: 9, fontWeight: 700, lineHeight: "14px", textAlign: "center",
            border: "2px solid var(--bg)",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="sidebar-tip">{label}</span>
    </button>
  );
}

function ProfileAvatar({ avatarUrl, initial, label }: {
  avatarUrl?: string | null;
  initial: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      aria-label={label}
      style={{
        width: 30, height: 30, borderRadius: "50%", marginTop: 4,
        background: "var(--accent)", color: "var(--accent-contrast)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, position: "relative", overflow: "visible",
      }}
      className="sidebar-icon-wrap"
    >
      {avatarUrl && !failed ? (
        <Image
          src={avatarUrl}
          alt=""
          width={30}
          height={30}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
      ) : initial}
      <span className="sidebar-tip">{label}</span>
    </div>
  );
}

// ── component ───────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { open, openWith, close } = useChatStore();
  const { user, accessToken } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const qc = useQueryClient();

  // Prefetch the garden page data on hover — fires before navigation starts,
  // so the page renders from cache instead of waiting for the API round-trip.
  const prefetchPlants = useCallback(() => {
    qc.prefetchQuery({ queryKey: QK.plants(), queryFn: () => listPlants(), staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.buds(),   queryFn: () => listBuds(),   staleTime: 2 * 60_000 });
  }, [qc]);

  // Prefetch conversation list on hover.
  const prefetchHistory = useCallback(() => {
    qc.prefetchQuery({ queryKey: QK.conversations(), queryFn: listConversations, staleTime: 60_000 });
    qc.prefetchQuery({ queryKey: QK.plants(), queryFn: () => listPlants(), staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.buds(),   queryFn: () => listBuds(),   staleTime: 2 * 60_000 });
  }, [qc]);

  // Prefetch calendar + summary on hover.
  const prefetchCalendar = useCallback(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${y}-${pad(m + 1)}-01`;
    const days = new Date(y, m + 1, 0).getDate();
    const to   = `${y}-${pad(m + 1)}-${pad(days)}`;
    qc.prefetchQuery({ queryKey: QK.calendar(y, m), queryFn: () => getCalendar(from, to), staleTime: 5 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.summary(),       queryFn: getSummary,                  staleTime: 5 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.briefing(),      queryFn: getBriefing,                 staleTime: 5 * 60_000 });
  }, [qc]);

  const { data: notifRes } = useQuery({
    queryKey: QK.notifications(),
    queryFn: () => listNotifications(),
    enabled: !!accessToken,
    staleTime: 10_000,
    // Poll every 15s so admin-sent notifications appear without a manual refresh.
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const notifCount = notifRes?.ok ? notifRes.data.items.length : 0;

  const initial = (user?.nickname?.[0] ?? "?").toUpperCase();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      style={{
        position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 20,
        width: "var(--sidebar-w)",
        display: "flex", flexDirection: "column", alignItems: "center",
        background: "var(--bg-sidebar)",
        borderRight: "none",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "14px 0", width: "100%", display: "flex", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Logo />
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <NavLink href="/home"    label="홈"    active={isActive("/home", true)} onPrefetch={prefetchPlants}><HomeIcon /></NavLink>
        <NavLink href="/plants"  label="정원"  active={isActive("/plants")}  onPrefetch={prefetchPlants}><PlantsIcon /></NavLink>
        <NavLink href="/calendar" label="캘린더" active={isActive("/calendar")} onPrefetch={prefetchCalendar}><CalendarIcon /></NavLink>
        <NavLink href="/history" label="대화 기록" active={isActive("/history")} onPrefetch={prefetchHistory}><HistoryIcon /></NavLink>

        <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.10)", margin: "8px 0" }} />

        <IconButton
          label="AI 정원사"
          active={open}
          onClick={() => (open ? close() : openWith())}
        >
          <ChatIcon />
        </IconButton>
      </nav>

      {/* Footer */}
      <div style={{ padding: "8px 0 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderTop: "1px solid rgba(255,255,255,0.08)", width: "100%" }}>
        <IconButton
          label={`알림${notifCount > 0 ? ` ${notifCount}` : ""}`}
          badge={notifCount}
          active={notifOpen}
          onClick={() => setNotifOpen((v) => !v)}
        >
          <BellIcon />
        </IconButton>
        <NavLink href="/settings" label="설정" active={isActive("/settings")}><SettingsIcon /></NavLink>

        <ProfileAvatar
          key={user?.avatar_url ?? "fallback"}
          avatarUrl={user?.avatar_url}
          initial={initial}
          label={user?.nickname ?? "프로필"}
        />
      </div>

      {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
    </aside>
  );
}
