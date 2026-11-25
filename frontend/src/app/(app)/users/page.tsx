"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Pencil, Plus, Shield, ShieldCheck, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useInfinitePaginatedList, useList } from "@/lib/hooks";
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
import { LoadMorePagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { formatDate } from "@/lib/format";
import { useTableGrid } from "@/lib/useTableGrid";
import { ResizableTh } from "@/components/ui/ResizableTh";

const USERS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "avatar", label: "Avatar", defaultVisible: true },
  { key: "username", label: "Username", required: true, defaultVisible: true },
  { key: "full_name", label: "Full Name", defaultVisible: true },
  { key: "user_type", label: "User Type", defaultVisible: true },
  { key: "company", label: "Business Org", defaultVisible: true },
  { key: "linked_client", label: "Linked Client", defaultVisible: true },
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
  const clientParam = searchParams.get("client_id") || searchParams.get("client");
  const orgParam = searchParams.get("organization_id") || searchParams.get("org");
  const clientNameParam = searchParams.get("client_name") || "";
  const clientEmailParam = searchParams.get("client_email") || "";
  const clientPhoneParam = searchParams.get("client_phone") || "";

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>(roleParam || "");

  const grid = useTableGrid({
    tableKey: "users",
    defaultColumns: USERS_PAGE_COLUMNS,
    defaultVisibleKeys: ["avatar", "username", "full_name", "user_type", "company", "linked_client", "email", "role", "status", "actions"],
  });

  const queryUrl = useMemo(() => {
    let url = `/api/auth/users/`;
    if (selectedRoleFilter) {
      url += `?role=${selectedRoleFilter}`;
    }
    return url;
  }, [selectedRoleFilter]);

  const {
    items: users,
    count: totalCount,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
  } = useInfinitePaginatedList<AppUser>(queryUrl);
  const { items: roles, reload: reloadRoles } = useList<Role>("/api/auth/roles/?page_size=100");

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [initialRoleId, setInitialRoleId] = useState<number | null>(null);
  const [initialClientId, setInitialClientId] = useState<number | null>(null);
  const [initialOrgId, setInitialOrgId] = useState<number | null>(null);
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  // Auto-open Add User modal if coming from Roles or Clients page with ?new=true
  useEffect(() => {
    if (newParam === "true") {
      setEditing("new");
      if (roleParam) {
        setInitialRoleId(Number(roleParam));
      }
      if (clientParam) {
        setInitialClientId(Number(clientParam));
      }
      if (orgParam) {
        setInitialOrgId(Number(orgParam));
      }
    }
  }, [newParam, roleParam, clientParam, orgParam]);

  const canAdd = can("users", "add");
  const canEdit = can("users", "edit");
  const canDelete = can("users", "delete");

  const renderCell = (colKey: string, u: AppUser) => {
    const initials = (u.first_name?.[0] || u.username[0] || "?").toUpperCase() + (u.last_name?.[0] || "").toUpperCase();
    const isSelf = u.id === currentUser?.id;
    const isPortal = u.user_type === "portal_user" || u.is_portal_client || u.role_name?.toLowerCase() === "client";

    if (colKey === "avatar") {
      return (
        <td key={colKey} className={TD}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-600">{initials}</div>
        </td>
      );
    }
    if (colKey === "username") return <td key={colKey} className={`${TD} font-semibold`}>{u.username}</td>;
    if (colKey === "full_name") return <td key={colKey} className={`${TD} text-ink-muted`}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>;
    if (colKey === "user_type") {
      return (
        <td key={colKey} className={TD}>
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
              isPortal
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            )}
          >
            {isPortal ? "Portal / Client" : "System Staff"}
          </span>
        </td>
      );
    }
    if (colKey === "company") {
      const orgName = u.organization_name;
      return (
        <td key={colKey} className={`${TD} text-xs font-semibold`}>
          {orgName ? (
            <span
              className={clsx(
                "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold",
                orgName.toLowerCase().includes("meewa")
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              )}
            >
              {orgName}
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
      );
    }
    if (colKey === "linked_client") {
      return (
        <td key={colKey} className={`${TD} text-ink-muted text-xs`}>
          {u.linked_client_name ? (
            <div>
              <span className="font-semibold text-primary-600">{u.linked_client_name}</span>
              {u.linked_client_company_name && (
                <div className="text-[11px] font-normal text-ink-muted leading-tight">
                  ({u.linked_client_company_name})
                </div>
              )}
            </div>
          ) : (
            "—"
          )}
        </td>
      );
    }
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
              All Roles ({totalCount ?? "..."})
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
                empty={!loading && users.length === 0}
                colSpan={grid.visibleColumns.size}
                emptyLabel="No users found."
              />
              {users.map((u) => (
                <tr key={u.id} className={TR}>
                  {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => renderCell(col.key, u))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMorePagination
          loadedCount={users.length}
          totalCount={totalCount}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          itemName="users"
        />
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add User" : "Edit User"}>
        {editing !== null && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            user={editing === "new" ? null : editing}
            roles={roles}
            initialRoleId={initialRoleId}
            initialClientId={initialClientId}
            initialOrgId={initialOrgId}
            defaultValues={
              editing === "new"
                ? {
                    username: clientNameParam ? clientNameParam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) : "",
                    first_name: clientNameParam,
                    email: clientEmailParam,
                    phone: clientPhoneParam,
                  }
                : undefined
            }
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
  initialClientId,
  initialOrgId,
  defaultValues,
  onReloadRoles,
  onCancel,
  onSaved,
}: {
  user: AppUser | null;
  roles: Role[];
  initialRoleId?: number | null;
  initialClientId?: number | null;
  initialOrgId?: number | null;
  defaultValues?: { username?: string; first_name?: string; email?: string; phone?: string };
  onReloadRoles: () => Promise<void> | void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [username, setUsername] = useState(user?.username ?? (defaultValues?.username || ""));
  const [firstName, setFirstName] = useState(user?.first_name ?? (defaultValues?.first_name || ""));
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? (defaultValues?.email || ""));
  const [phone, setPhone] = useState(user?.phone ?? (defaultValues?.phone || ""));
  const [role, setRole] = useState<number | "">(user?.role ?? (initialRoleId || ""));

  const isInitialClient = Boolean(
    user?.user_type === "portal_user" ||
    user?.is_portal_client ||
    user?.role_name?.toLowerCase() === "client" ||
    initialClientId
  );

  const [userType, setUserType] = useState<"system_user" | "portal_user">(
    user?.user_type ?? (isInitialClient ? "portal_user" : "system_user")
  );
  const [linkedClient, setLinkedClient] = useState<number | "">(
    user?.linked_client ?? (initialClientId || "")
  );
  const [clients, setClients] = useState<Array<{ id: number; client_name: string; company_name?: string | null; organization?: number; organization_name?: string }>>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | "">(
    user?.organization_id ?? (initialOrgId || "")
  );

  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/clients/?page_size=250")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.results || [];
        setClients(list);
      })
      .catch(() => {});

    apiFetch<{ organizations: Array<{ id: number; name: string; slug: string }> }>("/api/organizations/mine/")
      .then((res) => {
        const orgs = res?.organizations || [];
        setOrganizations(orgs);
        if (!user && initialOrgId) {
          setSelectedOrgId(initialOrgId);
        } else if (!user && !selectedOrgId && orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch(() => {});
  }, [user, initialOrgId]);

  function handleClientSelect(clientId: number | "") {
    setLinkedClient(clientId);
    if (clientId) {
      const match = clients.find((c) => c.id === clientId);
      if (match?.organization) {
        setSelectedOrgId(match.organization);
      }
    }
  }

  function handleRoleChange(newRoleId: number | "") {
    setRole(newRoleId);
    const chosenRole = roles.find((r) => r.id === newRoleId);
    if (chosenRole?.name?.toLowerCase() === "client") {
      setUserType("portal_user");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        role: role || null,
        user_type: userType,
        linked_client: userType === "portal_user" && linkedClient ? Number(linkedClient) : null,
        organization_id: selectedOrgId ? Number(selectedOrgId) : null,
      };

      if (user) {
        await apiFetch(`/api/auth/users/${user.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("User updated.");
      } else {
        payload.password = password;
        await apiFetch("/api/auth/users/", {
          method: "POST",
          body: JSON.stringify(payload),
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
        {/* User Type Selector */}
        <div>
          <label className="text-xs font-bold text-ink mb-1.5 block">User Account Type (Frappe Identity)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUserType("system_user")}
              className={clsx(
                "flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all cursor-pointer",
                userType === "system_user"
                  ? "border-primary-500 bg-primary-50/70 font-bold text-primary-900 ring-1 ring-primary-500"
                  : "border-border bg-white text-ink-muted hover:bg-surface-sunken"
              )}
            >
              <span className="font-bold">System Staff User</span>
              <span className="text-[11px] text-ink-muted font-normal mt-0.5">
                Internal CRM desks, operations, and management.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUserType("portal_user");
                const clientRole = roles.find((r) => r.name.toLowerCase() === "client");
                if (clientRole && !role) setRole(clientRole.id);
              }}
              className={clsx(
                "flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all cursor-pointer",
                userType === "portal_user"
                  ? "border-emerald-500 bg-emerald-50/70 font-bold text-emerald-950 ring-1 ring-emerald-500"
                  : "border-border bg-white text-ink-muted hover:bg-surface-sunken"
              )}
            >
              <span className="font-bold text-emerald-800">External Client Portal User</span>
              <span className="text-[11px] text-ink-muted font-normal mt-0.5">
                Restricted row-level client view; internal margins hidden.
              </span>
            </button>
          </div>
        </div>

        {/* Linked Client field when Portal User */}
        {userType === "portal_user" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <Field
              label="Linked Client (Frappe User Permission)"
              required
              hint="This login will strictly be restricted to quotations and orders belonging to this client."
            >
              <Select
                value={linkedClient}
                onChange={(e) => handleClientSelect(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">-- Choose Client Profile --</option>
                {clients.map((c) => {
                  const companyLabel = c.company_name || c.organization_name;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.client_name} {companyLabel ? `(${companyLabel})` : ""}
                    </option>
                  );
                })}
              </Select>
            </Field>
          </div>
        )}

        {/* Business Company Access (Meewa Industries vs Ananta Graphics) */}
        <div>
          <label className="text-xs font-bold text-ink mb-1.5 block">
            Business Company Access {userType === "portal_user" && <span className="text-rose-600">*</span>}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {organizations.map((org) => {
              const isSelected = selectedOrgId === org.id;
              const isMeewa = org.name.toLowerCase().includes("meewa") || org.slug.toLowerCase().includes("meewa");
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  className={clsx(
                    "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all cursor-pointer",
                    isSelected
                      ? isMeewa
                        ? "border-rose-500 bg-rose-50/80 ring-2 ring-rose-500 font-bold text-rose-950"
                        : "border-blue-600 bg-blue-50/80 ring-2 ring-blue-600 font-bold text-blue-950"
                      : "border-border bg-white text-ink-muted hover:bg-surface-sunken"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span className="font-bold text-xs">{org.name}</span>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <span className="text-[11px] text-ink-muted font-normal mt-0.5">
                    {isMeewa ? "Meewa Industries" : "Ananta Graphics"}
                  </span>
                </button>
              );
            })}
          </div>
          {userType === "portal_user" ? (
            <p className="mt-1.5 text-[11px] text-ink-muted">
              🔒 <strong>Strict Client Isolation:</strong> This client user will strictly only have access to{" "}
              <strong className="text-ink">{organizations.find((o) => o.id === selectedOrgId)?.name || "the chosen company"}</strong>. They cannot see or switch to the other company.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-ink-muted">
              Select the default business company for this user.
            </p>
          )}
        </div>

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
          <Select value={role} onChange={(e) => handleRoleChange(e.target.value ? Number(e.target.value) : "")}>
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
