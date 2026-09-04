"use client";

import { useEffect, useState } from "react";
import { Check, Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { CustomFieldDefinition, CustomFieldModule, CustomFieldType } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

const MODULES: { key: CustomFieldModule; label: string; description: string }[] = [
  {
    key: "order_item",
    label: "Orders (Line Items)",
    description: "Default extra columns on Order line items (e.g. GSM, Paper Type, Lamination, HSN Code).",
  },
  {
    key: "quotation_item",
    label: "Quotations (Line Items)",
    description: "Default extra columns on Quotation line items (e.g. Size, Finishing, Delivery Days).",
  },
  {
    key: "costing_item",
    label: "Costing Sheets (Line Items)",
    description: "Extra columns for Costing calculations (e.g. Wastage %, Machine Charge, Setup Fee).",
  },
  {
    key: "product",
    label: "Products / Catalog",
    description: "Custom attributes on catalog products (e.g. Brand, Material, Standard Unit).",
  },
  {
    key: "client",
    label: "Clients",
    description: "Custom client metadata (e.g. GSTIN, PAN No, Credit Limit, Territory).",
  },
  {
    key: "company",
    label: "Companies",
    description: "Custom company information (e.g. Registration Authority, Branch Code).",
  },
  {
    key: "supplier",
    label: "Suppliers",
    description: "Custom supplier metadata (e.g. Bank Account No, IFSC Code, Payment Terms).",
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
  const [modalOpen, setModalOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule]);

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
        toast.success("Custom column updated.");
      } else {
        const created = await apiFetch<CustomFieldDefinition>("/api/custom-fields/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFields((prev) => [...prev, created]);
        toast.success("Custom column created.");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save custom column.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this custom column?")) return;
    try {
      await apiFetch(`/api/custom-fields/${id}/`, { method: "DELETE" });
      setFields((prev) => prev.filter((f) => f.id !== id));
      toast.success("Custom column deleted.");
    } catch {
      toast.error("Failed to delete custom column.");
    }
  };

  const currentModuleObj = MODULES.find((m) => m.key === selectedModule);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-bold text-ink">Dynamic Custom Columns & Attributes</h3>
        <p className="text-xs text-ink-muted mt-0.5">
          Configure dynamic columns for data entry tables and custom attributes for CRM records. Added columns automatically reflect in forms, list views, and print invoices.
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
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
              selectedModule === m.key
                ? "bg-primary-600 text-white shadow-xs"
                : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-hover",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Selected Module Card Header & List */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-primary-50/50 p-4 rounded-xl border border-primary-100">
          <div>
            <h4 className="text-sm font-bold text-ink">{currentModuleObj?.label}</h4>
            <p className="text-xs text-ink-muted mt-0.5">{currentModuleObj?.description}</p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={openCreateModal} className="gap-1.5 shadow-xs whitespace-nowrap">
            <Plus className="h-4 w-4" /> Add Custom Column
          </Button>
        </div>

        {loading ? (
          <div className="flex h-36 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : fields.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-semibold text-ink-muted">No custom columns configured for {currentModuleObj?.label}.</p>
            <Button type="button" variant="secondary" size="sm" onClick={openCreateModal}>
              + Add First Column
            </Button>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/50 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3">Column Label</th>
                  <th className="px-4 py-3">Database Key</th>
                  <th className="px-4 py-3">Data Type</th>
                  <th className="px-4 py-3">Show in Print</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {fields.map((f) => (
                  <tr key={f.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{f.label}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono bg-surface-sunken px-1.5 py-0.5 rounded border border-border text-primary-700">
                        {f.field_key}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-ink-muted capitalize">
                      {FIELD_TYPES.find((t) => t.key === f.field_type)?.label || f.field_type}
                    </td>
                    <td className="px-4 py-3">
                      {f.show_in_print ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {f.is_required ? (
                        <span className="inline-flex rounded bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-bold text-rose-700 border border-rose-200">
                          Required
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(f)}
                          className="p-1 rounded text-ink-muted hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          className="p-1 rounded text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
    </div>
  );
}
