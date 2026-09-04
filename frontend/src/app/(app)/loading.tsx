import { LoadingState } from "@/components/ui/LoadingState";

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState size="lg" label="Loading page..." />
    </div>
  );
}
