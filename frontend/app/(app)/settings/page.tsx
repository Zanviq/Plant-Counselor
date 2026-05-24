"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/authStore";
import { useThemeStore, ThemeMode, AccentTheme } from "@/lib/store/themeStore";
import { updateMe, setApiKey, logout } from "@/lib/api/auth";
import { apiPost } from "@/lib/api/client";

const TABS = [
  { id: "account", label: "계정" },
  { id: "ai",      label: "AI" },
  { id: "garden",  label: "정원 규칙" },
  { id: "theme",   label: "테마" },
  { id: "about",   label: "정보" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TONES = [
  { key: "counselor", label: "따뜻한 상담사", desc: "공감과 격려를 중심으로 답합니다" },
  { key: "assistant", label: "담백한 비서",   desc: "간결하고 명확하게 답합니다" },
  { key: "friend",    label: "친구",          desc: "편하고 캐주얼하게 답합니다" },
];

const ACCENTS: { key: AccentTheme; label: string; color: string }[] = [
  { key: "emerald",  label: "Emerald",  color: "#059669" },
  { key: "sapphire", label: "Sapphire", color: "#2563EB" },
  { key: "violet",   label: "Violet",   color: "#7C3AED" },
  { key: "sunset",   label: "Sunset",   color: "#EA580C" },
];

const MODES: { key: ThemeMode; label: string; desc: string }[] = [
  { key: "light",  label: "라이트",  desc: "밝은 배경" },
  { key: "dark",   label: "다크",    desc: "어두운 배경" },
  { key: "system", label: "시스템",  desc: "OS 설정 따름" },
];

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setSession, clearSession, accessToken } = useAuthStore();
  const { mode, accent, setMode, setAccent } = useThemeStore();

  const [tab, setTab] = useState<TabId>("account");
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  function notify(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleLogout() {
    await logout();
    clearSession();
    qc.clear();
    router.replace("/login");
  }

  async function handleSaveApiKey() {
    if (!apiKeyVal.trim()) return;
    setSaving(true);
    const res = await setApiKey(apiKeyVal.trim());
    setSaving(false);
    if (res.ok) { notify("API 키를 저장했습니다."); setApiKeyVal(""); }
    else notify("저장 실패", false);
  }

  async function handleChangePw() {
    if (!oldPw || !newPw) return;
    if (newPw.length < 4) { notify("새 비밀번호는 4자 이상이어야 합니다.", false); return; }
    setSaving(true);
    const res = await apiPost<unknown>("/me/password", { old_password: oldPw, new_password: newPw });
    setSaving(false);
    if (res.ok) { notify("비밀번호를 변경했습니다."); setOldPw(""); setNewPw(""); }
    else notify("비밀번호 변경 실패", false);
  }

  async function handleSetTone(tone: string) {
    if (!user || !accessToken) return;
    const res = await updateMe({ tone });
    if (res.ok) setSession(accessToken, { ...user, tone });
  }

  async function handleSetRule(key: string, value: number) {
    if (!user || !accessToken) return;
    const rules = { ...(user.garden_rules as Record<string, number>), [key]: value };
    const res = await updateMe({ garden_rules: rules });
    if (res.ok) setSession(accessToken, { ...user, garden_rules: rules });
  }

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 960, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>설정</h1>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>
          계정, AI, 정원 규칙, 테마를 관리합니다.
        </p>
      </header>

      {msg && (
        <div
          className="animate-in"
          style={{
            padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 16,
            background: msg.ok ? "var(--accent-muted)" : "color-mix(in srgb, var(--danger) 8%, transparent)",
            color: msg.ok ? "var(--accent-fg)" : "var(--danger)",
            border: msg.ok ? "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" : "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
            fontSize: 13,
          }}
        >
          {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 32 }}>
        {/* Tabs */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                textAlign: "left", padding: "8px 12px", borderRadius: "var(--r-md)",
                background: tab === t.id ? "var(--bg-subtle)" : "transparent",
                color: tab === t.id ? "var(--fg)" : "var(--fg-muted)",
                border: "none", cursor: "pointer", fontSize: 13.5,
                fontWeight: tab === t.id ? 600 : 400, transition: "all 0.1s",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="animate-in">
          {tab === "account" && (
            <Section title="프로필">
              <Row label="닉네임" sub="현재 로그인된 계정">
                <span className="t-body" style={{ color: "var(--fg)", fontWeight: 600 }}>{user?.nickname ?? "—"}</span>
              </Row>

              <SubSection title="비밀번호 변경">
                <Row label="현재 비밀번호">
                  <input type="password" className="input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} style={{ maxWidth: 220 }} />
                </Row>
                <Row label="새 비밀번호" sub="4자 이상">
                  <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ maxWidth: 220 }} />
                </Row>
                <div style={{ paddingTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleChangePw} disabled={saving}>
                    {saving ? "저장 중…" : "비밀번호 변경"}
                  </button>
                </div>
              </SubSection>

              <SubSection title="세션">
                <Row label="로그아웃" sub="현재 세션을 종료합니다">
                  <button className="btn btn-danger btn-sm" onClick={handleLogout}>로그아웃</button>
                </Row>
              </SubSection>
            </Section>
          )}

          {tab === "ai" && (
            <Section title="AI 설정">
              <Row label="Gemini API 키" sub="저장 시 암호화하여 보관합니다">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    className="input"
                    type="password"
                    value={apiKeyVal}
                    onChange={(e) => setApiKeyVal(e.target.value)}
                    placeholder="AIzaSy…"
                    style={{ width: 220 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSaveApiKey} disabled={saving}>
                    저장
                  </button>
                </div>
              </Row>

              <SubSection title="응답 톤">
                {TONES.map((t) => (
                  <Row key={t.key} label={t.label} sub={t.desc}>
                    <Radio active={user?.tone === t.key} onClick={() => handleSetTone(t.key)} />
                  </Row>
                ))}
              </SubSection>
            </Section>
          )}

          {tab === "garden" && (
            <Section title="자동 전이 규칙">
              {[
                { k: "wilting_days",        label: "시듦 기준 일수",       sub: "변화 없이 며칠 지나면 시들기로 표시할지", min: 1,  max: 30 },
                { k: "rot_disappear_days",  label: "썩음 처리 일수",       sub: "시든 상태로 며칠 지나면 썩음으로 전환할지", min: 1, max: 60 },
                { k: "deadline_warn_days",  label: "마감 임박 알림 기준",   sub: "마감 며칠 전부터 알림을 보낼지",         min: 1, max: 14 },
              ].map((r) => (
                <Row key={r.k} label={r.label} sub={r.sub}>
                  <NumberStepper
                    value={(user?.garden_rules as Record<string, number>)?.[r.k] ?? 0}
                    min={r.min}
                    max={r.max}
                    onChange={(v) => handleSetRule(r.k, v)}
                  />
                </Row>
              ))}
            </Section>
          )}

          {tab === "theme" && (
            <Section title="테마">
              <SubSection title="모드">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {MODES.map((m) => (
                    <ModeCard
                      key={m.key}
                      active={mode === m.key}
                      onClick={() => setMode(m.key)}
                      label={m.label}
                      desc={m.desc}
                      themeKey={m.key}
                    />
                  ))}
                </div>
              </SubSection>

              <SubSection title="강조색">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {ACCENTS.map((a) => (
                    <AccentCard
                      key={a.key}
                      active={accent === a.key}
                      color={a.color}
                      label={a.label}
                      onClick={() => setAccent(a.key)}
                    />
                  ))}
                </div>
              </SubSection>
            </Section>
          )}

          {tab === "about" && (
            <Section title="앱 정보">
              <Row label="버전"     sub="현재 빌드"><span className="t-mono" style={{ color: "var(--fg-muted)" }}>v0.1.0</span></Row>
              <Row label="데이터"   sub="외부 전송 범위"><span className="t-body-sm" style={{ color: "var(--fg-muted)" }}>Gemini API 호출에만</span></Row>
              <Row label="만든 곳"  sub=""><span className="t-body-sm" style={{ color: "var(--fg-muted)" }}>Plant Counselor</span></Row>
            </Section>
          )}
        </main>
      </div>
    </div>
  );
}

// ── primitives ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="t-h1" style={{ color: "var(--fg)", marginBottom: 16 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500 }}>{label}</div>
        {sub && <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Radio({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        width: 22, height: 22, borderRadius: "50%",
        border: "2px solid",
        borderColor: active ? "var(--accent)" : "var(--border-strong)",
        background: active ? "var(--accent)" : "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s", padding: 0,
      }}
    >
      {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-contrast)" }} />}
    </button>
  );
}

function NumberStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--bg-elevated)" }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-muted)" }}
      >−</button>
      <span style={{ minWidth: 40, textAlign: "center", fontSize: 13, color: "var(--fg)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {value}일
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-muted)" }}
      >+</button>
    </div>
  );
}

