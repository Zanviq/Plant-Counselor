"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { getPlant, deletePlant, Plant } from "@/lib/api/plants";
import { listBuds, getBud, setBudProgress, Bud } from "@/lib/api/buds";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import {
  STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, BudStatus, isActive, isDone,
} from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import type { ApiResult } from "@/lib/api/client";
import { Skeleton, BudRowSkeleton } from "@/components/ui/Skeleton";

// ── Bud row ───────────────────────────────────────────────────

function BudRow({ bud, selected, onClick }: { bud: Bud; selected: boolean; onClick: () => void }) {
  const status = bud.status as BudStatus;
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", textAlign: "left", width: "100%", cursor: "pointer",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "var(--accent-muted)" : "var(--bg-elevated)",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <span className={STATUS_PILL[status]}>
        <span className="pill-dot" style={{ background: "currentColor" }} />
        {STATUS_LABEL[status]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-body-sm"
          style={{
            color: "var(--fg)", fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {bud.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, height: 3, background: "var(--bg-muted)", borderRadius: 999, overflow: "hidden", maxWidth: 200 }}>
            <div style={{ height: "100%", width: `${bud.progress}%`, background: STATUS_COLOR_VAR[status], transition: "width 0.3s" }} />
          </div>
          <span className="t-caption" style={{ color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>{bud.progress}%</span>
          {bud.deadline && (
            <>
              <span style={{ width: 1, height: 10, background: "var(--border)" }} />
              <span className="t-caption" style={{ color: "var(--warning)" }}>{bud.deadline}</span>
            </>
          )}
        </div>
      </div>
      <span className="badge badge-muted" style={{ flexShrink: 0 }}>
        {bud.type === "concern" ? "고민" : "일정"}
      </span>
    </button>
  );
}

// ── Detail drawer ─────────────────────────────────────────────

function BudDetailDrawer({ budId, onClose }: { budId: string; onClose: () => void }) {
  const { open: chatOpen, chatWidth, openWith } = useChatStore();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: QK.bud(budId), queryFn: () => getBud(budId) });
  // Manual progress slider state.
  const [draft, setDraft] = useState<number | null>(null);     // live slider value
  const [reasonFor, setReasonFor] = useState<number | null>(null); // value awaiting a reason
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  // Reset transient slider/popup state when the drawer switches to another bud.
  useEffect(() => {
    setDraft(null); setReasonFor(null); setReasonText("");
  }, [budId]);

  const bud = data?.ok ? data.data.bud : null;
  const history = data?.ok ? data.data.history : [];
  if (!bud) return null;

  const status = bud.status as BudStatus;
  const editable = !isDone(bud.status);
  const shown = draft ?? bud.progress;

  // Quick actions hand off to chat with a self-contained instruction so the
  // LLM uses the correct skill without further clarification.
  function quick(prompt: string) {
    openWith({ kind: "bud", id: bud!.id });
    setTimeout(() => {
      const ev = new CustomEvent("pc-chat-prompt", { detail: prompt });
      window.dispatchEvent(ev);
    }, 80);
  }

  // Persist the manually-set progress, then optionally hand the reason to the AI.
  async function commitProgress(value: number, note: string, sendToAI: boolean) {
    setSaving(true);
    const r = await setBudProgress(budId, value, note);
    setSaving(false);
    setReasonFor(null);
    setReasonText("");
    setDraft(null);
    if (!r.ok) return;
    qc.invalidateQueries({ queryKey: QK.bud(budId) });
    qc.invalidateQueries({ queryKey: QK.plantBuds(bud!.plant_id) });
    qc.invalidateQueries({ queryKey: ["buds"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["briefing"] });
    if (sendToAI && note) {
      const prompt =
        `방금 '${bud!.title}' 봉우리의 진행률을 직접 ${value}%로 변경했어요.\n` +
        `이유: ${note}\n\n` +
        `진행률은 이미 변경됐으니 다시 바꾸지 말고, 이 변화에 대해 짧게 조언하거나 ` +
        `다음에 무엇을 하면 좋을지 알려줘.`;
      openWith({ kind: "bud", id: budId }, { send: prompt });
    }
  }

  // When the chat panel is open the drawer shifts left to sit beside it.
  const drawerRight = chatOpen ? chatWidth : 0;

  return (
    <>
      {/* Backdrop — stops at the chat panel edge so it doesn't cover it */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          right: chatOpen ? chatWidth : 0,
          zIndex: 39,
          background: "var(--bg-overlay)", backdropFilter: "blur(3px)",
        }}
      />
      <aside
        className="animate-in-right"
        style={{
          position: "fixed",
          right: drawerRight,
          top: 0, bottom: 0, width: 400,
          zIndex: 45, // above ChatPanel (40) so it's never buried
          background: "var(--bg-elevated)", borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          transition: "right 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <header style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className={STATUS_PILL[status]}>
              <span className="pill-dot" style={{ background: "currentColor" }} />
              {STATUS_LABEL[status]}
            </span>
            <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="닫기">✕</button>
          </div>
          <h3 className="t-h1" style={{ color: "var(--fg)" }}>{bud.title}</h3>
          {bud.detail && (
            <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.6 }}>
              {bud.detail}
            </p>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="t-label" style={{ color: "var(--fg-muted)" }}>진행률 (완성도)</span>
              <span className="t-h3" style={{ color: "var(--accent)" }}>{shown}%</span>
            </div>
            {editable ? (
              <>
                <input
                  type="range" min={0} max={100} step={5}
                  value={shown}
                  onChange={(e) => setDraft(Number(e.target.value))}
                  onPointerUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v !== bud.progress) setReasonFor(v);
                  }}
                  onKeyUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v !== bud.progress) setReasonFor(v);
                  }}
                  disabled={saving || reasonFor !== null}
                  aria-label="진행률 슬라이더"
                  style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
                  슬라이더를 움직여 완성도를 직접 조절하세요. 30·60·85%에서 단계가 자동 전이됩니다.
                </div>
              </>
            ) : (
              <div className="progress-track" style={{ height: 6 }}>
                <div className="progress-fill" style={{ width: `${bud.progress}%` }} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            <MetaCell label="유형" value={bud.type === "concern" ? "고민" : "일정"} />
            <MetaCell label="마감일" value={bud.deadline ?? "없음"} accent={bud.deadline ? "warning" : undefined} />
            <MetaCell label="생성일" value={new Date(bud.created_at).toLocaleDateString("ko-KR")} />
            <MetaCell label="마지막 진행" value={bud.last_progress_at ? new Date(bud.last_progress_at).toLocaleDateString("ko-KR") : "—"} />
          </div>

          {history.length > 0 && (
            <>
              <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 8 }}>상태 변경 이력</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => {
                  const fromS = h.from_status as BudStatus;
                  const toS = h.to_status as BudStatus;
                  return (
                    <li
                      key={h.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        fontSize: 12.5, color: "var(--fg-secondary)",
                      }}
                    >
                      <span className="dot" style={{ background: i === history.length - 1 ? "var(--accent)" : "var(--border-strong)" }} />
                      <span style={{ color: "var(--fg-muted)" }}>
                        {fromS ? STATUS_LABEL[fromS] : "신규"} → <span style={{ color: "var(--fg)", fontWeight: 500 }}>{STATUS_LABEL[toS]}</span>
                      </span>
                      <span style={{ color: "var(--fg-subtle)", marginLeft: "auto" }}>
                        {new Date(h.at).toLocaleDateString("ko-KR")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <footer style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {!isDone(bud.status) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => quick(`이 봉우리(id=${bud.id}) 진행률을 ${Math.min(100, bud.progress + 20)}%로 올려줘`)}
              >
                +20%
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => quick(`이 봉우리(id=${bud.id})를 수확(완료) 처리해줘`)}
              >
                수확
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => quick(`이 봉우리(id=${bud.id})를 포기 처리해줘`)}
              >
                포기
              </button>
            </div>
          )}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={() => openWith({ kind: "bud", id: bud.id })}
          >
            AI에게 이 봉우리 상담받기
          </button>
        </footer>
      </aside>

      {/* "왜 변경하였나요?" reason popup — appears after a manual slider change */}
      {reasonFor !== null && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setReasonFor(null); setReasonText(""); setDraft(null); }}
        >
          <div
            className="card"
            style={{ width: 380, maxWidth: "92vw", padding: "22px 24px", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-h2" style={{ color: "var(--fg)", marginBottom: 6 }}>왜 변경하였나요?</div>
            <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginBottom: 14, lineHeight: 1.6 }}>
              진행률을 <strong style={{ color: "var(--accent-fg)" }}>{reasonFor}%</strong>로 바꾸셨네요.
              이유를 알려주시면 AI 정원사가 도움을 줄 수 있어요.
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              autoFocus
              rows={3}
              placeholder="예: 오늘 면접 준비를 절반쯤 끝냈어요"
              style={{
                width: "100%", padding: "9px 11px", borderRadius: "var(--r-md)",
                background: "var(--bg-subtle)", border: "1px solid var(--border)",
                color: "var(--fg)", fontSize: 13.5, outline: "none", resize: "vertical",
                boxSizing: "border-box", fontFamily: "var(--font-sans)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => commitProgress(reasonFor, "", false)}
              >
                그냥 저장
              </button>
              <button
                className="btn btn-primary"
                disabled={saving || !reasonText.trim()}
                onClick={() => commitProgress(reasonFor, reasonText.trim(), true)}
              >
                {saving ? "저장 중…" : "AI에게 전달"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaCell({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <div className="card-flat" style={{ padding: "10px 12px", borderRadius: "var(--r-md)" }}>
      <div className="t-caption" style={{ color: "var(--fg-muted)", marginBottom: 2 }}>{label}</div>
      <div className="t-body-sm" style={{ color: accent === "warning" ? "var(--warning)" : "var(--fg)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type Filter = "all" | "active" | "done";

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { openWith, scope } = useChatStore();
  const { accessToken } = useAuthStore();

  // Follow the chat session ONLY when it actually *changes* to a different plant
  // (e.g. via the "세션 변경" banner) — not when browsing to another plant's detail
  // while an old plant chat is still open. We track the last session id and act
  // only on a genuine transition, so manual navigation is never hijacked.
  const lastScopePlantId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const curId = scope.kind === "plant" ? scope.id ?? null : null;
    if (lastScopePlantId.current === undefined) {
      lastScopePlantId.current = curId;  // initialize on mount, don't navigate
      return;
    }
    if (curId !== lastScopePlantId.current) {
      lastScopePlantId.current = curId;
      if (curId && curId !== id) router.push(`/plants/${curId}`);
    }
  }, [scope.kind, scope.id, id, router]);
  const [selectedBudId, setSelectedBudId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);

  const { data: plantRes, isLoading: loadingPlant } = useQuery({
    queryKey: QK.plant(id),
    queryFn: () => getPlant(id),
    enabled: !!accessToken,
    // Populate immediately from the plants list cache if available —
    // avoids a blank header while the individual-plant request is in flight.
    initialData: () => {
      const list = qc.getQueryData<ApiResult<{ items: Plant[] }>>(QK.plants());
      if (list?.ok) {
        const hit = list.data.items.find((p) => p.id === id);
        if (hit) return { ok: true as const, data: hit };
      }
      return undefined;
    },
  });
  const { data: budsRes, isLoading: loadingBuds }  = useQuery({
    queryKey: QK.plantBuds(id),
    queryFn: () => listBuds({ plant_id: id }),
    enabled: !!accessToken,
  });

  const plant = plantRes?.ok ? plantRes.data : null;
  const allBuds = budsRes?.ok ? budsRes.data.items : [];
  const visible = allBuds.filter((b) => {
    if (b.disappeared_at) return false;
    if (filter === "active") return isActive(b.status);
    if (filter === "done")   return isDone(b.status);
    return true;
  });

  async function handleDelete() {
    if (!id) return;
    await deletePlant(id, false);
    // Refresh everything the dashboard/garden show so the deleted plant and its
    // buds disappear immediately (plants list, buds, summary stats, briefing).
    qc.invalidateQueries({ queryKey: ["plants"] });
    qc.invalidateQueries({ queryKey: ["buds"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["briefing"] });
    router.replace("/plants");
  }

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 960, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 20 }}>
        ← 정원으로
      </button>

      {/* Loading skeleton — shown only when no cached data is available */}
      {loadingPlant && !plant && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton w="45%" h={28} />
            <Skeleton w="70%" h={13} />
            <div style={{ display: "flex", gap: 24, marginTop: 6 }}>
              <Skeleton w={48} h={28} /><Skeleton w={48} h={28} /><Skeleton w={48} h={28} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <BudRowSkeleton /><BudRowSkeleton /><BudRowSkeleton />
          </div>
        </div>
      )}

      {plant && (
        <>
          <header className="card animate-in" style={{ padding: "22px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="t-display" style={{ color: "var(--fg)" }}>{plant.name}</h1>
                {plant.description && (
                  <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 6, maxWidth: 560 }}>
                    {plant.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                  <BigStat label="활성" value={plant.stats.active_bud_count} />
                  <BigStat label="수확" value={plant.stats.harvested_count} color="var(--positive)" />
                  <BigStat label="포기" value={plant.stats.rot_count} color="var(--danger)" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span className="t-caption" style={{ color: "var(--fg-muted)" }}>
                  {new Date(plant.created_at).toLocaleDateString("ko-KR")} 시작
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => openWith({ kind: "plant", id: plant.id })}>
                  이 식물 상담
                </button>
                {!confirming ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
                    식물 삭제
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>정말 삭제</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>취소</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Buds toolbar */}
          <div className="animate-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 className="t-h1" style={{ color: "var(--fg)" }}>봉우리</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FilterToggle current={filter} onChange={setFilter} />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openWith({ kind: "plant", id: plant.id })}
              >
                + 봉우리 추가
              </button>
            </div>
          </div>

          {loadingBuds ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <BudRowSkeleton /><BudRowSkeleton /><BudRowSkeleton />
            </div>
          ) : visible.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", background: "var(--bg-subtle)" }}>
              <p className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
                {filter === "all" ? "봉우리가 없습니다. AI에게 추가를 요청하세요." : "조건에 맞는 봉우리가 없습니다."}
              </p>
            </div>
          ) : (
            <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visible.map((b) => (
                <BudRow
                  key={b.id}
                  bud={b}
                  selected={selectedBudId === b.id}
                  onClick={() => setSelectedBudId((p) => (p === b.id ? null : b.id))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedBudId && (
        <BudDetailDrawer budId={selectedBudId} onClose={() => setSelectedBudId(null)} />
      )}
    </div>
  );
}

function BigStat({ label, value, color = "var(--fg)" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="t-h1" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function FilterToggle({ current, onChange }: { current: Filter; onChange: (f: Filter) => void }) {
  const opts: { k: Filter; label: string }[] = [
    { k: "all", label: "전체" },
    { k: "active", label: "진행 중" },
    { k: "done", label: "완료" },
  ];
  return (
    <div style={{
      display: "inline-flex", padding: 2, background: "var(--bg-subtle)",
      border: "1px solid var(--border)", borderRadius: "var(--r-md)",
    }}>
      {opts.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          style={{
            padding: "5px 10px", border: "none",
            background: current === o.k ? "var(--bg-elevated)" : "transparent",
            color: current === o.k ? "var(--fg)" : "var(--fg-muted)",
            fontSize: 12, fontWeight: 500, borderRadius: "var(--r-sm)",
            cursor: "pointer", transition: "all 0.12s",
            boxShadow: current === o.k ? "var(--shadow-xs)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
