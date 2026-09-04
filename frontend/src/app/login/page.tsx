"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useAuth, ApiError } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Dual Brand Circular Badges */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-white p-1 shadow-md border border-border ring-2 ring-primary-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ananta_logo.png"
                alt="Ananta Graphics"
                className="h-full w-full object-contain rounded-full"
              />
            </div>
            <div className="h-0.5 w-4 bg-linear-to-r from-primary-500 to-[#EE3050] opacity-40 rounded-full" />
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-white p-1 shadow-md border border-border ring-2 ring-[#EE3050]/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/meewa_logo.png"
                alt="Meewa Industries"
                className="h-full w-full object-contain rounded-full"
              />
            </div>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Ananta × Meewa CRM</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to your enterprise account</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-7 shadow-[var(--shadow-pop)]">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-md bg-primary-50 px-3.5 py-3 text-[13px] font-medium text-primary-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="e.g. admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-border bg-white px-3 pr-10 text-sm text-ink focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-ink-muted"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="md" loading={submitting} className="mt-2 w-full">
              Sign In
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">Internal tool — access is by invitation only.</p>
      </div>
    </div>
  );
}
