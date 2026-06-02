import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_PILL, dominantStatus, normalizeBudStatus, type BudStatus } from "@/lib/status";

export const PLANT_W = 178;
export const POT_H = 46;
export const LAYER_H = 64;

export type GardenBudVisual = {
  id: string;
  title: string;
  status: string;
};

const PIXEL = {
  stem: "#4D8542",
  leaf: "#75A859",
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
  wiltStem: "#6E4A26",
  wiltLeaf: "#996B3A",
};

// Whole-plant brown cast applied when the plant itself has wilted (plant.status
// === "wilting"). A CSS filter is far simpler than re-coloring every pixel.
const WILTED_PLANT_FILTER = "sepia(0.75) saturate(1.5) hue-rotate(-18deg) brightness(0.82)";

function Pixel({ x, y, w, h, color }: {
  x: number; y: number; w: number; h: number; color: string;
}) {
  return <span style={{ position: "absolute", left: x, top: y, width: w, height: h, background: color }} />;
}

function isGrowthLayerMirrored(bud: GardenBudVisual) {
  let hash = 0;
  for (const char of bud.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (hash & 1) === 1;
}

function getGrowthLayerMirrors(buds: GardenBudVisual[]) {
  let previous: boolean | undefined;
  let runLength = 0;

  return buds.map((bud) => {
    const hashedMirror = isGrowthLayerMirrored(bud);
    const mirror = hashedMirror === previous && runLength >= 3
      ? !hashedMirror
      : hashedMirror;

    runLength = mirror === previous ? runLength + 1 : 1;
    previous = mirror;
    return mirror;
  });
}

function GrowthLayer({ bud, index, layerCount, mirrored, onBudClick }: {
  bud: GardenBudVisual;
  index: number;
  layerCount: number;
  mirrored: boolean;
  onBudClick?: (budId: string) => void;
}) {
  const status = normalizeBudStatus(bud.status);
  const stem = status === "wilting" ? PIXEL.wiltStem
    : PIXEL.stem;
  const leaf = status === "wilting" ? PIXEL.wiltLeaf : PIXEL.leaf;
  const clickable = bud.id !== "empty" && !!onBudClick;

  function selectBud() {
    if (clickable) onBudClick(bud.id);
  }

  return (
    <div
      className="garden-bud-layer"
      role={clickable ? "button" : "img"}
      tabIndex={clickable ? 0 : undefined}
      aria-label={`봉우리: ${bud.title}`}
      onClick={clickable ? (event) => { event.stopPropagation(); selectBud(); } : undefined}
      onKeyDown={clickable ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectBud();
        }
      } : undefined}
      style={{
        position: "absolute", left: 0, bottom: POT_H + index * LAYER_H,
        width: PLANT_W, height: LAYER_H, zIndex: layerCount - index,
        cursor: clickable ? "pointer" : undefined,
      }}
    >
      {bud.id !== "empty" && <span className="garden-bud-tooltip" role="tooltip">{bud.title}</span>}
      <span style={{ position: "absolute", inset: 0, transform: mirrored ? "scaleX(-1)" : undefined }}>
        <Pixel x={84} y={status === "bud" ? 12 : status === "rot" ? -4 : 0} w={12} h={status === "bud" ? 52 : 64} color={stem} />
        <Pixel x={52} y={status === "rot" ? 22 : status === "fruit" ? 25 : 26} w={34} h={16} color={leaf} />
        <Pixel x={96} y={status === "rot" ? 10 : 14} w={36} h={16} color={leaf} />
        {status === "bud" && <>
          <Pixel x={79} y={-10} w={22} h={18} color={PIXEL.budUpper} />
          <Pixel x={83} y={-20} w={14} h={10} color={PIXEL.budTip} />
          <Pixel x={75} y={0} w={8} h={14} color={PIXEL.budSepalLeft} />
          <Pixel x={101} y={0} w={8} h={14} color={PIXEL.budSepalRight} />
          <Pixel x={83} y={8} w={14} h={12} color={PIXEL.budSepalCenter} />
        </>}
        {status === "flower" && <>
          <Pixel x={83} y={-19} w={14} h={16} color={PIXEL.flower} />
          <Pixel x={67} y={-3} w={16} h={14} color={PIXEL.flower} />
          <Pixel x={97} y={-3} w={16} h={14} color={PIXEL.flower} />
          <Pixel x={83} y={11} w={14} h={16} color={PIXEL.flower} />
          <Pixel x={83} y={-3} w={14} h={14} color={PIXEL.flowerCenter} />
        </>}
        {status === "fruit" && <>
          <Pixel x={59} y={7} w={18} h={18} color={PIXEL.fruit} />
          <Pixel x={109} y={-6} w={20} h={20} color={PIXEL.fruit} />
          <Pixel x={63} y={11} w={6} h={6} color={PIXEL.fruitShine} />
          <Pixel x={113} y={-2} w={6} h={6} color={PIXEL.fruitShine} />
        </>}
        {status === "rot" && <>
          <Pixel x={106} y={-4} w={24} h={22} color={PIXEL.rot} />
          <Pixel x={110} y={0} w={8} h={8} color={PIXEL.rotBruise} />
          <Pixel x={122} y={10} w={6} h={6} color={PIXEL.rotBruise} />
        </>}
        {status === "wilting" && <>
          <Pixel x={98} y={-24} w={32} h={12} color={PIXEL.wiltStem} />
          <Pixel x={126} y={-16} w={16} h={12} color={PIXEL.wiltLeaf} />
        </>}
      </span>
    </div>
  );
}

