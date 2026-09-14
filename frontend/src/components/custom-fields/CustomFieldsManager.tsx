"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Edit2, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { CustomFieldDefinition, CustomFieldModule, CustomFieldType } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const MODULES: { key: CustomFieldModule; label: string; description: string }[] = [
  {
    key: "order_item",
    label: "Orders / Projects",
    description: "Configure all table columns, pricing, dates, delivery/payment status and production line item attributes for Projects/Orders.",
  },
  {
    key: "quotation_item",
    label: "Quotations",
    description: "Configure all quotation table columns, recipient details, subject, financials and quotation line items.",
  },
  {
    key: "costing_item",
    label: "Costing Sheets",
    description: "Configure all costing table columns, quantities, rates, supplier costs, profit margins and line item calculations.",
  },
  {
    key: "product",
    label: "Products / Catalog",
    description: "Configure all product catalog columns, UOM, HSN code, pricing, MOQ and item specifications.",
  },
  {
    key: "client",
    label: "Clients",
    description: "Configure all client table columns, credit limits, payment terms, contact details and CRM attributes.",
  },
  {
    key: "company",
    label: "Companies",
    description: "Configure all company information columns, registration numbers, banking details and branding.",
  },
  {
    key: "supplier",
    label: "Suppliers",
    description: "Configure all supplier table columns, banking coordinates, tax registration and material categories.",
  },
];

const FIELD_TYPES: { key: CustomFieldType; label: string }[] = [
  { key: "text", label: "Text (Single Line)" },
  { key: "number", label: "Number / Decimal" },
  { key: "select", label: "Dropdown (Selection List)" },
  { key: "date", label: "Date" },
  { key: "boolean", label: "Yes / No (Checkbox)" },
];

