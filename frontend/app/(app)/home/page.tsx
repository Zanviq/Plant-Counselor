"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSummary, getBriefing } from "@/lib/api/stats";
import { listPlants, Plant } from "@/lib/api/plants";
import { listBuds, Bud } from "@/lib/api/buds";
// (wilting list is derived client-side from the same buds query)
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { STATUS_PILL, STATUS_LABEL, dominantStatus, isActive, BudStatus } from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { StatCardSkeleton, PlantCardSkeleton } from "@/components/ui/Skeleton";
import { AiChatButton } from "@/components/chat/AiChatButton";

// ── stat card ──────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent, onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "default" | "warning" | "danger" | "positive";
  onClick?: () => void;
}) {
  const accentColor =
    accent === "warning"  ? "var(--warning)"  :
    accent === "danger"   ? "var(--danger)"   :
    accent === "positive" ? "var(--positive)" :
                            "var(--fg-muted)";

  return (
    <button
      onClick={onClick}
      className="card card-hover"
      style={{
        padding: "18px 18px 16px",
        width: "100%",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        background: "var(--bg-elevated)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span className="dot" style={{ background: accentColor }} />
        <span className="t-label">{label}</span>
      </div>
      <div className="t-numeral" style={{ color: "var(--fg)" }}>{value}</div>
      {sub && <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 4 }}>{sub}</div>}
    </button>
  );
}

// ── plant card ─────────────────────────────────────────────────

