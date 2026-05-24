"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, signup, refreshToken } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { configureClient } from "@/lib/api/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { setSession, clearSession } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    configureClient(
      () => useAuthStore.getState().accessToken,
      async () => {
        const res = await refreshToken();
        if (!res.ok) { clearSession(); return null; }
        return (res.data as { access_token: string }).access_token;
      }
    );
  }, [clearSession]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (mode === "signup") {
      if (password !== password2) { setError("비밀번호가 일치하지 않습니다."); return; }
      if (password.length < 4)    { setError("비밀번호는 4자 이상이어야 합니다."); return; }
      setLoading(true);
      const res = await signup(nickname, password);
      setLoading(false);
      if (!res.ok) { setError(res.error.message); return; }
      setSuccess("가입 완료! 로그인해주세요.");
      setMode("login");
      setPassword(""); setPassword2("");
      return;
    }

    setLoading(true);
    const res = await login(nickname, password);
    setLoading(false);
    if (!res.ok) { setError(res.error.message); return; }
    const d = res.data as { access_token: string; user: Parameters<typeof setSession>[1] };
    setSession(d.access_token, d.user);
    router.replace("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)" }}>
      {/* Brand panel — hidden on small screens */}
      <aside
        style={{
          width: 440, flexShrink: 0,
          background: "var(--bg-subtle)",
          borderRight: "1px solid var(--border)",
          padding: "44px 40px",
          display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
        }}
        className="hidden lg:flex"
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--accent)" />
            <path d="M12 18V11.5M12 11.5C12 8 9.5 6 7.5 6c0 3 1 5.5 4.5 5.5zM12 11.5C12 8 14.5 6 16.5 6c0 3-1 5.5-4.5 5.5z" stroke="var(--accent-contrast)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>Plant Counselor</span>
        </div>

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

      {/* Form */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 360 }} className="animate-in">
          <div style={{ marginBottom: 28 }}>
            <h1 className="t-h1" style={{ color: "var(--fg)", marginBottom: 6 }}>
              {mode === "login" ? "정원에 돌아오세요" : "정원 만들기"}
            </h1>
            <p className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
              {mode === "login" ? "닉네임과 비밀번호로 로그인" : "닉네임과 비밀번호로 시작"}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="닉네임">
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="나만의 닉네임"
                autoFocus
                required
              />
            </Field>
            <Field label="비밀번호">
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4자 이상"
                required
              />
            </Field>
            {mode === "signup" && (
              <Field label="비밀번호 확인">
                <input
                  className="input"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="비밀번호를 한 번 더"
                  required
                />
              </Field>
            )}

            {error && (
              <div style={{
                padding: "10px 12px", borderRadius: "var(--r-md)",
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                color: "var(--danger)", fontSize: 13,
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                padding: "10px 12px", borderRadius: "var(--r-md)",
                background: "var(--accent-muted)",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                color: "var(--accent-fg)", fontSize: 13,
              }}>{success}</div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? "처리 중…" : mode === "login" ? "로그인" : "정원 만들기"}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--fg-muted)" }}>
            {mode === "login" ? "아직 계정이 없으신가요? " : "이미 계정이 있으신가요? "}
            <button
              type="button"
              onClick={() => { setMode((m) => (m === "login" ? "signup" : "login")); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              {mode === "login" ? "가입하기" : "로그인"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="t-label" style={{ color: "var(--fg-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
