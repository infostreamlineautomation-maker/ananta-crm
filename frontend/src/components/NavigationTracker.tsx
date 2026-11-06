"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { setCreationOrigin, clearCreationOrigin } from "@/lib/creation-redirect";

// Routes that represent an active creation or editing form / detail page
const FORM_OR_DETAIL_ROUTE_REGEX =
  /^\/(orders\/(new|\d+)|quotations\/(new|\d+)|costing\/(new|\d+)|projects(\/\d+)?|clients\/\d+|companies\/\d+)/;

// Master data directories where users branch off to create supporting entities (Clients, Companies, Products, Suppliers)
const MASTER_DATA_ROUTE_REGEX =
  /^\/(clients|companies|products|suppliers)(\?.*)?$/;

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const fullPath = searchParams && searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    const prev = prevRef.current;

    if (prev && prev !== fullPath) {
      const wasFormOrDetail = FORM_OR_DETAIL_ROUTE_REGEX.test(prev);
      const isMasterDataPage = MASTER_DATA_ROUTE_REGEX.test(fullPath);

      if (wasFormOrDetail && isMasterDataPage) {
        // Record where the user came from so when they create a master entry,
        // they get redirected right back to the form they were working in
        setCreationOrigin(prev);
      } else if (!isMasterDataPage) {
        // Navigating to order lists, dashboard, or other modules clears stale creation origin
        clearCreationOrigin();
      }
    }

    prevRef.current = fullPath;
  }, [pathname, searchParams]);

  return null;
}

