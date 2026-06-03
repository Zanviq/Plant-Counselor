"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";
const FALLBACK_LABEL = "Gemini 2.5 Flash";

type PublicRuntimeResponse = {
  ok: boolean;
  data?: {
    llm_default_model?: string;
    llm_default_model_label?: string;
  };
};

export default function ModelBadge() {
  const [label, setLabel] = useState(FALLBACK_LABEL);

  useEffect(() => {
    let alive = true;

    async function loadModel() {
      try {
        const res = await fetch(`${BASE}/public/runtime`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const body = await res.json() as PublicRuntimeResponse;
        const nextLabel = body.data?.llm_default_model_label;
        if (alive && nextLabel) setLabel(nextLabel);
      } catch {
        // Keep the static fallback when the backend is unavailable.
      }
    }

    void loadModel();
    const timer = window.setInterval(loadModel, 10_000);
    window.addEventListener("focus", loadModel);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadModel);
    };
  }, []);

  return <>AI 정원사 — {label}</>;
}
