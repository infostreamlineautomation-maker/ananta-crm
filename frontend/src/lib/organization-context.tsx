"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";
import { applyOrgTheme } from "./theme";
import { Organization } from "./types";

interface OrganizationContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  loading: boolean;
  switchOrganization: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ organizations: Organization[]; active_organization_id: number | null }>(
        "/api/organizations/mine/",
      );
      setOrganizations(res.organizations);
      setActiveId(res.active_organization_id);
      const active = res.organizations.find((o) => o.id === res.active_organization_id);
      applyOrgTheme(active?.primary_color);
    } catch {
      // Not logged in yet, or this user has no organization access — the
      // dashboard/login flow already handles surfacing that, nothing to do here.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      load();
    } else {
      setLoading(false);
    }
  }, [user, load]);

  const switchOrganization = useCallback(async (id: number) => {
    await apiFetch("/api/organizations/switch/", { method: "POST", body: JSON.stringify({ organization: id }) });
    // Hard navigation rather than a client-side refetch: every page's local
    // state (client lists, dashboard totals, cached picker options, ...) is
    // scoped to whichever organization was active when it loaded, and a soft
    // refetch would have to individually invalidate every one of them to be
    // safe. A full reload guarantees zero stale cross-organization data.
    window.location.href = "/dashboard";
  }, []);

  const activeOrganization = organizations.find((o) => o.id === activeId) ?? null;

  return (
    <OrganizationContext.Provider value={{ organizations, activeOrganization, loading, switchOrganization, refresh: load }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
