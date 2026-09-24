"use client";

import { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getCalendar, getSummary, getBriefing,
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  undoLastAction,
  type CalendarEventColor, type CalendarEventRepeatRule, type CalEvent,
} from "@/lib/api/stats";
import { listPlants, Plant } from "@/lib/api/plants";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { STATUS_COLOR_VAR, normalizeBudStatus } from "@/lib/status";
import { QK } from "@/lib/queryKeys";
import { CalendarSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { AiChatButton } from "@/components/chat/AiChatButton";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const EVENT_COLOR_OPTIONS: { id: CalendarEventColor; label: string; value: string }[] = [
  { id: "olive",  label: "올리브", value: "#5C6B3F" },
  { id: "blue",   label: "파랑",   value: "#4A6A8A" },
  { id: "yellow", label: "노랑",   value: "#C49A2A" },
  { id: "red",    label: "빨강",   value: "#B54A3A" },
  { id: "pink",   label: "분홍",   value: "#C56A86" },
  { id: "purple", label: "보라",   value: "#80679A" },
];
const EVENT_COLOR_VALUE = Object.fromEntries(
  EVENT_COLOR_OPTIONS.map(({ id, value }) => [id, value])
) as Record<CalendarEventColor, string>;
const REPEAT_OPTIONS: { id: CalendarEventRepeatRule; label: string }[] = [
  { id: "none", label: "안 함" },
  { id: "daily", label: "매일" },
  { id: "weekly", label: "매주" },
  { id: "monthly", label: "매월" },
  { id: "yearly", label: "매년" },
];
const REPEAT_LABEL: Record<CalendarEventRepeatRule, string> = Object.fromEntries(
  REPEAT_OPTIONS.map(({ id, label }) => [id, label])
) as Record<CalendarEventRepeatRule, string>;

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDaysKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function defaultEventTime() {
  return "12:00";
}

function addOneHour(value: string) {
  const [hRaw, mRaw] = value.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "13:00";
  return `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(year)}. ${Number(month)}. ${Number(day)}.`;
}

function timeLabel(value: string) {
  const [hourRaw, minute = "00"] = value.split(":");
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return value;
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${minute}`;
}

function eventRangeSummary(startDate: string, endDate: string, startTime: string, endTime: string, allDay: boolean) {
  if (allDay) {
    return startDate === endDate
      ? `${dateLabel(startDate)} 하루 종일`
      : `${dateLabel(startDate)}–${dateLabel(endDate)} 하루 종일`;
  }
  if (startDate === endDate) {
    return `${dateLabel(startDate)} ${timeLabel(startTime)}–${timeLabel(endTime)}`;
  }
  return `${dateLabel(startDate)} ${timeLabel(startTime)}–${dateLabel(endDate)} ${timeLabel(endTime)}`;
}

function eventTimeLabel(ev: CalEvent): string | null {
  if (ev.source !== "event") return null;
  if (ev.all_day ?? true) return "하루 종일";
  if (!ev.time) return null;
  return ev.end_time ? `${ev.time}–${ev.end_time}` : ev.time;
}

function eventSortValue(ev: CalEvent): string {
  if (ev.source !== "event") return `1-${ev.title}`;
  if (ev.all_day ?? true) return `0-00:00-${ev.title}`;
  return `2-${ev.time ?? "99:99"}-${ev.title}`;
}

/** Standalone events use their selected palette colour; bud deadlines use
 *  their lifecycle status colour. */
function eventColor(ev: CalEvent): string {
  if (ev.source === "event") return EVENT_COLOR_VALUE[ev.color ?? "olive"];
  return STATUS_COLOR_VAR[normalizeBudStatus(ev.status ?? "")] ?? "var(--fg-muted)";
}

function isDraggableCalendarEvent(ev: CalEvent): boolean {
  return ev.source === "event" && (ev.repeat_rule ?? "none") === "none";
}

function isMultiDayCalendarEvent(ev: CalEvent): boolean {
  return ev.source === "event" && (ev.repeat_rule ?? "none") === "none" && !!ev.date && !!ev.end_date && ev.date !== ev.end_date;
}

type CalendarSlotItem = { event: CalEvent; slot: number; hiddenBefore: number };
const MONTH_EVENT_SLOT_LIMIT = 3;

function eventInstanceKey(ev: CalEvent): string {
  return `${ev.source}:${ev.id}:${ev.source === "event" && ev.repeat_rule !== "none" ? ev.occurrence_date ?? ev.date ?? "" : ""}`;
}

function buildMonthSlots(events: Record<string, CalEvent[]>): Record<string, CalendarSlotItem[]> {
  const slotByEvent = new Map<string, number>();
  const occupiedByDay = new Map<string, Set<number>>();
  const result: Record<string, CalendarSlotItem[]> = {};
  const dayKeys = Object.keys(events).sort();

  for (const dayKey of dayKeys) {
    const prevEvents = events[addDaysKey(dayKey, -1)] ?? [];
    const dayEvents = [...(events[dayKey] ?? [])].sort((a, b) => {
      const aContinues = isMultiDayCalendarEvent(a) && prevEvents.some((other) => other.id === a.id && other.source === "event");
      const bContinues = isMultiDayCalendarEvent(b) && prevEvents.some((other) => other.id === b.id && other.source === "event");
      if (aContinues !== bContinues) return aContinues ? -1 : 1;
      return eventSortValue(a).localeCompare(eventSortValue(b));
    });
    for (const ev of dayEvents) {
      const instanceKey = eventInstanceKey(ev);
      let slot = slotByEvent.get(instanceKey);
      if (slot === undefined) {
        const occupied = occupiedByDay.get(dayKey) ?? new Set<number>();
        slot = 0;
        while (occupied.has(slot)) slot += 1;
        slotByEvent.set(instanceKey, slot);
      }
      const occupied = occupiedByDay.get(dayKey) ?? new Set<number>();
      occupied.add(slot);
      occupiedByDay.set(dayKey, occupied);
      const hiddenBefore = Array.from(occupied).filter((value) => value < slot && value >= MONTH_EVENT_SLOT_LIMIT).length;
      result[dayKey] = [...(result[dayKey] ?? []), { event: ev, slot, hiddenBefore }];
    }
  }

  for (const dayKey of Object.keys(result)) {
    result[dayKey].sort((a, b) => a.slot - b.slot);
  }
  return result;
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
  const [editingEvent, setEditingEvent] = useState<{ event: CalEvent; date: string } | null>(null);
  const [draggingEvent, setDraggingEvent] = useState<CalEvent | null>(null);
  const [notice, setNotice] = useState<string>("");

  const from = ymd(year, month, 1);
  const to   = ymd(year, month, daysInMonth(year, month));

  const { authed } = useAuthStore();

  // Prefetch adjacent months so prev/next navigation is instant.
  useEffect(() => {
    if (!authed) return;
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
  }, [year, month, authed]);
  const { data: calRes,     isLoading: loadingCal } = useQuery({ queryKey: QK.calendar(year, month), queryFn: () => getCalendar(from, to), staleTime: 5 * 60_000, enabled: authed });
  const { data: briefRes }                           = useQuery({ queryKey: QK.briefing(), queryFn: getBriefing, staleTime: 5 * 60_000,    enabled: authed });
  const { data: summaryRes }                         = useQuery({ queryKey: QK.summary(),  queryFn: getSummary,                             enabled: authed });
  const { data: plantsRes }                          = useQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(),                     enabled: authed });

  const events: Record<string, CalEvent[]> = calRes?.ok ? calRes.data.events : {};
  const monthSlots = useMemo(() => buildMonthSlots(events), [events]);
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

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelected(1); }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelected(1); }

  const selectedKey = selected ? ymd(year, month, selected) : null;
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedEvents: CalEvent[] = useMemo(
    () => selectedKey ? [...(events[selectedKey] ?? [])].sort((a, b) => eventSortValue(a).localeCompare(eventSortValue(b))) : [],
    [events, selectedKey]
  );
  const selectedLabel = selected ? `${month + 1}월 ${selected}일` : "날짜를 선택하세요";

  /** Open the calendar AI and actually ask it to explain the selected schedule
   *  (a real streamed LLM call, not a canned reply). */
  function askCalendarAI() {
    openWith({ kind: "calendar" }, { send: selectedKey ? `${selectedKey} 일정 설명해줘` : "오늘 일정 설명해줘" });
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
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    const r = await deleteCalendarEvent(id);
    if (r.ok) {
      setNotice("일정을 삭제했습니다.");
      invalidateCalendar();
    }
    else window.alert(`일정 삭제 실패: ${r.error.message}`);
  }

  async function handleUndo() {
    const r = await undoLastAction();
    if (r.ok) {
      setNotice(`되돌렸습니다: ${r.data.label}`);
      invalidateCalendar();
      qc.invalidateQueries({ queryKey: ["buds"] });
      qc.invalidateQueries({ queryKey: ["plants"] });
    } else {
      window.alert(r.error.message);
    }
  }

  async function moveEventToDate(ev: CalEvent, targetDate: string) {
    if (ev.source !== "event" || !ev.date || ev.date === targetDate) return;
    if ((ev.repeat_rule ?? "none") !== "none") {
      window.alert("반복 일정은 드래그로 이동하지 않고 수정 창에서 시작 날짜를 변경해주세요.");
      return;
    }
    const start = new Date(`${ev.date}T00:00:00`);
    const end = new Date(`${ev.end_date ?? ev.date}T00:00:00`);
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    const target = new Date(`${targetDate}T00:00:00`);
    const newEnd = new Date(target.getTime() + durationMs);
    const newEndDate = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, "0")}-${String(newEnd.getDate()).padStart(2, "0")}`;
    const r = await updateCalendarEvent(ev.id, { date: targetDate, end_date: newEndDate });
    if (r.ok) {
      setSelected(Number(targetDate.slice(8, 10)));
      invalidateCalendar();
    } else {
      window.alert(`일정 이동 실패: ${r.error.message}`);
    }
  }

  return (
    <div className="app-page app-page-calendar" style={{ "--page-pad-y": "24px" } as CSSProperties}>
      {/* Top-right AI chat button (hides while the chat panel is open) */}
      <AiChatButton style={{ position: "fixed", top: 24, right: 28, zIndex: 30 }} />

      <header className="animate-in" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="t-display" style={{ color: "var(--fg)" }}>캘린더</h1>
          <p className="t-body-sm" style={{ color: "var(--fg-muted)", marginTop: 4 }}>
            마감 일정을 한눈에 보고 오늘 할 일을 정리합니다.
          </p>
        </div>
      </header>

      {notice && (
        <div className="card animate-in" style={{ marginBottom: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, background: "var(--accent-muted)" }}>
          <span className="t-body-sm" style={{ color: "var(--accent-fg)", flex: 1 }}>{notice}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleUndo}>되돌리기</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setNotice("")}>닫기</button>
        </div>
      )}

      <div className="calendar-layout">
        {/* Calendar card */}
        {loadingCal ? <CalendarSkeleton /> : null}
        <section className="card" style={{ padding: 18, minHeight: 0, overflow: "visible", display: loadingCal ? "none" : undefined }}>
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

          <div className="calendar-month-scroll">
            <div className="calendar-month-inner">
              <div className="calendar-weekday-row">
                {WEEKDAYS.map(w => (
                  <div key={w} className="t-caption" style={{ color: "var(--fg-muted)", textAlign: "center", padding: "6px 0" }}>{w}</div>
                ))}
              </div>

              <div className="calendar-month-grid">
                {cells.map((d, i) => {
                  if (!d) return <div key={`empty-${i}`} />;
                  const key = ymd(year, month, d);
                  const dayEvents = events[key] ?? [];
                  const daySlots = monthSlots[key] ?? [];
                  const t = isToday(d);
                  const sel = selected === d;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      className="calendar-day-cell"
                      onClick={() => setSelected(d)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(d); }}
                      onDragOver={(e) => { if (draggingEvent) e.preventDefault(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingEvent) void moveEventToDate(draggingEvent, key);
                        setDraggingEvent(null);
                      }}
                      style={{
                        borderColor: t ? "var(--accent)" : sel ? "var(--accent)" : "transparent",
                        background: t ? "var(--accent-muted)" : sel ? "var(--bg-subtle)" : "transparent",
                      }}
                      onMouseEnter={e => { if (!t && !sel) e.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseLeave={e => { if (!t && !sel) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: t ? 700 : 500,
                          color: t ? "var(--accent-fg)" : "var(--fg)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          lineHeight: 1.2,
                        }}
                      >
                        {d}
                      </span>
                      {daySlots.length > 0 && (
                        <div className="calendar-event-stack">
                          {Array.from({ length: Math.min(MONTH_EVENT_SLOT_LIMIT, Math.max(...daySlots.map((item) => item.slot), 0) + 1) }, (_, slot) => {
                            const item = daySlots.find((candidate) => candidate.slot === slot);
                            if (!item) return <div key={`empty-slot-${slot}`} style={{ height: 16 }} />;
                            const ev = item.event;
                            const draggable = isDraggableCalendarEvent(ev);
                            const connected = isMultiDayCalendarEvent(ev);
                            const continuesFromPrev = connected && (events[addDaysKey(key, -1)] ?? []).some((other) => other.id === ev.id && other.source === "event");
                            const continuesToNext = connected && (events[addDaysKey(key, 1)] ?? []).some((other) => other.id === ev.id && other.source === "event");
                            return (
                              <div
                                key={`${ev.id}-${ev.occurrence_date ?? slot}`}
                                draggable={draggable}
                                className="calendar-event-pill"
                                onDragStart={(e) => {
                                  if (!draggable) return;
                                  e.stopPropagation();
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", ev.id);
                                  setDraggingEvent(ev);
                                }}
                                onDragEnd={() => setDraggingEvent(null)}
                                title={draggable ? `${ev.title} 드래그해서 날짜 이동` : ev.source === "event" ? `${ev.title} · 반복 일정은 수정 창에서 변경` : ev.title}
                                style={{
                                  "--event-left": continuesFromPrev ? "-11px" : "0px",
                                  "--event-right": continuesToNext ? "-11px" : "0px",
                                  borderTopLeftRadius: continuesFromPrev ? 0 : 5,
                                  borderBottomLeftRadius: continuesFromPrev ? 0 : 5,
                                  borderTopRightRadius: continuesToNext ? 0 : 5,
                                  borderBottomRightRadius: continuesToNext ? 0 : 5,
                                  background: eventColor(ev),
                                  opacity: ev.source === "event" ? 0.9 : 0.55,
                                  cursor: draggable ? "grab" : "default",
                                  zIndex: connected ? 1 : "auto",
                                } as CSSProperties}
                              >
                                {continuesFromPrev ? "" : ev.title}
                              </div>
                            );
                          })}
                          {daySlots.some((item) => item.slot >= MONTH_EVENT_SLOT_LIMIT) && (
                            <span className="t-caption" style={{ color: "var(--fg-muted)", fontSize: 10 }}>
                              +{daySlots.filter((item) => item.slot >= MONTH_EVENT_SLOT_LIMIT).length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Right column */}
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          {/* Selected date schedule */}
          <section className="card" style={{ padding: 16, flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 10 }}>
              <div className="t-h3" style={{ color: "var(--fg)" }}>선택 날짜 일정</div>
              <div className="t-caption" style={{ color: "var(--fg-muted)" }}>{selectedLabel}</div>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="t-caption" style={{ color: "var(--fg-muted)" }}>{selected ? "선택한 날짜에 일정이 없습니다." : "달력에서 날짜를 선택하세요."}</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0 }}>
                {selectedEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev}
                    onClick={() => ev.source === "bud"
                      ? router.push(`/plants/${ev.plant_id}?bud=${encodeURIComponent(ev.id)}`)
                      : setEditingEvent({ event: ev, date: selectedKey! })}
                    onEdit={ev.source === "event" ? () => setEditingEvent({ event: ev, date: selectedKey! }) : undefined}
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
              <p className="t-caption" style={{ color: "var(--fg-muted)" }}>AI에게 선택한 날짜 일정을 물어보세요.</p>
            )}
            <button className="btn btn-ghost btn-sm" onClick={askCalendarAI} style={{ marginTop: 8, paddingLeft: 0 }}>
              선택 날짜 일정 물어보기 →
            </button>
          </section>

          {/* Quick add */}
          <button className="btn btn-primary btn-lg" onClick={() => openAdd()} style={{ width: "100%" }}>
            + 일정 추가
          </button>
        </div>
      </div>

      {/* Summary */}
      <section className="card" style={{ padding: 14 }}>
        <div className="t-h2" style={{ color: "var(--fg)", marginBottom: 12 }}>일정 상태 요약</div>
        <div className="calendar-summary-grid stagger">
          {!summaryRes ? (
            <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
          ) : (
            <>
              <SmallStat label="진행 중인 일정" value={summary?.active_schedules ?? 0} accent="default" sub="활성 일정 봉우리" />
              <SmallStat label="진행 중인 고민" value={summary?.active_concerns ?? 0} accent="info" sub="활성 고민 봉우리" />
              <SmallStat label="주의 필요"     value={summary?.wilting_count ?? 0} accent="warning" sub="시들고 있는 봉우리" />
              <SmallStat label="이번 달 수확"   value={summary?.harvested_this_month ?? 0} accent="positive" sub="완료된 봉우리" />
            </>
          )}
        </div>
      </section>

      {addOpen && (
        <EventModal
          plants={plants}
          initialDate={addDate}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); invalidateCalendar(); }}
        />
      )}

      {editingEvent && (
        <EventModal
          plants={plants}
          initialDate={editingEvent.date}
          event={editingEvent.event}
          onClose={() => setEditingEvent(null)}
          onSaved={() => { setEditingEvent(null); invalidateCalendar(); }}
        />
      )}
    </div>
  );
}

