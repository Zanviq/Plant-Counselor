/**
 * Bud lifecycle status — single source of truth for label/color/pill class.
 * Used by every page that renders a status.
 */

export type BudStatus =
  | "seed"
  | "bud"
  | "flower"
  | "fruit"
  | "harvested"
  | "wilting"
  | "rot";

export const STATUS_LABEL: Record<BudStatus, string> = {
  seed: "씨앗",
  bud: "봉우리",
  flower: "꽃",
  fruit: "열매",
  harvested: "수확",
  wilting: "시듦",
  rot: "썩음",
};

export const STATUS_PILL: Record<BudStatus, string> = {
  seed: "pill pill-seed",
  bud: "pill pill-bud",
  flower: "pill pill-flower",
  fruit: "pill pill-fruit",
  harvested: "pill pill-harvest",
  wilting: "pill pill-wilting",
  rot: "pill pill-rot",
};

export const STATUS_COLOR_VAR: Record<BudStatus, string> = {
  seed: "var(--st-seed)",
  bud: "var(--st-bud)",
  flower: "var(--st-flower)",
  fruit: "var(--st-fruit)",
  harvested: "var(--st-harvest)",
  wilting: "var(--st-wilting)",
  rot: "var(--st-rot)",
};

export const ACTIVE_STATUSES: BudStatus[] = ["seed", "bud", "flower", "fruit", "wilting"];

export function isActive(s: string): boolean {
  return ACTIVE_STATUSES.includes(s as BudStatus);
}

export function isDone(s: string): boolean {
  return s === "harvested" || s === "rot";
}

/** Rank used to pick the "most representative" status for a plant card. */
const STATUS_RANK: Record<BudStatus, number> = {
  fruit: 6,
  flower: 5,
  bud: 4,
  seed: 3,
  wilting: 2,
  harvested: 1,
  rot: 0,
};

export function dominantStatus(buds: { status: string }[]): BudStatus {
  if (buds.length === 0) return "seed";
  return buds.reduce<BudStatus>((best, b) => {
    const s = b.status as BudStatus;
    return (STATUS_RANK[s] ?? -1) > (STATUS_RANK[best] ?? -1) ? s : best;
  }, "seed");
}
