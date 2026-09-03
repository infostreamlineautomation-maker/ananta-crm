"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Printer } from "lucide-react";
import clsx from "clsx";
import { useOrganization } from "@/lib/organization-context";
import { mediaUrl } from "@/lib/format";

function OrgLogo({ logo, name, size = 36 }: { logo: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false);
  const src = mediaUrl(logo);

  if (src && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dynamic remote URL
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className="flex-none rounded-lg border border-border object-cover"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex flex-none items-center justify-center rounded-lg bg-primary-500 text-white"
    >
      <Printer className="h-4.5 w-4.5" strokeWidth={2} />
    </div>
  );
}

export function OrgSwitcher() {
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
      <div className="flex items-center gap-2.5 px-5 py-5">
        <OrgLogo logo={null} name="Ananta CRM" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold leading-tight text-primary-500">Ananta CRM</div>
        </div>
      </div>
    );
  }

  const canSwitch = organizations.length > 1;

  return (
    <div className="relative px-3 py-3" ref={ref}>
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        disabled={!canSwitch}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
          canSwitch && "hover:bg-surface-sunken",
        )}
      >
        <OrgLogo logo={activeOrganization.logo} name={activeOrganization.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold leading-tight text-primary-500">{activeOrganization.name}</div>
          <div className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            {activeOrganization.tagline || " "}
          </div>
        </div>
        {canSwitch && <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-ink-faint" />}
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-30 mt-1.5 rounded-lg border border-border bg-surface py-1.5 shadow-[var(--shadow-pop)]">
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
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-sunken disabled:opacity-60"
            >
              <OrgLogo logo={org.logo} name={org.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{org.name}</span>
              {org.id === activeOrganization.id && <Check className="h-3.5 w-3.5 flex-none text-primary-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