// ── Create / edit standalone event modal ────────────────────

function EventModal({
  plants, initialDate, event, onClose, onSaved,
}: {
  plants: Plant[];
  initialDate: string;
  event?: CalEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialStartTime = event?.time ?? defaultEventTime();
  const [title, setTitle] = useState(event?.title ?? "");
  const [startDate, setStartDate] = useState(event?.date ?? initialDate);
  const [endDate, setEndDate] = useState(event?.end_date ?? event?.date ?? initialDate);
  const [allDay, setAllDay] = useState(event ? event.all_day ?? true : false);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(event?.end_time ?? addOneHour(initialStartTime));
  const [repeatRule, setRepeatRule] = useState<CalendarEventRepeatRule>(event?.repeat_rule ?? "none");
  const [timeOpen, setTimeOpen] = useState(false);
  const [plantId, setPlantId] = useState<string>(event ? event.plant_id ?? "" : plants[0]?.id ?? "");
  const [detail, setDetail] = useState(event?.detail ?? "");
  const [color, setColor] = useState<CalendarEventColor>(event?.color ?? "olive");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const editing = !!event;

  async function submit() {
    if (!title.trim()) { setErr("일정 제목을 입력해주세요."); return; }
    if (!startDate || !endDate) { setErr("시작과 종료 날짜를 선택해주세요."); return; }
    if (endDate < startDate) { setErr("종료 날짜는 시작 날짜보다 빠를 수 없습니다."); return; }
    if (!allDay && (!startTime || !endTime)) { setErr("시작과 종료 시간을 선택하거나 하루 종일을 켜주세요."); return; }
    if (!allDay && endDate === startDate && endTime <= startTime) { setErr("종료 시간은 시작 시간보다 뒤여야 합니다."); return; }
    setSaving(true);
    setErr("");
    const body = {
      title: title.trim(),
      date: startDate,
      end_date: endDate,
      time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      all_day: allDay,
      repeat_rule: repeatRule,
      plant_id: plantId || null,
      detail: detail.trim(),
      color,
    };
    const r = editing
      ? await updateCalendarEvent(event.id, body)
      : await createCalendarEvent(body);
    setSaving(false);
    if (r.ok) {
      if (r.data.conflicts && r.data.conflicts.length > 0) {
        window.alert(
          `겹치는 일정 ${r.data.conflicts.length}개가 있습니다.\n` +
          r.data.conflicts
            .slice(0, 4)
            .map((conflict) => `- ${conflict.date} ${conflict.time}–${conflict.end_time} ${conflict.title}`)
            .join("\n")
        );
      }
      onSaved();
    }
    else setErr(r.error.message || `일정 ${editing ? "수정" : "추가"}에 실패했습니다.`);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 540, maxWidth: "92vw", padding: "22px 24px", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="t-h2" style={{ color: "var(--fg)", marginBottom: 16 }}>일정 {editing ? "수정" : "추가"}</div>

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

        <div className="calendar-time-box">
          <button
            type="button"
            className="calendar-time-summary"
            aria-expanded={timeOpen}
            onClick={() => setTimeOpen((v) => !v)}
          >
            <span>{eventRangeSummary(startDate, endDate, startTime, endTime, allDay)}</span>
            <span>이벤트 시간에 알림</span>
          </button>

          {timeOpen && (
            <div className="calendar-time-details">
              <div className="calendar-time-row">
                <span>하루 종일:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allDay}
                  onClick={() => setAllDay((v) => !v)}
                  className="calendar-mini-switch"
                  data-active={allDay}
                >
                  <span />
                </button>
              </div>
              <div className="calendar-time-row">
                <span>시작:</span>
                <div className="calendar-time-inputs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartDate(next);
                      if (endDate < next) setEndDate(next);
                    }}
                    style={inputStyle}
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => {
                        const next = e.target.value;
                        setStartTime(next);
                        if (!endTime || (endDate === startDate && endTime <= next)) setEndTime(addOneHour(next));
                      }}
                      style={inputStyle}
                    />
                  )}
                </div>
              </div>
              <div className="calendar-time-row">
                <span>종료:</span>
                <div className="calendar-time-inputs">
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
                  {!allDay && (
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
                  )}
                </div>
              </div>
              <div className="calendar-time-row">
                <span>반복:</span>
                <select value={repeatRule} onChange={(e) => setRepeatRule(e.target.value as CalendarEventRepeatRule)} style={inputStyle}>
                  {REPEAT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

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

        <Field label="색상">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EVENT_COLOR_OPTIONS.map((option) => {
              const selected = color === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setColor(option.id)}
                  aria-label={`${option.label} 색상`}
                  aria-pressed={selected}
                  title={option.label}
                  style={{
                    width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                    background: option.value,
                    border: selected ? "3px solid var(--fg)" : "2px solid var(--bg-elevated)",
                    boxShadow: selected ? "0 0 0 2px var(--border-strong)" : "0 0 0 1px var(--border)",
                  }}
                />
              );
            })}
          </div>
        </Field>

        {err && <div className="t-caption" style={{ color: "var(--danger)", marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "저장 중…" : editing ? "수정" : "추가"}
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

function EventCard({ ev, onClick, onEdit, onDelete }: { ev: CalEvent; onClick: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const metaParts = [
    eventTimeLabel(ev),
    ev.source === "event" && ev.repeat_rule && ev.repeat_rule !== "none" ? `반복 ${REPEAT_LABEL[ev.repeat_rule]}` : null,
    ev.plant_name || null,
    ev.detail ? (ev.detail.length > 34 ? ev.detail.slice(0, 34) + "..." : ev.detail) : null,
  ].filter(Boolean);

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
          style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
        >
          <div className="t-body-sm" style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ev.title}
          </div>
          {metaParts.length > 0 && (
            <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {metaParts.join(" · ")}
            </div>
          )}
        </button>
        {ev.source !== "event" && (
          <span className="badge badge-muted" style={{ flexShrink: 0, fontSize: 10, height: 18, padding: "0 6px" }}>
            {ev.type === "schedule" ? "봉우리·일정" : "봉우리·고민"}
          </span>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label="일정 수정"
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, padding: "0 6px", height: 20, color: "var(--fg-muted)" }}
          >
            수정
          </button>
        )}
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

function SmallStat({ label, value, accent, sub }: { label: string; value: number; accent: "default" | "info" | "warning" | "positive"; sub: string }) {
  const color =
    accent === "warning" ? "var(--warning)"
    : accent === "positive" ? "var(--positive)"
    : accent === "info" ? "var(--info)"
    : "var(--accent)";
  return (
    <div style={{ minHeight: 96, padding: "14px 14px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--calendar-stat-bg, var(--bg-subtle))", display: "flex", gap: 12 }}>
      <span style={{ width: 5, height: 42, marginTop: 2, borderRadius: "var(--r-pill)", background: color, flexShrink: 0 }} />
      <div>
        <div className="t-numeral" style={{ color: "var(--fg)", lineHeight: 1 }}>{value}개</div>
        <div className="t-label" style={{ color: "var(--fg-secondary)", marginTop: 10 }}>{label}</div>
        <div className="t-caption" style={{ color: "var(--fg-muted)", marginTop: 8 }}>{sub}</div>
      </div>
    </div>
  );
}
