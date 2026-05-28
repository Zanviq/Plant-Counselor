import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * User profile from the backend /me endpoint.
 * Supabase Auth identity (provider, email) is handled by the Supabase client.
 */
export interface UserProfile {
  id: string;
  email: string | null;
  nickname: string | null;
  tone: string;
  ai_model: string;
  garden_rules: Record<string, unknown>;
  appearance: Record<string, unknown>;
  created_at: string;
}

interface AuthState {
  /** Supabase access_token — synced via onAuthStateChange in layout.tsx */
  accessToken: string | null;
  /** Backend profile data (fetched from /me after auth) */
  user: UserProfile | null;
  /**
   * Update local state with a new token + profile.
   * The Supabase session is managed by the Supabase client — this just
   * keeps the local cache in sync for fast UI reads.
   */
  setSession: (token: string, user: UserProfile) => void;
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
      // Persist only the profile (not the token — it changes frequently).
      // The token is recovered from the Supabase session on each mount.
      partialize: (state) => ({ user: state.user }),
    }
  )
);
