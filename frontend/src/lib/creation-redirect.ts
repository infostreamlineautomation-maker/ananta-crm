"use client";

export interface JustCreatedEntity {
  type: "client" | "company" | "product" | "supplier" | "project" | "quotation" | "order" | string;
  id: number | string;
  name?: string;
}

const ORIGIN_KEY = "crm_creation_origin";
const JUST_CREATED_KEY = "crm_just_created";

export function setCreationOrigin(url: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ORIGIN_KEY, url);
  } catch {}
}

export function getCreationOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ORIGIN_KEY);
  } catch {
    return null;
  }
}

export function clearCreationOrigin(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ORIGIN_KEY);
  } catch {}
}

export function setJustCreated(entity: JustCreatedEntity): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(JUST_CREATED_KEY, JSON.stringify(entity));
  } catch {}
}

export function getJustCreated(type?: string): JustCreatedEntity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(JUST_CREATED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JustCreatedEntity;
    if (type && parsed.type !== type) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeJustCreated(type?: string): JustCreatedEntity | null {
  if (typeof window === "undefined") return null;
  try {
    const entity = getJustCreated(type);
    if (entity) {
      sessionStorage.removeItem(JUST_CREATED_KEY);
    }
    return entity;
  } catch {
    return null;
  }
}

/**
 * Resolves the redirect URL when an entry is saved.
 * Priority:
 * 1. searchParams returnUrl or from
 * 2. Stored creation origin in sessionStorage
 * 3. defaultUrl
 */
export function resolveRedirect(
  defaultUrl: string,
  searchParams?: { get: (name: string) => string | null } | null
): string {
  const returnUrl = searchParams?.get("returnUrl") || searchParams?.get("from");
  if (returnUrl && returnUrl.startsWith("/")) {
    clearCreationOrigin();
    return returnUrl;
  }

  const origin = getCreationOrigin();
  if (origin && origin.startsWith("/") && origin !== defaultUrl) {
    // Never redirect a work module list (e.g. /orders, /quotations, /costing) into another detail item
    const isSameModule = (module: string) => defaultUrl.startsWith(module) && origin.startsWith(module);
    if (
      isSameModule("/orders") ||
      isSameModule("/quotations") ||
      isSameModule("/costing") ||
      isSameModule("/projects")
    ) {
      clearCreationOrigin();
      return defaultUrl;
    }

    clearCreationOrigin();
    return origin;
  }

  return defaultUrl;
}

