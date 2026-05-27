"use client";

/**
 * Lightweight skeleton / shimmer blocks.
 * Use while TanStack Query is fetching to eliminate blank-page flicker on navigation.
 */

interface SkeletonProps {
  w?: string | number;
  h?: string | number;
  r?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ w = "100%", h = 14, r = 6, style }: SkeletonProps) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "var(--bg-muted)",
        animation: "pulse 1.4s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Skeleton shaped like a stat card */
export function StatCardSkeleton() {
  return (
    <div className="card" style={{ padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton w={80} h={10} />
      <Skeleton w={48} h={28} />
      <Skeleton w={64} h={10} />
    </div>
  );
}

/** Skeleton shaped like a plant card */
export function PlantCardSkeleton() {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton w="60%" h={16} />
      <Skeleton w="80%" h={10} />
      <Skeleton h={4} r={999} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton w={80} h={10} />
        <Skeleton w={40} h={22} r={6} />
      </div>
    </div>
  );
}

/** Skeleton for the garden view card */
export function GardenSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 480, background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite" }} />
  );
}

/** Skeleton for a bud row */
export function BudRowSkeleton() {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
      <Skeleton w={56} h={20} r={999} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton w="60%" h={13} />
        <Skeleton h={3} r={999} />
      </div>
      <Skeleton w={32} h={20} r={6} />
    </div>
  );
}

/** Skeleton for a calendar grid */
export function CalendarSkeleton() {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton w={120} h={20} />
          <Skeleton w={64} h={12} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Skeleton w={30} h={26} r={6} />
          <Skeleton w={50} h={26} r={6} />
          <Skeleton w={30} h={26} r={6} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} h={64} r={8} style={{ animation: `pulse 1.4s ease-in-out ${(i % 7) * 40}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}
