"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Printer, TriangleAlert } from "lucide-react";
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
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-white shadow-[var(--shadow-pop)]">
            <Printer className="h-6 w-6" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Ananta CRM</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to your account</p>
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
