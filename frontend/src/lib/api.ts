export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
      try {
        const port = envUrl ? new URL(envUrl).port || "8000" : "8000";
        return `${window.location.protocol}//${window.location.hostname}:${port}`;
      } catch {
        return `http://${window.location.hostname}:8000`;
      }
    }
    return envUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

let cachedCsrfToken: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/** DRF+SessionAuthentication requires a csrftoken cookie before any mutating
 * request — the Django backend has no CSRF exemption anywhere (unlike the
 * legacy PHP app), so this has to run before the first POST/PUT/PATCH/DELETE. */
export async function ensureCsrf(): Promise<string | null> {
  const cookieToken = getCookie("csrftoken");
  if (cookieToken) {
    cachedCsrfToken = cookieToken;
    return cookieToken;
  }
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/csrf/`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && "csrfToken" in data && typeof data.csrfToken === "string") {
        cachedCsrfToken = data.csrfToken;
        return data.csrfToken;
      }
    }
  } catch {
    // ignore network errors
  }
  return getCookie("csrftoken") || cachedCsrfToken;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    const detail =
      data && typeof data === "object" && "detail" in data && typeof (data as { detail: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : "Something went wrong. Please try again.";
    super(detail);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isMutating = method !== "GET" && method !== "HEAD";
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (isMutating) {
    const token = (await ensureCsrf()) || cachedCsrfToken || getCookie("csrftoken");
    if (token) headers.set("X-CSRFToken", token);
  }

  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, { ...options, method, headers, credentials: "include" });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
