import { create } from "zustand";

interface ChatScope {
  kind: "global" | "plant" | "bud" | "calendar";
  id?: string;
}

interface ChatState {
  open: boolean;
  scope: ChatScope;
  draft: string;
  openWith: (scope?: ChatScope) => void;
  close: () => void;
  toggle: () => void;
  setDraft: (text: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  scope: { kind: "global" },
  draft: "",
  openWith: (scope = { kind: "global" }) => set({ open: true, scope }),
  close: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
  setDraft: (text) => set({ draft: text }),
}));
