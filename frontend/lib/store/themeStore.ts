import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  apply: () => void;
}

function resolveMode(m: ThemeMode): "light" | "dark" {
  if (m !== "system") return m;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paint(mode: ThemeMode): "light" | "dark" {
  const resolved = resolveMode(mode);
  if (typeof document === "undefined") return resolved;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.removeAttribute("data-accent");
  return resolved;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      resolved: "light",
      setMode: (mode) => {
        const resolved = paint(mode);
        set({ mode, resolved });
      },
      apply: () => {
        const { mode } = get();
        const resolved = paint(mode);
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