export function GardenPixelPlant({ buds, scale = 1, onBudClick, wilted = false }: {
  buds: GardenBudVisual[];
  scale?: number;
  onBudClick?: (budId: string) => void;
  wilted?: boolean;
}) {
  const height = POT_H + buds.length * LAYER_H;
  const layerMirrors = getGrowthLayerMirrors(buds);

  return (
    <div style={{ width: PLANT_W * scale, height: height * scale }}>
      <div style={{ position: "relative", width: PLANT_W, height, imageRendering: "pixelated", transform: `scale(${scale})`, transformOrigin: "top left", filter: wilted ? WILTED_PLANT_FILTER : undefined }}>
        {buds.map((bud, index) => <GrowthLayer
          key={bud.id}
          bud={bud}
          index={index}
          layerCount={buds.length}
          mirrored={layerMirrors[index]}
          onBudClick={onBudClick}
        />)}
        <Pixel x={50} y={height - POT_H} w={70} h={18} color={PIXEL.potLip} />
        <Pixel x={60} y={height - 28} w={50} h={28} color={PIXEL.potBody} />
      </div>
    </div>
  );
}

export function GardenPlantInfoCard({ name, buds, actions, wilted = false }: {
  name: string;
  buds: GardenBudVisual[];
  actions: ReactNode;
  wilted?: boolean;
}) {
  const status: BudStatus = wilted ? "wilting" : dominantStatus(buds);

  return (
    <div style={{
      width: 194, minHeight: 78, marginTop: 12, padding: "11px 12px 9px",
      borderRadius: 14, border: "1px solid var(--border)",
      background: "rgba(255,255,255,0.92)", boxShadow: "0 8px 9px rgba(20,26,15,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <strong style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#3D4A2A", fontSize: 15 }}>{name}</strong>
        <span className={STATUS_PILL[status]} style={{ flexShrink: 0 }}>{STATUS_LABEL[status]}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 5 }}>
        <span style={{ color: "#577054", fontSize: 12 }}>{buds.length}개 봉우리</span>
        <span style={{ display: "flex", gap: 3 }}>{actions}</span>
      </div>
    </div>
  );
}

export function GardenPlantVisual({ name, buds, actions, onBudClick, wilted = false }: {
  name: string;
  buds: GardenBudVisual[];
  actions: ReactNode;
  onBudClick?: (budId: string) => void;
  wilted?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: 210, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <GardenPixelPlant buds={buds} onBudClick={onBudClick} wilted={wilted} />
      <GardenPlantInfoCard name={name} buds={buds} actions={actions} wilted={wilted} />
    </div>
  );
}

// ── Harvest basket (vector, pixel-art style — striped like a woven basket) ────

export const BASKET_VISUAL_H = 150;

const BASKET = {
  rim: "#B07A41",
  rimLight: "#CD9C5E",
  opening: "#4E331A",
  stripeA: "#C68A4A",
  stripeB: "#9A6A38",
  weave: "#7C5430",
  base: "#6E4A26",
};

export type BasketFruitVisual = { id: string; plantId: string; plantName: string; title: string };

