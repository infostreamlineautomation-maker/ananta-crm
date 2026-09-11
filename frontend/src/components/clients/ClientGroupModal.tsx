"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Edit2, FolderPlus, Layers, Plus, Search, Trash2, Users, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Client, ClientGroup } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const PRESET_COLORS = [
  { label: "Rose / Wine", value: "#881337" },
  { label: "Indigo", value: "#4338ca" },
  { label: "Emerald", value: "#047857" },
  { label: "Amber", value: "#b45309" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Purple", value: "#6d28d9" },
  { label: "Cyan", value: "#0e7490" },
  { label: "Slate", value: "#475569" },
];

interface ClientGroupModalProps {
  open: boolean;
  onClose: () => void;
  groups: ClientGroup[];
  allClients: Client[];
  onGroupsChanged: () => void;
  initialEditingGroup?: ClientGroup | null;
}

export function ClientGroupModal({
  open,
  onClose,
  groups,
  allClients,
  onGroupsChanged,
  initialEditingGroup = null,
}: ClientGroupModalProps) {
  const toast = useToast();
  const [editingGroup, setEditingGroup] = useState<ClientGroup | null>(initialEditingGroup);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#881337");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<ClientGroup | null>(null);

  useEffect(() => {
    if (initialEditingGroup) {
      startEditing(initialEditingGroup);
    } else {
      resetForm();
    }
  }, [initialEditingGroup, open]);

  function resetForm() {
    setEditingGroup(null);
    setIsCreatingNew(false);
    setName("");
    setDescription("");
    setColor("#881337");
    setSelectedClientIds(new Set());
    setClientSearch("");
  }

  function startEditing(group: ClientGroup) {
    setEditingGroup(group);
    setIsCreatingNew(false);
    setName(group.name);
    setDescription(group.description || "");
    setColor(group.color || "#881337");
    setSelectedClientIds(new Set(group.clients || []));
    setClientSearch("");
  }

  function startCreating() {
    setEditingGroup(null);
    setIsCreatingNew(true);
    setName("");
    setDescription("");
    setColor("#881337");
    setSelectedClientIds(new Set());
    setClientSearch("");
  }

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients;
    const q = clientSearch.toLowerCase();
    return allClients.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        (c.company_name && c.company_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [allClients, clientSearch]);

  const toggleClient = (clientId: number) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a group name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        clients: Array.from(selectedClientIds),
      };

      if (editingGroup) {
        await apiFetch(`/api/client-groups/${editingGroup.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(`Client group "${payload.name}" updated.`);
      } else {
        await apiFetch("/api/client-groups/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Client group "${payload.name}" created.`);
      }

      onGroupsChanged();
      resetForm();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save client group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingGroup) return;
    try {
      await apiFetch(`/api/client-groups/${deletingGroup.id}/`, { method: "DELETE" });
      toast.success(`Group "${deletingGroup.name}" deleted.`);
      setDeletingGroup(null);
      if (editingGroup?.id === deletingGroup.id) {
        resetForm();
      }
      onGroupsChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete group.");
    }
  }

  const isFormActive = isCreatingNew || editingGroup !== null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage Client Groups"
        width="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          {!isFormActive ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="font-bold text-sm text-ink">Existing Groups</h3>
                  <p className="text-xs text-ink-muted">
                    Create custom client groups to filter projects and display specific clients.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={startCreating}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Client Group
                </Button>
              </div>

              {groups.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-sand-50/50 rounded-xl border border-dashed border-border">
                  <div className="p-3 bg-white rounded-full shadow-xs text-primary-600 mb-3">
                    <Layers className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-sm text-ink mb-1">No Client Groups Created Yet</h4>
                  <p className="text-xs text-ink-muted max-w-sm mb-4">
                    Create named client groups (e.g. "VIP Clients", "Corporate Buyers", "North Region") to filter projects easily.
                  </p>
                  <Button variant="primary" size="sm" onClick={startCreating}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create First Group
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {groups.map((grp) => {
                    const clientCount = grp.clients_count ?? (grp.clients?.length || 0);
                    return (
                      <div
                        key={grp.id}
                        className="flex flex-col justify-between p-3.5 rounded-xl border border-border bg-white hover:border-primary-300 hover:shadow-xs transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: grp.color || "#881337" }}
                            />
                            <h4 className="font-bold text-sm text-ink truncate">{grp.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditing(grp)}
                              className="p-1.5 rounded-md hover:bg-sand-100 text-ink-muted hover:text-ink transition-colors"
                              title="Edit Group"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingGroup(grp)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-ink-muted hover:text-rose-600 transition-colors"
                              title="Delete Group"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {grp.description && (
                          <p className="text-xs text-ink-muted line-clamp-2 mt-1.5 mb-2">
                            {grp.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-sand-100 text-xs text-ink-muted">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Users className="h-3.5 w-3.5 text-primary-600" />
                            {clientCount} {clientCount === 1 ? "Client" : "Clients"}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditing(grp)}
                            className="font-semibold text-primary-600 hover:text-primary-700 text-xs"
                          >
                            Edit Members →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CREATE / EDIT FORM */
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full shadow-xs shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="font-bold text-sm text-ink">
                    {editingGroup ? `Edit Group: ${editingGroup.name}` : "Create New Client Group"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-ink-muted hover:text-ink px-2 py-1 rounded-md hover:bg-sand-100"
                >
                  ← Back to Groups
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Group Name" required>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. VIP Clients, Retail Outlets, West Zone"
                      autoFocus
                      required
                    />
                  </Field>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-ink mb-1.5">Color Tag</label>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        className={`h-6 w-6 rounded-full transition-transform flex items-center justify-center ${
                          color === c.value
                            ? "ring-2 ring-offset-2 ring-primary-600 scale-110"
                            : "hover:scale-105 opacity-80"
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Field label="Description (Optional)">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about which clients belong to this group..."
                />
              </Field>

              {/* CLIENT SELECTOR */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary-600" />
                    Select Group Members ({selectedClientIds.size} selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      Select All
                    </button>
                    <span className="text-border">|</span>
                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      className="font-medium text-ink-muted hover:text-ink"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted pointer-events-none" />
                  <Input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search clients by name, company..."
                    className="pl-9 text-xs"
                  />
                </div>

                <div className="border border-border rounded-xl bg-white max-h-[200px] overflow-y-auto divide-y divide-border/60">
                  {filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-muted">
                      No clients matching "{clientSearch}"
                    </div>
                  ) : (
                    filteredClients.map((cli) => {
                      const isChecked = selectedClientIds.has(cli.id);
                      return (
                        <label
                          key={cli.id}
                          className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors hover:bg-sand-50 ${
                            isChecked ? "bg-primary-50/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleClient(cli.id)}
                              className="rounded border-border text-primary-600 focus:ring-primary-500 h-4 w-4 shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-bold text-ink">{cli.client_name}</span>
                              {cli.company_name && (
                                <span className="text-ink-muted ml-1.5 font-normal">
                                  ({cli.company_name})
                                </span>
                              )}
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[11px] font-semibold text-primary-700 bg-primary-100/70 px-2 py-0.5 rounded-full shrink-0">
                              Selected
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingGroup ? "Save Changes" : "Create Group"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {deletingGroup && (
        <ConfirmDialog
          open
          onClose={() => setDeletingGroup(null)}
          title="Delete Client Group"
          description={`Are you sure you want to delete the group "${deletingGroup.name}"? Clients will not be deleted, only the group grouping.`}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}
