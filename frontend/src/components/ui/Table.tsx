import { Loader2 } from "lucide-react";

export const TH = "px-5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint";
export const TD = "px-5 py-3 text-[13.5px] text-ink";
export const TR = "border-b border-border last:border-b-0 hover:bg-surface-hover";

export function TableState({ loading, empty, colSpan, emptyLabel = "Nothing here yet." }: { loading: boolean; empty: boolean; colSpan: number; emptyLabel?: string }) {
  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-5 py-12 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-faint" />
        </td>
      </tr>
    );
  }
  if (empty) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-ink-faint">
          {emptyLabel}
        </td>
      </tr>
    );
  }
  return null;
}
