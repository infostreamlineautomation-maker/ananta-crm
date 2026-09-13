"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Pencil, Plus, Shield, ShieldCheck, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList } from "@/lib/hooks";
import { AppUser, Role } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { Field, Input, Select } from "@/components/ui/Field";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { formatDate } from "@/lib/format";
import { useTableGrid } from "@/lib/useTableGrid";
import { ResizableTh } from "@/components/ui/ResizableTh";

const USERS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "avatar", label: "Avatar", defaultVisible: true },
  { key: "username", label: "Username", required: true, defaultVisible: true },
  { key: "full_name", label: "Full Name", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone", defaultVisible: false },
  { key: "role", label: "Role", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "date_joined", label: "Joined Date", defaultVisible: false },
  { key: "actions", label: "Actions", required: true, defaultVisible: true },
];

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-ink-muted">Loading users...</div>}>
      <UsersPageContent />
    </Suspense>
  );
}

function UsersPageContent() {
  const { can, user: currentUser } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();

  const roleParam = searchParams.get("role");
  const newParam = searchParams.get("new");

  const [page, setPage] = useState(1);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>(roleParam || "");

  const grid = useTableGrid({
    tableKey: "users",
    defaultColumns: USERS_PAGE_COLUMNS,
    defaultVisibleKeys: ["avatar", "username", "full_name", "email", "role", "status", "actions"],
  });

  const queryUrl = useMemo(() => {
    let url = `/api/auth/users/?page=${page}`;
    if (selectedRoleFilter) {
      url += `&role=${selectedRoleFilter}`;
    }
    return url;
  }, [page, selectedRoleFilter]);

  const { data, loading, reload } = usePaginatedList<AppUser>(queryUrl);
  const { items: roles, reload: reloadRoles } = useList<Role>("/api/auth/roles/?page_size=100");

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [initialRoleId, setInitialRoleId] = useState<number | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  // Auto-open Add User modal if coming from Roles page with ?new=true
  useEffect(() => {
    if (newParam === "true") {
      setEditing("new");
      if (roleParam) {
        setInitialRoleId(Number(roleParam));
      }
    }
  }, [newParam, roleParam]);

  const canAdd = can("users", "add");
  const canEdit = can("users", "edit");
  const canDelete = can("users", "delete");

  const renderCell = (colKey: string, u: AppUser) => {
    const initials = (u.first_name?.[0] || u.username[0] || "?").toUpperCase() + (u.last_name?.[0] || "").toUpperCase();
    const isSelf = u.id === currentUser?.id;

    if (colKey === "avatar") {
      return (
        <td key={colKey} className={TD}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-600">{initials}</div>
        </td>
      );
    }
    if (colKey === "username") return <td key={colKey} className={`${TD} font-semibold`}>{u.username}</td>;
    if (colKey === "full_name") return <td key={colKey} className={`${TD} text-ink-muted`}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>;
    if (colKey === "email") return <td key={colKey} className={`${TD} text-ink-muted`}>{u.email || "—"}</td>;
    if (colKey === "phone") return <td key={colKey} className={`${TD} text-ink-muted`}>{u.phone || "—"}</td>;
    if (colKey === "role") {
      return (
        <td key={colKey} className={TD}>
          <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", u.is_superuser ? "bg-primary-50 text-primary-600" : "bg-surface-sunken text-ink-muted")}>
            {u.role_name || "No role"}
          </span>
        </td>
      );
    }
    if (colKey === "status") {
      return (
        <td key={colKey} className={TD}>
          <span className={clsx("inline-flex items-center gap-1.5 text-xs font-semibold", u.is_active ? "text-success-700" : "text-ink-faint")}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", u.is_active ? "bg-success-500" : "bg-ink-faint")} />
            {u.is_active ? "Active" : "Inactive"}
          </span>
        </td>
      );
    }
    if (colKey === "date_joined") return <td key={colKey} className={`${TD} text-xs text-ink-muted`}>{u.date_joined ? formatDate(u.date_joined) : "—"}</td>;
    if (colKey === "actions") {
      return (
        <td key={colKey} className={`${TD} text-right`}>
          <div className="flex justify-end gap-1">
            {canEdit && (
              <>
                <RowActionButton label="Edit" onClick={() => setEditing(u)}>
                  <Pencil className="h-3.5 w-3.5" />
                </RowActionButton>
                <RowActionButton label="Reset Password" onClick={() => setResetting(u)}>
                  <KeyRound className="h-3.5 w-3.5" />
                </RowActionButton>
              </>
            )}
            {canDelete && !isSelf && (
              <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(u)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        </td>
      );
    }
    return <td key={colKey} className={TD}>—</td>;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Role Filter Tabs & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken/40 p-2 rounded-xl border border-border">
        {roles.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-ink-faint px-2 uppercase tracking-wider">Role:</span>
            <button
              onClick={() => setSelectedRoleFilter("")}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                !selectedRoleFilter
                  ? "bg-white text-primary-700 shadow-2xs font-bold ring-1 ring-primary-500/30"
                  : "text-ink-muted hover:text-ink hover:bg-white/50"
              )}
            >
              All Roles ({data?.count ?? "..."})
            </button>
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleFilter(String(r.id))}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  selectedRoleFilter === String(r.id)
                    ? "bg-white text-primary-700 shadow-2xs font-bold ring-1 ring-primary-500/30"
                    : "text-ink-muted hover:text-ink hover:bg-white/50"
                )}
              >
                <span>{r.name}</span>
                {typeof r.user_count === "number" && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                    {r.user_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Link href="/roles">
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <span>Roles & Permissions</span>
            </Button>
          </Link>

          <ColumnSelector
            columns={grid.columns}
            visibleColumns={grid.visibleColumns}
            onChange={grid.setVisibleColumns}
            onReorder={grid.reorderColumns}
            onReset={grid.resetGrid}
          />

          {canAdd && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setInitialRoleId(null);
                setEditing("new");
              }}
            >
              <Plus className="h-4 w-4" /> Add User
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {grid.columns
                  .filter((c) => grid.visibleColumns.has(c.key))
                  .map((col) => {
                    if (col.key === "actions") {
                      return (
                        <ResizableTh key="actions" columnKey="actions" grid={grid} align="right" isDraggable={false}>
                          <span className="sr-only">Actions</span>
                        </ResizableTh>
                      );
                    }
                    return (
                      <ResizableTh key={col.key} columnKey={col.key} grid={grid}>
                        <span>{col.label}</span>
                      </ResizableTh>
                    );
                  })}
              </tr>
            </thead>
            <tbody>
              <TableState
                loading={loading}
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={grid.visibleColumns.size}
                emptyLabel="No users found."
              />
              {data?.results.map((u) => (
                <tr key={u.id} className={TR}>
                  {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => renderCell(col.key, u))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add User" : "Edit User"}>
        {editing !== null && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            user={editing === "new" ? null : editing}
            roles={roles}
            initialRoleId={initialRoleId}
            onReloadRoles={reloadRoles}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
              reloadRoles();
            }}
          />
        )}
      </Modal>

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete user"
          description={`Delete "${deleting.username}"? They will lose access immediately.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/auth/users/${deleting.id}/`, { method: "DELETE" });
              toast.success("User deleted.");
              setDeleting(null);
              reload();
              reloadRoles();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this user.");
            }
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  user,
  roles,
  initialRoleId,
  onReloadRoles,
  onCancel,
  onSaved,
}: {
  user: AppUser | null;
  roles: Role[];
  initialRoleId?: number | null;
  onReloadRoles: () => Promise<void> | void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [username, setUsername] = useState(user?.username ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<number | "">(user?.role ?? (initialRoleId || ""));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (user) {
        await apiFetch(`/api/auth/users/${user.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ username, first_name: firstName, last_name: lastName, email, phone, role: role || null }),
        });
        toast.success("User updated.");
      } else {
        await apiFetch("/api/auth/users/", {
          method: "POST",
          body: JSON.stringify({ username, first_name: firstName, last_name: lastName, email, phone, role: role || null, password }),
        });
        toast.success("User added.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Username" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last Name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-ink">User Role</label>
            <button
              type="button"
              onClick={() => setAddRoleOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Role</span>
            </button>
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value ? Number(e.target.value) : "")}>
            <option value="">No role (Read-only)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.is_system ? "(System)" : ""}
              </option>
            ))}
          </Select>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Roles control access permissions across all modules</span>
            <Link href="/roles" target="_blank" className="font-semibold text-primary-600 hover:underline">
              Roles & Permissions →
            </Link>
          </div>
        </div>

        {!user && (
          <Field label="Password" required hint="At least 8 characters.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
        )}
        {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
        <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save User
          </Button>
        </div>
      </form>

      {/* Quick Add Role Modal inside UserForm */}
      <QuickCreateModal
        open={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        title="Create New Role"
        label="Role Name (e.g., Sales Manager, Accountant, Operator)"
        onCreate={async (name) => {
          const created = await apiFetch<Role>("/api/auth/roles/", {
            method: "POST",
            body: JSON.stringify({ name }),
          });
          toast.success(`Role "${created.name}" created and selected.`);
          await onReloadRoles();
          setRole(created.id);
        }}
      />
    </>
  );
}

function ResetPasswordModal({ user, onClose, onDone }: { user: AppUser; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/auth/users/${user.id}/`, { method: "POST", body: JSON.stringify({ password }) });
      toast.success(`Password reset for ${user.username}.`);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reset this password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Reset Password — ${user.username}`} width="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="New Password" required hint="At least 8 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
        </Field>
        {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Reset Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
