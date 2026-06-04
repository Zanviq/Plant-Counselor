"use client";

import { useMemo, useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listPlants, Plant } from "@/lib/api/plants";
import { listBuds, Bud } from "@/lib/api/buds";
import { getHistory, ConvMessage } from "@/lib/api/conversations";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { MarkdownText } from "@/lib/markdown";
import { AiChatButton } from "@/components/chat/AiChatButton";
import { STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, dominantStatus, isActive, normalizeBudStatus, BudStatus } from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { GardenSkeleton, PlantCardSkeleton } from "@/components/ui/Skeleton";
import { GardenPlantVisual, GardenHarvestBasket, LAYER_H, POT_H, BASKET_VISUAL_H } from "@/components/plants/GardenPlantVisual";
import { BudDetailDrawer } from "@/components/plants/BudDetailDrawer";

// ── Garden pixel assets (Figma 05 Plant Pixel Assets) ──────

const BOARD_MIN_W = 1800;
const BOARD_MIN_H = 1160;
const GARDEN_BASELINE = 696;
const VIEWPORT_GROUND_ROOM = 240;
const FOREGROUND_GRASS_H = 120;
const GARDEN_ZOOM_MIN = 0.5;
const GARDEN_ZOOM_MAX = 2;
const GARDEN_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const GARDEN_PLANT_ROW_OFFSET = 24;

function clampGardenZoom(zoom: number) {
  return Math.min(GARDEN_ZOOM_MAX, Math.max(GARDEN_ZOOM_MIN, zoom));
}

function getGardenPlantRow(index: number) {
  return index % 2;
}

// ── Status bar (list view) ─────────────────────────────────

const STATUS_ORDER: BudStatus[] = ["bud","flower","fruit","wilting","harvested","rot"];

function StatusBar({ buds }: { buds: Bud[] }) {
  const counts = STATUS_ORDER.map(s => buds.filter(b => normalizeBudStatus(b.status) === s).length);
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
  // Harvested fruits move to the basket; rot disappears. Plants show only the
  // living, growing buds.
  const visibleBuds = buds
    .filter((bud) => !bud.disappeared_at && bud.status !== "harvested")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const wilted = plant.status === "wilting";

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
        wilted={wilted}
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

// ── Harvest basket / sidebar / history popup ───────────────

interface HarvestedFruit { bud: Bud; plantId: string; plantName: string }

function FruitGlyph({ size = 22 }: { size?: number }) {
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block" }}>
      <span style={{ position: "absolute", left: 0, top: "10%", width: "100%", height: "90%", borderRadius: "50%", background: "#E05A2E" }} />
      <span style={{ position: "absolute", left: "20%", top: "26%", width: "26%", height: "26%", borderRadius: "50%", background: "#FFB26B" }} />
      <span style={{ position: "absolute", left: "46%", top: "-6%", width: "10%", height: "30%", background: "#4D8542", borderRadius: 2 }} />
    </span>
  );
}

