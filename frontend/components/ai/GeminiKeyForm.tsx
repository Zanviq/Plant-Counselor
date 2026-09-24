"use client";

import { useState } from "react";
import { GEMINI_KEY_URL, maskKey, setGeminiKey, useGeminiKey } from "@/lib/geminiKey";

/**
 * Enter / replace / remove the user's own Gemini API key.
 * The key is saved to this browser's localStorage only.
 */
export default function GeminiKeyForm({ compact = false }: { compact?: boolean }) {
  const key = useGeminiKey();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  function save() {
    if (!draft.trim()) return;
    setGeminiKey(draft);
    setDraft("");
    setEditing(false);
  }

  const showInput = !key || editing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {showInput ? (
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          <input
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label="Gemini API 키"
            placeholder="Gemini API 키 붙여넣기"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: "1 1 180px", minWidth: 0, fontSize: 13 }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim()}>저장</button>
          {key && (
            <button type="button" className="btn btn-sm" onClick={() => { setEditing(false); setDraft(""); }}>취소</button>
          )}
        </form>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="t-mono" style={{ fontSize: 13, color: "var(--fg-secondary)" }}>{maskKey(key)}</span>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>변경</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setGeminiKey(null)}>삭제</button>
        </div>
      )}
      <p className="t-caption" style={{ color: "var(--fg-subtle)", lineHeight: 1.6, margin: 0 }}>
        <a href={GEMINI_KEY_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
          Google AI Studio에서 무료 키 발급
        </a>
        {compact ? " · " : <br />}
        키는 이 브라우저에만 저장되고 AI 요청 때만 서버로 전달돼요. 서버에는 저장되지 않아요.
      </p>
    </div>
  );
}
