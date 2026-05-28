"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/authStore";
import { useChatStore } from "@/lib/store/chatStore";
import Sidebar from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import { refreshToken } from "@/lib/api/auth";
import { apiGet, configureClient } from "@/lib/api/client";
import { listPlants } from "@/lib/api/plants";
import { listBuds } from "@/lib/api/buds";
import { getSummary, getBriefing } from "@/lib/api/stats";
import { QK } from "@/lib/queryKeys";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { accessToken, user, setSession, clearSession } = useAuthStore();
  const { open, openWith, chatWidth } = useChatStore();
  const initialized = useRef(false);

  /** Warm the caches that every page needs — called once after a valid token is available. */
  function prefetchAll() {
    qc.prefetchQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(), staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.buds(),     queryFn: () => listBuds(),   staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.summary(),  queryFn: getSummary,         staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.briefing(), queryFn: getBriefing,        staleTime: 5 * 60_000 });
  }

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

    // Already fully hydrated — kick off prefetch immediately and exit.
    if (accessToken && user) {
      prefetchAll();
      return;
    }

    (async () => {
      // Step 1: Refresh the access token (uses httpOnly refresh cookie).
      const res = await refreshToken();
      if (!res.ok) {
        clearSession();
        router.replace("/login");
        return;
      }
      const token = (res.data as { access_token: string }).access_token;
      useAuthStore.setState({ accessToken: token });

      // Kick off cache warming in parallel with the profile fetch below.
      prefetchAll();

      // Step 2 (conditional): Fetch user profile only when not already cached
      // in localStorage (via authStore.persist).  If the profile is available
      // we trust it for this session — a background refresh isn't needed because
      // profile data changes only via intentional settings edits.
      const cachedUser = useAuthStore.getState().user;
      if (cachedUser) {
        // Token refreshed, profile already available — we're done.
        return;
      }

      const meRes = await apiGet<Record<string, unknown>>("/me");
      if (!meRes.ok) {
        clearSession();
        router.replace("/login");
        return;
      }
      setSession(token, meRes.data as unknown as Parameters<typeof setSession>[1]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main
        style={{
          minHeight: "100vh",
          marginLeft: SIDEBAR_W,
          marginRight: open ? chatWidth : 0,
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
