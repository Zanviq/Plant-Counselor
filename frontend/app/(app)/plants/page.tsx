"use client";

import { useMemo, useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listPlants, Plant } from "@/lib/api/plants";
import { listBuds, Bud } from "@/lib/api/buds";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, dominantStatus, isActive, BudStatus } from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { GardenSkeleton, PlantCardSkeleton } from "@/components/ui/Skeleton";
import { GardenPlantVisual, LAYER_H, POT_H } from "@/components/plants/GardenPlantVisual";

// ── Garden pixel assets (Figma 05 Plant Pixel Assets) ──────

const BOARD_MIN_W = 1800;
const BOARD_MIN_H = 1160;
const GARDEN_BASELINE = 696;
const VIEWPORT_GROUND_ROOM = 240;
const FOREGROUND_GRASS_H = 120;
const GARDEN_ZOOM_MIN = 0.5;
const GARDEN_ZOOM_MAX = 2;
const GARDEN_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function clampGardenZoom(zoom: number) {
  return Math.min(GARDEN_ZOOM_MAX, Math.max(GARDEN_ZOOM_MIN, zoom));
}

// ── Status bar (list view) ─────────────────────────────────

const STATUS_ORDER: BudStatus[] = ["seed","bud","flower","fruit","wilting","harvested","rot"];

function StatusBar({ buds }: { buds: Bud[] }) {
  const counts = STATUS_ORDER.map(s => buds.filter(b => b.status === s).length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return <div className="progress-track" style={{ background: "var(--bg-muted)" }} />;
  return (
    <div style={{ display: "flex", height: 4, borderRadius: 999, overflow: "hidden", background: "var(--bg-muted)" }}>
      {STATUS_ORDER.map((s, i) => counts[i] > 0 && <div key={s} title={`${STATUS_LABEL[s]} ${counts[i]}`} style={{ flex: counts[i], background: STATUS_COLOR_VAR[s] }} />)}
    </div>
  );
}

// ── List view card ─────────────────────────────────────────

function PlantCard({ plant, buds, onClick, onChat }: { plant: Plant; buds: Bud[]; onClick: () => void; onChat: () => void }) {
  const active = buds.filter(b => isActive(b.status));
  const avg = active.length ? Math.round(active.reduce((s, b) => s + b.progress, 0) / active.length) : 0;
  const dom = dominantStatus(active);
  return (
    <div className="card card-hover" style={{ padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 14 }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h2" style={{ color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plant.name}</div>
          <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 3 }}>{plant.description || "..."}</div>
        </div>
        {active.length > 0 && <span className={STATUS_PILL[dom]}><span className="pill-dot" style={{ background: "currentColor" }} />{STATUS_LABEL[dom]}</span>}
      </div>
      <StatusBar buds={buds} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="t-caption" style={{ color: "var(--fg-muted)" }}>{avg}% · {active.length}개 활성</span>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onChat(); }}>상담</button>
      </div>
    </div>
  );
}

// ── Garden plant composite ─────────────────────────────────

function GardenPlant({ plant, buds, selected, onSelect, onDetail, onChat, onBudClick }: {
  plant: Plant; buds: Bud[]; selected: boolean;
  onSelect: () => void; onDetail: () => void; onChat: () => void;
  onBudClick: (budId: string) => void;
}) {
  const visibleBuds = buds
    .filter((bud) => !bud.disappeared_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div
      onClick={onSelect}
      style={{
        position: "relative", width: 210, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        transition: "transform 0.18s ease, filter 0.18s ease",
        transform: selected ? "translateY(-8px)" : "none",
        filter: selected ? "drop-shadow(0 10px 10px rgba(30, 48, 24, 0.12))" : "none",
      }}
    >
      <GardenPlantVisual
        name={plant.name}
        buds={visibleBuds}
        onBudClick={onBudClick}
        actions={<>
            <button className="btn btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); onDetail(); }} style={{ padding: "0 5px" }}>상세</button>
            <button className="btn btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); onChat(); }} style={{ padding: "0 5px" }}>상담</button>
        </>}
      />
    </div>
  );
}

// ── Toggles ────────────────────────────────────────────────

type ViewMode = "garden" | "list";

const subscribeHydration = () => () => {};

