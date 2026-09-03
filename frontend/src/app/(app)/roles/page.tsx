"use client";

import { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { Role, RolePermissionRow } from "@/lib/types";
import { MODULE_LABELS, ModuleKey, PERMISSION_ACTIONS } from "@/lib/modules";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Roles & Permissions" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-1 p-3">
          {!loading && roles.length === 0 && <p className="px-2 py-4 text-center text-sm text-ink-faint">No roles yet.</p>}
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={clsx(
                "flex items-center justify-between rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors",
                selectedId === r.id ? "bg-primary-50 text-primary-600" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {r.name}
              {r.is_system && <Lock className="h-3.5 w-3.5 text-ink-faint" />}
            </button>
          ))}
          <Button variant="secondary" onClick={() => setAddOpen(true)} className="mt-2 w-full justify-center">
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </Card>

        <Card>
          {!selectedRole ? (
            <p className="px-5 py-12 text-center text-sm text-ink-faint">Select a role to edit its permissions.</p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Editing &apos;{selectedRole.name}&apos; Permissions</h2>
                  <p className="text-[12.5px] text-ink-muted">
                    {isLockedFullAccess ? "Built-in full-access role — not editable." : "Configure fine-grained access control across CRM modules."}
                  </p>
                </div>
                {!isLockedFullAccess && (
                  <Button variant="primary" onClick={handleSave} loading={saving}>
                    Save Permissions
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      <th className="px-5 py-2.5 text-left">Module</th>
                      {PERMISSION_ACTIONS.map((a) => (
                        <th key={a} className="px-3 py-2.5 text-center">
                          {ACTION_LABEL[a]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => (
                      <tr key={key} className="border-b border-border last:border-b-0">
                        <td className="px-5 py-2.5 text-[13.5px] font-medium text-ink">{MODULE_LABELS[key]}</td>
                        {(["can_view", "can_add", "can_edit", "can_delete"] as const).map((action) => (
                          <td key={action} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              disabled={isLockedFullAccess}
                              checked={matrix[key]?.[action] ?? false}
                              onChange={() => toggle(key, action)}
                              className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] disabled:opacity-40"
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
        title="Add Role"
        label="Role Name"
        onCreate={async (name) => {
          const created = await apiFetch<Role>("/api/auth/roles/", { method: "POST", body: JSON.stringify({ name }) });
          toast.success("Role added.");
          await load();
          setSelectedId(created.id);
        }}
      />
    </div>
  );
}
