import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export function Pagination({
  count,
  page,
  onPageChange,
}: {
  count: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (count === 0) return null;

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(count, page * PAGE_SIZE);

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-[13px] text-ink-muted">
        Showing <span className="font-semibold text-ink">{start}-{end}</span> of{" "}
        <span className="font-semibold text-ink">{count}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-[13px] font-semibold text-ink">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
