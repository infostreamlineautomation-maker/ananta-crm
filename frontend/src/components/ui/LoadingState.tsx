"use client";

import { useState } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { getBrandLogo } from "@/lib/format";

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
 * Premium Dual-Logo Loader featuring both Ananta Graphics & Meewa Industries.
 * Ideal for main application refreshes, initial startup, and cross-enterprise transitions.
 */
export function DualLogoLoader({
  label = "Initializing Enterprise CRM...",
  sublabel = "Ananta Graphics × Meewa Industries",
  fullscreen = true,
  className = "",
}: {
  label?: string;
  sublabel?: string;
  fullscreen?: boolean;
  className?: string;
}) {
  const [anantaErr, setAnantaErr] = useState(false);
  const [meewaErr, setMeewaErr] = useState(false);

  const loaderContent = (
    <div className={clsx("flex flex-col items-center justify-center text-center select-none", className)}>
      {/* Visual Arena for Dual Logos & Synergy Energy Field */}
      <div className="relative flex items-center justify-center py-6 px-10">
        {/* Ambient Radial Backlight Glow Mesh */}
        <div className="absolute -inset-8 rounded-full bg-linear-to-r from-[var(--color-primary-500)]/15 via-[#EE3050]/15 to-[var(--color-primary-600)]/15 blur-2xl animate-pulse-glow" />

        {/* Large Outer Orbital Rotating Ring */}
        <div className="absolute h-36 w-64 rounded-full border-2 border-dashed border-[var(--color-primary-500)]/20 animate-spin-slow pointer-events-none" />

        {/* Inner Counter Orbital Ring */}
        <div className="absolute h-32 w-60 rounded-full border border-t-[var(--color-primary-500)]/50 border-r-transparent border-b-[#EE3050]/40 border-l-transparent animate-spin-reverse pointer-events-none" />

        {/* Logos Flex Row */}
        <div className="relative z-10 flex items-center gap-6 md:gap-8">
          {/* 1. Ananta Graphics Circular Emblem */}
          <div className="relative group animate-float-harmonic-1">
            {/* Glowing Aura Ring */}
            <div className="absolute -inset-2 rounded-full bg-[var(--color-primary-500)]/20 blur-md animate-pulse" />
            <div className="relative flex h-20 w-20 md:h-22 md:w-22 items-center justify-center rounded-full bg-white p-2.5 shadow-[0_8px_24px_rgba(195,20,50,0.22)] border-2 border-primary-100 ring-4 ring-white/80 transition-transform">
              {!anantaErr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/ananta_logo.png"
                  alt="Ananta Graphics"
                  className="h-full w-full object-contain rounded-full"
                  onError={() => setAnantaErr(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] text-white shadow-inner font-black text-sm">
                  AG
                </div>
              )}
            </div>
            {/* Badge Pill */}
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary-500 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
              Ananta
            </div>
          </div>

          {/* Central Synergy Connector Bridge */}
          <div className="relative flex flex-col items-center justify-center px-1">
            {/* Pulsing Light Beam */}
            <div className="h-0.5 w-10 md:w-14 bg-linear-to-r from-primary-500 via-amber-400 to-[#EE3050] animate-pulse-bridge" />
            {/* Glowing Nexus Sparkle */}
            <div className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-white border border-border shadow-md text-amber-500 animate-pulse">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* 2. Meewa Industries Circular Emblem */}
          <div className="relative group animate-float-harmonic-2">
            {/* Glowing Aura Ring */}
            <div className="absolute -inset-2 rounded-full bg-[#EE3050]/20 blur-md animate-pulse" />
            <div className="relative flex h-20 w-20 md:h-22 md:w-22 items-center justify-center rounded-full bg-white p-2.5 shadow-[0_8px_24px_rgba(238,48,80,0.22)] border-2 border-red-100 ring-4 ring-white/80 transition-transform">
              {!meewaErr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/meewa_logo.png"
                  alt="Meewa Industries"
                  className="h-full w-full object-contain rounded-full"
                  onError={() => setMeewaErr(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-[#EE3050] to-[#C31432] text-white shadow-inner font-black text-sm">
                  MI
                </div>
              )}
            </div>
            {/* Badge Pill */}
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#EE3050] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
              Meewa
            </div>
          </div>
        </div>
      </div>

      {/* Typography & Sleek Shimmer Bar */}
      <div className="mt-7 flex flex-col items-center gap-1.5 max-w-sm">
        <h2 className="text-base md:text-lg font-black text-ink tracking-tight">
          {label}
        </h2>
        <p className="text-xs font-semibold text-ink-muted tracking-wide">
          {sublabel}
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
            "relative z-10 flex items-center justify-center rounded-full bg-white shadow-lg border border-border overflow-hidden p-2 transition-transform duration-300 animate-float-harmonic-1",
            currentSize.emblem
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getBrandLogo(orgName, activeOrganization?.logo)}
            alt={orgName}
            className={clsx("rounded-full object-contain transition-all", currentSize.logoImg)}
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

