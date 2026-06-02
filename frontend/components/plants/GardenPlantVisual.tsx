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
  wiltStem: "#75613D",
  wiltLeaf: "#AD8A4F",
};

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

export function GardenPixelPlant({ buds, scale = 1, onBudClick }: {
  buds: GardenBudVisual[];
  scale?: number;
  onBudClick?: (budId: string) => void;
}) {
  const height = POT_H + buds.length * LAYER_H;
  const layerMirrors = getGrowthLayerMirrors(buds);

  return (
    <div style={{ width: PLANT_W * scale, height: height * scale }}>
      <div style={{ position: "relative", width: PLANT_W, height, imageRendering: "pixelated", transform: `scale(${scale})`, transformOrigin: "top left" }}>
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

export function GardenPlantInfoCard({ name, buds, actions }: {
  name: string;
  buds: GardenBudVisual[];
  actions: ReactNode;
}) {
  const status: BudStatus = dominantStatus(buds);

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

export function GardenPlantVisual({ name, buds, actions, onBudClick }: {
  name: string;
  buds: GardenBudVisual[];
  actions: ReactNode;
  onBudClick?: (budId: string) => void;
}) {
  return (
    <div style={{ position: "relative", width: 210, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <GardenPixelPlant buds={buds} onBudClick={onBudClick} />
      <GardenPlantInfoCard name={name} buds={buds} actions={actions} />
    </div>
  );
}
