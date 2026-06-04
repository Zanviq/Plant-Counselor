"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import { apiGet, configureClient } from "@/lib/api/client";
import { withAuthMetadata, type UserProfile } from "@/lib/store/authStore";

function AdminNav() {
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const router = useRouter();

  const nav = [
    { href: "/admin", label: "대시보드" },
    { href: "/admin/users", label: "사용자 관리" },
    { href: "/admin/logs", label: "AI 로그" },
    { href: "/admin/notifications", label: "알림 발송" },
    { href: "/admin/data", label: "데이터 관리" },
    { href: "/admin/controller", label: "컨트롤러" },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    clearSession();
    router.replace("/login");
  }

  return (
    <aside
      className="admin-sidebar"
      style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 220,
        background: "#1a1f2e", borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column", zIndex: 20,
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "var(--accent, #e11d48)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>
            P
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Plant Admin</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 36 }}>
          {user?.email ?? ""}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {nav.map(({ href, label }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 7, marginBottom: 2,
                background: active ? "rgba(255,255,255,0.1)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: "none",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Link
          href="/home"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 7, marginBottom: 4,
            color: "rgba(255,255,255,0.45)", fontSize: 13,
            textDecoration: "none",
          }}
        >
          일반 사용자 모드
        </Link>
        <button
          onClick={handleLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 7, border: "none",
            background: "transparent", color: "rgba(255,255,255,0.45)",
            fontSize: 13, cursor: "pointer", textAlign: "left",
          }}
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setSession, clearSession } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    configureClient(
      () => useAuthStore.getState().accessToken,
      async () => {
        const { data } = await supabase.auth.refreshSession();
        const newToken = data.session?.access_token ?? null;
        if (newToken) useAuthStore.setState({ accessToken: newToken });
        return newToken;
      }
    );

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          const isOAuth = typeof window !== "undefined" &&
            (window.location.search.includes("code=") || window.location.hash.includes("access_token="));
          if (isOAuth) return;
          clearSession();
          router.replace("/login");
          return;
        }

        const token = session.access_token;
        useAuthStore.setState({ accessToken: token });

        const cachedUser = useAuthStore.getState().user;
        if (cachedUser && event !== "SIGNED_IN") {
          setSession(token, withAuthMetadata(cachedUser, session.user.user_metadata));
          // Verify still admin
          if (cachedUser.role !== "admin") {
            router.replace("/home");
          }
          return;
        }

        const meRes = await apiGet<UserProfile>("/me");
        if (!meRes.ok) {
          if (!meRes.error || meRes.error.code === "401") {
            clearSession();
            router.replace("/login");
          }
          return;
        }

        // Non-admin users cannot access admin panel
        if (meRes.data.role !== "admin") {
          router.replace("/home");
          return;
        }

        setSession(token, withAuthMetadata(meRes.data, session.user.user_metadata));
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: if user is loaded but not admin, redirect (side effect must run in effect).
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/home");
    }
  }, [user, router]);

  if (user && user.role !== "admin") return null;

  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
