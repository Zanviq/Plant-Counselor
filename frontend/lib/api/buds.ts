import { apiDelete, apiGet, apiPatch } from "./client";

export const listBuds = (params: { plant_id?: string; wilting_only?: boolean } = {}) => {
  const q = new URLSearchParams();
  if (params.plant_id) q.set("plant_id", params.plant_id);
  if (params.wilting_only) q.set("wilting_only", "true");
  return apiGet<{ items: Bud[] }>(`/buds?${q}`);
};

export const getBud = (id: string) =>
  apiGet<{ bud: Bud; history: BudHistory[] }>(`/buds/${id}`);

export const patchBud = (id: string, fields: { title?: string; detail?: string }) =>
  apiPatch<Bud>(`/buds/${id}`, fields);

export const deleteBud = (id: string) =>
  apiDelete<{ deleted_id: string }>(`/buds/${id}`);

/** Manually set a bud's progress (slider). `note` carries the user's reason. */
export const setBudProgress = (id: string, progress: number, note = "") =>
  apiPatch<Bud>(`/buds/${id}/progress`, { progress, note });

export const moveBud = (id: string, targetPlantId: string) =>
  apiPatch<Bud>(`/buds/${id}/move`, { target_plant_id: targetPlantId });

export interface Bud {
  id: string;
  plant_id: string;
  title: string;
  detail: string;
  type: "concern" | "schedule";
  status: "seed" | "bud" | "flower" | "fruit" | "harvested" | "wilting" | "rot"; // seed: migration 004 이전 읽기 호환
  progress: number;
  deadline: string | null;
  last_progress_at: string | null;
  disappeared_at: string | null;
  created_at: string;
}

export interface BudHistory {
  id: string;
  bud_id: string;
  from_status: string;
  to_status: string;
  at: string;
  reason: string;
}
