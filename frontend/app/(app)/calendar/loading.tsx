import { CalendarSkeleton, Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="app-page app-page-wide">
      <div style={{ marginBottom: 24 }}>
        <Skeleton w={100} h={28} style={{ marginBottom: 8 }} />
        <Skeleton w={220} h={13} />
      </div>
      <div className="calendar-layout" style={{ marginBottom: 16 }}>
        <CalendarSkeleton />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 16, height: 120, background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite" }} />
          <div className="card" style={{ padding: 16, height: 120, background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite", animationDelay: "80ms" }} />
        </div>
      </div>
      <div className="calendar-summary-grid">
        <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
      </div>
    </div>
  );
}
