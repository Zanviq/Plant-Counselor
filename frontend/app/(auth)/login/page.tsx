"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { getCurrentUser, login, signup } from "@/lib/api/auth";

type Mode = "login" | "signup";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-elevated)",
  color: "var(--fg)",
  fontSize: 14,
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="t-caption" style={{ color: "var(--fg-secondary)", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (valid session cookie) → skip to home
  useEffect(() => {
    getCurrentUser().then((res) => {
      if (res.ok) router.replace("/home");
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = mode === "login"
      ? await login(username, password)
      : await signup({ username, password, nickname: nickname || undefined });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message || "요청을 처리하지 못했습니다.");
      return;
    }
    setUser(res.data);
    router.replace(res.data.role === "admin" && mode === "login" ? "/admin" : "/home");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
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
              {mode === "login" ? "아이디와 비밀번호로 로그인합니다" : "아이디와 비밀번호만 있으면 시작할 수 있어요"}
            </p>
          </div>

          <div role="tablist" style={{ display: "flex", gap: 4, padding: 4, marginBottom: 20, borderRadius: "var(--r-md)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                  background: mode === m ? "var(--bg-elevated)" : "transparent",
                  color: mode === m ? "var(--fg)" : "var(--fg-muted)",
                  boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {m === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" style={{
              padding: "10px 12px", borderRadius: "var(--r-md)", marginBottom: 16,
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
              color: "var(--danger)", fontSize: 13, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="아이디">
              <input
                style={inputStyle} name="username" autoComplete="username" required
                minLength={mode === "signup" ? 3 : 1} maxLength={32}
                pattern={mode === "signup" ? "[A-Za-z0-9_.\\-]+" : undefined}
                title={mode === "signup" ? "영문, 숫자, _ . - 만 사용할 수 있어요 (3~32자)" : undefined}
                value={username} onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            {mode === "signup" && (
              <Field label="닉네임 (선택)">
                <input
                  style={inputStyle} name="nickname" maxLength={40} placeholder="비워두면 아이디를 사용해요"
                  value={nickname} onChange={(e) => setNickname(e.target.value)}
                />
              </Field>
            )}
            <Field label="비밀번호">
              <input
                style={inputStyle} name="password" type="password" required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 8 : 1} maxLength={128}
                placeholder={mode === "signup" ? "8자 이상" : undefined}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", marginTop: 6, padding: "12px 20px", borderRadius: "var(--r-md)",
                background: "var(--accent)", color: "var(--accent-contrast)", border: "none",
                cursor: loading ? "wait" : "pointer", fontSize: 15, fontWeight: 600,
              }}
            >
              {loading ? "잠시만요…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>

          <p className="t-caption" style={{ color: "var(--fg-subtle)", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
            데모 계정: <strong>demo</strong> / <strong>demo1234</strong>
          </p>
        </div>
      </main>
    </div>
  );
}
