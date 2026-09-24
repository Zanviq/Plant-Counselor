"use client";

import { useSyncExternalStore } from "react";

/**
 * The user's own Gemini API key.
 *
 * Stored only in this browser's localStorage and sent with each AI chat request
 * as the `X-Gemini-Api-Key` header. The backend uses it for that request only
 * and never stores or logs it.
 */
const STORAGE_KEY = "pc-gemini-api-key";
const EVENT = "pc-gemini-api-key-change";

export const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";

export function getGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setGeminiKey(value: string | null) {
  try {
    if (value && value.trim()) window.localStorage.setItem(STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Mask a key for display, e.g. "AIza••••••••3f9Q". */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Reactive read of the stored key (null when absent or during SSR). */
export function useGeminiKey(): string | null {
  return useSyncExternalStore(subscribe, getGeminiKey, () => null);
}
