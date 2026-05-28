// Server component — no "use client".
// <Link> renders as real <a> tags → navigation works without JS.
import Link from "next/link";
import AuthRedirect from "./_components/AuthRedirect";

// ── SVG icons ──────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <path
        d="M14 22V14.5M14 14.5C14 10 11 8 8.5 8c0 3.5 1.2 6.5 5.5 6.5zM14 14.5C14 10 17 8 19.5 8c0 3.5-1.2 6.5-5.5 6.5z"
        stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="13" y2="14" />
    </svg>
  );
}

function IconSeedling() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22V12" />
      <path d="M12 12C12 7.5 9 5.5 5.5 5.5 5.5 9.5 7 12 12 12z" />
      <path d="M12 12C12 7.5 15 5.5 18.5 5.5 18.5 9.5 17 12 12 12z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8.01" y2="14" strokeWidth="2" />
      <line x1="12" y1="14" x2="12.01" y2="14" strokeWidth="2" />
      <line x1="16" y1="14" x2="16.01" y2="14" strokeWidth="2" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="2" y1="7" x2="12" y2="7" />
      <polyline points="8 3 12 7 8 11" />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ── Feature card data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <IconChat />,
    title: "자연어로 기록",
    desc: "\"면접 준비해야 해\" 한 마디면 AI가 알아서 분야와 항목을 만들어 드립니다. 형식에 맞출 필요가 없습니다.",
  },
  {
    icon: <IconSeedling />,
    title: "식물 생애주기",
    desc: "씨앗에서 열매까지. 고민과 일정의 진행 상황을 자연의 언어로 직관적으로 확인합니다.",
  },
  {
    icon: <IconCalendar />,
    title: "일정 자동 분류",
    desc: "대화 맥락을 파악해 일상·취업·건강 등 분야로 자동 분류하고 캘린더에 정리합니다.",
  },
  {
    icon: <IconBell />,
    title: "방치 알림",
    desc: "오랫동안 신경 쓰지 못한 항목이 시들기 전에 AI가 먼저 상기시켜 드립니다.",
  },
] as const;

// ── Lifecycle step data ────────────────────────────────────────────────────

