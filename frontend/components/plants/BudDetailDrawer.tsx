"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBud, setBudProgress, deleteBud, moveBud } from "@/lib/api/buds";
import { listPlants } from "@/lib/api/plants";
import { useChatStore } from "@/lib/store/chatStore";
import {
  STATUS_LABEL, STATUS_PILL, normalizeBudStatus, isDone,
} from "@/lib/status";
import { QK } from "@/lib/queryKeys";

export function BudDetailDrawer({ budId, onClose }: { budId: string; onClose: () => void }) {
  const { open: chatOpen, chatWidth, openWith } = useChatStore();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: QK.bud(budId), queryFn: () => getBud(budId) });
  const { data: plantsRes } = useQuery({ queryKey: QK.plants(), queryFn: () => listPlants() });
  const [draft, setDraft] = useState<number | null>(null);
  const [reasonFor, setReasonFor] = useState<number | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const bud = data?.ok ? data.data.bud : null;
  const history = data?.ok ? data.data.history : [];
  if (!bud) return null;
  const currentBud = bud;
  const plants = plantsRes?.ok ? plantsRes.data.items : [];
  const movablePlants = plants.filter((plant) => plant.id !== currentBud.plant_id && plant.status !== "archived");

  const status = normalizeBudStatus(currentBud.status);
  const editable = !isDone(currentBud.status);
  const canHarvest = currentBud.progress >= 100;
  const shown = draft ?? currentBud.progress;

  function quick(prompt: string) {
    openWith({ kind: "bud", id: currentBud.id });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("pc-chat-prompt", { detail: prompt }));
    }, 80);
  }

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
      openWith({ kind: "bud", id: budId }, {
        send:
          `방금 '${currentBud.title}' 봉우리의 진행률을 직접 ${value}%로 변경했어요.\n` +
          `이유: ${note}\n\n` +
          `진행률은 이미 변경됐으니 다시 바꾸지 말고, 이 변화에 대해 짧게 조언하거나 ` +
          `다음에 무엇을 하면 좋을지 알려줘.`,
      });
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

  const drawerRight = chatOpen ? chatWidth : 0;

  return (
    <>
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
          zIndex: 45,
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
          <h3 className="t-h1" style={{ color: "var(--fg)" }}>{currentBud.title}</h3>
          {currentBud.detail && (
            <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.6 }}>
              {currentBud.detail}
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
                    if (v !== currentBud.progress) setReasonFor(v);
                  }}
                  onKeyUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v !== currentBud.progress) setReasonFor(v);
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
                <div className="progress-fill" style={{ width: `${currentBud.progress}%` }} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            <MetaCell label="유형" value={currentBud.type === "concern" ? "고민" : "일정"} />
            <MetaCell label="마감일" value={currentBud.deadline ?? "없음"} accent={currentBud.deadline ? "warning" : undefined} />
            <MetaCell label="생성일" value={new Date(currentBud.created_at).toLocaleDateString("ko-KR")} />
            <MetaCell label="마지막 진행" value={currentBud.last_progress_at ? new Date(currentBud.last_progress_at).toLocaleDateString("ko-KR") : "—"} />
          </div>

          {history.length > 0 && (
            <>
              <div className="t-label" style={{ color: "var(--fg-muted)", marginBottom: 8 }}>상태 변경 이력</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => {
                  const fromS = h.from_status ? normalizeBudStatus(h.from_status) : null;
                  const toS = normalizeBudStatus(h.to_status);
                  return (
                    <li key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--fg-secondary)" }}>
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
          {!isDone(currentBud.status) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => quick(`이 봉우리(id=${currentBud.id}) 진행률을 ${Math.min(100, currentBud.progress + 20)}%로 올려줘`)}>
                +20%
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!canHarvest}
                title={canHarvest ? "봉우리 수확" : "진행률 100%를 달성하면 수확할 수 있습니다."}
                onClick={() => quick(`이 봉우리(id=${currentBud.id})를 수확(완료) 처리해줘`)}
              >
                수확
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => quick(`이 봉우리(id=${currentBud.id})를 포기 처리해줘`)}>
                포기
              </button>
            </div>
          )}
          {!isDone(currentBud.status) && !canHarvest && (
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
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={() => openWith({ kind: "bud", id: currentBud.id })}>
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
              <strong style={{ color: "var(--fg)" }}>{currentBud.title}</strong> 봉우리와 정원에서 연결된 줄기가 함께 사라집니다.
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

      {reasonFor !== null && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setReasonFor(null); setReasonText(""); setDraft(null); }}
        >
          <div className="card" style={{ width: 380, maxWidth: "92vw", padding: "22px 24px", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
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
              <button className="btn btn-ghost" disabled={saving} onClick={() => commitProgress(reasonFor, "", false)}>
                그냥 저장
              </button>
              <button className="btn btn-primary" disabled={saving || !reasonText.trim()} onClick={() => commitProgress(reasonFor, reasonText.trim(), true)}>
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
