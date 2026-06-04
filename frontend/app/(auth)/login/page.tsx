"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already authenticated → skip to home
  useEffect(() => {
    if (accessToken) router.replace("/home");
  }, [accessToken, router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/home`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
    // On success Supabase redirects to Google; loading stays true during redirect.
  }

  return (
    <div className="login-shell">
      {/* Brand panel */}
      <aside
        style={{
          width: 440, flexShrink: 0,
          background: "var(--bg-subtle)",
          borderRight: "1px solid var(--border)",
          padding: "44px 40px",
          display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
        }}
        className="login-brand-panel"
      >
        <Link
          href="/"
          aria-label="랜딩 페이지로 이동"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", width: "fit-content" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--accent)" />
            <path d="M12 18V11.5M12 11.5C12 8 9.5 6 7.5 6c0 3 1 5.5 4.5 5.5zM12 11.5C12 8 14.5 6 16.5 6c0 3-1 5.5-4.5 5.5z" stroke="var(--accent-contrast)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>Plant Counselor</span>
        </Link>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2 className="t-display" style={{ color: "var(--fg)", lineHeight: 1.2, marginBottom: 16 }}>
            고민과 일정을<br />식물처럼 키우는<br />AI 정원사.
          </h2>
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", lineHeight: 1.7, maxWidth: 320 }}>
            자연스러운 대화로 고민과 일정을 정리하고,
            식물 생애주기로 진행 상황을 한눈에 봅니다.
          </p>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "자연스러운 대화로 일정 관리",
            "식물 생애주기로 진행 상황 시각화",
            "정체된 봉우리를 AI가 돌봐드려요",
          ].map((line) => (
            <li key={line} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 7l3 3 7-7" />
              </svg>
              <span className="t-body-sm" style={{ color: "var(--fg-secondary)" }}>{line}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Login form */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 360 }} className="animate-in">
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 className="t-h1" style={{ color: "var(--fg)", marginBottom: 8 }}>
              정원에 오세요
            </h1>
            <p className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
              Google 계정으로 간편하게 시작합니다
            </p>
          </div>

          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: "var(--r-md)", marginBottom: 16,
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
              color: "var(--danger)", fontSize: 13, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* Google OAuth button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "12px 20px",
              borderRadius: "var(--r-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              cursor: loading ? "wait" : "pointer",
              fontSize: 15, fontWeight: 600, color: "var(--fg)",
              transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "var(--bg-subtle)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
            }}
          >
            {/* Google "G" logo */}
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? "연결 중…" : "Google로 계속하기"}
          </button>

          <p className="t-caption" style={{ color: "var(--fg-subtle)", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
            Google 계정으로 로그인하면 서비스 이용약관에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
