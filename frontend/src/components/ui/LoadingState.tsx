"use client";

import { useState } from "react";
import clsx from "clsx";
import { Printer, Sparkles } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { mediaUrl } from "@/lib/format";

interface LoadingStateProps {
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fullscreen?: boolean;
  card?: boolean;
  minHeight?: string;
  className?: string;
  showDetails?: boolean;
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
}: LoadingStateProps) {
  const { activeOrganization } = useOrganization();
  const [imgError, setImgError] = useState(false);

  const logoSrc = mediaUrl(activeOrganization?.logo);
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
            "relative z-10 flex items-center justify-center rounded-full bg-white shadow-lg border border-border overflow-hidden p-2.5 transition-transform duration-300 animate-float-subtle",
            currentSize.emblem
          )}
        >
          {logoSrc && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={orgName}
              className={clsx("rounded-full object-contain transition-all", currentSize.logoImg)}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] text-white shadow-inner">
              <Printer className={clsx("animate-pulse", currentSize.icon)} />
            </div>
          )}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-md">
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