function PlantCard({ plant, buds, onClick, onChat }: {
  plant: Plant;
  buds: Bud[];
  onClick: () => void;
  onChat: () => void;
}) {
  const active = buds.filter((b) => isActive(b.status));
  const avg = active.length ? Math.round(active.reduce((s, b) => s + b.progress, 0) / active.length) : 0;
  const dom = dominantStatus(active);

  return (
    <div
      className="card card-hover"
      style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
      onClick={onClick}
    >
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="t-h3"
              style={{ color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {plant.name}
            </div>
            <div
              className="t-caption"
              style={{
                color: "var(--fg-muted)", marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
              }}
            >
              {plant.description || "설명 없음"}
            </div>
          </div>
          {active.length > 0 && (
            <span className={STATUS_PILL[dom as BudStatus]}>
              <span className="pill-dot" style={{ background: "currentColor" }} />
              {STATUS_LABEL[dom as BudStatus]}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span className="t-caption" style={{ color: "var(--fg-muted)" }}>진행률</span>
          <span className="t-mono" style={{ color: "var(--fg-secondary)" }}>{avg}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${avg}%` }} />
        </div>
      </div>

      <div className="divider" />

      <div style={{ padding: "10px 12px 10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="t-caption" style={{ color: "var(--fg-muted)" }}>
          {active.length}개 진행 · {buds.length}개 누적
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); onChat(); }}
        >
          상담
        </button>
      </div>
    </div>
  );
}

// ── empty plant card (CTA) ─────────────────────────────────────

function NewPlantCTA({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        padding: "20px 16px",
        background: "var(--bg-subtle)",
        border: "1px dashed var(--border-strong)",
        cursor: "pointer",
        textAlign: "left",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: 140,
      }}
    >
      <div>
        <div className="t-label" style={{ color: "var(--accent)" }}>새 식물</div>
        <div className="t-h3" style={{ color: "var(--fg)", marginTop: 6 }}>
          AI와 분야 만들기
        </div>
        <p className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 4 }}>
          어떤 분야의 고민을 관리하고 싶은지 말해보세요
        </p>
      </div>
      <span className="t-caption" style={{ color: "var(--accent)", marginTop: 12 }}>+ 식물 추가</span>
    </button>
  );
}

// ── wilting row ────────────────────────────────────────────────

function WiltingRow({ bud, onChat }: { bud: Bud; onChat: () => void }) {
  return (
    <div
      className="card"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px",
      }}
    >
      <span className="pill pill-wilting">
        <span className="pill-dot" style={{ background: "currentColor" }} />
        시듦
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-body-sm"
          style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {bud.title}
        </div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onChat}>상담</button>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { openWith } = useChatStore();
  const { user, accessToken } = useAuthStore();

  // Query keys from QK factory — shared with plants/page.tsx to hit the same cache.
  // `enabled` guard prevents unauthenticated 401s on cold start.
  const { data: sumRes,    isLoading: loadingSum }    = useQuery({ queryKey: QK.summary(),  queryFn: getSummary,          enabled: !!accessToken });
  const { data: briefRes }                             = useQuery({ queryKey: QK.briefing(), queryFn: getBriefing, staleTime: 5 * 60_000, enabled: !!accessToken });
  const { data: plantsRes, isLoading: loadingPlants } = useQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(),  enabled: !!accessToken });
  const { data: budsRes }                             = useQuery({ queryKey: QK.buds(),     queryFn: () => listBuds(),    enabled: !!accessToken });

  const summary  = sumRes?.ok    ? sumRes.data            : null;
  const briefing = briefRes?.ok  ? briefRes.data.briefing : "";
  const plants   = plantsRes?.ok ? plantsRes.data.items   : [];
  const allBuds  = budsRes?.ok   ? budsRes.data.items     : [];
  // Derive wilting from the same list — avoids a duplicate /buds call.
  const wilting  = allBuds.filter((b) => b.status === "wilting");

  const budsByPlant = useMemo(() => {
    const m = new Map<string, Bud[]>();
    for (const b of allBuds) {
      const arr = m.get(b.plant_id) ?? [];
      arr.push(b);
      m.set(b.plant_id, arr);
    }
    return m;
  }, [allBuds]);

  const activeBudCount = allBuds.filter((b) => isActive(b.status)).length;
  const dateStr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  // Friendly nudge when the briefing endpoint signals a missing/bad API key —
  // the backend embeds a recognisable Korean fragment in that case.
  const apiKeyMissing = briefing.includes("API 키") && briefing.includes("설정");

  return (
    <div style={{ padding: "40px 36px 64px", maxWidth: 1120, margin: "0 auto" }}>
      {/* Top-right AI chat button (hides while the chat panel is open) */}
      <AiChatButton style={{ position: "fixed", top: 24, right: 28, zIndex: 30 }} />

      {/* Header */}
      <header className="animate-in" style={{ marginBottom: 28 }}>
        <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 6 }}>{dateStr}</div>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>
          안녕하세요, {user?.nickname ?? "정원사"}님
        </h1>
        {briefing && !apiKeyMissing && (
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 8, maxWidth: 640 }}>
            {briefing}
          </p>
        )}
      </header>

      {apiKeyMissing && (
        <div
          className="card animate-in"
          style={{
            padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12,
            background: "color-mix(in srgb, var(--warning) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)",
          }}
        >
          <span className="dot" style={{ background: "var(--warning)" }} />
          <div style={{ flex: 1 }}>
            <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500 }}>
              AI를 사용하려면 Gemini API 키가 필요해요
            </div>
            <div className="t-caption" style={{ color: "var(--fg-muted)" }}>
              설정 → AI 에서 키를 입력하면 AI 정원사와 대화할 수 있습니다.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => router.push("/settings")}>설정 열기</button>
        </div>
      )}

      {/* Stats */}
      <section
        className="stagger"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}
      >
        {loadingSum ? (
          <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="진행 중인 고민"   value={summary?.active_concerns      ?? 0} accent="default"  sub="활성 봉우리" onClick={() => router.push("/plants")} />
            <StatCard label="진행 중인 일정"   value={summary?.active_schedules     ?? 0} accent="positive" sub="활성 봉우리" onClick={() => router.push("/calendar")} />
            <StatCard label="이번 달 수확"    value={summary?.harvested_this_month ?? 0} accent="positive" sub="완료된 봉우리" />
            <StatCard label="주의 필요"      value={summary?.wilting_count        ?? 0} accent="warning"  sub="시들고 있는 봉우리" onClick={() => openWith()} />
          </>
        )}
      </section>

      {/* Plants */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 className="t-h1" style={{ color: "var(--fg)" }}>식물 관리 보드</h2>
            <p className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 2 }}>
              {plants.length}개 분야 · {activeBudCount}개 진행 중
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/plants")}>
            정원 전체 보기 →
          </button>
        </div>

        {loadingPlants ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <PlantCardSkeleton /><PlantCardSkeleton /><PlantCardSkeleton />
            <PlantCardSkeleton /><PlantCardSkeleton /><PlantCardSkeleton />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="stagger">
            {plants.slice(0, 5).map((p) => (
              <PlantCard
                key={p.id}
                plant={p}
                buds={budsByPlant.get(p.id) ?? []}
                onClick={() => router.push(`/plants/${p.id}`)}
                onChat={() => openWith({ kind: "plant", id: p.id })}
              />
            ))}
            <NewPlantCTA onClick={() => openWith()} />
          </div>
        )}
      </section>

      {/* Wilting */}
      {wilting.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h2 className="t-h2" style={{ color: "var(--fg)" }}>주의가 필요한 봉우리</h2>
            <span className="badge badge-warning">{wilting.length}</span>
          </div>
          <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {wilting.slice(0, 6).map((b) => (
              <WiltingRow key={b.id} bud={b} onChat={() => openWith({ kind: "bud", id: b.id })} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
