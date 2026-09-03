"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, Paginated } from "@/lib/api";

interface Notification {
  id: number;
  event_type: string;
  title: string;
  message: string;
  order: number | null;
  order_no: string | null;
  created_at: string;
  is_read: boolean;
  is_dismissed: boolean;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Topbar() {
  const router = useRouter();
  const { user, can, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const canSeeNotifications = can("notifications", "view");
  const unreadCount = notifications.filter((n) => !n.is_read && !n.is_dismissed).length;

  useEffect(() => {
    if (!canSeeNotifications) return;
    apiFetch<Paginated<Notification>>("/api/notifications/")
      .then((res) => setNotifications(res.results.filter((n) => !n.is_dismissed)))
      .catch(() => {});
  }, [canSeeNotifications]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(n: Notification) {
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await apiFetch(`/api/notifications/${n.id}/read/`, { method: "POST" });
    } catch {}
  }

  function handleNotificationClick(n: Notification) {
    if (!n.is_read) markRead(n);
    setNotifOpen(false);
    if (n.order) {
      router.push(`/orders/${n.order}`);
      return;
    }
    const match = (n.title + " " + (n.message || "")).match(/ORD-\d{4}-\d+/i);
    if (match) {
      router.push(`/orders?search=${encodeURIComponent(match[0])}`);
      return;
    }
    const quoteMatch = (n.title + " " + (n.message || "")).match(/QT-\d{4}-\d+|QUO-\d+/i);
    if (quoteMatch) {
      router.push(`/quotations?search=${encodeURIComponent(quoteMatch[0])}`);
      return;
    }
  }

  async function dismiss(n: Notification) {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await apiFetch(`/api/notifications/${n.id}/dismiss/`, { method: "POST" });
    } catch {}
  }

  const displayName = user ? user.first_name || user.username : "";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          placeholder="Search..."
          className="h-9 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="flex flex-none items-center gap-2">
        {canSeeNotifications && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-surface" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-20 mt-2 w-96 rounded-lg border border-border bg-surface shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-bold text-ink">Notifications</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-ink-faint">You&apos;re all caught up.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={clsxNotif(n.is_read)}
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${n.is_read ? "bg-transparent" : "bg-primary-500"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink hover:text-primary-600 transition-colors">{n.title}</p>
                          {n.message && <p className="truncate text-xs text-ink-muted">{n.message}</p>}
                          <p className="mt-0.5 text-[11px] text-ink-faint">{timeAgo(n.created_at)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n);
                          }}
                          className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-faint hover:bg-surface-sunken hover:text-ink-muted"
                          aria-label="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-semibold text-primary-500 hover:bg-surface-sunken hover:text-primary-600"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md py-1.5 pr-2 pl-1.5 hover:bg-surface-sunken"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-600">
              {initials}
            </div>
            <span className="text-[13.5px] font-semibold text-ink">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-pop)]">
              <div className="border-b border-border px-3.5 py-2.5">
                <p className="truncate text-[13px] font-semibold text-ink">{displayName}</p>
                <p className="truncate text-xs text-ink-faint">{user?.role_name || "No role"}</p>
              </div>
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-primary-600"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function clsxNotif(isRead: boolean) {
  return `flex cursor-pointer items-start gap-2.5 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-sunken ${
    isRead ? "" : "bg-primary-50/40"
  }`;
}