function BasketFruit() {
  return (
    <span style={{ position: "relative", display: "block", width: 24, height: 24, imageRendering: "pixelated" }}>
      <Pixel x={0} y={3} w={24} h={20} color={PIXEL.fruit} />
      <Pixel x={4} y={9} w={16} h={11} color="#EE7A45" />
      <Pixel x={5} y={6} w={5} h={5} color={PIXEL.fruitShine} />
      <Pixel x={11} y={-2} w={3} h={8} color={PIXEL.stem} />
      <Pixel x={13} y={0} w={6} h={4} color={PIXEL.leaf} />
    </span>
  );
}

// Fixed pile positions inside the basket opening (front row drawn in front).
const BASKET_PILE: { x: number; y: number }[] = [
  { x: 44, y: 26 }, { x: 72, y: 28 }, { x: 100, y: 26 }, { x: 122, y: 28 }, // back row
  { x: 30, y: 44 }, { x: 58, y: 46 }, { x: 86, y: 44 }, { x: 114, y: 46 },  // front row
];

function GardenBasketPixels() {
  const height = BASKET_VISUAL_H;
  const BW = 140;
  const cx = (PLANT_W - BW) / 2;          // 19
  const top = height - 86;                // basket starts here (64)
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <>
      {/* rim / opening */}
      <Pixel x={cx - 8} y={top} w={BW + 16} h={14} color={BASKET.rim} />
      <Pixel x={cx - 8} y={top} w={BW + 16} h={4} color={BASKET.rimLight} />
      <Pixel x={cx + 6} y={top + 6} w={BW - 12} h={8} color={BASKET.opening} />
      {/* woven horizontal stripes (tapering body) */}
      {rows.map((r) => {
        const inset = r * 4;
        return <Pixel key={`s${r}`} x={cx + inset} y={top + 14 + r * 11} w={BW - inset * 2} h={11}
          color={r % 2 === 0 ? BASKET.stripeA : BASKET.stripeB} />;
      })}
      {/* vertical weave accents */}
      {[36, 62, 88, 114].map((vx) => (
        <Pixel key={`v${vx}`} x={cx + vx} y={top + 16} w={3} h={56} color={BASKET.weave} />
      ))}
      {/* base shadow */}
      <Pixel x={cx + 24} y={top + 80} w={BW - 48} h={6} color={BASKET.base} />
    </>
  );
}

export function GardenHarvestBasket({ fruits, selectedPlantIds, onOpen, onFruitClick }: {
  fruits: BasketFruitVisual[];
  selectedPlantIds: Set<string>;
  onOpen: () => void;
  onFruitClick: (id: string) => void;
}) {
  const hasFilter = selectedPlantIds.size > 0;
  const shown = fruits.slice(0, BASKET_PILE.length);
  const overflow = fruits.length - shown.length;

  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      title="수확 바구니 열기"
      style={{ position: "relative", width: 210, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={{ position: "relative", width: PLANT_W, height: BASKET_VISUAL_H, imageRendering: "pixelated" }}>
        <GardenBasketPixels />
        {/* fruits actually sitting in the basket */}
        {shown.map((f, i) => {
          const pos = BASKET_PILE[i];
          const dim = hasFilter && !selectedPlantIds.has(f.plantId);
          return (
            <button
              key={f.id}
              onClick={(e) => { e.stopPropagation(); onFruitClick(f.id); }}
              title={`${f.plantName} · ${f.title}`}
              style={{
                position: "absolute", left: pos.x, top: pos.y, width: 24, height: 24,
                border: "none", background: "transparent", padding: 0, cursor: "pointer",
                zIndex: 10 + pos.y, opacity: dim ? 0.3 : 1, transition: "opacity 0.15s",
              }}
            >
              <BasketFruit />
            </button>
          );
        })}
        {overflow > 0 && (
          <span style={{
            position: "absolute", left: PLANT_W - 52, top: 6, zIndex: 200,
            padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: "#5A3A1E", color: "#FCEAD2",
          }}>+{overflow}</span>
        )}
      </div>
      <div style={{
        width: 194, minHeight: 78, marginTop: 12, padding: "11px 12px 9px",
        borderRadius: 14, border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.92)", boxShadow: "0 8px 9px rgba(20,26,15,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <strong style={{ flex: 1, color: "#5A3A1E", fontSize: 15 }}>수확 바구니</strong>
          <span className="pill pill-harvest" style={{ flexShrink: 0 }}>{fruits.length}</span>
        </div>
        <div style={{ marginTop: 5, color: "#577054", fontSize: 12 }}>클릭해 수확한 열매 보기</div>
      </div>
    </div>
  );
}
