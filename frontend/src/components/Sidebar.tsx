"use client";

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
  ClipboardList,
  FileText,
  Calculator,
  BarChart3,
  UserCog,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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

  return (
    <aside className="flex w-64 flex-none flex-col border-r border-border bg-surface">
      <OrgSwitcher />

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter((item) => item.module === null || can(item.module, "view"));
          if (items.length === 0) return null;
          return (
            <div key={gi} className={gi === 0 ? "" : "mt-5"}>
              {group.label && (
                <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-md border-l-[3px] px-3 py-2 text-[13.5px] font-semibold transition-colors",
                        active
                          ? "border-primary-500 bg-primary-50 text-primary-600"
                          : "border-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] flex-none" strokeWidth={2} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
