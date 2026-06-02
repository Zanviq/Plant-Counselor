// Server component — no "use client".
// <Link> renders as real <a> tags → navigation works without JS.
// The preview blocks below are purely presentational mock-ups: they reuse the
// real sprite assets and chat styling, but nothing here is interactive.
import Link from "next/link";
import type { CSSProperties } from "react";
import AuthRedirect from "./_components/AuthRedirect";
import { GardenPlantVisual, LAYER_H, POT_H } from "@/components/plants/GardenPlantVisual";

// ── Garden pixel constants (mirror the current /plants renderer) ─────────────

const DEMO_GARDEN_GROUND_ROOM = 124;
const PREVIEW_LIGHT_TOKENS = {
  "--border": "#DDD9CE",
  "--fg": "#2A2A24",
  "--fg-muted": "#7A7A6E",
  "--bg-hover": "#E2DED5",
  "--st-bud": "#7A8A5A",
  "--st-flower": "#8BAA5A",
  "--st-fruit": "#5C6B3F",
  "--st-harvest": "#C49A2A",
  "--st-wilting": "#BDA040",
  "--st-rot": "#B54A3A",
} as CSSProperties;

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

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
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

// ── Preview mock-ups (non-interactive) ──────────────────────────────────────

// The garden preview mirrors the current 2D grass field used by /plants.
function GardenPreview() {
  return (
    <div style={{
      ...PREVIEW_LIGHT_TOKENS,
      position: "relative", overflow: "hidden",
      borderRadius: "var(--r-xl)", border: "1px solid var(--border)",
      boxShadow: "var(--shadow-md)", minHeight: 372,
      display: "flex", flexDirection: "column",
    }}>
      {/* Sky */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, #E6F3E8 0%, #F3FAF0 54%, #FCFDF9 100%)",
        zIndex: 0,
      }} />
      {/* Caption chip */}
      <div style={{ position: "relative", zIndex: 4, padding: "14px 16px 0" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: "var(--r-pill)",
          background: "rgba(255,255,255,0.78)", backdropFilter: "blur(4px)",
          fontSize: 12, fontWeight: 600, color: "#3d4a30",
        }}>
          <IconSeedling /> 나의 정원
        </span>
      </div>
      {/* Terrain layers */}
      <div style={{ position: "absolute", top: `calc(100% - ${DEMO_GARDEN_GROUND_ROOM + 8}px)`, left: 0, right: 0, height: 118, zIndex: 1, pointerEvents: "none", background: "#D7E8B2" }} />
      <div style={{ position: "absolute", top: `calc(100% - ${DEMO_GARDEN_GROUND_ROOM - 64}px)`, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none", background: "#B2CF85" }} />
      {/* Plants: pot bottoms share the same ground baseline as /plants. */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: `calc(100% - ${DEMO_GARDEN_GROUND_ROOM + POT_H + 3 * LAYER_H}px)`,
        zIndex: 2, display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 18,
      }}>
        <div>
          <GardenPlantVisual
            name="취업"
            buds={[
              { id: "career-1", status: "fruit", title: "디자인 면접 준비" },
              { id: "career-2", status: "flower", title: "포트폴리오 정리" },
              { id: "career-3", status: "bud", title: "자기소개서 작성" },
            ]}
            actions={<>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 5px" }}>상세</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 5px" }}>상담</button>
            </>}
          />
        </div>
        <div style={{ marginTop: LAYER_H }}>
          <GardenPlantVisual
            name="건강"
            buds={[
              { id: "health-1", status: "harvested", title: "주 3회 러닝" },
              { id: "health-2", status: "bud", title: "수면 패턴 교정" },
            ]}
            actions={<>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 5px" }}>상세</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 5px" }}>상담</button>
            </>}
          />
        </div>
      </div>
    </div>
  );
}

// One chat bubble in the mock conversation.
function DemoBubble({ role, children }: { role: "user" | "ai"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4, fontWeight: 600, textAlign: isUser ? "right" : "left" }}>
        {isUser ? "나" : "AI 정원사"}
      </div>
      <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
        <div style={{
          maxWidth: "84%",
          padding: "10px 14px",
          fontSize: 14, lineHeight: 1.6,
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          background: isUser ? "var(--accent)" : "var(--bg-subtle)",
          color: isUser ? "var(--accent-contrast)" : "var(--fg)",
          border: isUser ? "none" : "1px solid var(--border)",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// A "skill ran" chip, like the real chat shows after a tool call.
function DemoToolChip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: "var(--r-pill)",
        background: "var(--accent-muted)", border: "1px solid var(--accent-soft)",
        fontSize: 12, fontWeight: 600, color: "var(--accent-fg)",
      }}>
        <IconSeedling /> {children}
      </span>
    </div>
  );
}

