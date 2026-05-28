import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatScope {
  kind: "global" | "plant" | "bud" | "calendar";
  id?: string;
}

interface ChatState {
  open: boolean;
  scope: ChatScope;
  draft: string;
  chatWidth: number;
  openWith: (scope?: ChatScope) => void;
  close: () => void;
  toggle: () => void;
  setDraft: (text: string) => void;
  setChatWidth: (w: number) => void;
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
      openWith: (scope = { kind: "global" }) => set({ open: true, scope }),
      close: () => set({ open: false }),
      toggle: () => set((s) => ({ open: !s.open })),
      setDraft: (text) => set({ draft: text }),
      setChatWidth: (w) => set({ chatWidth: w }),
    }),
    {
      name: "pc-chat",
      // persist only the width preference — open/scope/draft should not survive reload
      partialize: (state) => ({ chatWidth: state.chatWidth }),
    }
  )
);
