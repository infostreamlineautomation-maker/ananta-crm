import { LoadingState } from "@/components/ui/LoadingState";

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState variant="dual" fullscreen={false} label="Loading Page..." sublabel="Ananta Graphics × Meewa Industries" />
    </div>
  );
}
