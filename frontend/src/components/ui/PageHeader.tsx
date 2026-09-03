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
  children,
}: {
  onClick: () => void;
  label: string;
  tone?: "muted" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "flex h-7 w-7 items-center justify-center rounded-md " +
        (tone === "danger" ? "text-ink-faint hover:bg-primary-50 hover:text-primary-600" : "text-ink-faint hover:bg-surface-sunken hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
