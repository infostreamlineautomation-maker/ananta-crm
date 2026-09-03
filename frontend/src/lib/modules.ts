/** Mirrors apps/core/modules.py on the backend — the RBAC module keys the
 * permission matrix is keyed by. Keep these two files in sync. */
export const MODULES = {
  CLIENTS: "clients",
  COMPANIES: "companies",
  CATALOG: "catalog",
  SUPPLIERS: "suppliers",
  PROJECTS: "projects",
  ORDERS: "orders",
  QUOTATIONS: "quotations",
  COSTING: "costing",
  REPORTS: "reports",
  USERS: "users",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];
export type PermissionAction = "view" | "add" | "edit" | "delete";

/** Display labels for the Roles & Permissions matrix — mirrors the MODULES
 * dict values in apps/core/modules.py, same order. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  [MODULES.CLIENTS]: "Clients",
  [MODULES.COMPANIES]: "Companies",
  [MODULES.CATALOG]: "Products",
  [MODULES.SUPPLIERS]: "Suppliers",
  [MODULES.PROJECTS]: "Projects",
  [MODULES.ORDERS]: "Orders",
  [MODULES.QUOTATIONS]: "Quotations",
  [MODULES.COSTING]: "Costing",
  [MODULES.REPORTS]: "Reports",
  [MODULES.USERS]: "Users",
  [MODULES.SETTINGS]: "Settings",
  [MODULES.NOTIFICATIONS]: "Notifications",
};

export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "add", "edit", "delete"];
