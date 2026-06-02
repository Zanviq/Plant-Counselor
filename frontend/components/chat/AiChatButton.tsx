"use client";

import type { CSSProperties } from "react";
import { useChatStore } from "@/lib/store/chatStore";

/**
 * Top-right "AI 대화" button shown on the home / garden / calendar pages.
 * Opens the global chat panel, and hides itself while the panel is open
 * (the panel has its own close control).
 */
export function AiChatButton({ style, className = "btn btn-primary" }: {
  style?: CSSProperties;
  className?: string;
}) {
  const { open, openWith } = useChatStore();
  if (open) return null;
  return (
    <button
      onClick={() => openWith()}
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, ...style }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      AI 대화
    </button>
  );
}
