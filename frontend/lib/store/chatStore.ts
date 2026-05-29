import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatScope {
  kind: "global" | "plant" | "bud" | "calendar";
  id?: string;
}

interface OpenOpts {
  /** Prefill the input box (NOT sent) — user presses Enter to send. */
  prefill?: string;
  /** Auto-send this text once the new session's history has loaded. */
  send?: string;
}

interface ChatState {
  open: boolean;
  scope: ChatScope;
  draft: string;
  chatWidth: number;
  /** One-shot: text to prefill the input after a scope change (carry-over). */
  pendingPrefill: string | null;
  /** One-shot: text to auto-send after a scope change. */
  pendingSend: string | null;
  openWith: (scope?: ChatScope, opts?: OpenOpts) => void;
  close: () => void;
  toggle: () => void;
  setDraft: (text: string) => void;
  setChatWidth: (w: number) => void;
  clearPending: () => void;
}

export const DEFAULT_CHAT_W = 400;
export const MIN_CHAT_W = 280;
export const MAX_CHAT_W = 700;

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      open: false,
      scope: { kind: "global" },
      draft: "",
      chatWidth: DEFAULT_CHAT_W,
      pendingPrefill: null,
      pendingSend: null,
      openWith: (scope = { kind: "global" }, opts) =>
        set({
          open: true,
          scope,
          pendingPrefill: opts?.prefill ?? null,
          pendingSend: opts?.send ?? null,
        }),
      close: () => set({ open: false }),
      toggle: () => set((s) => ({ open: !s.open })),
      setDraft: (text) => set({ draft: text }),
      setChatWidth: (w) => set({ chatWidth: w }),
      clearPending: () => set({ pendingPrefill: null, pendingSend: null }),
    }),
    {
      name: "pc-chat",
      // persist only the width preference — open/scope/draft should not survive reload
      partialize: (state) => ({ chatWidth: state.chatWidth }),
    }
  )
);
