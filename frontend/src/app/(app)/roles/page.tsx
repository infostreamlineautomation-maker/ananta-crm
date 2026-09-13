"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { Role, RolePermissionRow } from "@/lib/types";
import { MODULE_LABELS, ModuleKey, PERMISSION_ACTIONS } from "@/lib/modules";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { LoadingState } from "@/components/ui/LoadingState";

const ACTION_LABEL: Record<string, string> = { view: "View", add: "Add", edit: "Edit", delete: "Delete" };

export default function RolesPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }>>({});
  const [saving, setSaving] = useState(false);

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
  // is_system only protects a role from deletion (Staff is is_system too, and
  // its scoped permissions are meant to be edited) — the full-access lock is
  // specifically about the Admin role, not "any built-in role".
  const isLockedFullAccess = selectedRole?.name === "Admin";

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
      };
    }
    setMatrix(next);
  }, [selectedRole]);

  function toggle(moduleKey: string, action: "can_view" | "can_add" | "can_edit" | "can_delete") {
    setMatrix((prev) => ({ ...prev, [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] } }));
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const rows = Object.entries(matrix).map(([module, flags]) => ({ module, ...flags }));
      await apiFetch(`/api/auth/roles/${selectedRole.id}/permissions/`, { method: "PUT", body: JSON.stringify(rows) });
      toast.success("Permissions saved.");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save permissions.");
    } finally {
      setSaving(false);
    }
  }

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
            label="Loading Roles & Permissions..."
            sublabel="Fetching defined roles, permission matrices, and user assignments"
          />
        </div>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-1 p-3">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Defined Roles ({roles.length})
          </div>

          {!loading && roles.length === 0 && <p className="px-2 py-4 text-center text-sm text-ink-faint">No roles yet.</p>}

          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={clsx(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-all cursor-pointer",
                selectedId === r.id
                  ? "bg-primary-50 text-primary-700 shadow-2xs ring-1 ring-primary-500/20"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <div className="flex items-center gap-2">
                <span>{r.name}</span>
                {r.is_system && <Lock className="h-3 w-3 text-ink-faint" />}
              </div>
              {typeof r.user_count === "number" && (
                <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-mono font-bold", selectedId === r.id ? "bg-primary-100 text-primary-800" : "bg-surface-sunken text-ink-faint")}>
                  {r.user_count} {r.user_count === 1 ? "user" : "users"}
                </span>
              )}
            </button>
          ))}

          <Button variant="secondary" onClick={() => setAddOpen(true)} className="mt-3 w-full justify-center">
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </Card>

        <Card>
          {!selectedRole ? (
            <p className="px-5 py-12 text-center text-sm text-ink-faint">Select a role to edit its permissions.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border px-5 py-4 bg-surface-sunken/20">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[16px] font-bold text-ink">&apos;{selectedRole.name}&apos; Role</h2>
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
                      {selectedRole.user_count || 0} Assigned
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {isLockedFullAccess
                      ? "Built-in full-access administrator role (all permissions granted)."
                      : "Configure fine-grained view, create, edit, and delete privileges across CRM modules."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/users?new=true&role=${selectedRole.id}`}>
                    <Button variant="secondary" size="sm" className="gap-1.5 text-xs font-semibold">
                      <UserPlus className="h-3.5 w-3.5 text-primary-600" />
                      <span>Add User with this Role</span>
                    </Button>
                  </Link>

                  {(selectedRole.user_count ?? 0) > 0 && (
                    <Link href={`/users?role=${selectedRole.id}`}>
                      <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5" />
                        <span>View Users</span>
                      </Button>
                    </Link>
                  )}

                  {!isLockedFullAccess && (
                    <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                      Save Permissions
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint bg-surface-sunken/40">
                      <th className="px-5 py-2.5 text-left">Module / Resource</th>
                      {PERMISSION_ACTIONS.map((a) => (
                        <th key={a} className="px-3 py-2.5 text-center">
                          {ACTION_LABEL[a]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => (
                      <tr key={key} className="hover:bg-surface-hover/40 transition-colors">
                        <td className="px-5 py-3 text-[13.5px] font-semibold text-ink">{MODULE_LABELS[key]}</td>
                        {(["can_view", "can_add", "can_edit", "can_delete"] as const).map((action) => (
                          <td key={action} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={matrix[key]?.[action] ?? false}
                              onChange={() => toggle(key, action)}
                              className="h-4 w-4 rounded border-border-strong accent-primary-600 disabled:opacity-40 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      <QuickCreateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create New Role"
        label="Role Name (e.g. Sales Executive, Accountant, Designer, Operator)"
        onCreate={async (name) => {
          const created = await apiFetch<Role>("/api/auth/roles/", { method: "POST", body: JSON.stringify({ name }) });
          toast.success(`Role "${created.name}" added. You can now configure permissions or assign users.`);
          await load();
          setSelectedId(created.id);
        }}
      />
    </div>
  );
}

