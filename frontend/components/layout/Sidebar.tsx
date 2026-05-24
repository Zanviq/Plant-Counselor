"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { listNotifications } from "@/lib/api/notifications";
import NotificationsPopover from "./NotificationsPopover";

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
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" />
  </svg>
);}

function PlantsIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20V11" />
    <path d="M12 11C12 8 9.5 6 7.5 6c0 3 1 5 4.5 5z" />
    <path d="M12 11c0-3 2.5-5 4.5-5 0 3-1 5-4.5 5z" />
    <path d="M6 20h12" />
  </svg>
);}

function CalendarIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);}

function SettingsIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.9 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);}

function ChatIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.5A8 8 0 1121 12z" />
  </svg>
);}

function BellIcon() { return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 003.4 0" />
  </svg>
);}

// ── primitives ──────────────────────────────────────────────

function NavLink({ href, label, active, children }: {
  href: string; label: string; active: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={"sidebar-icon-btn" + (active ? " active" : "")}
      aria-label={label}
      aria-current={active ? "page" : undefined}
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

// ── component ───────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { open, openWith, close } = useChatStore();
  const { user, accessToken } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifRes } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: !!accessToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
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
        <NavLink href="/" label="홈" active={isActive("/", true)}><HomeIcon /></NavLink>
        <NavLink href="/plants" label="정원" active={isActive("/plants")}><PlantsIcon /></NavLink>
        <NavLink href="/calendar" label="캘린더" active={isActive("/calendar")}><CalendarIcon /></NavLink>

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

        <div
          aria-label={user?.nickname ?? "프로필"}
          style={{
            width: 30, height: 30, borderRadius: "50%", marginTop: 4,
            background: "var(--accent)", color: "var(--accent-contrast)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, position: "relative",
          }}
          className="sidebar-icon-wrap"
        >
          {initial}
          <span className="sidebar-tip">{user?.nickname ?? "프로필"}</span>
        </div>
      </div>

      {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
    </aside>
  );
}
