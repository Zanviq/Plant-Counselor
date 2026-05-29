"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/authStore";
import { useChatStore } from "@/lib/store/chatStore";
import Sidebar from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import { supabase } from "@/lib/supabase";
import { apiGet, configureClient } from "@/lib/api/client";
import { listPlants } from "@/lib/api/plants";
import { listBuds } from "@/lib/api/buds";
import { getSummary, getBriefing } from "@/lib/api/stats";
import { QK } from "@/lib/queryKeys";
import type { UserProfile } from "@/lib/store/authStore";

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

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Configure the API client to read the Supabase token from Zustand store
    // (always up-to-date via onAuthStateChange below).
    configureClient(
      () => useAuthStore.getState().accessToken,
      async () => {
        // 401 fallback: ask Supabase to refresh the session
        const { data } = await supabase.auth.refreshSession();
        const newToken = data.session?.access_token ?? null;
        if (newToken && data.session) {
          const cur = useAuthStore.getState().user;
          if (cur) useAuthStore.getState().setSession(newToken, cur);
          else useAuthStore.setState({ accessToken: newToken });
        }
        return newToken;
      }
    );

    // Subscribe to Supabase auth state changes.
    // This fires immediately with the current session (or null) on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          // Bug A fix: PKCE OAuth callback sends ?code= in the URL. Supabase
          // exchanges the code asynchronously; INITIAL_SESSION fires with null
          // before the exchange completes. Don't redirect — wait for SIGNED_IN.
          const isOAuthCallback =
            typeof window !== "undefined" &&
            (window.location.search.includes("code=") ||
              window.location.hash.includes("access_token="));
          if (isOAuthCallback) return;

          clearSession();
          router.replace("/login");
          return;
        }

        const token = session.access_token;
        // Keep the store token in sync (Supabase refreshes it automatically)
        useAuthStore.setState({ accessToken: token });

        // Kick off cache warming immediately (no waiting for profile fetch)
        prefetchAll();

        // Bug B fix: always refresh profile on SIGNED_IN so name/email are
        // up-to-date. On TOKEN_REFRESHED / INITIAL_SESSION use cached value.
        const cachedUser = useAuthStore.getState().user;
        if (cachedUser && event !== "SIGNED_IN") return;

        const meRes = await apiGet<UserProfile>("/me");
        if (!meRes.ok) {
          // Bug C fix: only clear session on real 401 (invalid token).
          // A 500 (backend down, DB error) must not log the user out.
          if (!meRes.error || meRes.error.code === "401") {
            clearSession();
            router.replace("/login");
          }
          return;
        }
        setSession(token, meRes.data);

        // Admin users are redirected to the admin panel immediately after login.
        if (meRes.data.role === "admin" && event === "SIGNED_IN") {
          router.replace("/admin");
          return;
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global space-key opens chat (when not in input)
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

      {/* Floating chat FAB — visible only when chat is closed */}
      {!open && (
        <button
          onClick={() => openWith()}
          aria-label="AI 정원사 열기"
          style={{
            position: "fixed",
            top: 12, right: 16,
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
