"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, ApiError, ensureCsrf } from "./api";
import type { ModuleKey, PermissionAction } from "./modules";

export type PermissionMatrix = Record<ModuleKey, Record<PermissionAction, boolean>>;

export interface AuthUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number | null;
  role_name: string | null;
  is_superuser: boolean;
  permissions: PermissionMatrix;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (module: ModuleKey, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<AuthUser>("/api/auth/me/");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureCsrf().finally(refresh);
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    await ensureCsrf();
    const me = await apiFetch<AuthUser>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout/", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const can = useCallback(
    (module: ModuleKey, action: PermissionAction) => {
      if (!user) return false;
      if (user.is_superuser) return true;
      return Boolean(user.permissions?.[module]?.[action]);
    },
    [user],
  );

  return <AuthContext.Provider value={{ user, loading, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