const STEPS = [
  { step: "01", label: "대화하기", desc: "채팅창에 고민이나 일정을 자연스럽게 입력하세요." },
  { step: "02", label: "정원 보기", desc: "AI가 분야·항목을 생성하고 식물 정원에 배치합니다." },
  { step: "03", label: "함께 가꾸기", desc: "진행할수록 씨앗이 꽃이 되고 열매가 맺힙니다." },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* Logged-in users are silently redirected to /home */}
      <AuthRedirect />

      <div style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "inherit",
      }}>

        {/* ── Nav ──────────────────────────────────────────────────── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 20,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{
            maxWidth: 1080, margin: "0 auto",
            padding: "0 32px",
            height: 56,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LogoMark />
              <span style={{
                fontSize: 15, fontWeight: 700, color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}>
                Plant Counselor
              </span>
            </div>

            <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/login"
                style={{
                  fontSize: 13, fontWeight: 500, color: "var(--fg-muted)",
                  textDecoration: "none", padding: "6px 12px",
                  borderRadius: "var(--r-md)",
                  transition: "color 0.12s, background 0.12s",
                }}
                onMouseOver={undefined}
              >
                로그인
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                무료로 시작하기
              </Link>
            </nav>
          </div>
        </header>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section style={{
          flex: "none",
          padding: "96px 32px 80px",
          textAlign: "center",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>

            {/* Tag */}
            <div style={{ marginBottom: 28, display: "inline-flex" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "5px 14px 5px 10px",
                borderRadius: "var(--r-pill)",
                background: "var(--accent-muted)",
                border: "1px solid var(--accent-soft)",
                fontSize: 12, fontWeight: 600,
                color: "var(--accent-fg)",
                letterSpacing: "0.01em",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--accent)", display: "inline-block",
                  flexShrink: 0,
                }} />
                AI 정원사 — Gemini 2.5 Flash
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
              fontWeight: 800,
              color: "var(--fg)",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              marginBottom: 24,
            }}>
              고민과 일정을<br />
              <span style={{ color: "var(--accent)" }}>식물처럼</span> 키워요
            </h1>

            <p style={{
              fontSize: 17,
              color: "var(--fg-muted)",
              lineHeight: 1.75,
              maxWidth: 520,
              margin: "0 auto 40px",
            }}>
              자연스러운 대화 한 마디로 AI가 고민을 정리하고,
              식물 생애주기로 진행 상황을 한눈에 확인하세요.
            </p>

            {/* CTA row */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/login"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "13px 28px",
                  background: "var(--accent)",
                  color: "white",
                  borderRadius: "var(--r-md)",
                  fontSize: 15, fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid var(--accent)",
                  transition: "background 0.12s",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <IconGoogle />
                Google로 무료 시작
              </Link>

              <a
                href="#features"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "13px 22px",
                  background: "var(--bg-elevated)",
                  color: "var(--fg-secondary)",
                  borderRadius: "var(--r-md)",
                  fontSize: 15, fontWeight: 500,
                  textDecoration: "none",
                  border: "1px solid var(--border)",
                  transition: "background 0.12s",
                }}
              >
                더 알아보기
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <line x1="7" y1="2" x2="7" y2="12" />
                  <polyline points="3 8 7 12 11 8" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section
          id="features"
          style={{
            padding: "80px 32px",
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--accent)", textTransform: "uppercase", marginBottom: 10,
              }}>
                주요 기능
              </p>
              <h2 style={{
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 700, color: "var(--fg)",
                letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>
                정원사가 하는 일
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}>
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  style={{
                    padding: "28px 24px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: "var(--r-md)",
                    background: "var(--accent-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    {f.icon}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 700,
                    color: "var(--fg)", marginBottom: 8,
                    letterSpacing: "-0.01em",
                  }}>
                    {f.title}
                  </div>
                  <p style={{
                    fontSize: 13, color: "var(--fg-muted)",
                    lineHeight: 1.7, margin: 0,
                  }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section style={{ padding: "80px 32px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--accent)", textTransform: "uppercase", marginBottom: 10,
              }}>
                시작하기
              </p>
              <h2 style={{
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 700, color: "var(--fg)",
                letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>
                3단계로 정원을 만드세요
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 0,
              position: "relative",
            }}>
              {STEPS.map((s, i) => (
                <div key={s.step} style={{
                  padding: "32px 28px",
                  position: "relative",
                  borderRight: i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800,
                    color: "var(--accent)", letterSpacing: "0.1em",
                    marginBottom: 12,
                  }}>
                    STEP {s.step}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 700,
                    color: "var(--fg)", marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}>
                    {s.label}
                  </div>
                  <p style={{
                    fontSize: 13, color: "var(--fg-muted)",
                    lineHeight: 1.7, margin: 0,
                  }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ───────────────────────────────────────────── */}
        <section style={{
          padding: "88px 32px",
          textAlign: "center",
          background: "var(--bg-subtle)",
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
              <LogoMark />
            </div>
            <h2 style={{
              fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
              fontWeight: 700, color: "var(--fg)",
              letterSpacing: "-0.02em", lineHeight: 1.25,
              marginBottom: 14,
            }}>
              지금 바로 정원을<br />시작하세요
            </h2>
            <p style={{
              fontSize: 14, color: "var(--fg-muted)",
              lineHeight: 1.7, marginBottom: 36,
            }}>
              Google 계정으로 5초 만에 시작할 수 있습니다.
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "14px 32px",
                background: "var(--accent)",
                color: "white",
                borderRadius: "var(--r-md)",
                fontSize: 15, fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--accent)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <IconGoogle />
              Google로 시작하기
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "20px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LogoMark />
            <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              Plant Counselor
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
            © 2026 Plant Counselor. All rights reserved.
          </span>
        </footer>

      </div>
    </>
  );
}
