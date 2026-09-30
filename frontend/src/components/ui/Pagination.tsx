import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

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

export function LoadMorePagination({
  loadedCount,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
  itemName = "records",
}: {
  loadedCount: number;
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  itemName?: string;
}) {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/80 px-5 py-3.5 gap-3 bg-surface-sunken/30">
      <p className="text-[13px] text-ink-muted">
        Showing <span className="font-semibold text-ink">{loadedCount}</span> of{" "}
        <span className="font-semibold text-ink">{totalCount}</span> {itemName}
      </p>

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white hover:bg-primary-50 text-primary-700 hover:text-primary-800 border border-primary-200 px-4 py-2 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {loadingMore ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
              <span>Loading more {itemName}...</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
              <span>Load More ({totalCount - loadedCount} remaining)</span>
            </>
          )}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Check className="h-3.5 w-3.5 text-emerald-600" /> All {totalCount} {itemName} loaded
        </span>
      )}
    </div>
  );
}

export { PAGE_SIZE };