export function CustomFieldsManager() {
  const toast = useToast();
  const [selectedModule, setSelectedModule] = useState<CustomFieldModule>("order_item");
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "table" | "print" | "required">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingField, setDeletingField] = useState<CustomFieldDefinition | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const [label, setLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsStr, setOptionsStr] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [showInTable, setShowInTable] = useState(true);
  const [showInPrint, setShowInPrint] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadFields = async (mod: CustomFieldModule) => {
    setLoading(true);
    try {
      const data = await apiFetch<CustomFieldDefinition[]>(`/api/custom-fields/?module=${mod}`);
      setFields(data);
    } catch {
      toast.error("Failed to load custom fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields(selectedModule);
    setSearchQuery("");
    setActiveFilterTab("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule]);

  const handleQuickToggle = async (f: CustomFieldDefinition, key: "show_in_table" | "show_in_print" | "is_required") => {
    const updatedVal = !f[key];
    setFields((prev) => prev.map((item) => (item.id === f.id ? { ...item, [key]: updatedVal } : item)));
    try {
      await apiFetch<CustomFieldDefinition>(`/api/custom-fields/${f.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: updatedVal }),
      });
      toast.success(`Updated ${f.label}`);
    } catch {
      // Rollback
      setFields((prev) => prev.map((item) => (item.id === f.id ? { ...item, [key]: !updatedVal } : item)));
      toast.error("Failed to update column setting.");
    }
  };

  const openCreateModal = () => {
    setEditingField(null);
    setLabel("");
    setFieldKey("");
    setFieldType("text");
    setOptionsStr("");
    setDefaultValue("");
    setIsRequired(false);
    setShowInTable(true);
    setShowInPrint(true);
    setModalOpen(true);
  };

  const openEditModal = (f: CustomFieldDefinition) => {
    setEditingField(f);
    setLabel(f.label);
    setFieldKey(f.field_key);
    setFieldType(f.field_type);
    setOptionsStr(f.options?.join(", ") || "");
    setDefaultValue(f.default_value || "");
    setIsRequired(f.is_required);
    setShowInTable(f.show_in_table);
    setShowInPrint(f.show_in_print);
    setModalOpen(true);
  };

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!editingField) {
      const autoKey = val.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      setFieldKey(autoKey);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Please enter a field label.");
      return;
    }
    if (!fieldKey.trim()) {
      toast.error("Please enter a valid field identifier key.");
      return;
    }

    setSaving(true);
    try {
      const optionsList =
        fieldType === "select"
          ? optionsStr
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [];

      const payload = {
        module: selectedModule,
        label: label.trim(),
        field_key: fieldKey.trim().toLowerCase(),
        field_type: fieldType,
        options: optionsList,
        default_value: defaultValue.trim(),
        is_required: isRequired,
        show_in_table: showInTable,
        show_in_print: showInPrint,
      };

      if (editingField) {
        const updated = await apiFetch<CustomFieldDefinition>(`/api/custom-fields/${editingField.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        toast.success("Column updated successfully.");
      } else {
        const created = await apiFetch<CustomFieldDefinition>("/api/custom-fields/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFields((prev) => [...prev, created]);
        toast.success("Column created successfully.");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save custom column.");
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deletingField) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/api/custom-fields/${deletingField.id}/`, { method: "DELETE" });
      setFields((prev) => prev.filter((f) => f.id !== deletingField.id));
      toast.success(`Removed column "${deletingField.label}".`);
      setDeletingField(null);
    } catch {
      toast.error("Failed to delete column.");
    } finally {
      setDeletingLoading(false);
    }
  };

  const currentModuleObj = MODULES.find((m) => m.key === selectedModule);

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      if (activeFilterTab === "table" && !f.show_in_table) return false;
      if (activeFilterTab === "print" && !f.show_in_print) return false;
      if (activeFilterTab === "required" && !f.is_required) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return f.label.toLowerCase().includes(q) || f.field_key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [fields, activeFilterTab, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-bold text-ink">Dynamic Custom Columns & Attributes</h3>
        <p className="text-xs text-ink-muted mt-0.5">
          Configure all table columns, fields, and custom attributes for each CRM module. Customize display names, default visibility in list tables, and print/PDF documents.
        </p>
      </div>

      {/* Module Selector Pills */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {MODULES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelectedModule(m.key)}
            className={clsx(
              "px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              selectedModule === m.key
                ? "bg-primary-600 text-white shadow-xs font-bold"
                : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-hover",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Selected Module Card Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-primary-50/60 p-4 rounded-xl border border-primary-100">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink">{currentModuleObj?.label}</h4>
              <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-bold text-primary-800">
                {fields.length} Available Column{fields.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">{currentModuleObj?.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              className="gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Add Custom Column
            </Button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveFilterTab("all")}
              className={clsx(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                activeFilterTab === "all" ? "bg-white text-ink shadow-2xs font-bold" : "text-ink-muted hover:text-ink"
              )}
            >
              All Columns ({fields.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilterTab("table")}
              className={clsx(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                activeFilterTab === "table" ? "bg-white text-ink shadow-2xs font-bold" : "text-ink-muted hover:text-ink"
              )}
            >
              Table Columns ({fields.filter((f) => f.show_in_table).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilterTab("print")}
              className={clsx(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                activeFilterTab === "print" ? "bg-white text-ink shadow-2xs font-bold" : "text-ink-muted hover:text-ink"
              )}
            >
              Print / PDF ({fields.filter((f) => f.show_in_print).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilterTab("required")}
              className={clsx(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                activeFilterTab === "required" ? "bg-white text-ink shadow-2xs font-bold" : "text-ink-muted hover:text-ink"
              )}
            >
              Required ({fields.filter((f) => f.is_required).length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : filteredFields.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <p className="text-xs font-semibold text-ink-muted">
              {searchQuery ? "No columns match your search query." : `No custom fields defined for ${currentModuleObj?.label} yet.`}
            </p>
            {!searchQuery && (
              <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
                <Plus className="h-3.5 w-3.5" /> Add Custom Column
              </Button>
            )}
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3">Column Label</th>
                  <th className="px-4 py-3">Database Key</th>
                  <th className="px-4 py-3">Data Type & Choices</th>
                  <th className="px-4 py-3">Default Value</th>
                  <th className="px-4 py-3 text-center">Table Visibility</th>
                  <th className="px-4 py-3 text-center">Print / PDF</th>
                  <th className="px-4 py-3 text-center">Required</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredFields.map((f) => (
                  <tr key={f.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">
                      <span>{f.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[11.5px] font-mono bg-surface-sunken px-1.5 py-0.5 rounded border border-border text-primary-700">
                        {f.field_key}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-ink">
                          {FIELD_TYPES.find((t) => t.key === f.field_type)?.label || f.field_type}
                        </span>
                        {f.field_type === "select" && f.options && f.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {f.options.slice(0, 4).map((opt) => (
                              <span
                                key={opt}
                                className="inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] text-ink-muted border border-border"
                              >
                                {opt}
                              </span>
                            ))}
                            {f.options.length > 4 && (
                              <span className="text-[10px] text-ink-faint">+{f.options.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {f.default_value ? (
                        <span className="font-mono text-[11px] text-neutral-800">{f.default_value}</span>
                      ) : (
                        <span className="text-ink-faint">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(f, "show_in_table")}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer",
                          f.show_in_table
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-surface-sunken text-ink-faint border border-border hover:bg-surface-hover hover:text-ink"
                        )}
                        title="Click to toggle table column visibility"
                      >
                        {f.show_in_table ? <Check className="h-3 w-3" /> : null}
                        {f.show_in_table ? "Visible" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(f, "show_in_print")}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer",
                          f.show_in_print
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-surface-sunken text-ink-faint border border-border hover:bg-surface-hover hover:text-ink"
                        )}
                        title="Click to toggle invoice print / PDF visibility"
                      >
                        {f.show_in_print ? <Check className="h-3 w-3" /> : null}
                        {f.show_in_print ? "Printable" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(f, "is_required")}
                        className={clsx(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold transition-colors cursor-pointer",
                          f.is_required
                            ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            : "bg-surface-sunken text-ink-faint border border-border hover:bg-surface-hover hover:text-ink"
                        )}
                        title="Click to toggle mandatory requirement"
                      >
                        {f.is_required ? "Required" : "Optional"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(f)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                          title="Edit Column"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingField(f)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Column"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h4 className="text-sm font-bold text-ink">
                {editingField ? `Edit Column (${editingField.label})` : `Add Custom Column for ${currentModuleObj?.label}`}
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Field label="Column Label / Name" required hint="Display name in table header & entry form">
                <Input
                  value={label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Paper GSM, HSN Code, Finish"
                  required
                />
              </Field>

              <Field
                label="Database Identifier Key"
                required
                hint="Unique internal identifier (alphanumeric snake_case)"
              >
                <Input
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="e.g. paper_gsm"
                  required
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="Field Type">
                <Select value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {fieldType === "select" && (
                <Field label="Dropdown Options" hint="Comma-separated list of choices">
                  <Input
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder="e.g. 100 GSM, 250 GSM, 300 GSM, 350 GSM"
                  />
                </Field>
              )}

              <Field label="Default Value (Optional)">
                <Input
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Optional preset value"
                />
              </Field>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInPrint}
                    onChange={(e) => setShowInPrint(e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  Include column in Invoice / Proposal Printouts & PDFs
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInTable}
                    onChange={(e) => setShowInTable(e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  Show as default column in CRM List Tables
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                  />
                  Mark as mandatory / required field
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingField ? "Save Changes" : "Create Column"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={!!deletingField}
        onClose={() => setDeletingField(null)}
        onConfirm={executeDelete}
        title="Delete Column"
        description={`Are you sure you want to remove the column "${deletingField?.label}"?`}
        confirmLabel="Delete Column"
        loading={deletingLoading}
      />
    </div>
  );
}
