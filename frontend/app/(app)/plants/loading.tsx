import { GardenSkeleton } from "@/components/ui/Skeleton";

export default function PlantsLoading() {
  return (
    <div className="app-page app-page-wide">
      <div style={{ marginBottom: 18 }}>
        <div style={{ width: 60, height: 28, borderRadius: 6, background: "var(--bg-muted)", animation: "pulse 1.4s ease-in-out infinite" }} />
      </div>
      <GardenSkeleton />
    </div>
  );
}
