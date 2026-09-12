"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useList } from "@/lib/hooks";
import { AppUser, Role } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { formatDate } from "@/lib/format";

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
  const { can, user: currentUser } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(
    new Set(["avatar", "username", "full_name", "email", "role", "status", "actions"])
  );
  const { data, loading, reload } = usePaginatedList<AppUser>(`/api/auth/users/?page=${page}`);
  const { items: roles } = useList<Role>("/api/auth/roles/?page_size=100");

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  const canAdd = can("users", "add");
  const canEdit = can("users", "edit");
  const canDelete = can("users", "delete");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        action={
          <div className="flex items-center gap-2">
            <ColumnSelector columns={USERS_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
            {canAdd && (
              <Button variant="primary" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Add User
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {cols.has("avatar") && <th className={TH}></th>}
                {cols.has("username") && <th className={TH}>Username</th>}
                {cols.has("full_name") && <th className={TH}>Full Name</th>}
                {cols.has("email") && <th className={TH}>Email</th>}
                {cols.has("phone") && <th className={TH}>Phone</th>}
                {cols.has("role") && <th className={TH}>Role</th>}
                {cols.has("status") && <th className={TH}>Status</th>}
                {cols.has("date_joined") && <th className={TH}>Joined Date</th>}
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No users yet." />
              {data?.results.map((u) => {
                const initials = (u.first_name?.[0] || u.username[0] || "?").toUpperCase() + (u.last_name?.[0] || "").toUpperCase();
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={TR}>
                    {cols.has("avatar") && (
                      <td className={TD}>
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-600">{initials}</div>
                      </td>
                    )}
                    {cols.has("username") && <td className={`${TD} font-semibold`}>{u.username}</td>}
                    {cols.has("full_name") && <td className={`${TD} text-ink-muted`}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>}
                    {cols.has("email") && <td className={`${TD} text-ink-muted`}>{u.email || "—"}</td>}
                    {cols.has("phone") && <td className={`${TD} text-ink-muted`}>{u.phone || "—"}</td>}
                    {cols.has("role") && (
                      <td className={TD}>
                        <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", u.is_superuser ? "bg-primary-50 text-primary-600" : "bg-surface-sunken text-ink-muted")}>
                          {u.role_name || "No role"}
                        </span>
                      </td>
                    )}
                    {cols.has("status") && (
                      <td className={TD}>
                        <span className={clsx("inline-flex items-center gap-1.5 text-xs font-semibold", u.is_active ? "text-success-700" : "text-ink-faint")}>
                          <span className={clsx("h-1.5 w-1.5 rounded-full", u.is_active ? "bg-success-500" : "bg-ink-faint")} />
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    )}
                    {cols.has("date_joined") && <td className={`${TD} text-xs text-ink-muted`}>{u.date_joined ? formatDate(u.date_joined) : "—"}</td>}
                    {cols.has("actions") && (
                      <td className={`${TD} text-right`}>
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
                    )}
                  </tr>
                );
              })}
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
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
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
  onCancel,
  onSaved,
}: {
  user: AppUser | null;
  roles: Role[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [username, setUsername] = useState(user?.username ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<number | "">(user?.role ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value ? Number(e.target.value) : "")}>
          <option value="">No role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      {!user && (
        <Field label="Password" required hint="At least 8 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </Field>
      )}
      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save User
        </Button>
      </div>
    </form>
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
      await apiFetch(`/api/auth/users/${user.id}/set_password/`, { method: "POST", body: JSON.stringify({ password }) });
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
