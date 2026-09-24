import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Signed-in user profile (from /auth/me).
 * The session itself is an httpOnly cookie managed by the backend, so no token
 * is ever stored in JavaScript.
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  nickname: string | null;
  role: "user" | "admin";
  tone: string;
  ai_model: string;
  garden_rules: Record<string, unknown>;
  appearance: Record<string, unknown>;
  created_at: string;
}

interface AuthState {
  /** Cached profile for instant UI on reload; re-validated against /auth/me. */
  user: UserProfile | null;
  /** True once /auth/me confirmed the session cookie in this page load. Gates queries. */
  authed: boolean;
  setUser: (user: UserProfile) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      authed: false,
      setUser: (user) => set({ user, authed: true }),
      clearSession: () => set({ user: null, authed: false }),
    }),
    { name: "pc-auth", partialize: (state) => ({ user: state.user }) }
  )
);
