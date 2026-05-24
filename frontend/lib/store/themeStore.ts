import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentTheme = "emerald" | "sapphire" | "violet" | "sunset";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentTheme;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentTheme) => void;
  apply: () => void;
}

function resolveMode(m: ThemeMode): "light" | "dark" {
  if (m !== "system") return m;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paint(mode: ThemeMode, accent: AccentTheme): "light" | "dark" {
  const resolved = resolveMode(mode);
  if (typeof document === "undefined") return resolved;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  // emerald is the default token set; only mark non-default accents
  if (accent === "emerald") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
  return resolved;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      accent: "emerald",
      resolved: "light",
      setMode: (mode) => {
        const resolved = paint(mode, get().accent);
        set({ mode, resolved });
      },
      setAccent: (accent) => {
        const resolved = paint(get().mode, accent);
        set({ accent, resolved });
      },
      apply: () => {
        const { mode, accent } = get();
        const resolved = paint(mode, accent);
        set({ resolved });
      },
    }),
    { name: "pc-theme" }
  )
);

/** Call once on mount to wire prefers-color-scheme listener. */
export function attachThemeListener() {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const { mode, apply } = useThemeStore.getState();
    if (mode === "system") apply();
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
