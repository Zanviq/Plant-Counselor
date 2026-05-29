"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getCalendar, getSummary, getBriefing,
  createCalendarEvent, deleteCalendarEvent,
} from "@/lib/api/stats";
import { listPlants, Plant } from "@/lib/api/plants";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { STATUS_COLOR_VAR, BudStatus } from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { CalendarSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface CalEvent {
  id: string;
  title: string;
  status: string;
  type: string;
  detail: string;
  plant_name: string;
  plant_id: string | null;
  source: "bud" | "event";
}

/** Dot/accent colour for an event: standalone events use the accent, bud
 *  deadlines use their lifecycle status colour. */
function eventColor(ev: CalEvent): string {
  if (ev.source === "event") return "var(--accent)";
  return STATUS_COLOR_VAR[(ev.status as BudStatus)] ?? "var(--fg-muted)";
}

export default function CalendarPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { openWith } = useChatStore();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState<string>("");

  const from = ymd(year, month, 1);
  const to   = ymd(year, month, daysInMonth(year, month));

  const { accessToken } = useAuthStore();

  // Prefetch adjacent months so prev/next navigation is instant.
  useEffect(() => {
    if (!accessToken) return;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;

    qc.prefetchQuery({
      queryKey: QK.calendar(prevY, prevM),
      queryFn: () => getCalendar(ymd(prevY, prevM, 1), ymd(prevY, prevM, daysInMonth(prevY, prevM))),
      staleTime: 5 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: QK.calendar(nextY, nextM),
      queryFn: () => getCalendar(ymd(nextY, nextM, 1), ymd(nextY, nextM, daysInMonth(nextY, nextM))),
      staleTime: 5 * 60_000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, accessToken]);
  const { data: calRes,     isLoading: loadingCal } = useQuery({ queryKey: QK.calendar(year, month), queryFn: () => getCalendar(from, to), staleTime: 5 * 60_000, enabled: !!accessToken });
  const { data: briefRes }                           = useQuery({ queryKey: QK.briefing(), queryFn: getBriefing, staleTime: 5 * 60_000,    enabled: !!accessToken });
  const { data: summaryRes }                         = useQuery({ queryKey: QK.summary(),  queryFn: getSummary,                             enabled: !!accessToken });
  const { data: plantsRes }                          = useQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(),                     enabled: !!accessToken });

  const events: Record<string, CalEvent[]> = calRes?.ok ? calRes.data.events : {};
  const summary = summaryRes?.ok ? summaryRes.data : null;
  const briefing = briefRes?.ok ? briefRes.data.briefing : "";
  const plants: Plant[] = plantsRes?.ok ? plantsRes.data.items : [];

  const totalEvents = Object.values(events).reduce((s, arr) => s + arr.length, 0);
  const cells: (number | null)[] = [
    ...Array(firstWeekday(year, month)).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelected(null); }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelected(null); }

  const selectedKey = selected ? ymd(year, month, selected) : null;
  const selectedEvents: CalEvent[] = selectedKey ? (events[selectedKey] ?? []) : [];
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEvents: CalEvent[] = events[todayKey] ?? [];

  function openCalendarChat() {
    openWith({ kind: "calendar" });
  }

  function openAdd(dateKey?: string) {
    setAddDate(dateKey ?? selectedKey ?? todayKey);
    setAddOpen(true);
  }

  function invalidateCalendar() {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: QK.summary() });
  }

  async function handleDeleteEvent(id: string) {
    const r = await deleteCalendarEvent(id);
    if (r.ok) invalidateCalendar();
  }

  return (
    <div style={{ padding: "32px 36px 48px", maxWidth: 1200, margin: "0 auto" }}>
      <header className="animate-in" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="t-display" style={{ color: "var(--fg)" }}>캘린더</h1>
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>
            마감 일정을 한눈에 보고 오늘 할 일을 정리합니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => openAdd()}>
            + 일정 추가
          </button>
          <button className="btn btn-primary" onClick={openCalendarChat}>
            일정 AI와 대화
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
        {/* Calendar card */}
        {loadingCal ? <CalendarSkeleton /> : null}
        <section className="card" style={{ padding: 18, display: loadingCal ? "none" : undefined }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div className="t-h1" style={{ color: "var(--fg)" }}>{year}년 {MONTHS[month]}</div>
              <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 2 }}>일정 {totalEvents}개</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={prev} className="btn btn-ghost btn-sm" aria-label="이전 달">&#8249;</button>
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(today.getDate()); }} className="btn btn-secondary btn-sm">오늘</button>
              <button onClick={next} className="btn btn-ghost btn-sm" aria-label="다음 달">&#8250;</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {WEEKDAYS.map(w => (
              <div key={w} className="t-caption" style={{ color: "var(--fg-muted)", textAlign: "center", padding: "6px 0" }}>{w}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const key = ymd(year, month, d);
              const dayEvents = events[key] ?? [];
              const t = isToday(d);
              const sel = selected === d;
              return (
                <button key={key} onClick={() => setSelected(sel ? null : d)} style={{
                  minHeight: 64, padding: "6px 7px", borderRadius: "var(--r-md)",
                  border: "1px solid", borderColor: t ? "var(--accent)" : sel ? "var(--accent)" : "transparent",
                  background: t ? "var(--accent-muted)" : sel ? "var(--bg-subtle)" : "transparent",
                  cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 3,
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => { if (!t && !sel) e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={e => { if (!t && !sel) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 13, fontWeight: t ? 700 : 500, color: t ? "var(--accent-fg)" : "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{d}</span>
                  {dayEvents.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 1 }}>
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <span key={j} className="dot" style={{ width: 5, height: 5, background: eventColor(ev) }} title={ev.title} />
                      ))}
                      {dayEvents.length > 3 && <span className="t-caption" style={{ color: "var(--fg-muted)", fontSize: 10 }}>+{dayEvents.length - 3}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Today's schedule */}
          <section className="card" style={{ padding: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <div className="t-h3" style={{ color: "var(--fg)" }}>오늘 일정</div>
              <div className="t-caption" style={{ color: "var(--fg-muted)" }}>{today.getMonth() + 1}월 {today.getDate()}일</div>
            </div>
            {todayEvents.length === 0 ? (
              <p className="t-caption" style={{ color: "var(--fg-muted)" }}>오늘 일정이 없습니다.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {todayEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev}
                    onClick={() => ev.plant_id && router.push(`/plants/${ev.plant_id}`)}
                    onDelete={ev.source === "event" ? () => handleDeleteEvent(ev.id) : undefined} />
                ))}
              </ul>
            )}
          </section>

          {/* AI suggestion */}
          <section className="card" style={{ padding: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <div className="t-h3" style={{ color: "var(--fg)" }}>AI 일정 제안</div>
              <div className="t-caption" style={{ color: "var(--fg-muted)" }}>식물 상태 기반</div>
            </div>
            {briefing ? (
              <p className="t-body-sm" style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}>
                {briefing.length > 140 ? briefing.slice(0, 140) + "..." : briefing}
              </p>
            ) : (
              <p className="t-caption" style={{ color: "var(--fg-muted)" }}>AI에게 오늘 일정을 물어보세요.</p>
            )}
            <button className="btn btn-ghost btn-sm" onClick={openCalendarChat} style={{ marginTop: 8, paddingLeft: 0 }}>
              AI에게 물어보기 →
            </button>
          </section>

          {/* Quick add */}
          <button className="btn btn-primary btn-lg" onClick={() => openAdd()} style={{ width: "100%" }}>
            + 일정 추가
          </button>
        </div>
      </div>

      {/* Selected day events */}
      {selected !== null && (
        <section className="card animate-in" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="t-label" style={{ color: "var(--fg-muted)" }}>
              {month + 1}월 {selected}일 일정
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => openAdd(selectedKey ?? undefined)}>+ 이 날짜에 추가</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="t-caption" style={{ color: "var(--fg-muted)" }}>이 날짜에 일정이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {selectedEvents.map(ev => (
                <EventCard key={ev.id} ev={ev}
                  onClick={() => ev.plant_id && router.push(`/plants/${ev.plant_id}`)}
                  onDelete={ev.source === "event" ? () => handleDeleteEvent(ev.id) : undefined} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Summary */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="stagger">
        {!summaryRes ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <SmallStat label="진행 중인 일정" value={summary?.active_schedules ?? 0} accent="default" />
            <SmallStat label="진행 중인 고민" value={summary?.active_concerns ?? 0} accent="default" />
            <SmallStat label="주의 필요"     value={summary?.wilting_count ?? 0} accent="warning" />
            <SmallStat label="이번 달 수확"   value={summary?.harvested_this_month ?? 0} accent="positive" />
          </>
        )}
      </section>

      {addOpen && (
        <AddEventModal
          plants={plants}
          initialDate={addDate}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); invalidateCalendar(); }}
        />
      )}
    </div>
  );
}

// ── Add event modal ─────────────────────────────────────────

function AddEventModal({
  plants, initialDate, onClose, onCreated,
}: {
  plants: Plant[];
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [plantId, setPlantId] = useState<string>(plants[0]?.id ?? "");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!title.trim()) { setErr("일정 제목을 입력해주세요."); return; }
    if (!date) { setErr("날짜를 선택해주세요."); return; }
    setSaving(true);
    setErr("");
    const r = await createCalendarEvent({
      title: title.trim(),
      date,
      plant_id: plantId || null,
      detail: detail.trim(),
    });
    setSaving(false);
    if (r.ok) onCreated();
    else setErr(r.error.message || "일정 추가에 실패했습니다.");
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 420, maxWidth: "92vw", padding: "22px 24px", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="t-h2" style={{ color: "var(--fg)", marginBottom: 16 }}>일정 추가</div>

        <Field label="제목">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 치과 예약"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={inputStyle}
          />
        </Field>

        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="관련 식물">
          {plants.length === 0 ? (
            <div className="t-caption" style={{ color: "var(--fg-muted)" }}>
              아직 식물이 없습니다. 식물 없이도 일정을 추가할 수 있어요.
            </div>
          ) : (
            <select value={plantId} onChange={(e) => setPlantId(e.target.value)} style={inputStyle}>
              <option value="">(관련 식물 없음)</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </Field>

        <Field label="세부 정보 (선택)">
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="예: 오후 2시, 강남역"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={inputStyle}
          />
        </Field>

        {err && <div className="t-caption" style={{ color: "var(--danger)", marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "추가 중…" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="t-label" style={{ color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", borderRadius: "var(--r-md)",
  background: "var(--bg-subtle)", border: "1px solid var(--border)",
  color: "var(--fg)", fontSize: 13.5, outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
};

// ── Event card with plant name + detail ─────────────────────

function EventCard({ ev, onClick, onDelete }: { ev: CalEvent; onClick: () => void; onDelete?: () => void }) {
  return (
    <li>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
        borderRadius: "var(--r-md)", background: "var(--bg-elevated)",
        textAlign: "left", transition: "background 0.12s",
      }}>
        <span className="dot" style={{ background: eventColor(ev), width: 8, height: 8, marginTop: 5, flexShrink: 0 }} />
        <button
          onClick={onClick}
          style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: ev.plant_id ? "pointer" : "default" }}
        >
          <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ev.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            {ev.plant_name && (
              <span className="badge badge-muted" style={{ fontSize: 10, height: 18, padding: "0 6px" }}>{ev.plant_name}</span>
            )}
            {ev.detail && (
              <span className="t-caption" style={{ color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ev.detail.length > 30 ? ev.detail.slice(0, 30) + "..." : ev.detail}
              </span>
            )}
          </div>
        </button>
        <span className="badge badge-muted" style={{ flexShrink: 0, fontSize: 10, height: 18, padding: "0 6px" }}>
          {ev.source === "event" ? "일정" : ev.type === "schedule" ? "봉우리·일정" : "봉우리·고민"}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="일정 삭제"
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, padding: "0 6px", height: 20, color: "var(--fg-muted)" }}
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: number; accent: "default" | "warning" | "positive" }) {
  const color = accent === "warning" ? "var(--warning)" : accent === "positive" ? "var(--positive)" : "var(--fg-muted)";
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span className="dot" style={{ background: color }} />
        <span className="t-label" style={{ color: "var(--fg-muted)" }}>{label}</span>
      </div>
      <div className="t-numeral" style={{ color: "var(--fg)" }}>{value}</div>
    </div>
  );
}
