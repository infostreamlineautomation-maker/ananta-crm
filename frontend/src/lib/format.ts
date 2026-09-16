import { getApiBaseUrl } from "./api";

export function formatCurrency(value: string | number, currencyCode = "INR", minFractionDigits?: number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  try {
    const hasDecimals = n % 1 !== 0;
    const minDigits = minFractionDigits !== undefined ? minFractionDigits : (hasDecimals ? 2 : 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currencyCode} ${n.toLocaleString("en-IN")}`;
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function getBrandLogo(nameOrOrg?: string | null, customLogoPath?: string | null): string {
  if (customLogoPath) {
    const lower = customLogoPath.toLowerCase();
    if (!lower.includes("anantalogo") && !lower.includes("meewamainlogo")) {
      const url = mediaUrl(customLogoPath);
      if (url) return url;
    }
  }
  const str = (nameOrOrg || "").toLowerCase();
  if (str.includes("meewa")) {
    return "/meewa_logo.png";
  }
  return "/ananta_logo.png";
}

export function getReportLogo(
  nameOrOrg?: string | null,
  customReportLogoPath?: string | null,
  customBrandLogoPath?: string | null,
): string {
  if (customReportLogoPath) {
    const url = mediaUrl(customReportLogoPath);
    if (url) return url;
  }
  if (customBrandLogoPath) {
    const url = mediaUrl(customBrandLogoPath);
    if (url) return url;
  }
  const str = (nameOrOrg || "").toLowerCase();
  if (str.includes("meewa")) {
    return "/meewa_logo.png";
  }
  return "/ananta_logo.png";
}

