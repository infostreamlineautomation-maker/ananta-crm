"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  LogOut,
  X,
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Truck,
  FolderKanban,
  FileText,
  Calculator,
  BarChart3,
  UserCog,
  ShieldCheck,
  Settings as SettingsIcon,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { apiFetch, Paginated } from "@/lib/api";
import { GlobalSearch } from "./search/GlobalSearch";

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

function getRouteInfo(pathname: string) {
  if (pathname === "/" || pathname === "/dashboard") {
    return { title: "Dashboard", group: null, parent: null, parentHref: null, icon: LayoutDashboard };
  }
  if (pathname.startsWith("/orders")) {
    if (pathname === "/orders/new") {
      return { title: "New Order", group: "Work", parent: "Orders", parentHref: "/orders", icon: FolderKanban };
    }
    if (pathname !== "/orders") {
      return { title: "Order Details", group: "Work", parent: "Orders", parentHref: "/orders", icon: FolderKanban };
    }
    return { title: "Orders & Jobs", group: "Work", parent: null, parentHref: null, icon: FolderKanban };
  }
  if (pathname.startsWith("/quotations")) {
    if (pathname === "/quotations/new") {
      return { title: "New Quotation", group: "Work", parent: "Quotations", parentHref: "/quotations", icon: FileText };
    }
    if (pathname !== "/quotations") {
      return { title: "Quotation Details", group: "Work", parent: "Quotations", parentHref: "/quotations", icon: FileText };
    }
    return { title: "Quotations", group: "Work", parent: null, parentHref: null, icon: FileText };
  }
  if (pathname.startsWith("/costing")) {
    if (pathname === "/costing/new") {
      return { title: "New Costing", group: "Work", parent: "Costing", parentHref: "/costing", icon: Calculator };
    }
    return { title: "Costing Sheet", group: "Work", parent: null, parentHref: null, icon: Calculator };
  }
  if (pathname.startsWith("/clients")) {
    if (pathname !== "/clients") {
      return { title: "Client Profile", group: "Master Data", parent: "Clients", parentHref: "/clients", icon: Users };
    }
    return { title: "Clients Directory", group: "Master Data", parent: null, parentHref: null, icon: Users };
  }
  if (pathname.startsWith("/companies")) {
    if (pathname !== "/companies") {
      return { title: "Company Profile", group: "Master Data", parent: "Companies", parentHref: "/companies", icon: Building2 };
    }
    return { title: "Companies", group: "Master Data", parent: null, parentHref: null, icon: Building2 };
  }
  if (pathname.startsWith("/products")) {
    return { title: "Products & Catalog", group: "Master Data", parent: null, parentHref: null, icon: Package };
  }
  if (pathname.startsWith("/suppliers")) {
    if (pathname !== "/suppliers") {
      return { title: "Supplier Profile", group: "Master Data", parent: "Suppliers", parentHref: "/suppliers", icon: Truck };
    }
    return { title: "Suppliers Directory", group: "Master Data", parent: null, parentHref: null, icon: Truck };
  }
  if (pathname.startsWith("/reports")) {
    return { title: "Reports & Analytics", group: "Analytics", parent: null, parentHref: null, icon: BarChart3 };
  }
  if (pathname.startsWith("/users")) {
    return { title: "Users & Accounts", group: "Admin", parent: null, parentHref: null, icon: UserCog };
  }
  if (pathname.startsWith("/roles")) {
    return { title: "Roles & Permissions", group: "Admin", parent: null, parentHref: null, icon: ShieldCheck };
  }
  if (pathname.startsWith("/settings")) {
    return { title: "System Settings", group: "Admin", parent: null, parentHref: null, icon: SettingsIcon };
  }
  if (pathname.startsWith("/notifications")) {
    return { title: "Notifications", group: "System", parent: null, parentHref: null, icon: Bell };
  }
  return { title: "Enterprise CRM", group: null, parent: null, parentHref: null, icon: LayoutDashboard };
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const routeInfo = getRouteInfo(pathname || "");
  const RouteIcon = routeInfo.icon;

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
    <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
      {/* 1. Left: Active Tab / Section Title & Breadcrumbs + Sidebar Toggle */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[240px] sm:max-w-xs">
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          className="flex h-8.5 w-8.5 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer flex-none border border-border/60 hover:border-border"
          aria-label="Toggle navigation menu"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5 text-ink-faint hover:text-ink transition-colors" />
          ) : (
            <PanelLeftClose className="h-4.5 w-4.5 text-ink-faint hover:text-ink transition-colors" />
          )}
        </button>

        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-primary-50 text-primary-600 flex-none shadow-2xs border border-primary-100/80">
          <RouteIcon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-faint">
            {routeInfo.group && (
              <>
                <span className="uppercase tracking-wider">{routeInfo.group}</span>
                <ChevronRight className="h-3 w-3 text-ink-faint" />
              </>
            )}
            {routeInfo.parent && (
              <>
                <Link href={routeInfo.parentHref || "#"} className="hover:text-ink transition-colors">
                  {routeInfo.parent}
                </Link>
                <ChevronRight className="h-3 w-3 text-ink-faint" />
              </>
            )}
          </div>
          <h2 className="truncate text-[14px] sm:text-[14.5px] font-extrabold text-ink tracking-tight">
            {routeInfo.title}
          </h2>
        </div>
      </div>

      {/* 2. Center: Universal Quick Search (Fuzzy, Debounced, Spotlight Modal) */}
      <div className="flex-1 max-w-md mx-auto px-2">
        <GlobalSearch />
      </div>

      {/* 3. Right: Notifications & User Profile */}
      <div className="flex flex-none items-center gap-2">
        {canSeeNotifications && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-surface animate-pulse" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-30 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-surface shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-bold text-ink">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
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
                          className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-faint hover:bg-surface-sunken hover:text-ink-muted cursor-pointer"
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
            className="flex items-center gap-2 rounded-xl py-1.5 pr-2.5 pl-1.5 hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-primary-100 text-[11.5px] font-extrabold text-primary-700 shadow-2xs">
              {initials}
            </div>
            <span className="text-[13.5px] font-bold text-ink hidden sm:inline">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-100">
              <div className="border-b border-border px-3.5 py-2.5 bg-surface-sunken/40">
                <p className="truncate text-[13px] font-bold text-ink">{displayName}</p>
                <p className="truncate text-xs text-ink-muted">{user?.role_name || "Staff"}</p>
              </div>
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-rose-600 transition-colors cursor-pointer"
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
