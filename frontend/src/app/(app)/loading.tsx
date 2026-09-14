export default function AppLoading() {
  return (
    <div className="w-full py-6 flex items-center justify-center">
      <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full w-2/3 rounded-full bg-primary-500 animate-shimmer-line shadow-xs" />
      </div>
    </div>
  );
}
