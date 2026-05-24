import { create } from "zustand";

interface User {
  id: string;
  nickname: string;
  address: string;
  tone: string;
  ai_model: string;
  ai_proactive: boolean;
  garden_rules: Record<string, unknown>;
  appearance: Record<string, unknown>;
  sound: Record<string, unknown>;
  created_at: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (token, user) => set({ accessToken: token, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}));
