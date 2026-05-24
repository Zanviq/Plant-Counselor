"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listPlants, Plant } from "@/lib/api/plants";
import { listBuds, Bud } from "@/lib/api/buds";
import { useChatStore } from "@/lib/store/chatStore";
import { STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, dominantStatus, isActive, BudStatus } from "@/lib/status";

// ── Sprite constants (from manifest.json v5) ───────────────

const S = "/sprites";
const PLANT_IMG = { file: `${S}/plant.png`, w: 140, h: 240 };
const SLOTS = [
  { x: 28, y: 12 }, { x: 108, y: 12 },
  { x: 20, y: 56 }, { x: 116, y: 56 },
  { x: 32, y: 108 }, { x: 104, y: 108 },
];
const MAX_BUDS = 6;

interface BudMeta { file: string; w: number; h: number; ax: number; ay: number }
// anchor = center of each bud image, so the bud sits centered on the slot point
const BUD_SPRITES: Record<string, BudMeta> = {
  seed:      { file: `${S}/bud_seed.png`,      w: 20, h: 28, ax: 10, ay: 14 },
  sprout:    { file: `${S}/bud_sprout.png`,     w: 36, h: 28, ax: 18, ay: 14 },
  flower:    { file: `${S}/bud_flower.png`,     w: 36, h: 32, ax: 18, ay: 16 },
  fruit:     { file: `${S}/bud_fruit.png`,      w: 28, h: 32, ax: 14, ay: 16 },
  wilted:    { file: `${S}/bud_wilted.png`,     w: 28, h: 24, ax: 14, ay: 12 },
  harvested: { file: `${S}/bud_harvested.png`,  w: 28, h: 20, ax: 14, ay: 10 },
};
const STATUS_MAP: Record<string, string> = {
  seed: "seed", bud: "sprout", flower: "flower", fruit: "fruit",
  wilting: "wilted", rot: "wilted", harvested: "harvested",
};

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
  const activeBuds = buds.filter(b => !b.disappeared_at).slice(0, MAX_BUDS);
  const scale = 1.1; // display scale
  const w = PLANT_IMG.w * scale;
  const h = PLANT_IMG.h * scale;

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        cursor: "pointer", flexShrink: 0,
        transition: "transform 0.3s ease",
        transform: selected ? "scale(1.08)" : "scale(0.92)",
        opacity: selected ? 1 : 0.7,
        filter: selected ? "none" : "brightness(0.92)",
      }}
    >
      <div style={{ position: "relative", width: w, height: h, imageRendering: "pixelated" }}>
        {/* Plant composite (stem+leaves+pot) */}
        <img src={PLANT_IMG.file} alt={plant.name} width={w} height={h}
          style={{ imageRendering: "pixelated", display: "block" }} draggable={false} />

        {/* Buds at slot positions */}
        {activeBuds.map((bud, i) => {
          const slot = SLOTS[i];
          if (!slot) return null;
          const sprKey = STATUS_MAP[bud.status] ?? "seed";
          const meta = BUD_SPRITES[sprKey];
          if (!meta) return null;
          const bx = slot.x * scale - meta.ax * scale;
          const by = slot.y * scale - meta.ay * scale;
          return (
            <div key={bud.id} title={bud.title} style={{
              position: "absolute", left: bx, top: by,
              width: meta.w * scale, height: meta.h * scale,
              zIndex: 3, cursor: "pointer",
            }}>
              <img src={meta.file} alt={bud.title}
                width={meta.w * scale} height={meta.h * scale}
                style={{ imageRendering: "pixelated", display: "block" }} draggable={false} />
              <span className="bud-tooltip" style={{
                position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                background: "var(--fg)", color: "var(--bg-elevated)",
                fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                padding: "3px 8px", borderRadius: 5, pointerEvents: "none",
                marginBottom: 4, boxShadow: "var(--shadow-md)",
              }}>{bud.title}</span>
            </div>
          );
        })}
      </div>

      {/* Label + actions — z-index above ground layers */}
      <div style={{ textAlign: "center", marginTop: 6, position: "relative", zIndex: 10 }}>
        <div className="t-h3" style={{ color: selected ? "var(--fg)" : "var(--fg-muted)" }}>{plant.name}</div>
        <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>{activeBuds.length}개 봉우리</div>
        {selected && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onDetail(); }}>상세</button>
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); onChat(); }}>상담</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toggles ────────────────────────────────────────────────

