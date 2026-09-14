"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
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
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { MODULES } from "@/lib/modules";
import { OrgSwitcher } from "./OrgSwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  module: (typeof MODULES)[keyof typeof MODULES] | null;
}

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: null }],
  },
  {
    label: "Master Data",
    items: [
      { href: "/clients", label: "Clients", icon: Users, module: MODULES.CLIENTS },
      { href: "/companies", label: "Companies", icon: Building2, module: MODULES.COMPANIES },
      { href: "/products", label: "Products", icon: Package, module: MODULES.CATALOG },
      { href: "/suppliers", label: "Suppliers", icon: Truck, module: MODULES.SUPPLIERS },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/orders", label: "Projects", icon: FolderKanban, module: MODULES.ORDERS },
      { href: "/quotations", label: "Quotations", icon: FileText, module: MODULES.QUOTATIONS },
      { href: "/costing", label: "Costing", icon: Calculator, module: MODULES.COSTING },
    ],
  },
  {
    label: null,
    items: [{ href: "/reports", label: "Reports", icon: BarChart3, module: MODULES.REPORTS }],
  },
  {
    label: "Admin",
    items: [
      { href: "/users", label: "Users", icon: UserCog, module: MODULES.USERS },
      { href: "/roles", label: "Roles & Permissions", icon: ShieldCheck, module: MODULES.USERS },
      { href: "/settings", label: "Settings", icon: Settings, module: MODULES.SETTINGS },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <aside
      className={clsx(
        "flex flex-none flex-col border-r border-border bg-surface transition-[width] duration-300 ease-in-out relative select-none",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Top Organization Branding Header */}
      <OrgSwitcher isCollapsed={isCollapsed} />

      {/* Main Navigation List */}
      <nav className={clsx("flex-1 overflow-y-auto pb-4 overflow-x-hidden", isCollapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter((item) => item.module === null || can(item.module, "view"));
          if (items.length === 0) return null;
          return (
            <div key={gi} className={gi === 0 ? "" : isCollapsed ? "mt-3" : "mt-5"}>
              {group.label && (
                <>
                  {isCollapsed ? (
                    <div className="mx-auto my-2 w-7 border-t border-border/70" />
                  ) : (
                    <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      {group.label}
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      title={isCollapsed ? item.label : undefined}
                      className={clsx(
                        "group relative flex items-center rounded-lg transition-all",
                        isCollapsed
                          ? "h-10 w-10 mx-auto justify-center"
                          : "gap-2.5 border-l-[3px] px-3 py-2 text-[13.5px] font-semibold",
                        active
                          ? isCollapsed
                            ? "bg-primary-50 text-primary-600 ring-1 ring-primary-200"
                            : "border-primary-500 bg-primary-50 text-primary-600 font-bold"
                          : isCollapsed
                            ? "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                            : "border-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
                      )}
                    >
                      <Icon
                        className={clsx(
                          "flex-none transition-transform duration-150 group-hover:scale-110",
                          isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
                        )}
                        strokeWidth={active ? 2.2 : 2}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}

                      {/* Tooltip on hover when collapsed */}
                      {isCollapsed && (
                        <div className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-[12px] font-semibold text-white shadow-md transition-all group-hover:flex items-center animate-in fade-in zoom-in-95 duration-100">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Footer with Sidebar Collapse Toggle */}
      <div className={clsx("border-t border-border p-2.5 transition-all", isCollapsed ? "flex justify-center" : "px-3")}>
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          className={clsx(
            "flex items-center rounded-lg text-[13px] font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer group",
            isCollapsed ? "h-10 w-10 justify-center" : "w-full gap-2.5 px-2.5 py-2"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] text-ink-faint group-hover:text-ink transition-colors" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] text-ink-faint group-hover:text-ink transition-colors" />
              <span className="flex-1 text-left truncate">Collapse menu</span>
              <kbd className="hidden sm:inline-block rounded border border-border bg-surface-sunken px-1.5 py-0.5 text-[10px] font-mono text-ink-faint">
                Ctrl+B
              </kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
