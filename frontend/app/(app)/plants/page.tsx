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

// ── Garden pixel assets (Figma 05 Plant Pixel Assets) ──────

const PLANT_W = 178;
const POT_H = 46;
const LAYER_H = 64;
const BOARD_MIN_W = 1800;
const BOARD_MIN_H = 1160;
const GARDEN_BASELINE = 696;
const VIEWPORT_GROUND_ROOM = 240;
const FOREGROUND_GRASS_H = 120;

const PIXEL = {
  stem: "#4D8542",
  leaf: "#75A859",
  leafLight: "#9CCB8C",
  budUpper: "#C8D96B",
  budTip: "#DDE8A2",
  budSepalLeft: "#9FC45D",
  budSepalRight: "#8FB655",
  budSepalCenter: "#6FA04D",
  potLip: "#735740",
  potBody: "#8A694F",
  flower: "#ED708C",
  flowerCenter: "#F7C740",
  fruit: "#E05A2E",
  fruitShine: "#FFB26B",
  rot: "#94482B",
  rotBruise: "#2E1F14",
  wiltStem: "#7A6D55",
  wiltLeaf: "#A5946D",
};

function Pixel({ x, y, w, h, color, radius = 0 }: {
  x: number; y: number; w: number; h: number; color: string; radius?: number;
}) {
  return <span style={{ position: "absolute", left: x, top: y, width: w, height: h, background: color, borderRadius: radius }} />;
}

function GrowthLayer({ bud, index }: { bud: Bud; index: number }) {
  const status = bud.status;
  const stem = status === "wilting" || status === "rot" ? PIXEL.wiltStem : PIXEL.stem;
  const leaf = status === "wilting" || status === "rot" ? PIXEL.wiltLeaf : PIXEL.leaf;
  const flip = index % 2 === 1;

  return (
    <div title={bud.title} style={{ position: "absolute", left: 0, bottom: POT_H + index * LAYER_H, width: PLANT_W, height: LAYER_H }}>
      <Pixel x={84} y={0} w={12} h={64} color={stem} />
      <Pixel x={flip ? 94 : 52} y={34} w={34} h={16} color={leaf} />
      <Pixel x={flip ? 52 : 96} y={22} w={36} h={16} color={leaf} />

      {(status === "seed" || status === "bud") && <>
        <Pixel x={79} y={0} w={22} h={18} color={PIXEL.budUpper} />
        <Pixel x={83} y={-10} w={14} h={10} color={PIXEL.budTip} />
        <Pixel x={75} y={10} w={8} h={14} color={PIXEL.budSepalLeft} />
        <Pixel x={101} y={10} w={8} h={14} color={PIXEL.budSepalRight} />
        <Pixel x={83} y={18} w={14} h={12} color={PIXEL.budSepalCenter} />
      </>}
      {status === "flower" && <>
        <Pixel x={83} y={0} w={14} h={16} color={PIXEL.flower} />
        <Pixel x={67} y={16} w={16} h={14} color={PIXEL.flower} />
        <Pixel x={97} y={16} w={16} h={14} color={PIXEL.flower} />
        <Pixel x={83} y={30} w={14} h={16} color={PIXEL.flower} />
        <Pixel x={83} y={16} w={14} h={14} color={PIXEL.flowerCenter} />
      </>}
      {status === "fruit" && <>
        <Pixel x={57} y={25} w={18} h={18} color={PIXEL.fruit} />
        <Pixel x={108} y={13} w={20} h={20} color={PIXEL.fruit} />
        <Pixel x={61} y={29} w={6} h={6} color={PIXEL.fruitShine} />
        <Pixel x={112} y={17} w={6} h={6} color={PIXEL.fruitShine} />
      </>}
      {status === "rot" && <>
        <Pixel x={105} y={17} w={24} h={22} color={PIXEL.rot} />
        <Pixel x={109} y={21} w={8} h={8} color={PIXEL.rotBruise} />
        <Pixel x={121} y={31} w={6} h={6} color={PIXEL.rotBruise} />
      </>}
      {status === "wilting" && <>
        <Pixel x={92} y={2} w={24} h={10} color={PIXEL.wiltLeaf} />
        <Pixel x={108} y={10} w={10} h={20} color={PIXEL.wiltStem} />
      </>}
    </div>
  );
}

