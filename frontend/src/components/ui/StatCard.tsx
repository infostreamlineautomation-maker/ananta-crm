import clsx from "clsx";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  emphasis = false,
  icon,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</span>
        {icon}
      </div>
      <div className={clsx("tnum mt-2 text-2xl font-extrabold", emphasis ? "text-primary-500" : "text-ink")}>
        {value}
      </div>
    </Card>
  );
}
