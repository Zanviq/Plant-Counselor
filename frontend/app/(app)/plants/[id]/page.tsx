"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { getPlant, listPlants, updatePlant, deletePlant, Plant } from "@/lib/api/plants";
import { listBuds, getBud, patchBud, setBudProgress, deleteBud, moveBud, Bud } from "@/lib/api/buds";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import {
  STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, normalizeBudStatus, isActive, isDone,
} from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { formatKstDate } from "@/lib/time";
import type { ApiResult } from "@/lib/api/client";
import { Skeleton, BudRowSkeleton } from "@/components/ui/Skeleton";

// ── Bud row ───────────────────────────────────────────────────

function BudRow({ bud, selected, onClick }: { bud: Bud; selected: boolean; onClick: () => void }) {
  const status = normalizeBudStatus(bud.status);
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
        <div className="t-caption" style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
          클릭해서 상세 확인 및 수정
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
  const { data: plantsRes } = useQuery({ queryKey: QK.plants(), queryFn: () => listPlants() });
  // Manual progress slider state.
  const [draft, setDraft] = useState<number | null>(null);     // live slider value
  const [reasonFor, setReasonFor] = useState<number | null>(null); // value awaiting a reason
  const [reasonText, setReasonText] = useState("");
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const bud = data?.ok ? data.data.bud : null;
  const history = data?.ok ? data.data.history : [];
  const [editingMeta, setEditingMeta] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState("");

  useEffect(() => {
    if (!bud || editingMeta) return;
    setTitleDraft(bud.title);
    setDetailDraft(bud.detail ?? "");
  }, [bud, editingMeta]);

  if (!bud) return null;
  const currentBud = bud;
  const plants = plantsRes?.ok ? plantsRes.data.items : [];
  const movablePlants = plants.filter((plant) => plant.id !== currentBud.plant_id && plant.status !== "archived");

  const status = normalizeBudStatus(currentBud.status);
  const editable = !isDone(currentBud.status);
  const canHarvest = currentBud.progress >= 100;
  const shown = draft ?? currentBud.progress;

  // Quick actions hand off to chat with a self-contained instruction so the
  // LLM uses the correct skill without further clarification.
  function quick(prompt: string) {
    openWith({ kind: "bud", id: currentBud.id });
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
    qc.invalidateQueries({ queryKey: QK.plantBuds(currentBud.plant_id) });
    qc.invalidateQueries({ queryKey: ["buds"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["briefing"] });
    if (sendToAI && note) {
      const prompt =
        `방금 '${currentBud.title}' 봉우리의 진행률을 직접 ${value}%로 변경했어요.\n` +
        `이유: ${note}\n\n` +
        `진행률은 이미 변경됐으니 다시 바꾸지 말고, 이 변화에 대해 짧게 조언하거나 ` +
        `다음에 무엇을 하면 좋을지 알려줘.`;
      openWith({ kind: "bud", id: budId }, { send: prompt });
    }
  }

  async function removeBud() {
    setDeleting(true);
    const result = await deleteBud(budId);
    setDeleting(false);
    if (!result.ok) return;
    qc.removeQueries({ queryKey: QK.bud(budId) });
    qc.invalidateQueries({ queryKey: QK.plantBuds(currentBud.plant_id) });
    qc.invalidateQueries({ queryKey: ["buds"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["briefing"] });
    setConfirmingDelete(false);
    onClose();
  }

  async function moveToPlant() {
    if (!moveTargetId || moveTargetId === currentBud.plant_id) return;
    setMoving(true);
    setMoveError("");
    const previousPlantId = currentBud.plant_id;
    const result = await moveBud(budId, moveTargetId);
    setMoving(false);
    if (!result.ok) {
      setMoveError(result.error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: QK.bud(budId) });
    qc.invalidateQueries({ queryKey: QK.plantBuds(previousPlantId) });
    qc.invalidateQueries({ queryKey: QK.plantBuds(moveTargetId) });
    qc.invalidateQueries({ queryKey: QK.plants() });
    qc.invalidateQueries({ queryKey: ["buds"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["briefing"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    setMoveTargetId("");
  }

  async function saveBudMeta() {
    const title = titleDraft.trim();
    if (!title) {
      setMetaError("봉우리 제목을 입력해주세요.");
      return;
    }
    setMetaSaving(true);
    setMetaError("");
    const result = await patchBud(budId, { title, detail: detailDraft.trim() });
    setMetaSaving(false);
    if (!result.ok) {
      setMetaError(result.error.message);
      return;
    }
    setEditingMeta(false);
    qc.invalidateQueries({ queryKey: QK.bud(budId) });
    qc.invalidateQueries({ queryKey: QK.plantBuds(currentBud.plant_id) });
    qc.invalidateQueries({ queryKey: QK.buds() });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: QK.briefing() });
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
          top: 0, bottom: 0, width: "min(400px, calc(100vw - var(--sidebar-w)))",
          zIndex: 45, // above ChatPanel (40) so it's never buried
          background: "var(--bg-elevated)", borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          transition: "right 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <header style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className={STATUS_PILL[status]}>
              <span className="pill-dot" style={{ background: "currentColor" }} />
              {STATUS_LABEL[status]}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!editingMeta && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingMeta(true)}>수정</button>
              )}
              <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="닫기">✕</button>
            </div>
          </div>
          {editingMeta ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                className="input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                placeholder="봉우리 제목"
                autoFocus
                maxLength={80}
              />
              <textarea
                className="input"
                value={detailDraft}
                onChange={(event) => setDetailDraft(event.target.value)}
                placeholder="세부 설명"
                rows={3}
                style={{ resize: "vertical", fontFamily: "var(--font-sans)" }}
              />
              {metaError && <div className="t-caption" style={{ color: "var(--danger)" }}>{metaError}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={metaSaving}
                  onClick={() => {
                    setEditingMeta(false);
                    setMetaError("");
                    setTitleDraft(bud.title);
                    setDetailDraft(bud.detail ?? "");
                  }}
                >
                  취소
                </button>
                <button className="btn btn-primary btn-sm" disabled={metaSaving} onClick={saveBudMeta}>
                  {metaSaving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="t-h1" style={{ color: "var(--fg)" }}>{bud.title}</h3>
              {bud.detail && (
                <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.6 }}>
                  {bud.detail}
                </p>
              )}
            </>
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
                  슬라이더를 움직여 완성도를 직접 조절하세요. 60·85%에서 단계가 자동 전이됩니다.
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
            <MetaCell label="생성일" value={formatKstDate(bud.created_at)} />
            <MetaCell label="마지막 진행" value={bud.last_progress_at ? formatKstDate(bud.last_progress_at) : "—"} />
          </div>

          {history.length > 0 && (
            <>
              <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 8 }}>상태 변경 이력</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => {
                  const fromS = h.from_status ? normalizeBudStatus(h.from_status) : null;
                  const toS = normalizeBudStatus(h.to_status);
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
                        {formatKstDate(h.at)}
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
                disabled={!canHarvest}
                title={canHarvest ? "봉우리 수확" : "진행률 100%를 달성하면 수확할 수 있습니다."}
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
          {!isDone(bud.status) && !canHarvest && (
            <div className="t-caption" style={{ color: "var(--fg-subtle)", textAlign: "center" }}>
              진행률 100%를 달성하면 수확할 수 있습니다.
            </div>
          )}
          <div className="card-flat" style={{ padding: 10, borderRadius: "var(--r-md)" }}>
            <div className="t-caption" style={{ color: "var(--fg-muted)", marginBottom: 6 }}>다른 식물로 이동</div>
            {movablePlants.length === 0 ? (
              <div className="t-caption" style={{ color: "var(--fg-subtle)" }}>
                이동할 수 있는 다른 식물이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select
                  className="input"
                  value={moveTargetId}
                  onChange={(event) => setMoveTargetId(event.target.value)}
                  disabled={moving}
                  aria-label="봉우리를 이동할 대상 식물"
                  style={{ flex: 1, minWidth: 0, height: 34, fontSize: 12.5 }}
                >
                  <option value="">대상 식물 선택</option>
                  {movablePlants.map((plant) => (
                    <option key={plant.id} value={plant.id}>{plant.name}</option>
                  ))}
                </select>
                <button className="btn btn-secondary btn-sm" disabled={!moveTargetId || moving} onClick={moveToPlant}>
                  {moving ? "이동 중…" : "이동"}
                </button>
              </div>
            )}
            {moveError && (
              <div className="t-caption" style={{ color: "var(--danger)", marginTop: 6 }}>{moveError}</div>
            )}
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={() => openWith({ kind: "bud", id: bud.id })}
          >
            AI에게 이 봉우리 상담받기
          </button>
          <button className="btn btn-danger btn-sm" disabled={deleting} onClick={() => setConfirmingDelete(true)}>
            {deleting ? "삭제 중…" : "봉우리 삭제"}
          </button>
        </footer>
      </aside>

      {confirmingDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 380, maxWidth: "92vw", padding: "22px 24px", boxShadow: "var(--shadow-lg)" }}>
            <div className="t-h2" style={{ color: "var(--fg)", marginBottom: 8 }}>봉우리를 삭제할까요?</div>
            <p className="t-body-sm" style={{ color: "var(--fg-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--fg)" }}>{bud.title}</strong> 봉우리와 정원에서 연결된 줄기가 함께 사라집니다.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button className="btn btn-ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>취소</button>
              <button className="btn btn-danger" disabled={deleting} onClick={removeBud}>
                {deleting ? "삭제 중…" : "정말 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

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
type StatusFilter = "all" | "active" | "bud" | "flower" | "fruit" | "wilting" | "harvested" | "rot";
type DeadlineFilter = "all" | "overdue" | "today" | "week" | "none";
type BudSort = "recent" | "deadline" | "progress_desc" | "progress_asc" | "status";

function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

function daysUntil(value: string | null | undefined): number | null {
  const key = dateOnly(value);
  if (!key) return null;
  const target = new Date(`${key}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function budActivityTime(bud: Bud): number {
  return Date.parse(bud.updated_at ?? bud.last_progress_at ?? bud.created_at) || 0;
}

function parseProgressBound(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeProgressInput(value: string): string {
  const parsed = parseProgressBound(value);
  return parsed === null ? "" : String(parsed);
}

function matchesProgressRange(bud: Bud, minRaw: string, maxRaw: string): boolean {
  const min = parseProgressBound(minRaw);
  const max = parseProgressBound(maxRaw);
  const lower = min ?? 0;
  const upper = max ?? 100;
  return bud.progress >= Math.min(lower, upper) && bud.progress <= Math.max(lower, upper);
}

function matchesDeadline(bud: Bud, filter: DeadlineFilter): boolean {
  if (filter === "all") return true;
  const left = daysUntil(bud.deadline);
  if (filter === "none") return left === null;
  if (left === null) return false;
  if (filter === "overdue") return left < 0;
  if (filter === "today") return left === 0;
  return left >= 0 && left <= 7;
}

function sortBuds(a: Bud, b: Bud, sort: BudSort): number {
  if (sort === "recent") return budActivityTime(b) - budActivityTime(a);
  if (sort === "progress_desc") return b.progress - a.progress || budActivityTime(b) - budActivityTime(a);
  if (sort === "progress_asc") return a.progress - b.progress || budActivityTime(b) - budActivityTime(a);
  if (sort === "deadline") {
    const ad = a.deadline ? Date.parse(`${dateOnly(a.deadline)}T00:00:00`) : Number.POSITIVE_INFINITY;
    const bd = b.deadline ? Date.parse(`${dateOnly(b.deadline)}T00:00:00`) : Number.POSITIVE_INFINITY;
    return ad - bd || budActivityTime(b) - budActivityTime(a);
  }
  const statusRank = { wilting: 0, bud: 1, flower: 2, fruit: 3, harvested: 4, rot: 5 };
  return (statusRank[normalizeBudStatus(a.status)] ?? 9) - (statusRank[normalizeBudStatus(b.status)] ?? 9)
    || budActivityTime(b) - budActivityTime(a);
}

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { openWith, scope } = useChatStore();
  const { authed } = useAuthStore();

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
  const [selectedBudId, setSelectedBudId] = useState<string | null>(() => searchParams.get("bud"));
  const [filter, setFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [progressMin, setProgressMin] = useState("");
  const [progressMax, setProgressMax] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [budSort, setBudSort] = useState<BudSort>("recent");
  const [confirming, setConfirming] = useState(false);
  const [editingPlant, setEditingPlant] = useState(false);
  const [plantNameDraft, setPlantNameDraft] = useState("");
  const [plantDescriptionDraft, setPlantDescriptionDraft] = useState("");
  const [plantSaveError, setPlantSaveError] = useState("");
  const [plantSaving, setPlantSaving] = useState(false);

  const { data: plantRes, isLoading: loadingPlant } = useQuery({
    queryKey: QK.plant(id),
    queryFn: () => getPlant(id),
    enabled: authed,
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
    enabled: authed,
  });

  const plant = plantRes?.ok ? plantRes.data : null;
  const allBuds = budsRes?.ok ? budsRes.data.items : [];

  useEffect(() => {
    if (!plant || editingPlant) return;
    setPlantNameDraft(plant.name);
    setPlantDescriptionDraft(plant.description ?? "");
  }, [plant, editingPlant]);

  // The plants table never maintains active_bud_count/harvested_count/rot_count
  // (they're write-never columns), so derive the header stats live from the buds.
  const headerStats = {
    active: allBuds.filter((b) => isActive(b.status)).length,
    harvested: allBuds.filter((b) => b.status === "harvested").length,
    rot: allBuds.filter((b) => normalizeBudStatus(b.status) === "rot").length,
  };
  const visible = useMemo(() => allBuds
    .filter((b) => {
      if (b.disappeared_at) return false;
      if (filter === "active" && !isActive(b.status)) return false;
      if (filter === "done" && !isDone(b.status)) return false;
      const status = normalizeBudStatus(b.status);
      if (statusFilter === "active" && !isActive(b.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && status !== statusFilter) return false;
      if (!matchesProgressRange(b, progressMin, progressMax)) return false;
      if (!matchesDeadline(b, deadlineFilter)) return false;
      return true;
    })
    .sort((a, b) => sortBuds(a, b, budSort)),
    [allBuds, filter, statusFilter, progressMin, progressMax, deadlineFilter, budSort]
  );
  const hasAdvancedFilter = statusFilter !== "all"
    || progressMin.trim() !== ""
    || progressMax.trim() !== ""
    || deadlineFilter !== "all"
    || budSort !== "recent";

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

  async function savePlantMeta() {
    if (!plant) return;
    const name = plantNameDraft.trim();
    if (!name) {
      setPlantSaveError("식물 이름을 입력해주세요.");
      return;
    }
    setPlantSaving(true);
    setPlantSaveError("");
    const result = await updatePlant(plant.id, {
      name,
      description: plantDescriptionDraft.trim(),
    });
    setPlantSaving(false);
    if (!result.ok) {
      setPlantSaveError(result.error.message);
      return;
    }
    setEditingPlant(false);
    qc.invalidateQueries({ queryKey: QK.plant(plant.id) });
    qc.invalidateQueries({ queryKey: QK.plants() });
    qc.invalidateQueries({ queryKey: QK.buds() });
    qc.invalidateQueries({ queryKey: QK.briefing() });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  return (
    <div className="app-page app-page-narrow">
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingPlant ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
                    <input
                      className="input"
                      value={plantNameDraft}
                      onChange={(event) => setPlantNameDraft(event.target.value)}
                      placeholder="식물 이름"
                      autoFocus
                      maxLength={60}
                      style={{ fontSize: 22, fontWeight: 700 }}
                    />
                    <textarea
                      className="input"
                      value={plantDescriptionDraft}
                      onChange={(event) => setPlantDescriptionDraft(event.target.value)}
                      placeholder="식물 설명"
                      rows={3}
                      style={{ resize: "vertical", fontFamily: "var(--font-sans)" }}
                    />
                    {plantSaveError && <div className="t-caption" style={{ color: "var(--danger)" }}>{plantSaveError}</div>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-primary btn-sm" disabled={plantSaving} onClick={savePlantMeta}>
                        {plantSaving ? "저장 중…" : "저장"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={plantSaving}
                        onClick={() => {
                          setEditingPlant(false);
                          setPlantSaveError("");
                          setPlantNameDraft(plant.name);
                          setPlantDescriptionDraft(plant.description ?? "");
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="t-display" style={{ color: "var(--fg)" }}>{plant.name}</h1>
                    {plant.description && (
                      <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 6, maxWidth: 560 }}>
                        {plant.description}
                      </p>
                    )}
                  </>
                )}
                <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
                  <BigStat label="활성" value={headerStats.active} />
                  <BigStat label="수확" value={headerStats.harvested} color="var(--positive)" />
                  <BigStat label="포기" value={headerStats.rot} color="var(--danger)" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span className="t-caption" style={{ color: "var(--fg-muted)" }}>
                  {formatKstDate(plant.created_at)} 시작
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => openWith({ kind: "plant", id: plant.id })}>
                  이 식물 상담
                </button>
                {!editingPlant && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingPlant(true)}>정보 수정</button>
                )}
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
          <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h2 className="t-h1" style={{ color: "var(--fg)" }}>봉우리</h2>
                <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 2 }}>
                  {visible.length}개 표시 · 전체 {allBuds.filter((b) => !b.disappeared_at).length}개
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <FilterToggle current={filter} onChange={setFilter} />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openWith({ kind: "plant", id: plant.id })}
                >
                  + 봉우리 추가
                </button>
              </div>
            </div>

            <div className="card-flat" style={{ padding: 10, borderRadius: "var(--r-md)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <FilterSelect
                label="상태"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  ["all", "전체 상태"],
                  ["active", "진행 상태"],
                  ["bud", "봉우리"],
                  ["flower", "꽃"],
                  ["fruit", "열매"],
                  ["wilting", "시듦"],
                  ["harvested", "수확"],
                  ["rot", "포기"],
                ]}
              />
              <ProgressRangeFilter
                min={progressMin}
                max={progressMax}
                onMinChange={setProgressMin}
                onMaxChange={setProgressMax}
              />
              <FilterSelect
                label="마감일"
                value={deadlineFilter}
                onChange={(value) => setDeadlineFilter(value as DeadlineFilter)}
                options={[
                  ["all", "전체 마감"],
                  ["overdue", "기한 지남"],
                  ["today", "오늘"],
                  ["week", "7일 이내"],
                  ["none", "마감 없음"],
                ]}
              />
              <FilterSelect
                label="정렬"
                value={budSort}
                onChange={(value) => setBudSort(value as BudSort)}
                options={[
                  ["recent", "최근 수정순"],
                  ["deadline", "마감 임박순"],
                  ["progress_desc", "진행률 높은순"],
                  ["progress_asc", "진행률 낮은순"],
                  ["status", "상태순"],
                ]}
              />
              {hasAdvancedFilter && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setProgressMin("");
                    setProgressMax("");
                    setDeadlineFilter("all");
                    setBudSort("recent");
                  }}
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {loadingBuds ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <BudRowSkeleton /><BudRowSkeleton /><BudRowSkeleton />
            </div>
          ) : visible.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", background: "var(--bg-subtle)" }}>
              <p className="t-body-sm" style={{ color: "var(--fg-muted)" }}>
                {filter === "all" && !hasAdvancedFilter ? "봉우리가 없습니다. AI에게 추가를 요청하세요." : "조건에 맞는 봉우리가 없습니다."}
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
        <BudDetailDrawer
          key={selectedBudId}
          budId={selectedBudId}
          onClose={() => {
            setSelectedBudId(null);
            if (searchParams.has("bud")) router.replace(`/plants/${id}`, { scroll: false });
          }}
        />
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 118 }}>
      <span className="t-caption" style={{ color: "var(--fg-muted)" }}>{label}</span>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ height: 34, fontSize: 12.5, padding: "0 28px 0 10px" }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ProgressRangeFilter({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 152 }}>
      <span className="t-caption" style={{ color: "var(--fg-muted)" }}>진행률</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={min}
          onChange={(event) => onMinChange(event.target.value)}
          onBlur={() => onMinChange(normalizeProgressInput(min))}
          placeholder="최소"
          aria-label="진행률 최소값"
          style={{ height: 34, width: 68, fontSize: 12.5, padding: "0 8px" }}
        />
        <span className="t-caption" style={{ color: "var(--fg-muted)" }}>~</span>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={max}
          onChange={(event) => onMaxChange(event.target.value)}
          onBlur={() => onMaxChange(normalizeProgressInput(max))}
          placeholder="최대"
          aria-label="진행률 최대값"
          style={{ height: 34, width: 68, fontSize: 12.5, padding: "0 8px" }}
        />
      </div>
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
