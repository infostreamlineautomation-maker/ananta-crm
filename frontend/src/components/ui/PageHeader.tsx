export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
      {action}
    </div>
  );
}

export function RowActionButton({
  onClick,
  label,
  tone = "muted",
  disabled = false,
  loading = false,
  children,
}: {
  onClick: () => void;
  label: string;
  tone?: "muted" | "danger";
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        (tone === "danger" ? "text-ink-faint hover:bg-primary-50 hover:text-primary-600" : "text-ink-faint hover:bg-surface-sunken hover:text-ink")
      }
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}
