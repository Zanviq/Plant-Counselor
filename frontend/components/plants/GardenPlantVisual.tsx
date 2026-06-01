import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_PILL, dominantStatus, type BudStatus } from "@/lib/status";

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
  wiltStem: "#7A6D55",
  wiltLeaf: "#A5946D",
};

function Pixel({ x, y, w, h, color }: {
  x: number; y: number; w: number; h: number; color: string;
}) {
  return <span style={{ position: "absolute", left: x, top: y, width: w, height: h, background: color }} />;
}

function GrowthLayer({ bud, index }: { bud: GardenBudVisual; index: number }) {
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

export function GardenPixelPlant({ buds, scale = 1 }: { buds: GardenBudVisual[]; scale?: number }) {
  const height = POT_H + Math.max(1, buds.length) * LAYER_H;
  const visibleBuds = buds.length > 0 ? buds : [{ id: "empty", title: "새싹", status: "harvested" }];

  return (
    <div style={{ width: PLANT_W * scale, height: height * scale }}>
      <div style={{ position: "relative", width: PLANT_W, height, imageRendering: "pixelated", transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {visibleBuds.map((bud, index) => <GrowthLayer key={bud.id} bud={bud} index={index} />)}
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

export function GardenPlantVisual({ name, buds, actions }: {
  name: string;
  buds: GardenBudVisual[];
  actions: ReactNode;
}) {
  return (
    <div style={{ position: "relative", width: 210, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <GardenPixelPlant buds={buds} />
      <GardenPlantInfoCard name={name} buds={buds} actions={actions} />
    </div>
  );
}
