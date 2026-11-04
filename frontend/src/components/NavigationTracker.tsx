"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { setCreationOrigin, clearCreationOrigin } from "@/lib/creation-redirect";

// Routes that represent an active creation or editing form / detail page
const FORM_OR_DETAIL_ROUTE_REGEX =
  /^\/(orders\/(new|\d+)|quotations\/(new|\d+)|costing\/(new|\d+)|projects(\/\d+)?|clients\/\d+|companies\/\d+)/;

// Master list pages where users typically go to create entities
const MASTER_LIST_ROUTE_REGEX =
  /^\/(clients|companies|products|suppliers|projects|orders|quotations|costing)(\?.*)?$/;

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const fullPath = searchParams && searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    const prev = prevRef.current;

    if (prev && prev !== fullPath) {
      const wasFormOrDetail = FORM_OR_DETAIL_ROUTE_REGEX.test(prev);
      const isMasterPage = MASTER_LIST_ROUTE_REGEX.test(fullPath);

      if (wasFormOrDetail && isMasterPage) {
        // Record where the user came from so when they create an entry,
        // they get redirected right back to this form
        setCreationOrigin(prev);
      } else if (!isMasterPage && !FORM_OR_DETAIL_ROUTE_REGEX.test(fullPath)) {
        // Navigating to dashboard or outside forms clears stale creation origin
        clearCreationOrigin();
      }
    }

    prevRef.current = fullPath;
  }, [pathname, searchParams]);

  return null;
}

