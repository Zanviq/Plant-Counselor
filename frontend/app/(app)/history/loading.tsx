import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="app-page app-page-wide">
      <div style={{ marginBottom: 20 }}>
        <Skeleton w={120} h={32} style={{ marginBottom: 8 }} />
        <Skeleton w={200} h={13} />
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "280px 1fr",
        border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
        overflow: "hidden", minHeight: 560,
        background: "var(--bg-elevated)",
      }}>
        <div style={{ borderRight: "1px solid var(--border)", background: "var(--bg-subtle)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton w="100%" h={32} r={8} style={{ marginBottom: 4 }} />
          {[100, 80, 100, 70, 90, 70, 80].map((w, i) => (
            <div key={i} style={{
              height: 40, borderRadius: "var(--r-sm)",
              background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 60}ms`,
            }} />
          ))}
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {[60, 80, 45, 70, 55, 80].map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}>
              <Skeleton w={`${w}%`} h={44} r={10} style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
