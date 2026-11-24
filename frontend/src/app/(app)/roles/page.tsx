"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Eye,
  FileCheck2,
  FileDown,
  Info,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XSquare,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { Role, RolePermissionRow } from "@/lib/types";
import { MODULE_LABELS, ModuleKey, PERMISSION_ACTION_LABELS, PermissionAction } from "@/lib/modules";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";

type MatrixRow = {
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_cancel: boolean;
  can_print: boolean;
  can_export: boolean;
  apply_user_permissions: boolean;
  permlevel: number;
};

export default function RolesPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, MatrixRow>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  async function load() {
    try {
      const list = await apiFetch<Role[] | { results: Role[] }>("/api/auth/roles/?page_size=100");
      const items = Array.isArray(list) ? list : list.results;
      setRoles(items);
      if (items.length && selectedId === null) setSelectedId(items[0].id);
    } catch {
      toast.error("Couldn't load roles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedId) || null;
  const isLockedFullAccess = selectedRole?.name === "Admin";
  const isClientRole = selectedRole?.name?.toLowerCase() === "client";

  useEffect(() => {
    if (!selectedRole) return;
    const next: typeof matrix = {};
    for (const key of Object.keys(MODULE_LABELS)) {
      const row = selectedRole.permissions.find((p: RolePermissionRow) => p.module === key);
      next[key] = {
        can_view: row?.can_view ?? false,
        can_add: row?.can_add ?? false,
        can_edit: row?.can_edit ?? false,
        can_delete: row?.can_delete ?? false,
        can_submit: row?.can_submit ?? false,
        can_cancel: row?.can_cancel ?? false,
        can_print: row?.can_print ?? false,
        can_export: row?.can_export ?? false,
        apply_user_permissions: row?.apply_user_permissions ?? false,
        permlevel: row?.permlevel ?? 0,
      };
    }
    setMatrix(next);
    setIsDirty(false);
  }, [selectedRole]);

  function toggle(moduleKey: string, field: keyof MatrixRow) {
    if (isLockedFullAccess) return;
    setMatrix((prev) => {
      const current = prev[moduleKey] || {
        can_view: false,
        can_add: false,
        can_edit: false,
        can_delete: false,
        can_submit: false,
        can_cancel: false,
        can_print: false,
        can_export: false,
        apply_user_permissions: false,
        permlevel: 0,
      };
      const updated = {
        ...prev,
        [moduleKey]: {
          ...current,
          [field]: typeof current[field] === "boolean" ? !current[field] : current[field],
        },
      };
      return updated;
    });
    setIsDirty(true);
  }

  function applyPreset(presetType: "client_portal" | "staff_standard" | "clear_all" | "grant_all") {
    if (isLockedFullAccess) return;
    setMatrix((prev) => {
      const next: Record<string, MatrixRow> = { ...prev };
      for (const mod of Object.keys(MODULE_LABELS)) {
        if (presetType === "clear_all") {
          next[mod] = {
            can_view: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_submit: false,
            can_cancel: false,
            can_print: false,
            can_export: false,
            apply_user_permissions: false,
            permlevel: 0,
          };
        } else if (presetType === "grant_all") {
          next[mod] = {
            can_view: true,
            can_add: true,
            can_edit: true,
            can_delete: true,
            can_submit: true,
            can_cancel: true,
            can_print: true,
            can_export: true,
            apply_user_permissions: false,
            permlevel: 0,
          };
        } else if (presetType === "client_portal") {
          const isClientDoc = ["quotations", "orders", "catalog", "clients", "companies", "notifications"].includes(mod);
          const needsUserPerm = ["quotations", "orders", "clients", "companies", "notifications"].includes(mod);
          next[mod] = {
            can_view: isClientDoc,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_submit: mod === "quotations", // Client can accept quotation
            can_cancel: false,
            can_print: isClientDoc && mod !== "catalog",
            can_export: false,
            apply_user_permissions: needsUserPerm,
            permlevel: 0,
          };
        } else if (presetType === "staff_standard") {
          const isRestricted = ["users", "settings"].includes(mod);
          next[mod] = {
            can_view: !isRestricted,
            can_add: !isRestricted,
            can_edit: !isRestricted,
            can_delete: false,
            can_submit: true,
            can_cancel: false,
            can_print: true,
            can_export: true,
            apply_user_permissions: false,
            permlevel: 0,
          };
        }
      }
      return next;
    });
    setIsDirty(true);
    toast.success(`Preset "${presetType.replace('_', ' ')}" applied.`);
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const rows = Object.entries(matrix).map(([module, flags]) => ({ module, ...flags }));
      await apiFetch(`/api/auth/roles/${selectedRole.id}/permissions/`, {
        method: "PUT",
        body: JSON.stringify(rows),
      });
      toast.success("Frappe permissions saved successfully.");
      setIsDirty(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRole() {
    if (!selectedRole || selectedRole.is_system) return;
    try {
      await apiFetch(`/api/auth/roles/${selectedRole.id}/`, { method: "DELETE" });
      toast.success(`Role "${selectedRole.name}" deleted.`);
      setDeleteConfirmOpen(false);
      setSelectedId(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete role.");
    }
  }

  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (Object.keys(MODULE_LABELS) as ModuleKey[]).filter((key) => {
      if (!q) return true;
      return MODULE_LABELS[key].toLowerCase().includes(q) || key.toLowerCase().includes(q);
    });
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-end gap-2">
          <Link href="/users">
            <Button variant="secondary" className="gap-1.5 text-xs font-semibold">
              <Users className="h-4 w-4 text-primary-600" />
              <span>Users & Accounts</span>
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </div>
        <div className="flex min-h-[55vh] items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
          <LoadingState
            size="lg"
            label="Loading Role Permission Manager..."
            sublabel="Fetching Frappe DocType permissions, user restrictions, and role matrices"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <span>Role Permissions Manager</span>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-100 text-primary-800">
              Frappe RBAC
            </span>
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Configure DocType-level permissions, workflow actions (Submit / Print), row-level client restrictions, and PermLevels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/users">
            <Button variant="secondary" className="gap-1.5 text-xs font-semibold">
              <Users className="h-4 w-4 text-primary-600" />
              <span>Users & Portal Accounts</span>
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Left Side: Defined Roles List */}
        <Card className="flex flex-col gap-1 p-3">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint flex items-center justify-between">
            <span>Defined Roles ({roles.length})</span>
            <span className="text-[10px] text-primary-600 font-semibold">Frappe Matrix</span>
          </div>

          {!loading && roles.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-ink-faint">No roles defined yet.</p>
          )}

          {roles.map((r) => {
            const isClient = r.name?.toLowerCase() === "client";
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={clsx(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-all cursor-pointer",
                  selectedId === r.id
                    ? "bg-primary-50 text-primary-700 shadow-2xs ring-1 ring-primary-500/20 font-bold"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{r.name}</span>
                  {r.is_system && (
                    <span title="Built-in System Role">
                      <Lock className="h-3 w-3 flex-none text-ink-faint" />
                    </span>
                  )}
                  {isClient && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                      Portal
                    </span>
                  )}
                </div>
                {typeof r.user_count === "number" && (
                  <span
                    className={clsx(
                      "text-[11px] px-2 py-0.5 rounded-full font-mono font-bold flex-none",
                      selectedId === r.id
                        ? "bg-primary-100 text-primary-800"
                        : "bg-surface-sunken text-ink-faint",
                    )}
                  >
                    {r.user_count}
                  </span>
                )}
              </button>
            );
          })}

          <Button variant="secondary" onClick={() => setAddOpen(true)} className="mt-3 w-full justify-center text-xs">
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </Card>

        {/* Right Side: Frappe Permission Manager Table */}
        <Card className="flex flex-col">
          {!selectedRole ? (
            <p className="px-5 py-12 text-center text-sm text-ink-faint">Select a role to edit its permissions.</p>
          ) : (
            <>
              {/* Role Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border px-5 py-4 bg-surface-sunken/20">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-[17px] font-bold text-ink">&apos;{selectedRole.name}&apos; Role</h2>
                    {selectedRole.is_system ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                        <Lock className="h-3 w-3" /> System Role
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                        Custom Role
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted bg-white px-2 py-0.5 rounded-md border border-border">
                      <Users className="h-3 w-3 text-ink-faint" />
                      {selectedRole.user_count || 0} Assigned Users
                    </span>
                    {isDirty && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        ● Unsaved Changes
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {isLockedFullAccess
                      ? "Built-in superuser administrator role (full bypass across all DocTypes, modules, and settings)."
                      : isClientRole
                      ? "External customer portal role with row-level filtering and automatic PermLevel 1 internal margin masking."
                      : selectedRole.description || "Configure fine-grained view, create, edit, delete, submit, print, and row-level ownership."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/users?new=true&role=${selectedRole.id}`}>
                    <Button variant="secondary" size="sm" className="gap-1.5 text-xs font-semibold">
                      <UserPlus className="h-3.5 w-3.5 text-primary-600" />
                      <span>Add User</span>
                    </Button>
                  </Link>

                  {!selectedRole.is_system && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}

                  {!isLockedFullAccess && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      loading={saving}
                      disabled={!isDirty && !saving}
                    >
                      Save Permissions
                    </Button>
                  )}
                </div>
              </div>

              {/* Frappe Portal Security Callout for Client Role */}
              {isClientRole && (
                <div className="border-b border-emerald-200 bg-emerald-50/80 px-5 py-3 text-xs text-emerald-950 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 flex-none mt-0.5" />
                  <div>
                    <span className="font-bold">Frappe Portal Row-Level Security & Field Masking Active:</span>
                    <p className="text-emerald-800 mt-0.5">
                      Users assigned to the <strong>Client</strong> role only see quotations, orders, and company records linked to their specific client profile (<code>user.linked_client</code>). Internal cost breakdown, supplier rates, and profit margin percentages are automatically stripped from API responses (PermLevel 1).
                    </p>
                  </div>
                </div>
              )}

              {/* Preset Toolbar & Filter */}
              {!isLockedFullAccess && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-2.5 bg-surface-sunken/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink-muted">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset("client_portal")}
                      className="px-2 py-1 rounded bg-white border border-border text-ink hover:border-primary-500 hover:text-primary-600 font-semibold cursor-pointer"
                    >
                      Client Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("staff_standard")}
                      className="px-2 py-1 rounded bg-white border border-border text-ink hover:border-primary-500 hover:text-primary-600 font-semibold cursor-pointer"
                    >
                      Staff Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("grant_all")}
                      className="px-2 py-1 rounded bg-white border border-border text-ink hover:border-emerald-500 hover:text-emerald-700 font-semibold cursor-pointer"
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("clear_all")}
                      className="px-2 py-1 rounded bg-white border border-border text-ink hover:border-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="text"
                      placeholder="Filter DocType..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 rounded-md border border-border bg-white text-xs text-ink placeholder:text-ink-faint focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* The Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint bg-surface-sunken/60 select-none">
                      <th className="px-4 py-3 min-w-[140px]">DocType / Module</th>
                      <th className="px-2 py-3 text-center" title="Read / View Document">Read</th>
                      <th className="px-2 py-3 text-center" title="Create New Document">Create</th>
                      <th className="px-2 py-3 text-center" title="Write / Edit Document">Write</th>
                      <th className="px-2 py-3 text-center" title="Delete Document">Delete</th>
                      <th className="px-2 py-3 text-center" title="Submit / Approve Document (Frappe DocStatus)">Submit</th>
                      <th className="px-2 py-3 text-center" title="Cancel Document">Cancel</th>
                      <th className="px-2 py-3 text-center" title="Print and Generate PDF">Print</th>
                      <th className="px-2 py-3 text-center" title="Export to CSV/Excel">Export</th>
                      <th className="px-3 py-3 text-center min-w-[130px] bg-amber-50/50 text-amber-900 border-l border-border/80" title="Frappe User Permissions: Restrict rows to user's linked Client or Company">
                        🛡️ User Perms (Owner)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredModules.map((key) => {
                      const row = matrix[key] || {
                        can_view: false,
                        can_add: false,
                        can_edit: false,
                        can_delete: false,
                        can_submit: false,
                        can_cancel: false,
                        can_print: false,
                        can_export: false,
                        apply_user_permissions: false,
                        permlevel: 0,
                      };

                      const isClientRestricted = ["quotations", "orders", "clients", "companies"].includes(key);

                      return (
                        <tr key={key} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-ink text-[13px]">
                            <div className="flex items-center gap-1.5">
                              <span>{MODULE_LABELS[key]}</span>
                              {isClientRestricted && isClientRole && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-100 text-emerald-800">
                                  Client Scoped
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Read */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_view}
                              onChange={() => toggle(key, "can_view")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Create */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_add}
                              onChange={() => toggle(key, "can_add")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Write */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_edit}
                              onChange={() => toggle(key, "can_edit")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Delete */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_delete}
                              onChange={() => toggle(key, "can_delete")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Submit */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_submit}
                              onChange={() => toggle(key, "can_submit")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Cancel */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_cancel}
                              onChange={() => toggle(key, "can_cancel")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Print */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_print}
                              onChange={() => toggle(key, "can_print")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* Export */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={isLockedFullAccess || row.can_export}
                              onChange={() => toggle(key, "can_export")}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-50 cursor-pointer"
                            />
                          </td>

                          {/* User Permissions / Owner Only */}
                          <td className="px-3 py-3 text-center bg-amber-50/30 border-l border-border/80">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                disabled={isLockedFullAccess}
                                checked={!isLockedFullAccess && row.apply_user_permissions}
                                onChange={() => toggle(key, "apply_user_permissions")}
                                className="h-4 w-4 rounded border-amber-400 accent-amber-600 disabled:opacity-50 cursor-pointer"
                              />
                              {row.apply_user_permissions && (
                                <span className="text-[10px] font-bold text-amber-800">
                                  Owner
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Sticky Action Bar if Dirty */}
              {isDirty && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-amber-50">
                  <span className="text-xs font-semibold text-amber-800">
                    You have unsaved changes in &apos;{selectedRole.name}&apos; permissions.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedId(selectedRole.id)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                      Save Permissions
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <QuickCreateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create New Role"
        label="Role Name (e.g. Sales Executive, Production Manager, Client, Quality Inspector)"
        onCreate={async (name) => {
          const created = await apiFetch<Role>("/api/auth/roles/", { method: "POST", body: JSON.stringify({ name }) });
          toast.success(`Role "${created.name}" added. You can now configure permissions or assign users.`);
          await load();
          setSelectedId(created.id);
        }}
      />

      {deleteConfirmOpen && selectedRole && (
        <ConfirmDialog
          open
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Role"
          description={`Are you sure you want to delete role "${selectedRole.name}"? Users assigned to this role will lose their custom permissions.`}
          onConfirm={handleDeleteRole}
        />
      )}
    </div>
  );
}
