/**
 * Shown while the settings route's JS chunk is loading on first navigation.
 * Matches the approximate layout of SettingsPage to avoid a jarring flash.
 */
import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div style={{ padding: "32px 36px 64px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton w={80} h={28} style={{ marginBottom: 8 }} />
        <Skeleton w={260} h={13} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 32 }}>
        {/* Tab nav skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[80, 60, 90, 70, 60].map((w, i) => (
            <Skeleton key={i} w={w} h={32} r={8} />
          ))}
        </div>

        {/* Content skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Skeleton w={120} h={20} />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton w={100} h={13} />
                <Skeleton w={160} h={11} />
              </div>
              <Skeleton w={80} h={26} r={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
