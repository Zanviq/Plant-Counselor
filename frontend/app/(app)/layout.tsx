"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { useChatStore } from "@/lib/store/chatStore";
import Sidebar from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import { refreshToken } from "@/lib/api/auth";
import { apiGet, configureClient } from "@/lib/api/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, setSession, clearSession } = useAuthStore();
  const { open, openWith } = useChatStore();
  const initialized = useRef(false);

  // Session restore: configure client + recover session on first mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    configureClient(
      () => useAuthStore.getState().accessToken,
      async () => {
        const res = await refreshToken();
        if (!res.ok) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const token = (res.data as { access_token: string }).access_token;
        const cur = useAuthStore.getState().user;
        if (cur) useAuthStore.getState().setSession(token, cur);
        else useAuthStore.setState({ accessToken: token });
        return token;
      }
    );

    if (accessToken && user) return;

    (async () => {
      const res = await refreshToken();
      if (!res.ok) {
        clearSession();
        router.replace("/login");
        return;
      }
      const token = (res.data as { access_token: string }).access_token;
      useAuthStore.setState({ accessToken: token });
      const meRes = await apiGet<Record<string, unknown>>("/me");
      if (!meRes.ok) {
        clearSession();
        router.replace("/login");
        return;
      }
      setSession(token, meRes.data as unknown as Parameters<typeof setSession>[1]);
    })();
  }, [accessToken, user, setSession, clearSession, router]);

  // Global space-key opens chat (when not in input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (e.key !== " " || tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      openWith();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openWith]);

  const SIDEBAR_W = 64;
  const CHAT_W = 380;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main
        style={{
          minHeight: "100vh",
          marginLeft: SIDEBAR_W,
          marginRight: open ? CHAT_W : 0,
          transition: "margin-right 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {children}
      </main>

      {/* Floating chat FAB — visible only when chat is closed. */}
      {!open && (
        <button
          onClick={() => openWith()}
          aria-label="AI 정원사 열기"
          style={{
            position: "fixed",
            top: 12,
            right: 16,
            zIndex: 30,
            width: 36, height: 36,
            borderRadius: "var(--r-md)",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            border: "none",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--shadow-md)",
            transition: "background 0.12s, transform 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.5A8 8 0 1121 12z" />
          </svg>
        </button>
      )}

      <ChatPanel />
    </div>
  );
}