function ModeCard({ active, onClick, label, desc, themeKey }: {
  active: boolean; onClick: () => void; label: string; desc: string; themeKey: ThemeMode;
}) {
  const previewBg = themeKey === "dark" ? "#0A0A0B" : themeKey === "light" ? "#FAFAFA" : "linear-gradient(135deg, #FAFAFA 50%, #0A0A0B 50%)";
  const previewFg = themeKey === "dark" ? "#FAFAFA" : themeKey === "light" ? "#18181B" : "transparent";
  return (
    <button
      onClick={onClick}
      style={{
        padding: 0, border: "1px solid",
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)", cursor: "pointer",
        textAlign: "left", overflow: "hidden",
        transition: "border-color 0.12s",
      }}
    >
      <div style={{ height: 56, background: previewBg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: previewFg }}>Aa</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500 }}>{label}</div>
          <div className="t-caption" style={{ color: "var(--fg-muted)" }}>{desc}</div>
        </div>
        {active && <Check />}
      </div>
    </button>
  );
}

function AccentCard({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px", border: "1px solid",
        borderColor: active ? color : "var(--border)",
        borderRadius: "var(--r-md)", cursor: "pointer",
        background: "var(--bg-elevated)", textAlign: "left",
        display: "flex", alignItems: "center", gap: 10,
        transition: "border-color 0.12s",
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span className="t-body-sm" style={{ color: "var(--fg)", flex: 1 }}>{label}</span>
      {active && <Check />}
    </button>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7l3 3 7-7" />
    </svg>
  );
}
