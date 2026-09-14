"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import clsx from "clsx";
import { useOrganization } from "@/lib/organization-context";
import { getBrandLogo } from "@/lib/format";

function OrgLogo({ logo, name, size = 36 }: { logo: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false);
  const brandSrc = getBrandLogo(name, logo);

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex-none rounded-full aspect-square bg-white overflow-hidden flex items-center justify-center shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Brand logo */}
      <img
        src={error ? getBrandLogo(name) : brandSrc}
        alt={name}
        className="h-full w-full rounded-full aspect-square object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}

export function OrgSwitcher({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { organizations, activeOrganization, switchOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!activeOrganization) {
    return (
      <div className={clsx("flex items-center gap-2.5 px-3 py-4", isCollapsed ? "justify-center px-2" : "px-4")}>
        <OrgLogo logo={null} name="Ananta CRM" size={isCollapsed ? 32 : 36} />
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold leading-tight text-primary-500">Ananta CRM</div>
          </div>
        )}
      </div>
    );
  }

  const canSwitch = organizations.length > 1;

  return (
    <div className={clsx("relative py-3 transition-all", isCollapsed ? "px-2 flex justify-center" : "px-3")} ref={ref}>
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        disabled={!canSwitch}
        title={isCollapsed ? `${activeOrganization.name} (Click to switch)` : undefined}
        className={clsx(
          "flex items-center rounded-lg transition-colors group cursor-pointer",
          isCollapsed
            ? "justify-center p-1.5 hover:bg-surface-sunken"
            : "w-full gap-2.5 px-2 py-2 text-left hover:bg-surface-sunken",
          !canSwitch && "cursor-default"
        )}
      >
        <OrgLogo logo={activeOrganization.logo} name={activeOrganization.name} size={isCollapsed ? 32 : 36} />
        {!isCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-extrabold leading-tight text-primary-500">{activeOrganization.name}</div>
              <div className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {activeOrganization.tagline || " "}
              </div>
            </div>
            {canSwitch && <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-ink-faint group-hover:text-ink transition-colors" />}
          </>
        )}
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-1.5 rounded-xl border border-border bg-surface py-1.5 shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-100",
            isCollapsed ? "left-14 top-2 w-56" : "left-3 right-3"
          )}
        >
          <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Switch business</p>
          {organizations.map((org) => (
            <button
              key={org.id}
              disabled={switching}
              onClick={async () => {
                setSwitching(true);
                setOpen(false);
                await switchOrganization(org.id);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-sunken disabled:opacity-60 cursor-pointer"
            >
              <OrgLogo logo={org.logo} name={org.name} size={26} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{org.name}</span>
              {org.id === activeOrganization.id && <Check className="h-3.5 w-3.5 flex-none text-primary-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
