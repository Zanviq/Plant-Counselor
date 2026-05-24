"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getPlant, deletePlant } from "@/lib/api/plants";
import { listBuds, getBud, Bud } from "@/lib/api/buds";
import { useChatStore } from "@/lib/store/chatStore";
import {
  STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, BudStatus, isActive, isDone,
} from "@/lib/status";

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
  const { openWith } = useChatStore();
  const { data } = useQuery({ queryKey: ["bud", budId], queryFn: () => getBud(budId) });
  const bud = data?.ok ? data.data.bud : null;
  const history = data?.ok ? data.data.history : [];
  if (!bud) return null;

  const status = bud.status as BudStatus;

  // Quick actions hand off to chat with a self-contained instruction so the
  // LLM uses the correct skill without further clarification.
  function quick(prompt: string) {
    openWith({ kind: "bud", id: bud!.id });
    setTimeout(() => {
      const ev = new CustomEvent("pc-chat-prompt", { detail: prompt });
      window.dispatchEvent(ev);
    }, 80);
  }
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 39, background: "var(--bg-overlay)", backdropFilter: "blur(3px)" }}
      />
      <aside
        className="animate-in-right"
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: 400, zIndex: 40,
          background: "var(--bg-elevated)", borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
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
              <span className="t-label" style={{ color: "var(--fg-muted)" }}>진행률</span>
              <span className="t-h3" style={{ color: "var(--accent)" }}>{bud.progress}%</span>
            </div>
            <div className="progress-track" style={{ height: 6 }}>
              <div className="progress-fill" style={{ width: `${bud.progress}%` }} />
            </div>
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
  const { openWith } = useChatStore();
  const [selectedBudId, setSelectedBudId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);

  const { data: plantRes } = useQuery({ queryKey: ["plant", id], queryFn: () => getPlant(id) });
  const { data: budsRes }  = useQuery({ queryKey: ["buds", { plant_id: id }], queryFn: () => listBuds({ plant_id: id }) });

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
    qc.invalidateQueries({ queryKey: ["plants"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    router.replace("/plants");
  }

  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 960, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 20 }}>
        ← 정원으로
      </button>

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

          {visible.length === 0 ? (
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
