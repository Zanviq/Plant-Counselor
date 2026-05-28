"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // If already logged in, skip landing and go straight to the app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/home");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    // Blank while we confirm session — avoids flash of landing for logged-in users.
    return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect width="24" height="24" rx="6" fill="var(--accent)" />
            <path d="M12 18V11.5M12 11.5C12 8 9.5 6 7.5 6c0 3 1 5.5 4.5 5.5zM12 11.5C12 8 14.5 6 16.5 6c0 3-1 5.5-4.5 5.5z"
              stroke="var(--accent-contrast)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
            Plant Counselor
          </span>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="btn btn-primary btn-sm"
        >
          시작하기
        </button>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{
        flex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "80px 40px 60px",
        textAlign: "center",
      }}>
        <div className="animate-in" style={{ maxWidth: 640 }}>

          {/* Badge */}
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 14px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              fontSize: 12, fontWeight: 600, color: "var(--accent)",
              letterSpacing: "0.02em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              AI 정원사
            </span>
          </div>

          {/* Headline */}
          <h1 className="t-display" style={{
            color: "var(--fg)", lineHeight: 1.15,
            marginBottom: 20, fontSize: "clamp(2rem, 5vw, 3rem)",
          }}>
            고민과 일정을<br />식물처럼 키워요
          </h1>

          <p className="t-body-sm" style={{
            color: "var(--fg-muted)", lineHeight: 1.8,
            marginBottom: 40, maxWidth: 480, margin: "0 auto 40px",
          }}>
            자연스러운 대화 한 마디로 AI가 고민을 정리하고,<br />
            식물 생애주기로 진행 상황을 한눈에 확인하세요.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/login")}
              className="btn btn-primary"
              style={{ padding: "12px 28px", fontSize: 15, fontWeight: 600 }}
            >
              Google로 무료 시작
            </button>
            <button
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn btn-ghost"
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              더 알아보기 ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          padding: "72px 40px",
          background: "var(--bg-subtle)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 className="t-h1" style={{
            textAlign: "center", color: "var(--fg)",
            marginBottom: 48,
          }}>
            정원사가 하는 일
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}>
            {[
              {
                icon: "💬",
                title: "자연어로 기록",
                desc: "\"면접 준비해야 해\" 한 마디면 AI가 알아서 식물과 봉우리를 만들어 드립니다.",
              },
              {
                icon: "🌱",
                title: "식물 생애주기",
                desc: "씨앗 → 새싹 → 꽃 → 열매 → 수확. 고민의 진행 상황을 자연의 언어로 확인하세요.",
              },
              {
                icon: "📅",
                title: "일정 자동 분류",
                desc: "\"밥먹기\", \"면접\", \"운동\" — 대화 맥락을 파악해 캘린더에 자동으로 정리합니다.",
              },
              {
                icon: "🔔",
                title: "방치 알림",
                desc: "오랫동안 신경 쓰지 못한 봉우리가 시들기 전에 AI가 먼저 알려드립니다.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="card"
                style={{
                  padding: "24px 22px",
                  background: "var(--bg-elevated)",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <div className="t-h3" style={{ color: "var(--fg)", marginBottom: 8 }}>{f.title}</div>
                <p className="t-body-sm" style={{ color: "var(--fg-muted)", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section style={{
        padding: "72px 40px",
        textAlign: "center",
        borderTop: "1px solid var(--border)",
      }}>
        <h2 className="t-h1" style={{ color: "var(--fg)", marginBottom: 16 }}>
          지금 바로 정원을 시작하세요
        </h2>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginBottom: 32 }}>
          Google 계정으로 5초 만에 가입할 수 있어요.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="btn btn-primary"
          style={{ padding: "14px 36px", fontSize: 16, fontWeight: 600 }}
        >
          Google로 시작하기
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "20px 40px",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6,
      }}>
        <span className="t-caption" style={{ color: "var(--fg-subtle)" }}>
          © 2026 Plant Counselor
        </span>
      </footer>

    </div>
  );
}
