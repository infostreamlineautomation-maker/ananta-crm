"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";
import { getBrandLogo } from "./format";
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

function setTabFavicon(url: string) {
  if (typeof document === "undefined") return;
  try {
    const existing = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    existing.forEach((el) => el.parentNode?.removeChild(el));

    const link = document.createElement("link");
    link.type = "image/png";
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);

    const shortcut = document.createElement("link");
    shortcut.type = "image/png";
    shortcut.rel = "shortcut icon";
    shortcut.href = url;
    document.head.appendChild(shortcut);
  } catch {}
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [switchingOrg, setSwitchingOrg] = useState<Organization | null>(null);

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
    const target = organizations.find((o) => o.id === id);
    if (target) {
      setSwitchingOrg(target);
      applyOrgTheme(target.primary_color);
      document.title = target.name.toLowerCase().includes("crm") ? target.name : `${target.name} CRM`;
      const logoUrl = getBrandLogo(target.name, target.logo);
      setTabFavicon(logoUrl);
      try {
        localStorage.setItem("crm_active_org_name", target.name);
        localStorage.setItem("crm_active_org_logo", logoUrl);
        localStorage.setItem("crm_active_org_color", target.primary_color || "");
      } catch {}
    }
    await apiFetch("/api/organizations/switch/", { method: "POST", body: JSON.stringify({ organization: id }) });
    // Hard navigation rather than a client-side refetch: every page's local
    // state (client lists, dashboard totals, cached picker options, ...) is
    // scoped to whichever organization was active when it loaded, and a soft
    // refetch would have to individually invalidate every one of them to be
    // safe. A full reload guarantees zero stale cross-organization data.
    window.location.href = "/dashboard";
  }, [organizations]);

  const activeOrganization = organizations.find((o) => o.id === activeId) ?? null;

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (activeOrganization) {
      const orgName = activeOrganization.name;
      document.title = orgName.toLowerCase().includes("crm") ? orgName : `${orgName} CRM`;

      const logoUrl = getBrandLogo(activeOrganization.name, activeOrganization.logo);
      setTabFavicon(logoUrl);
      try {
        localStorage.setItem("crm_active_org_name", activeOrganization.name);
        localStorage.setItem("crm_active_org_logo", logoUrl);
        localStorage.setItem("crm_active_org_color", activeOrganization.primary_color || "");
      } catch {}
    } else {
      // In loading state or transition: retain previously loaded organization branding from localStorage
      try {
        const savedName = localStorage.getItem("crm_active_org_name");
        const savedLogo = localStorage.getItem("crm_active_org_logo");
        if (savedName) {
          document.title = savedName.toLowerCase().includes("crm") ? savedName : `${savedName} CRM`;
        }
        if (savedLogo) {
          setTabFavicon(savedLogo);
        }
      } catch {}
    }
  }, [activeOrganization]);

  return (
    <OrganizationContext.Provider value={{ organizations, activeOrganization, loading, switchOrganization, refresh: load }}>
      {children}
      {switchingOrg && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center">
            {/* Ambient Radial Glow */}
            <div className="absolute h-36 w-36 rounded-full bg-[var(--color-primary-500)]/20 blur-2xl animate-pulse-glow" />
            {/* Outer Orbiting ring */}
            <div className="absolute h-32 w-32 rounded-full border-2 border-dashed border-[var(--color-primary-400)]/50 animate-spin-slow" />
            {/* Inner counter rotating ring */}
            <div className="absolute h-28 w-28 rounded-full border border-t-[var(--color-primary-500)] border-r-transparent border-b-[var(--color-primary-400)]/30 border-l-transparent animate-spin-reverse" />

            {/* Circular Logo Emblem */}
            <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full aspect-square bg-white p-1 overflow-hidden animate-float-harmonic-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getBrandLogo(switchingOrg.name, switchingOrg.logo)}
                alt={switchingOrg.name}
                className="h-full w-full rounded-full aspect-square object-contain"
              />
            </div>
          </div>

          <div className="mt-7 flex flex-col items-center gap-1.5 text-center max-w-sm px-4">
            <h3 className="text-base md:text-lg font-extrabold text-ink tracking-tight">
              Switching to {switchingOrg.name}...
            </h3>
            <p className="text-xs font-semibold text-ink-muted">
              Loading workspace, permissions & preferences
            </p>
            <div className="mt-3.5 h-1.5 w-40 overflow-hidden rounded-full bg-surface-sunken p-0.5 border border-border/50">
              <div className="h-full w-2/3 rounded-full bg-[var(--color-primary-500)] animate-shimmer-line shadow-xs" />
            </div>
          </div>
        </div>
      )}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