function BasketSidebar({ fruits, plants, selectedPlantIds, setSelectedPlantIds, search, setSearch, onClose, onFruitClick }: {
  fruits: HarvestedFruit[]; plants: Plant[];
  selectedPlantIds: Set<string>; setSelectedPlantIds: (s: Set<string>) => void;
  search: string; setSearch: (s: string) => void;
  onClose: () => void; onFruitClick: (f: HarvestedFruit) => void;
}) {
  const plantsWithFruit = useMemo(() => {
    const ids = new Set(fruits.map((f) => f.plantId));
    return plants.filter((p) => ids.has(p.id));
  }, [fruits, plants]);

  const toggleLabel = (pid: string) => {
    const next = new Set(selectedPlantIds);
    if (next.has(pid)) next.delete(pid); else next.add(pid);
    setSelectedPlantIds(next);
  };

  const q = search.trim().toLowerCase();
  const listed = fruits.filter((f) => {
    if (selectedPlantIds.size > 0 && !selectedPlantIds.has(f.plantId)) return false;
    if (q && !(f.bud.title.toLowerCase().includes(q) || f.plantName.toLowerCase().includes(q) || (f.bud.detail || "").toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 332, zIndex: 7,
      background: "var(--bg-elevated)", borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 24px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14, color: "var(--fg)" }}>수확 바구니 ({fruits.length})</strong>
        <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="닫기">✕</button>
      </div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <input className="input" placeholder="검색 (열매·식물)" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {plantsWithFruit.map((p) => {
            const on = selectedPlantIds.has(p.id);
            return <button key={p.id} onClick={() => toggleLabel(p.id)} style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
              background: on ? "var(--accent-muted)" : "var(--bg-subtle)",
              color: on ? "var(--accent-fg)" : "var(--fg-muted)", fontWeight: on ? 600 : 400,
            }}>{p.name}</button>;
          })}
          {plantsWithFruit.length === 0 && <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>아직 수확한 열매가 없어요.</span>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {listed.length === 0 ? (
          <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            {fruits.length === 0 ? "수확한 열매가 없어요." : "조건에 맞는 열매가 없어요."}
          </div>
        ) : listed.map((f) => (
          <button key={f.bud.id} onClick={() => onFruitClick(f)} style={{
            width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8,
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <FruitGlyph />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.bud.title}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--fg-muted)" }}>{f.plantName}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FruitHistoryPopup({ fruit, onClose }: { fruit: HarvestedFruit; onClose: () => void }) {
  const { accessToken } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["budConvHistory", fruit.bud.id],
    queryFn: () => getHistory("bud", fruit.bud.id, 200),
    enabled: !!accessToken,
  });
  const messages: ConvMessage[] = data?.ok ? data.data.messages.filter((m) => m.role === "user" || m.role === "assistant") : [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: "rgba(20,26,15,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 560, maxWidth: "94vw", maxHeight: "86vh", display: "flex", flexDirection: "column",
        background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.4)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--accent-fg)", fontWeight: 600 }}>{fruit.plantName} · 수확한 열매</div>
              <div className="t-h2" style={{ color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fruit.bud.title}</div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="닫기" style={{ flexShrink: 0 }}>✕</button>
          </div>
          {fruit.bud.detail && <div style={{ marginTop: 6, fontSize: 13, color: "var(--fg-muted)" }}>{fruit.bud.detail}</div>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div className="t-caption" style={{ color: "var(--fg-subtle)", marginBottom: 12 }}>이 고민/일정을 해결해 나가던 과거 기록</div>
          {isLoading && <div style={{ textAlign: "center", padding: 30, color: "var(--fg-muted)" }}>불러오는 중…</div>}
          {!isLoading && messages.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--fg-muted)", fontSize: 13 }}>기록된 대화가 없어요.</div>}
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <div style={{ maxWidth: "82%" }}>
                  <div className="t-caption" style={{ color: "var(--fg-muted)", marginBottom: 3, textAlign: isUser ? "right" : "left", fontWeight: 600 }}>{isUser ? "나" : "AI 정원사"}</div>
                  <div style={{
                    padding: "9px 12px", borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    fontSize: 13.5, lineHeight: 1.55, whiteSpace: isUser ? "pre-wrap" : "normal",
                    background: isUser ? "var(--accent)" : "var(--bg-subtle)",
                    color: isUser ? "var(--accent-contrast)" : "var(--fg)",
                    border: isUser ? "none" : "1px solid var(--border)", overflowWrap: "anywhere",
                  }}>{isUser ? m.text : <MarkdownText text={m.text} />}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--fg-subtle)", textAlign: "center" }}>
          지난 기록 보기 전용 — 추가 대화는 할 수 없어요.
        </div>
      </div>
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
  // Harvest basket / fruit history popup
  const [basketOpen, setBasketOpen] = useState(false);
  const [selectedFruitPlantIds, setSelectedFruitPlantIds] = useState<Set<string>>(new Set());
  const [basketSearch, setBasketSearch] = useState("");
  const [historyFruit, setHistoryFruit] = useState<HarvestedFruit | null>(null);
  const [gardenBudId, setGardenBudId] = useState<string | null>(null);
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

  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  // Harvested fruits collected from every plant — shown in the basket, not on plants.
  const harvestedFruits = useMemo<HarvestedFruit[]>(() =>
    allBuds
      .filter((b) => b.status === "harvested" && !b.disappeared_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((b) => ({ bud: b, plantId: b.plant_id, plantName: plantById.get(b.plant_id)?.name ?? "알 수 없음" })),
    [allBuds, plantById],
  );
  const fruitById = useMemo(() => new Map(harvestedFruits.map((f) => [f.bud.id, f])), [harvestedFruits]);
  const basketFruits = useMemo(
    () => harvestedFruits.map((f) => ({ id: f.bud.id, plantId: f.plantId, plantName: f.plantName, title: f.bud.title })),
    [harvestedFruits],
  );

  const orderedPlants = useMemo(
    () => [...plants].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [plants],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? orderedPlants.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : orderedPlants;
  }, [orderedPlants, query]);

  const activeCount = allBuds.filter(b => isActive(b.status)).length;
  const maxVisibleBuds = Math.max(1, ...filtered.map((plant) => (budsByPlant.get(plant.id) ?? []).filter((bud) => !bud.disappeared_at && bud.status !== "harvested").length));
  // Include the add-card and a calm right margin inside the painted field.
  // Otherwise the card extends past the board background and exposes a hard edge.
  // +1 slot reserved at the far left for the harvest basket.
  const boardMinWidth = Math.max(BOARD_MIN_W, (filtered.length + 1) * 256 + 450);
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
      : undefined}
      className={view === "garden" ? undefined : "app-page app-page-wide"}>
      {/* Header */}
      <header className="animate-in" style={view === "garden" ? {
        position: "absolute", top: 22, left: 24, zIndex: 5,
        width: 262, padding: "9px 15px 10px", borderRadius: 12,
        border: "1px solid var(--border)", background: "rgba(255,255,255,0.94)",
      } : { marginBottom: 18 }}>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>정원</h1>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>{plants.length}개 분야 · {activeCount}개 진행 중</p>
      </header>

      {/* Top-right AI chat button (garden view, like other pages) */}
      {view === "garden" && (
        <AiChatButton style={{ position: "absolute", top: 22, right: 24, zIndex: 6 }} />
      )}

      {/* Toolbar */}
      <div style={view === "garden" ? {
        position: "absolute", top: 110, left: 24, zIndex: 5,
      } : { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <ViewToggle current={view} onChange={setView} />
        {view === "list" && <input className="input" placeholder="식물 검색" value={query} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 240 }} />}
        {view === "list" && <AiChatButton style={{ marginLeft: "auto" }} />}
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
            <div className="responsive-card-grid">
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
        <>
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
              {/* Harvest basket — leftmost slot of the pot row, on the baseline */}
              <div style={{ position: "absolute", left: 80, top: gardenBaseline - BASKET_VISUAL_H, zIndex: 2 }}>
                <GardenHarvestBasket
                  fruits={basketFruits}
                  selectedPlantIds={selectedFruitPlantIds}
                  onOpen={() => setBasketOpen((o) => !o)}
                  onFruitClick={(id) => { const f = fruitById.get(id); if (f) setHistoryFruit(f); }}
                />
              </div>
              {filtered.map((plant, i) => {
                const plantBuds = budsByPlant.get(plant.id) ?? [];
                const visibleBudCount = plantBuds.filter((bud) => !bud.disappeared_at && bud.status !== "harvested").length;
                const plantHeight = POT_H + visibleBudCount * LAYER_H;
                const plantRow = getGardenPlantRow(i);
                return <div key={plant.id} data-garden-plant={i} style={{
                  position: "absolute", left: 80 + (i + 1) * 256,
                  top: gardenBaseline - plantHeight + plantRow * GARDEN_PLANT_ROW_OFFSET,
                  zIndex: effectiveSelectedIdx === i ? 4 : plantRow + 1,
                }}>
                  <GardenPlant
                    plant={plant}
                    buds={plantBuds}
                    selected={effectiveSelectedIdx === i}
                    onSelect={() => effectiveSelectedIdx === i ? router.push(`/plants/${plant.id}`) : setSelectedIdx(i)}
                    onDetail={() => router.push(`/plants/${plant.id}`)}
                    onChat={() => openWith({ kind: "plant", id: plant.id })}
                    onBudClick={(budId) => setGardenBudId(budId)}
                  />
                </div>;
              })}
              <button type="button" onClick={() => openWith()} style={{
                position: "absolute", left: 80 + (filtered.length + 1) * 256, top: gardenBaseline - 180,
                width: 210, height: 286, padding: "72px 18px 0", textAlign: "center",
                borderRadius: 18, border: "1px solid var(--border)", background: "rgba(255,255,255,0.72)",
                cursor: "pointer", fontFamily: "inherit", zIndex: 3,
              }}>
                <div style={{ color: "var(--accent)", fontSize: 34, lineHeight: 1 }}>+</div>
                <strong style={{ display: "block", marginTop: 18, color: "var(--fg)", fontSize: 15 }}>{plants.length === 0 ? "첫 식물 심기" : "새 식물 자리"}</strong>
                <span style={{ display: "block", marginTop: 10, color: "var(--fg-muted)", fontSize: 12, lineHeight: 1.5 }}>{plants.length === 0 ? "AI 정원사와 대화해 첫 고민을 심어보세요." : "고민이 추가되면 이곳에 배치됩니다."}</span>
              </button>
            </div>
          </div>
        </div>
        {basketOpen && (
          <BasketSidebar
            fruits={harvestedFruits}
            plants={orderedPlants}
            selectedPlantIds={selectedFruitPlantIds}
            setSelectedPlantIds={setSelectedFruitPlantIds}
            search={basketSearch}
            setSearch={setBasketSearch}
            onClose={() => setBasketOpen(false)}
            onFruitClick={(f) => setHistoryFruit(f)}
          />
        )}
        {gardenBudId && (
          <BudDetailDrawer
            key={gardenBudId}
            budId={gardenBudId}
            onClose={() => setGardenBudId(null)}
          />
        )}
        </>
      )}

      {/* List view */}
      {!showLoading && plants.length > 0 && view === "list" && (
        <div className="responsive-card-grid stagger">
          {filtered.map(p => (
            <PlantCard key={p.id} plant={p} buds={budsByPlant.get(p.id) ?? []}
              onClick={() => router.push(`/plants/${p.id}`)} onChat={() => openWith({ kind: "plant", id: p.id })} />
          ))}
        </div>
      )}

      {/* Fruit history popup — past records for a harvested bud, read-only */}
      {historyFruit && (
        <FruitHistoryPopup fruit={historyFruit} onClose={() => setHistoryFruit(null)} />
      )}
    </div>
  );
}