// The chat preview — a static mock of the in-app chat panel.
function ChatPreview() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", overflow: "hidden",
      borderRadius: "var(--r-xl)", border: "1px solid var(--border)",
      background: "var(--bg-elevated)", boxShadow: "var(--shadow-md)",
      minHeight: 372,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
      }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconChat />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>AI 정원사</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg-muted)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", display: "inline-block" }} />
            전체 정원
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: "16px", overflow: "hidden", background: "var(--bg-elevated)" }}>
        <DemoBubble role="ai">안녕하세요, 정원사예요. 요즘 가장 신경 쓰이는 일이 있나요?</DemoBubble>
        <DemoBubble role="user">다음 주 수요일에 디자인 면접이 있어서 준비해야 해</DemoBubble>
        <DemoToolChip>‘취업’ 식물에 새 봉우리를 심었어요</DemoToolChip>
        <DemoBubble role="ai">
          <strong>디자인 면접 준비</strong> 봉우리를 만들었어요.<br />
          수요일까지 함께 키워봐요. 포트폴리오부터 정리해볼까요?
        </DemoBubble>
      </div>

      {/* Input bar (disabled — preview only) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: 12, borderTop: "1px solid var(--border)", background: "var(--bg)",
      }}>
        <div style={{
          flex: 1, padding: "10px 14px",
          borderRadius: "var(--r-md)", border: "1px solid var(--border)",
          background: "var(--bg-subtle)", color: "var(--fg-subtle)", fontSize: 13,
        }}>
          로그인하면 직접 대화할 수 있어요
        </div>
        <div aria-hidden style={{
          width: 38, height: 38, flexShrink: 0,
          borderRadius: "var(--r-md)", background: "var(--bg-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fg-subtle)",
        }}>
          <IconSend />
        </div>
      </div>
    </div>
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
    desc: "봉우리에서 열매까지. 고민과 일정의 진행 상황을 자연의 언어로 직관적으로 확인합니다.",
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
  { step: "03", label: "함께 가꾸기", desc: "진행할수록 봉우리가 꽃이 되고 열매가 맺힙니다." },
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
                }}
              >
                로그인
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                시작하기
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ flex: 1 }}>
          {/* ── Hero ─────────────────────────────────────────────────── */}
          <section style={{
          flex: "none",
          padding: "84px 32px 64px",
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
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <IconGoogle />
                Google로 시작하기
              </Link>

              <a
                href="#preview"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "13px 22px",
                  background: "var(--bg-elevated)",
                  color: "var(--fg-secondary)",
                  borderRadius: "var(--r-md)",
                  fontSize: 15, fontWeight: 500,
                  textDecoration: "none",
                  border: "1px solid var(--border)",
                }}
              >
                둘러보기
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <line x1="7" y1="2" x2="7" y2="12" />
                  <polyline points="3 8 7 12 11 8" />
                </svg>
              </a>
            </div>
          </div>
          </section>

          {/* ── Live preview (garden + chat) ─────────────────────────── */}
          <section
          id="preview"
          style={{
            padding: "80px 32px",
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--accent)", textTransform: "uppercase", marginBottom: 10,
              }}>
                미리보기
              </p>
              <h2 style={{
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 700, color: "var(--fg)",
                letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>
                대화 한 번이면, 이렇게 자랍니다
              </h2>
              <p style={{ fontSize: 14, color: "var(--fg-muted)", marginTop: 12 }}>
                실제 화면 그대로의 미리보기예요. (둘러보기용 — 입력은 동작하지 않아요)
              </p>
            </div>

            {/* Responsive 2-up: chat ↔ garden. Wraps to one column when narrow. */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              alignItems: "stretch",
            }}>
              <ChatPreview />
              <GardenPreview />
            </div>
          </div>
          </section>

          {/* ── Features ─────────────────────────────────────────────── */}
          <section
          id="features"
          style={{
            padding: "80px 32px",
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
              Google 계정으로 바로 시작할 수 있습니다.
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
        </main>

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
