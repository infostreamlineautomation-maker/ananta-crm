"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError, Paginated } from "./api";

function isPaginated<T>(res: T[] | Paginated<T>): res is Paginated<T> {
  return !Array.isArray(res);
}

/** Fetches a DRF paginated list endpoint, refetching whenever `path` changes
 * (build the querystring — filters, search, page — into `path` itself, e.g.
 * via useMemo, so this hook stays a plain dependency-driven fetcher). Call
 * `reload()` after a create/update/delete to refresh the current page. */
export function usePaginatedList<T>(path: string) {
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<Paginated<T>>(path)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load this list. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  return { data, loading, error, reload };
}

/** Fetches a list once and unwraps it into a flat array, whether the endpoint
 * returns a bare array (e.g. /api/countries/, which sets pagination_class =
 * None) or DRF's paginated {count, results: [...]} shape (everything else —
 * pass a generous ?page_size= for "give me every option" picker use cases,
 * since this doesn't paginate further itself). */
export function useList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<T[] | Paginated<T>>(path)
      .then((res) => {
        if (cancelled) return;
        setItems(isPaginated(res) ? res.results : res);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { items, loading };
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
