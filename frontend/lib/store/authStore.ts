import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (token, user) => set({ accessToken: token, user }),
      clearSession: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "pc-auth",
      // Only persist the user profile — NOT the access token.
      // The token is short-lived and refreshed from the httpOnly cookie each load.
      // Persisting just the user object lets the UI render correctly on mount
      // while the background token refresh is still in flight.
      partialize: (state) => ({ user: state.user }),
    }
  )
);
