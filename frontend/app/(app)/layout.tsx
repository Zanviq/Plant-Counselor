"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/authStore";
import { useChatStore } from "@/lib/store/chatStore";
import Sidebar from "@/components/layout/Sidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import ChatPanel from "@/components/chat/ChatPanel";
import { getCurrentUser } from "@/lib/api/auth";
import { listPlants } from "@/lib/api/plants";
import { listBuds } from "@/lib/api/buds";
import { getSummary, getBriefing } from "@/lib/api/stats";
import { QK } from "@/lib/queryKeys";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { setUser, clearSession } = useAuthStore();
  const { open, openWith, chatWidth, setScope } = useChatStore();
  const initialized = useRef(false);

  /** Warm the caches that every page needs — called once the session is confirmed. */
  function prefetchAll() {
    qc.prefetchQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(), staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.buds(),     queryFn: () => listBuds(),   staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.summary(),  queryFn: getSummary,         staleTime: 2 * 60_000 });
    qc.prefetchQuery({ queryKey: QK.briefing(), queryFn: getBriefing,        staleTime: 5 * 60_000 });
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Validate the httpOnly session cookie, then warm the caches. Page queries
    // are gated on `authed`, which flips to true once /auth/me succeeds.
    getCurrentUser().then((res) => {
      if (!res.ok) {
        // Only a real 401 logs out — a 5xx (backend down / restarting) must not.
        if (res.error.code === "401") {
          clearSession();
          router.replace("/login");
        }
        return;
      }
      setUser(res.data);
      prefetchAll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Match the chat session to the current page: 홈/정원 → 전체(global), 캘린더 → calendar.
  // Plant detail / history / settings pages keep whatever scope is active.
  useEffect(() => {
    if (pathname === "/home" || pathname === "/plants") setScope({ kind: "global" });
    else if (pathname === "/calendar") setScope({ kind: "calendar" });
  }, [pathname, setScope]);

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main
        className="app-main"
        style={{ "--chat-offset": `${open ? chatWidth : 0}px` } as CSSProperties}
      >
        {children}
      </main>

      <ChatPanel />
      <MobileBottomNav />
    </div>
  );
}
