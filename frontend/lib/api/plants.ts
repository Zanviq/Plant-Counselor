import { apiGet, apiPatch, apiDelete } from "./client";

export const listPlants = (sort = "activity", include_dormant = false) =>
  apiGet<{ items: Plant[] }>(`/plants?sort=${sort}&include_dormant=${include_dormant}`);

export const getPlant = (id: string) =>
  apiGet<Plant>(`/plants/${id}`);

export const updatePlant = (id: string, fields: Partial<Plant>) =>
  apiPatch<Plant>(`/plants/${id}`, fields);

export const deletePlant = (id: string, hard = false) =>
  apiDelete(`/plants/${id}?hard=${hard}`);

export interface Plant {
  id: string;
  user_id: string;
  name: string;
  description: string;
  species: string;
  color: string;
  status: string;
  stats: { harvested_count: number; rot_count: number; active_bud_count: number };
  last_activity_at: string | null;
  created_at: string;
}