type ViewMode = "garden" | "list";

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
  const { openWith } = useChatStore();
  const [view, setView] = useState<ViewMode>("garden");
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: plantsRes } = useQuery({ queryKey: ["plants", {}], queryFn: () => listPlants() });
  const { data: budsRes }   = useQuery({ queryKey: ["buds", {}], queryFn: () => listBuds() });

  const plants = plantsRes?.ok ? plantsRes.data.items : [];
  const allBuds = budsRes?.ok ? budsRes.data.items : [];
  const budsByPlant = useMemo(() => {
    const m = new Map<string, Bud[]>();
    for (const b of allBuds) { const a = m.get(b.plant_id) ?? []; a.push(b); m.set(b.plant_id, a); }
    return m;
  }, [allBuds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? plants.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : [...plants];
  }, [plants, query]);

  const activeCount = allBuds.filter(b => isActive(b.status)).length;

  const navigate = useCallback((dir: number) => {
    setSelectedIdx(prev => {
      const next = Math.max(0, Math.min(filtered.length - 1, prev + dir));
      setTimeout(() => {
        const el = scrollRef.current?.children[next] as HTMLElement | undefined;
        el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 50);
      return next;
    });
  }, [filtered.length]);

  useEffect(() => {
    if (view !== "garden") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(1); }
      if (e.key === "Enter" && filtered[selectedIdx]) { e.preventDefault(); router.push(`/plants/${filtered[selectedIdx].id}`); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, navigate, filtered, selectedIdx, router]);

  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIdx]);

  return (
    <div style={{ padding: "32px 36px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <header className="animate-in" style={{ marginBottom: 18 }}>
        <h1 className="t-display" style={{ color: "var(--fg)" }}>정원</h1>
        <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>{plants.length}개 분야 · {activeCount}개 진행 중</p>
      </header>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ViewToggle current={view} onChange={setView} />
          {view === "list" && <input className="input" placeholder="식물 검색" value={query} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 240 }} />}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openWith()}>+ AI와 식물 만들기</button>
      </div>

      {/* Empty */}
      {plants.length === 0 && (
        <div className="card" style={{ padding: "56px 32px", textAlign: "center", background: "var(--bg-subtle)", border: "1px dashed var(--border-strong)" }}>
          <h2 className="t-h1" style={{ color: "var(--fg)", marginBottom: 8 }}>정원이 비어 있어요</h2>
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginBottom: 20 }}>AI 정원사에게 말해보세요.</p>
          <button className="btn btn-primary btn-lg" onClick={() => openWith()}>AI와 시작하기</button>
        </div>
      )}

      {/* Garden view — inside a card with sky background */}
      {plants.length > 0 && view === "garden" && (
        <div className="card" style={{
          padding: 0, overflow: "hidden", position: "relative",
          borderRadius: "var(--r-xl)", minHeight: 480,
        }}>
          {/* Sky background */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${S}/sky.png)`,
            backgroundSize: "cover", backgroundPosition: "center bottom",
            zIndex: 0,
          }} />

          {/* Navigation arrows */}
          {filtered.length > 1 && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 10, display: "flex", gap: 8, alignItems: "center",
              background: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)",
              padding: "4px 12px", borderRadius: "var(--r-pill)",
            }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ padding: "0 6px", fontSize: 16 }}>‹</button>
              <span className="t-caption" style={{ color: "var(--fg-secondary)", fontWeight: 600 }}>{selectedIdx + 1} / {filtered.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(1)} style={{ padding: "0 6px", fontSize: 16 }}>›</button>
            </div>
          )}

          {/* Scrollable plant row */}
          <div ref={scrollRef} style={{
            flex: 1, display: "flex", alignItems: "flex-end",
            justifyContent: filtered.length <= 3 ? "center" : "flex-start",
            gap: 64, padding: "48px 80px 100px",
            overflowX: "auto", overflowY: "hidden",
            scrollSnapType: "x mandatory", scrollbarWidth: "none",
            position: "relative", zIndex: 2,
          }}>
            {filtered.map((plant, i) => (
              <div key={plant.id} style={{ scrollSnapAlign: "center", flexShrink: 0 }}>
                <GardenPlant
                  plant={plant}
                  buds={budsByPlant.get(plant.id) ?? []}
                  selected={selectedIdx === i}
                  onSelect={() => selectedIdx === i ? router.push(`/plants/${plant.id}`) : setSelectedIdx(i)}
                  onDetail={() => router.push(`/plants/${plant.id}`)}
                  onChat={() => openWith({ kind: "plant", id: plant.id })}
                />
              </div>
            ))}
          </div>

          {/* Grass + soil — absolute at bottom so they don't push buttons out */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 52, zIndex: 1,
            pointerEvents: "none",
          }}>
            <div style={{
              height: 32,
              backgroundImage: `url(${S}/grass.png)`,
              backgroundRepeat: "repeat-x", backgroundSize: "auto 32px",
              backgroundPosition: "bottom", imageRendering: "pixelated",
            }} />
            <div style={{
              height: 20,
              background: "linear-gradient(180deg, #7AB050 0%, #5A8A30 50%, #4A7228 100%)",
            }} />
          </div>
        </div>
      )}

      {/* List view */}
      {plants.length > 0 && view === "list" && (
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