function ViewToggle({ current, onChange }: { current: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div style={{ display: "inline-flex", padding: 2, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
      {([{ key: "garden" as const, label: "정원" }, { key: "list" as const, label: "리스트" }]).map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          padding: "5px 12px", border: "none", background: current === o.key ? "var(--bg-elevated)" : "transparent",
          color: current === o.key ? "var(--fg)" : "var(--fg-muted)", fontSize: 12, fontWeight: 500,
          borderRadius: "var(--r-sm)", cursor: "pointer", boxShadow: current === o.key ? "var(--shadow-xs)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function GardenZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const changeBy = (direction: -1 | 1) => {
    const levels = direction > 0 ? GARDEN_ZOOM_LEVELS : [...GARDEN_ZOOM_LEVELS].reverse();
    const next = levels.find((level) => direction > 0 ? level > zoom + 0.001 : level < zoom - 0.001);
    onChange(next ?? (direction > 0 ? GARDEN_ZOOM_MAX : GARDEN_ZOOM_MIN));
  };

  return (
    <div
      aria-label="정원 확대 축소"
      style={{
        display: "inline-flex", alignItems: "center", gap: 2, padding: 2,
        border: "1px solid var(--border)", borderRadius: "var(--r-md)",
        background: "rgba(255,255,255,0.94)", boxShadow: "var(--shadow-sm)",
      }}
    >
      <button
        type="button"
        aria-label="정원 축소"
        disabled={zoom <= GARDEN_ZOOM_MIN}
        onClick={() => changeBy(-1)}
        className="btn btn-ghost btn-sm"
        style={{ width: 28, padding: 0, fontSize: 18 }}
      >-</button>
      <button
        type="button"
        aria-label="정원 배율 초기화"
        title="100%로 초기화"
        onClick={() => onChange(1)}
        className="btn btn-ghost btn-sm"
        style={{ width: 48, padding: 0, fontSize: 11, fontVariantNumeric: "tabular-nums" }}
      >{Math.round(zoom * 100)}%</button>
      <button
        type="button"
        aria-label="정원 확대"
        disabled={zoom >= GARDEN_ZOOM_MAX}
        onClick={() => changeBy(1)}
        className="btn btn-ghost btn-sm"
        style={{ width: 28, padding: 0, fontSize: 18 }}
      >+</button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function PlantsPage() {
  const router = useRouter();
  const { openWith, scope } = useChatStore();
  const { accessToken } = useAuthStore();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [view, setView] = useState<ViewMode>("garden");
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [gardenZoom, setGardenZoom] = useState(1);
  const [gardenViewport, setGardenViewport] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const gardenZoomRef = useRef(gardenZoom);
  const pendingZoomScrollRef = useRef<{
    contentX: number; contentY: number; viewportX: number; viewportY: number;
  } | null>(null);

  const queryEnabled = hydrated && !!accessToken;
  const { data: plantsRes, isLoading } = useQuery({ queryKey: QK.plants(), queryFn: () => listPlants(), enabled: queryEnabled });
  const { data: budsRes }              = useQuery({ queryKey: QK.buds(),   queryFn: () => listBuds(),   enabled: queryEnabled });
  const showLoading = !queryEnabled || isLoading;

  const plants = useMemo(() => plantsRes?.ok ? plantsRes.data.items : [], [plantsRes]);
  const allBuds = useMemo(() => budsRes?.ok ? budsRes.data.items : [], [budsRes]);
  const budsByPlant = useMemo(() => {
    const m = new Map<string, Bud[]>();
    for (const b of allBuds) { const a = m.get(b.plant_id) ?? []; a.push(b); m.set(b.plant_id, a); }
    return m;
  }, [allBuds]);

  const orderedPlants = useMemo(
    () => [...plants].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [plants],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? orderedPlants.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : orderedPlants;
  }, [orderedPlants, query]);

  const activeCount = allBuds.filter(b => isActive(b.status)).length;
  const maxVisibleBuds = Math.max(1, ...filtered.map((plant) => (budsByPlant.get(plant.id) ?? []).filter((bud) => !bud.disappeared_at).length));
  // Include the add-card and a calm right margin inside the painted field.
  // Otherwise the card extends past the board background and exposes a hard edge.
  const boardMinWidth = Math.max(BOARD_MIN_W, filtered.length * 256 + 450);
  const skyExtension = Math.max(0, 220 + maxVisibleBuds * LAYER_H - GARDEN_BASELINE);
  const gardenBaseline = GARDEN_BASELINE + skyExtension;
  const boardMinHeight = BOARD_MIN_H + skyExtension;
  // Keep the painted field at least as large as the viewport after scaling.
  // Otherwise a zoomed-out empty garden exposes the plain viewport background.
  const boardWidth = Math.max(boardMinWidth, gardenViewport.width / gardenZoom);
  const boardHeight = Math.max(boardMinHeight, gardenViewport.height / gardenZoom);
  const grassTufts = Array.from({ length: Math.ceil(boardWidth / 72) + 1 }, (_, index) => ({
    left: 28 + index * 72,
    top: 736 + (index % 3) * 8,
    height: 18 + (index % 5) * 5,
    color: index % 2 === 0 ? "#D7E8B2" : "#8BB463",
  })).filter((tuft) => tuft.left + 38 <= boardWidth);
  const groundShadows = Array.from({ length: Math.ceil(boardWidth / 226) }, (_, index) => ({
    left: 76 + index * 226,
    top: 912 + (index % 3) * 18,
  })).filter((shadow) => shadow.left + 154 <= boardWidth);
  const scopeSelectedIdx = scope.kind === "plant" && scope.id ? filtered.findIndex((plant) => plant.id === scope.id) : -1;
  const effectiveSelectedIdx = scopeSelectedIdx >= 0
    ? scopeSelectedIdx
    : Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  // 상태만 업데이트 — 스크롤은 아래 effect가 처리
  const navigate = useCallback((dir: number) => {
    setSelectedIdx(prev => Math.max(0, Math.min(filtered.length - 1, prev + dir)));
  }, [filtered.length]);

  const updateGardenZoom = useCallback((nextZoom: number, focalPoint?: { x: number; y: number }) => {
    const viewport = scrollRef.current;
    const currentZoom = gardenZoomRef.current;
    const clampedZoom = clampGardenZoom(nextZoom);
    if (Math.abs(clampedZoom - currentZoom) < 0.001) return;

    if (viewport) {
      const viewportX = focalPoint?.x ?? viewport.clientWidth / 2;
      const viewportY = focalPoint?.y ?? viewport.clientHeight / 2;
      pendingZoomScrollRef.current = {
        contentX: (viewport.scrollLeft + viewportX) / currentZoom,
        contentY: (viewport.scrollTop + viewportY) / currentZoom,
        viewportX,
        viewportY,
      };
    }

    gardenZoomRef.current = clampedZoom;
    setGardenZoom(clampedZoom);
  }, []);

  useEffect(() => {
    if (view !== "garden" || showLoading) return;
    const viewport = scrollRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setGardenViewport((current) => current.width === width && current.height === height
        ? current
        : { width, height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [showLoading, view]);

  useEffect(() => {
    if (view !== "garden" || showLoading) return;
    const viewport = scrollRef.current;
    if (!viewport) return;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      updateGardenZoom(
        gardenZoomRef.current * Math.exp(-event.deltaY * 0.01),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
      );
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [showLoading, updateGardenZoom, view]);

  useEffect(() => {
    const viewport = scrollRef.current;
    const pending = pendingZoomScrollRef.current;
    if (!viewport || !pending) return;
    pendingZoomScrollRef.current = null;
    viewport.scrollTo({
      left: Math.max(0, pending.contentX * gardenZoom - pending.viewportX),
      top: Math.max(0, pending.contentY * gardenZoom - pending.viewportY),
    });
  }, [gardenZoom]);

  // selectedIdx가 바뀐 뒤(React 재렌더 완료 후) 스크롤 — setTimeout 불필요
  useEffect(() => {
    if (view !== "garden") return;
    const viewport = scrollRef.current;
    const el = viewport?.querySelector<HTMLElement>(`[data-garden-plant="${effectiveSelectedIdx}"]`);
    if (!viewport) return;
    viewport.scrollTo({
      left: el
        ? Math.max(0, (el.offsetLeft + el.offsetWidth / 2) * gardenZoomRef.current - viewport.clientWidth / 2)
        : viewport.scrollLeft,
      top: Math.max(0, gardenBaseline * gardenZoomRef.current - viewport.clientHeight + VIEWPORT_GROUND_ROOM),
      behavior: "smooth",
    });
  }, [effectiveSelectedIdx, filtered.length, gardenBaseline, view]);

  // 현재 선택값을 ref로 유지해 키보드 핸들러에서 stale closure 방지
  const selectedIdxRef = useRef(effectiveSelectedIdx);
  useEffect(() => { selectedIdxRef.current = effectiveSelectedIdx; }, [effectiveSelectedIdx]);

  useEffect(() => {
    if (view !== "garden") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(1); }
      if (e.key === "Enter") {
        const plant = filtered[selectedIdxRef.current];
        if (plant) { e.preventDefault(); router.push(`/plants/${plant.id}`); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, navigate, filtered, router]);

  return (
    <div style={view === "garden"
      ? { position: "relative", height: "100vh", overflow: "hidden" }
      : { padding: "32px 36px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <header className="animate-in" style={view === "garden" ? {
        position: "absolute", top: 22, left: 24, zIndex: 5,
        width: 262, padding: "9px 15px 10px", borderRadius: 12,
        border: "1px solid var(--border)", background: "rgba(255,255,255,0.94)",
      } : { marginBottom: 18 }}>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>정원</h1>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>{plants.length}개 분야 · {activeCount}개 진행 중</p>
      </header>

      {/* Toolbar */}
      <div style={view === "garden" ? {
        position: "absolute", top: 110, left: 24, zIndex: 5,
      } : { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <ViewToggle current={view} onChange={setView} />
        {view === "list" && <input className="input" placeholder="식물 검색" value={query} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 240 }} />}
      </div>

      {view === "garden" && (
        <div style={{ position: "absolute", right: 24, bottom: 24, zIndex: 5 }}>
          <GardenZoomControl zoom={gardenZoom} onChange={updateGardenZoom} />
        </div>
      )}

      {/* Loading skeleton */}
      {showLoading && (
        <div>
          {view === "garden" ? (
            <GardenSkeleton />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              <PlantCardSkeleton /><PlantCardSkeleton /><PlantCardSkeleton />
              <PlantCardSkeleton /><PlantCardSkeleton /><PlantCardSkeleton />
            </div>
          )}
        </div>
      )}

      {/* Empty list view */}
      {!showLoading && plants.length === 0 && view === "list" && (
        <div className="card" style={{ padding: "56px 32px", textAlign: "center", background: "var(--bg-subtle)", border: "1px dashed var(--border-strong)" }}>
          <h2 className="t-h1" style={{ color: "var(--fg)", marginBottom: 8 }}>정원이 비어 있어요</h2>
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginBottom: 20 }}>AI 정원사에게 말해보세요.</p>
          <button className="btn btn-primary btn-lg" onClick={() => openWith()}>AI와 시작하기</button>
        </div>
      )}

      {/* Garden view — Figma-style bidirectional field */}
      {!showLoading && view === "garden" && (
        <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflow: "auto", background: "#E6F3E8" }}>
          <div style={{
            position: "relative", width: boardWidth * gardenZoom, height: boardHeight * gardenZoom,
          }}>
            <div style={{
              position: "relative", width: boardWidth, height: boardHeight,
              transform: `scale(${gardenZoom})`, transformOrigin: "top left",
              background: "linear-gradient(180deg, #E6F3E8 0%, #F3FAF0 54%, #FCFDF9 100%)",
            }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 688 + skyExtension, height: 118, background: "#D7E8B2" }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: 760 + skyExtension, bottom: 0, background: "#B2CF85" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FOREGROUND_GRASS_H, background: "#8BB463" }} />
              {grassTufts.map((tuft, index) => <span key={`tuft-${index}`} style={{
                position: "absolute", left: tuft.left, top: tuft.top + skyExtension, width: 38, height: tuft.height,
                borderRadius: 10, background: tuft.color,
              }} />)}
              {groundShadows.map((shadow, index) => <span key={`shadow-${index}`} style={{
                position: "absolute", left: shadow.left, top: shadow.top + skyExtension, width: 154, height: 22,
                borderRadius: 999, background: "#68874D",
              }} />)}
              {filtered.map((plant, i) => {
                const plantBuds = budsByPlant.get(plant.id) ?? [];
                const visibleBudCount = plantBuds.filter((bud) => !bud.disappeared_at).length;
                const plantHeight = POT_H + visibleBudCount * LAYER_H;
                return <div key={plant.id} data-garden-plant={i} style={{
                  position: "absolute", left: 80 + i * 256, top: gardenBaseline - plantHeight + (i % 2) * 10,
                }}>
                  <GardenPlant
                    plant={plant}
                    buds={plantBuds}
                    selected={effectiveSelectedIdx === i}
                    onSelect={() => effectiveSelectedIdx === i ? router.push(`/plants/${plant.id}`) : setSelectedIdx(i)}
                    onDetail={() => router.push(`/plants/${plant.id}`)}
                    onChat={() => openWith({ kind: "plant", id: plant.id })}
                    onBudClick={(budId) => router.push(`/plants/${plant.id}?bud=${encodeURIComponent(budId)}`)}
                  />
                </div>;
              })}
              <button type="button" onClick={() => openWith()} style={{
                position: "absolute", left: 80 + filtered.length * 256, top: gardenBaseline - 180,
                width: 210, height: 286, padding: "72px 18px 0", textAlign: "center",
                borderRadius: 18, border: "1px solid var(--border)", background: "rgba(255,255,255,0.72)",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                <div style={{ color: "var(--accent)", fontSize: 34, lineHeight: 1 }}>+</div>
                <strong style={{ display: "block", marginTop: 18, color: "var(--fg)", fontSize: 15 }}>{plants.length === 0 ? "첫 식물 심기" : "새 식물 자리"}</strong>
                <span style={{ display: "block", marginTop: 10, color: "var(--fg-muted)", fontSize: 12, lineHeight: 1.5 }}>{plants.length === 0 ? "AI 정원사와 대화해 첫 고민을 심어보세요." : "고민이 추가되면 이곳에 배치됩니다."}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {!showLoading && plants.length > 0 && view === "list" && (
        <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map(p => (
            <PlantCard key={p.id} plant={p} buds={budsByPlant.get(p.id) ?? []}
              onClick={() => router.push(`/plants/${p.id}`)} onChat={() => openWith({ kind: "plant", id: p.id })} />
          ))}
        </div>
      )}
    </div>
  );
}