function PixelPlant({ buds }: { buds: Bud[] }) {
  return (
    <div style={{ position: "relative", width: PLANT_W, height: POT_H + Math.max(1, buds.length) * LAYER_H, imageRendering: "pixelated" }}>
      {buds.map((bud, index) => <GrowthLayer key={bud.id} bud={bud} index={index} />)}
      {buds.length === 0 && <GrowthLayer bud={{ id: "empty", plant_id: "", title: "새싹", detail: "", type: "concern", status: "harvested", progress: 0, deadline: null, last_progress_at: null, disappeared_at: null, created_at: "" }} index={0} />}
      <Pixel x={50} y={POT_H + Math.max(1, buds.length) * LAYER_H - POT_H} w={70} h={18} color={PIXEL.potLip} />
      <Pixel x={60} y={POT_H + Math.max(1, buds.length) * LAYER_H - 28} w={50} h={28} color={PIXEL.potBody} />
    </div>
  );
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

function GardenPlant({ plant, buds, selected, onSelect, onDetail, onChat }: {
  plant: Plant; buds: Bud[]; selected: boolean;
  onSelect: () => void; onDetail: () => void; onChat: () => void;
}) {
  const visibleBuds = buds
    .filter((bud) => !bud.disappeared_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const status = dominantStatus(visibleBuds);

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
      <PixelPlant buds={visibleBuds} />

      <div style={{
        width: 194, minHeight: 78, marginTop: 12, padding: "11px 12px 9px",
        borderRadius: 14, border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.92)", boxShadow: "0 8px 9px rgba(20,26,15,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <strong style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#3D4A2A", fontSize: 15 }}>{plant.name}</strong>
          <span className={STATUS_PILL[status]} style={{ flexShrink: 0 }}>{STATUS_LABEL[status]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 5 }}>
          <span style={{ color: "#577054", fontSize: 12 }}>{visibleBuds.length}개 봉우리</span>
          <span style={{ display: "flex", gap: 3 }}>
            <button className="btn btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); onDetail(); }} style={{ padding: "0 5px" }}>상세</button>
            <button className="btn btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); onChat(); }} style={{ padding: "0 5px" }}>상담</button>
          </span>
        </div>
      </div>
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

// ── Page ───────────────────────────────────────────────────

export default function PlantsPage() {
  const router = useRouter();
  const { openWith, scope } = useChatStore();
  const { accessToken } = useAuthStore();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [view, setView] = useState<ViewMode>("garden");
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const boardWidth = Math.max(BOARD_MIN_W, filtered.length * 256 + 450);
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
  const skyExtension = Math.max(0, 220 + maxVisibleBuds * LAYER_H - GARDEN_BASELINE);
  const gardenBaseline = GARDEN_BASELINE + skyExtension;
  const boardHeight = BOARD_MIN_H + skyExtension;
  const scopeSelectedIdx = scope.kind === "plant" && scope.id ? filtered.findIndex((plant) => plant.id === scope.id) : -1;
  const effectiveSelectedIdx = scopeSelectedIdx >= 0
    ? scopeSelectedIdx
    : Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  // 상태만 업데이트 — 스크롤은 아래 effect가 처리
  const navigate = useCallback((dir: number) => {
    setSelectedIdx(prev => Math.max(0, Math.min(filtered.length - 1, prev + dir)));
  }, [filtered.length]);

  // selectedIdx가 바뀐 뒤(React 재렌더 완료 후) 스크롤 — setTimeout 불필요
  useEffect(() => {
    if (view !== "garden") return;
    const viewport = scrollRef.current;
    const el = viewport?.querySelector<HTMLElement>(`[data-garden-plant="${effectiveSelectedIdx}"]`);
    if (!viewport || !el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    viewport.scrollTo({
      top: Math.max(0, gardenBaseline - viewport.clientHeight + VIEWPORT_GROUND_ROOM),
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
            position: "relative", width: boardWidth, height: boardHeight,
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
              const plantHeight = POT_H + Math.max(1, visibleBudCount) * LAYER_H;
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
