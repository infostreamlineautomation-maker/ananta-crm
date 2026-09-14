"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { getBrandLogo } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import { Organization } from "@/lib/types";

interface LoadingStateProps {
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fullscreen?: boolean;
  card?: boolean;
  minHeight?: string;
  className?: string;
  showDetails?: boolean;
  variant?: "single" | "dual";
}

/**
 * Premium Multi/Dual-Logo Loader featuring dynamic organization brand logos.
 * Ideal for main application refreshes, initial startup, and cross-enterprise transitions.
 */
export function DualLogoLoader({
  label = "Initializing Enterprise CRM...",
  sublabel,
  fullscreen = true,
  className = "",
  orgs,
}: {
  label?: string;
  sublabel?: string;
  fullscreen?: boolean;
  className?: string;
  orgs?: Organization[];
}) {
  const { organizations: contextOrgs } = useOrganization();

  const activeOrgs = (orgs && orgs.length > 0)
    ? orgs
    : (contextOrgs && contextOrgs.length > 0)
      ? contextOrgs
      : [
          { id: 1, name: "Ananta Graphics", logo: null, primary_color: "#c31432", slug: "ananta" } as Organization,
          { id: 2, name: "Meewa Industries", logo: null, primary_color: "#EE3050", slug: "meewa" } as Organization,
        ];

  const sub = sublabel || (activeOrgs.length > 1
    ? activeOrgs.map((o) => o.name).join(" × ")
    : activeOrgs[0]?.name || "Enterprise CRM");

  const loaderContent = (
    <div className={clsx("flex flex-col items-center justify-center text-center select-none", className)}>
      {/* Visual Arena for Brand Logos & Synergy Energy Field */}
      <div className="relative flex items-center justify-center py-6 px-10">
        {/* Ambient Radial Backlight Glow Mesh */}
        <div className="absolute -inset-8 rounded-full bg-linear-to-r from-[var(--color-primary-500)]/15 via-[#EE3050]/15 to-[var(--color-primary-600)]/15 blur-2xl animate-pulse-glow" />

        {/* Large Outer Orbital Rotating Ring */}
        <div className="absolute h-36 w-64 rounded-full border-2 border-dashed border-[var(--color-primary-500)]/20 animate-spin-slow pointer-events-none" />

        {/* Inner Counter Orbital Ring */}
        <div className="absolute h-32 w-60 rounded-full border border-t-[var(--color-primary-500)]/50 border-r-transparent border-b-[#EE3050]/40 border-l-transparent animate-spin-reverse pointer-events-none" />

        {/* Logos Flex Row */}
        <div className="relative z-10 flex items-center gap-6 md:gap-8 flex-wrap justify-center">
          {activeOrgs.map((org, index) => {
            const logoSrc = getBrandLogo(org.name, org.logo);
            const shortName = org.name.replace(/\s+(CRM|Graphics|Industries|Pvt|Ltd).*$/i, "");
            return (
              <div key={org.id || index} className="flex items-center gap-6 md:gap-8">
                {index > 0 && (
                  <div className="relative flex flex-col items-center justify-center px-1">
                    {/* Pulsing Light Beam */}
                    <div className="h-0.5 w-8 md:w-12 bg-linear-to-r from-primary-500 via-amber-400 to-[#EE3050] animate-pulse-bridge" />
                    {/* Glowing Nexus Sparkle */}
                    <div className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border shadow-md text-amber-500 animate-pulse">
                      <Sparkles className="h-3 w-3" />
                    </div>
                  </div>
                )}

                <div className={clsx("relative group", index % 2 === 0 ? "animate-float-harmonic-1" : "animate-float-harmonic-2")}>
                  {/* Glowing Aura Ring */}
                  <div
                    className="absolute -inset-2 rounded-full blur-md animate-pulse"
                    style={{ backgroundColor: org.primary_color ? `${org.primary_color}33` : "rgba(195,20,50,0.2)" }}
                  />
                  {/* Circular Emblem */}
                  <div className="relative flex h-20 w-20 md:h-22 md:w-22 items-center justify-center rounded-full aspect-square bg-white p-1 overflow-hidden shrink-0 transition-transform">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoSrc}
                      alt={org.name}
                      className="h-full w-full rounded-full aspect-square object-contain"
                    />
                  </div>
                  {/* Badge Pill */}
                  <div
                    className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm"
                    style={{ backgroundColor: org.primary_color || "var(--color-primary-500)" }}
                  >
                    {shortName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Typography & Sleek Shimmer Bar */}
      <div className="mt-7 flex flex-col items-center gap-1.5 max-w-sm">
        <h2 className="text-base md:text-lg font-black text-ink tracking-tight">
          {label}
        </h2>
        <p className="text-xs font-semibold text-ink-muted tracking-wide">
          {sub}
        </p>

        {/* Dynamic Dual-Gradient Progress Shimmer Bar */}
        <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-surface-sunken p-0.5 border border-border/50">
          <div className="h-full w-2/3 rounded-full bg-linear-to-r from-primary-500 via-amber-400 to-[#EE3050] animate-shimmer-line shadow-xs" />
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-md">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}

export function LoadingState({
  label = "Loading...",
  sublabel,
  size = "md",
  fullscreen = false,
  card = false,
  minHeight,
  className = "",
  showDetails = true,
  variant = "single",
}: LoadingStateProps) {
  const { activeOrganization } = useOrganization();
  const [imgError, setImgError] = useState(false);

  if (variant === "dual") {
    return (
      <DualLogoLoader
        label={label}
        sublabel={sublabel}
        fullscreen={fullscreen}
        className={className}
      />
    );
  }

  const orgName = activeOrganization?.name || "Ananta CRM";

  // Size configurations
  const sizeMap = {
    sm: {
      emblem: "h-11 w-11",
      ring: "h-16 w-16",
      icon: "h-5 w-5",
      logoImg: "h-8 w-8",
      title: "text-xs",
      subtitle: "text-[10px]",
      padding: "py-6",
    },
    md: {
      emblem: "h-16 w-16",
      ring: "h-24 w-24",
      icon: "h-7 w-7",
      logoImg: "h-11 w-11",
      title: "text-sm",
      subtitle: "text-xs",
      padding: "py-10",
    },
    lg: {
      emblem: "h-20 w-20",
      ring: "h-28 w-28",
      icon: "h-9 w-9",
      logoImg: "h-14 w-14",
      title: "text-base",
      subtitle: "text-xs",
      padding: "py-16",
    },
    xl: {
      emblem: "h-24 w-24",
      ring: "h-36 w-36",
      icon: "h-11 w-11",
      logoImg: "h-16 w-16",
      title: "text-lg",
      subtitle: "text-sm",
      padding: "py-24",
    },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        fullscreen ? "min-h-screen p-6" : minHeight || currentSize.padding,
        className
      )}
    >
      {/* Animated Orbiting Ring & System Logo Container */}
      <div className="relative flex items-center justify-center">
        {/* Outer Pulsing Aura Glow */}
        <div
          className={clsx(
            "absolute rounded-full bg-[var(--color-primary-500)]/15 blur-xl animate-pulse-glow",
            currentSize.ring
          )}
        />

        {/* Outer Rotating Dash / Gradient Ring */}
        <div
          className={clsx(
            "absolute rounded-full border-2 border-dashed border-[var(--color-primary-400)]/40 animate-spin-slow",
            currentSize.ring
          )}
        />

        {/* Inner Counter-Rotating Gradient Ring */}
        <div
          className={clsx(
            "absolute rounded-full border border-t-[var(--color-primary-500)] border-r-transparent border-b-[var(--color-primary-400)]/20 border-l-transparent animate-spin-reverse",
            currentSize.ring
          )}
        />

        {/* Central Circular Logo Emblem Badge */}
        <div
          className={clsx(
            "relative z-10 flex items-center justify-center rounded-full aspect-square bg-white overflow-hidden p-1 transition-transform duration-300 animate-float-harmonic-1 shrink-0",
            currentSize.emblem
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getBrandLogo(orgName, activeOrganization?.logo)}
            alt={orgName}
            className={clsx("rounded-full aspect-square object-contain transition-all shrink-0", currentSize.logoImg)}
            onError={() => setImgError(true)}
          />
        </div>
      </div>

      {/* Loading Shimmer Bar & Labels */}
      {showDetails && (
        <div className="mt-5 flex flex-col items-center gap-1.5 max-w-xs">
          <div className="flex items-center gap-1.5">
            <h3 className={clsx("font-extrabold text-ink tracking-tight", currentSize.title)}>
              {label}
            </h3>
          </div>

          <p className={clsx("text-ink-muted font-medium", currentSize.subtitle)}>
            {sublabel || orgName}
          </p>

          {/* Sleek Animated Progress Bar */}
          <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full w-1/2 rounded-full bg-linear-to-r from-transparent via-[var(--color-primary-500)] to-transparent animate-shimmer-line" />
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  if (card) {
    return (
      <div className="rounded-xl border border-border bg-white shadow-xs">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Lightweight TabLoadingState for switching sub-tabs inside profile/detail views.
 */
export function TabLoadingState({
  label = "Loading tab data...",
  sublabel,
  className = "",
}: {
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <LoadingState
      size="md"
      label={label}
      sublabel={sublabel}
      card
      minHeight="min-h-[280px]"
      className={clsx("py-12", className)}
    />
  );
}

