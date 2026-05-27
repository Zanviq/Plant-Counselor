import { GardenSkeleton } from "@/components/ui/Skeleton";

export default function PlantsLoading() {
  return (
    <div style={{ padding: "32px 36px 48px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ width: 60, height: 28, borderRadius: 6, background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite" }} />
      </div>
      <GardenSkeleton />
    </div>
  );
}
