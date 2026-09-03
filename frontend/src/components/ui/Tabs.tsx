import clsx from "clsx";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            "border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
            active === t.key ? "border-primary-500 text-primary-600" : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
