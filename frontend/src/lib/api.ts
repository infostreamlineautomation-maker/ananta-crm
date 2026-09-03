const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/** DRF+SessionAuthentication requires a csrftoken cookie before any mutating
 * request — the Django backend has no CSRF exemption anywhere (unlike the
 * legacy PHP app), so this has to run before the first POST/PUT/PATCH/DELETE. */
export async function ensureCsrf(): Promise<void> {
  if (getCookie("csrftoken")) return;
  await fetch(`${API_URL}/api/auth/csrf/`, { credentials: "include" });
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
    await ensureCsrf();
    const token = getCookie("csrftoken");
    if (token) headers.set("X-CSRFToken", token);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, method, headers, credentials: "include" });

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
