"use client";

import { useId, useState, useMemo, useEffect } from "react";
import clsx from "clsx";
import {
  Calculator,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  PieChart,
  Layers,
  FileText,
  RotateCcw,
  Sparkles,
  Copy,
  Settings2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  DetailedCostingCustomColumn,
  DetailedCostingData,
  DetailedCostingRow,
  DetailedCostingQuantityTier,
} from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";

function newRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function createBlankDetailedRow(itemName: string = ""): DetailedCostingRow {
  return {
    id: newRowId(),
    item_name: itemName,
    qty: "",
    rate: "",
    total: "0.00",
    custom_fields: {},
  };
}

export function createBlankQuantityTier(
  qty: string = "1000",
  totalAmount: string = "0.00",
  unitRate: string = "0.00",
  notes: string = ""
): DetailedCostingQuantityTier {
  return {
    id: `tier_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    qty,
    total_amount: totalAmount,
    unit_rate: unitRate,
    include_in_whatsapp: true,
    notes,
  };
}

export function createInitialDetailedCostingData(
  initialJobTitle: string = ""
): DetailedCostingData {
  return {
    job_title: initialJobTitle || "",
    total_qty: "1000",
    col_item_label: "Item / Process Name",
    col_qty_label: "Qty.",
    col_rate_label: "Rate",
    col_total_label: "Total Amount",
    custom_columns: [],
    rows: [
      createBlankDetailedRow(),
      createBlankDetailedRow(),
      createBlankDetailedRow(),
      createBlankDetailedRow(),
    ],
    total_cost: "0.00",
    cost_per_unit: "0.00",
    margin_percent: "0",
    client_rate: "0.00",
    client_subtotal: "0.00",
    costing_notes: "",
    quantity_tiers: [],
  };
}

export const DEFAULT_COMMON_PROCESS_TEMPLATES = [
  "Paper",
  "Printing",
  "Matt Lamination",
  "Gloss Lamination",
  "Creasing",
  "Die Punching",
  "Binding",
  "Spot UV / Foil",
  "Transportation",
];

export const STORAGE_KEY_QUICK_PROCESSES = "ananta_crm_costing_quick_processes";

/**
 * Universal builder for Detailed Costing WhatsApp proposals.
 * Formats checked comparison tiers when available, or batch rate.
 */
export function buildDetailedCostingWhatsappMessage(
  data: DetailedCostingData,
  clientName: string = "Sir/Madam",
  city: string = "",
  jobSubject: string = "",
  orgName: string = "Meewa Industries"
): string {
  const jobTitle = data.job_title || jobSubject || "Job";
  const totalQty = data.total_qty || "1000";
  const totalCost = parseFloat(data.total_cost || "0") || 0;
  const unitCost = parseFloat(data.cost_per_unit || "0") || 0;
  const clientRate = parseFloat(data.client_rate || "0") || unitCost;
  const clientSubtotal = parseFloat(data.client_subtotal || data.total_cost || "0") || 0;

  const lines: string[] = [];
  lines.push("Dear.");
  lines.push(`*${clientName}*`);
  if (city && city.trim()) lines.push(city.trim());
  lines.push("");
  lines.push(`Quotation Costing For : *${jobTitle.trim()}*`);
  lines.push("");

  const checkedTiers = (data.quantity_tiers || []).filter(
    (t) => t.include_in_whatsapp !== false
  );

  if (checkedTiers.length > 0) {
    lines.push(`📦 *Quantity & Rate Comparison:*`);
    checkedTiers.forEach((t) => {
      const q = Number(t.qty || 0).toLocaleString();
      const r = parseFloat(t.unit_rate || "0").toFixed(2);
      const tot = parseFloat(t.total_amount || "0").toFixed(2);
      const noteStr = t.notes?.trim() ? ` _(${t.notes.trim()})_` : "";
      lines.push(`• *${q} pcs* ➜ Rate: *Rs. ${r}* / pc (Total: Rs. ${tot})${noteStr}`);
    });
    lines.push("");
  } else {
    lines.push(`📦 *Quantity:* ${Number(totalQty || 0).toLocaleString() || totalQty} pcs`);
    lines.push(
      `🏷️ *Product Rate:* Rs. ${
        clientRate > 0 ? clientRate.toFixed(2) : unitCost.toFixed(2)
      }/- + GST per pc`
    );
    lines.push(
      `💰 *Total Amount:* Rs. ${
        clientSubtotal > 0 ? clientSubtotal.toFixed(2) : totalCost.toFixed(2)
      }`
    );
    lines.push("");
  }

  if (data.costing_notes?.trim()) {
    lines.push(`📝 *Specifications:* ${data.costing_notes.trim()}`);
    lines.push("");
  }

  lines.push("Thank you... Thank you.... Very much...");
  return lines.join("\n");
}

/**
 * WhatsApp proposal with full internal production breakdown.
 */
export function buildDetailedCostingWhatsappWithBreakdown(
  data: DetailedCostingData,
  clientName: string = "Sir/Madam",
  city: string = "",
  jobSubject: string = "",
  orgName: string = "Meewa Industries"
): string {
  const base = buildDetailedCostingWhatsappMessage(data, clientName, city, jobSubject, orgName);
  const activeRows = (data.rows || []).filter(
    (r) => r.item_name && r.item_name.trim().length > 0
  );
  if (activeRows.length === 0) return base;

  const parts = base.split("Thank you... Thank you.... Very much...");
  const lines: string[] = [];
  lines.push(parts[0].trimEnd());
  lines.push("");
  lines.push(`📊 *Production Breakdown:*`);
  activeRows.forEach((r) => {
    const q = r.qty || "1";
    const rt = r.rate || "0";
    const tot = r.total || "0";
    lines.push(`• ${r.item_name.trim()}: ${q} × Rs. ${rt} = Rs. ${tot}`);
  });
  lines.push("─────────────────────────────");
  lines.push("Thank you... Thank you.... Very much...");
  return lines.join("\n");
}

const PROCESS_COLORS = [
  "bg-primary-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
];

interface DetailedCostingGridProps {
  data: DetailedCostingData;
  currencyCode?: string;
  onChange: (updated: DetailedCostingData) => void;
  readOnly?: boolean;
}

export function DetailedCostingGrid({
  data,
  currencyCode = "INR",
  onChange,
  readOnly = false,
}: DetailedCostingGridProps) {
  const toast = useToast();
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [headerTempText, setHeaderTempText] = useState("");
  const [newColName, setNewColName] = useState("");
  const [isAddingCol, setIsAddingCol] = useState(false);

  // Quick Add Common Process Rows state (customizable: add/remove/persist)
  const [quickProcesses, setQuickProcesses] = useState<string[]>(() => {
    if (data.custom_process_templates && data.custom_process_templates.length > 0) {
      return data.custom_process_templates;
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_QUICK_PROCESSES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // fallback to defaults
      }
    }
    return DEFAULT_COMMON_PROCESS_TEMPLATES;
  });
  const [isAddingProcess, setIsAddingProcess] = useState(false);
  const [newProcessInput, setNewProcessInput] = useState("");
  const [isManagingProcesses, setIsManagingProcesses] = useState(false);

  useEffect(() => {
    if (data.custom_process_templates && data.custom_process_templates.length > 0) {
      setQuickProcesses(data.custom_process_templates);
    }
  }, [data.custom_process_templates]);

  function handleSaveNewProcess() {
    const clean = newProcessInput.trim();
    if (!clean) return;
    if (quickProcesses.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      toast.error(`"${clean}" is already in your quick process list.`);
      return;
    }
    const updated = [...quickProcesses, clean];
    setQuickProcesses(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_QUICK_PROCESSES, JSON.stringify(updated));
      } catch {}
    }
    updateDataAndRecalculate({ custom_process_templates: updated });
    setNewProcessInput("");
    setIsAddingProcess(false);
    toast.success(`Added "${clean}" to quick processes.`);
  }

  function handleRemoveQuickProcess(nameToRemove: string) {
    const updated = quickProcesses.filter((p) => p !== nameToRemove);
    setQuickProcesses(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_QUICK_PROCESSES, JSON.stringify(updated));
      } catch {}
    }
    updateDataAndRecalculate({ custom_process_templates: updated });
    toast.success(`Removed "${nameToRemove}" from quick processes.`);
  }

  function handleResetQuickProcesses() {
    setQuickProcesses(DEFAULT_COMMON_PROCESS_TEMPLATES);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_QUICK_PROCESSES, JSON.stringify(DEFAULT_COMMON_PROCESS_TEMPLATES));
      } catch {}
    }
    updateDataAndRecalculate({ custom_process_templates: DEFAULT_COMMON_PROCESS_TEMPLATES });
    toast.success("Reset quick processes to default templates.");
  }

  const customCols = data.custom_columns || [];
  const rows = data.rows?.length > 0 ? data.rows : [createBlankDetailedRow()];
  const isCustomQtyMode = data.qty_mode === "custom";

  // Recalculate totals helper
  function updateDataAndRecalculate(partial: Partial<DetailedCostingData>) {
    const nextData: DetailedCostingData = { ...data, ...partial };

    let totalCost = 0;

    const computedRows = (nextData.rows || []).map((r) => {
      const q = parseFloat(r.qty) || 0;
      const rate = parseFloat(r.rate) || 0;
      const rowTotal = q * rate;
      totalCost += rowTotal;
      return {
        ...r,
        total: rowTotal > 0 ? rowTotal.toFixed(2) : "0.00",
      };
    });

    nextData.rows = computedRows;
    nextData.total_cost = totalCost.toFixed(2);

    // Total quantity is user-entered and independent of process row quantities
    let activeQty = parseFloat(nextData.total_qty || "0") || 0;
    if (activeQty <= 0) {
      activeQty = 1000;
      nextData.total_qty = "1000";
    }

    const unitCost = activeQty > 0 ? totalCost / activeQty : 0;
    nextData.cost_per_unit = unitCost > 0 ? unitCost.toFixed(2) : "0.00";

    const marginPct = parseFloat(nextData.margin_percent || "0") || 0;
    const clientRate = unitCost * (1 + marginPct / 100);
    nextData.client_rate = clientRate > 0 ? clientRate.toFixed(2) : "0.00";

    const clientSubtotal = activeQty * clientRate;
    nextData.client_subtotal = clientSubtotal > 0 ? clientSubtotal.toFixed(2) : nextData.total_cost;

    onChange(nextData);
  }

  // Row modifications
  function handleRowFieldChange(
    index: number,
    field: "item_name" | "qty" | "rate",
    val: string
  ) {
    const updatedRows = [...rows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: val,
    };
    updateDataAndRecalculate({ rows: updatedRows });
  }

  function handleCustomFieldChange(
    rowIndex: number,
    colKey: string,
    val: string
  ) {
    const updatedRows = [...rows];
    const currentRow = updatedRows[rowIndex];
    updatedRows[rowIndex] = {
      ...currentRow,
      custom_fields: {
        ...(currentRow.custom_fields || {}),
        [colKey]: val,
      },
    };
    updateDataAndRecalculate({ rows: updatedRows });
  }

  function handleAddRow(itemName: string = "") {
    if (itemName) {
      const firstEmptyIdx = rows.findIndex(
        (r) =>
          (!r.item_name || !r.item_name.trim()) &&
          (!r.qty || r.qty === "") &&
          (!r.rate || r.rate === "")
      );
      if (firstEmptyIdx !== -1) {
        const updatedRows = [...rows];
        updatedRows[firstEmptyIdx] = {
          ...updatedRows[firstEmptyIdx],
          item_name: itemName,
        };
        updateDataAndRecalculate({ rows: updatedRows });
        toast.success(`Added "${itemName}" row to costing sheet.`);
        return;
      }
    }
    const updatedRows = [...rows, createBlankDetailedRow(itemName)];
    updateDataAndRecalculate({ rows: updatedRows });
    if (itemName) {
      toast.success(`Added "${itemName}" row to costing sheet.`);
    }
  }

  function handleDeleteRow(index: number) {
    if (rows.length <= 1) {
      updateDataAndRecalculate({ rows: [createBlankDetailedRow()] });
      return;
    }
    const updatedRows = rows.filter((_, i) => i !== index);
    updateDataAndRecalculate({ rows: updatedRows });
  }

  // Column modifications
  function handleStartEditHeader(key: string, currentLabel: string) {
    if (readOnly) return;
    setEditingHeaderKey(key);
    setHeaderTempText(currentLabel);
  }

  function handleSaveHeaderEdit(key: string) {
    const clean = headerTempText.trim();
    if (!clean) {
      setEditingHeaderKey(null);
      return;
    }

    if (key === "item") {
      updateDataAndRecalculate({ col_item_label: clean });
    } else if (key === "qty") {
      updateDataAndRecalculate({ col_qty_label: clean });
    } else if (key === "rate") {
      updateDataAndRecalculate({ col_rate_label: clean });
    } else if (key === "total") {
      updateDataAndRecalculate({ col_total_label: clean });
    } else {
      const updatedCustom = customCols.map((c) =>
        c.key === key ? { ...c, label: clean } : c
      );
      updateDataAndRecalculate({ custom_columns: updatedCustom });
    }
    setEditingHeaderKey(null);
  }

  function handleAddCustomColumn() {
    const clean = newColName.trim();
    if (!clean) return;
    const newKey = `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const updatedCustom: DetailedCostingCustomColumn[] = [
      ...customCols,
      { key: newKey, label: clean },
    ];
    setNewColName("");
    setIsAddingCol(false);
    updateDataAndRecalculate({ custom_columns: updatedCustom });
  }

  function handleDeleteCustomColumn(key: string) {
    const updatedCustom = customCols.filter((c) => c.key !== key);
    const updatedRows = rows.map((r) => {
      const copy = { ...(r.custom_fields || {}) };
      delete copy[key];
      return { ...r, custom_fields: copy };
    });
    updateDataAndRecalculate({
      custom_columns: updatedCustom,
      rows: updatedRows,
    });
  }

  function handleAddQuantityTier(presetQty?: string) {
    const existing = data.quantity_tiers || [];
    let nextQty = presetQty;
    if (!nextQty) {
      if (existing.length === 0) {
        nextQty = data.total_qty || "1000";
      } else {
        const highest = existing.reduce((max, t) => Math.max(max, parseFloat(t.qty) || 0), 0);
        nextQty = String(highest > 0 ? highest + 1000 : 2000);
      }
    }

    const qNum = parseFloat(nextQty) || 1000;
    const baseRate = parseFloat(data.client_rate || data.cost_per_unit || "0") || 0;
    const estTotal = (qNum * baseRate).toFixed(2);
    const estRate = baseRate > 0 ? baseRate.toFixed(2) : "0.00";

    const newTier = createBlankQuantityTier(nextQty, estTotal, estRate);
    updateDataAndRecalculate({
      quantity_tiers: [...existing, newTier],
    });
  }

  function handleUpdateQuantityTier(
    tierId: string,
    field: "qty" | "total_amount" | "unit_rate" | "include_in_whatsapp" | "notes",
    val: any
  ) {
    let toggledQty = "";
    let toggledState = false;

    const tiers = (data.quantity_tiers || []).map((t) => {
      if (t.id !== tierId) return t;

      const updated = { ...t };
      if (field === "total_amount") {
        updated.total_amount = val;
        const q = parseFloat(updated.qty) || 0;
        const tot = parseFloat(val) || 0;
        if (q > 0) {
          updated.unit_rate = (tot / q).toFixed(2);
        }
      } else if (field === "unit_rate") {
        updated.unit_rate = val;
        const q = parseFloat(updated.qty) || 0;
        const r = parseFloat(val) || 0;
        updated.total_amount = (q * r).toFixed(2);
      } else if (field === "qty") {
        updated.qty = val;
        const q = parseFloat(val) || 0;
        const r = parseFloat(updated.unit_rate) || 0;
        if (q > 0 && r > 0) {
          updated.total_amount = (q * r).toFixed(2);
        } else if (q > 0 && parseFloat(updated.total_amount) > 0) {
          updated.unit_rate = (parseFloat(updated.total_amount) / q).toFixed(2);
        }
      } else if (field === "include_in_whatsapp") {
        updated.include_in_whatsapp = Boolean(val);
        toggledQty = updated.qty;
        toggledState = Boolean(val);
      } else if (field === "notes") {
        updated.notes = val;
      }
      return updated;
    });

    updateDataAndRecalculate({ quantity_tiers: tiers });

    if (field === "include_in_whatsapp") {
      const qFormatted = Number(toggledQty || 0).toLocaleString();
      if (toggledState) {
        toast.success(`${qFormatted} pcs variant included in WhatsApp proposal.`);
      } else {
        toast.success(`${qFormatted} pcs variant removed from WhatsApp proposal.`);
      }
    }
  }

  function handleDeleteQuantityTier(tierId: string) {
    const tiers = (data.quantity_tiers || []).filter((t) => t.id !== tierId);
    updateDataAndRecalculate({ quantity_tiers: tiers });
    toast.success("Quantity comparison tier removed.");
  }

  function handleCopyWhatsappCosting() {
    const message = buildDetailedCostingWhatsappMessage(
      data,
      "Sir/Madam",
      "",
      data.job_title || ""
    );

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message);
      toast.success("Detailed Costing WhatsApp proposal copied to clipboard!");
    }
  }

  const colItemLabel = data.col_item_label || "Item / Process Name";
  const colQtyLabel = data.col_qty_label || "Qty.";
  const colRateLabel = data.col_rate_label || "Rate";
  const colTotalLabel = data.col_total_label || "Total Amount";

  const totalCostNumber = parseFloat(data.total_cost || "0") || 0;
  const totalQtyNumber = parseFloat(data.total_qty || "0") || 0;
  const unitCostNumber = parseFloat(data.cost_per_unit || "0") || 0;
  const clientSubtotalNumber = parseFloat(data.client_subtotal || "0") || totalCostNumber;
  const clientRateNumber = parseFloat(data.client_rate || "0") || unitCostNumber;

  // Active non-empty processes for distribution analytics
  const activeProcesses = useMemo(() => {
    return rows
      .filter((r) => r.item_name && r.item_name.trim().length > 0)
      .map((r) => {
        const tot = parseFloat(r.total || "0") || 0;
        const pct = totalCostNumber > 0 ? (tot / totalCostNumber) * 100 : 0;
        return {
          id: r.id,
          name: r.item_name.trim(),
          qty: r.qty,
          rate: r.rate,
          total: tot,
          percent: pct,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows, totalCostNumber]);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Action Toolbar (Clean CRM style, no job title box, no Table 1) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-5 py-2.5 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink">
            Detailed Costing Sheet
          </span>
          <span className="text-[11px] font-semibold text-ink-muted bg-surface px-2 py-0.5 rounded-full border border-border">
            {rows.filter((r) => r.item_name && r.item_name.trim()).length} processes entered
          </span>
        </div>

        {/* Action Buttons: Add Column & Add Row */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            {isAddingCol ? (
              <div className="flex items-center gap-1.5 bg-white border border-primary-500 rounded-md p-1 shadow-xs">
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomColumn();
                    if (e.key === "Escape") setIsAddingCol(false);
                  }}
                  autoFocus
                  placeholder="Column name (e.g. Size)"
                  className="text-xs px-2 py-1 text-ink focus:outline-none w-36"
                />
                <button
                  type="button"
                  onClick={handleAddCustomColumn}
                  className="p-1 rounded bg-primary-600 text-white hover:bg-primary-700 transition"
                  title="Add column"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCol(false)}
                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-sunken transition"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingCol(true)}
                className="text-xs h-8 gap-1.5 border-border hover:border-primary-400"
              >
                <Plus className="h-3.5 w-3.5 text-primary-600" />
                <span>Add Column</span>
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddRow()}
              className="text-xs h-8 gap-1.5 border-border hover:border-primary-400"
            >
              <Plus className="h-3.5 w-3.5 text-primary-600" />
              <span>Add Row</span>
            </Button>
          </div>
        )}
      </div>

      {/* Spreadsheet Table in CRM Theme */}
      <div className="overflow-x-auto rounded-lg border border-border shadow-2xs bg-white">
        <table className="w-full text-left text-xs border-collapse">
          {/* Header row in CRM style */}
          <thead>
            <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {/* Sr. No. */}
              <th className="w-12 px-3 py-2.5 text-center border-r border-border">
                #
              </th>

              {/* Column 1: Item / Process Name */}
              <th className="min-w-[260px] sm:min-w-[320px] px-3.5 py-2.5 border-r border-border">
                {editingHeaderKey === "item" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={headerTempText}
                      onChange={(e) => setHeaderTempText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveHeaderEdit("item");
                        if (e.key === "Escape") setEditingHeaderKey(null);
                      }}
                      autoFocus
                      className="bg-white text-ink text-xs px-2 py-0.5 rounded border border-primary-500 font-medium w-full"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveHeaderEdit("item")}
                      className="p-1 text-primary-700 hover:bg-primary-50 rounded"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <span
                      onClick={() => handleStartEditHeader("item", colItemLabel)}
                      className="cursor-pointer hover:text-primary-700 flex items-center gap-1.5"
                      title="Click to rename column header"
                    >
                      {colItemLabel}
                      {!readOnly && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600" />}
                    </span>
                  </div>
                )}
              </th>

              {/* Custom Columns */}
              {customCols.map((c) => (
                <th key={c.key} className="px-3 py-2.5 min-w-[130px] text-center border-r border-border">
                  {editingHeaderKey === c.key ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={headerTempText}
                        onChange={(e) => setHeaderTempText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveHeaderEdit(c.key);
                          if (e.key === "Escape") setEditingHeaderKey(null);
                        }}
                        autoFocus
                        className="bg-white text-ink text-xs px-1.5 py-0.5 rounded border border-primary-500 font-medium w-full"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveHeaderEdit(c.key)}
                        className="p-1 text-primary-700 hover:bg-primary-50 rounded"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <span
                        onClick={() => handleStartEditHeader(c.key, c.label)}
                        className="cursor-pointer hover:text-primary-700"
                        title="Click to rename column header"
                      >
                        {c.label}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomColumn(c.key)}
                          className="p-1 text-ink-muted hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete column"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}

              {/* Column 2: Qty. */}
              <th className="w-28 px-3 py-2.5 text-right border-r border-border">
                {editingHeaderKey === "qty" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={headerTempText}
                      onChange={(e) => setHeaderTempText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveHeaderEdit("qty");
                        if (e.key === "Escape") setEditingHeaderKey(null);
                      }}
                      autoFocus
                      className="bg-white text-ink text-xs px-2 py-0.5 rounded border border-primary-500 font-medium w-full text-right"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveHeaderEdit("qty")}
                      className="p-1 text-primary-700 hover:bg-primary-50 rounded"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 group">
                    <span
                      onClick={() => handleStartEditHeader("qty", colQtyLabel)}
                      className="cursor-pointer hover:text-primary-700 flex items-center gap-1"
                      title="Click to rename column header"
                    >
                      {colQtyLabel}
                      {!readOnly && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600" />}
                    </span>
                  </div>
                )}
              </th>

              {/* Column 3: Rate */}
              <th className="w-32 px-3 py-2.5 text-right border-r border-border">
                {editingHeaderKey === "rate" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={headerTempText}
                      onChange={(e) => setHeaderTempText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveHeaderEdit("rate");
                        if (e.key === "Escape") setEditingHeaderKey(null);
                      }}
                      autoFocus
                      className="bg-white text-ink text-xs px-2 py-0.5 rounded border border-primary-500 font-medium w-full text-right"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveHeaderEdit("rate")}
                      className="p-1 text-primary-700 hover:bg-primary-50 rounded"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 group">
                    <span
                      onClick={() => handleStartEditHeader("rate", colRateLabel)}
                      className="cursor-pointer hover:text-primary-700 flex items-center gap-1"
                      title="Click to rename column header"
                    >
                      {colRateLabel}
                      {!readOnly && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600" />}
                    </span>
                  </div>
                )}
              </th>

              {/* Column 4: Total Amount */}
              <th className="w-36 px-3 py-2.5 text-right border-r border-border">
                {editingHeaderKey === "total" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={headerTempText}
                      onChange={(e) => setHeaderTempText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveHeaderEdit("total");
                        if (e.key === "Escape") setEditingHeaderKey(null);
                      }}
                      autoFocus
                      className="bg-white text-ink text-xs px-2 py-0.5 rounded border border-primary-500 font-medium w-full text-right"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveHeaderEdit("total")}
                      className="p-1 text-primary-700 hover:bg-primary-50 rounded"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1.5 group">
                    <span
                      onClick={() => handleStartEditHeader("total", colTotalLabel)}
                      className="cursor-pointer hover:text-primary-700 flex items-center gap-1"
                      title="Click to rename column header"
                    >
                      {colTotalLabel}
                      {!readOnly && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600" />}
                    </span>
                  </div>
                )}
              </th>

              {/* Actions Header */}
              {!readOnly && (
                <th className="w-10 px-2 py-2.5 text-center">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body in CRM theme */}
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => {
              const rowTotal = parseFloat(row.total || "0") || 0;
              const isEven = index % 2 === 0;

              return (
                <tr
                  key={row.id || index}
                  className={clsx(
                    "hover:bg-primary-50/20 transition-colors group",
                    isEven ? "bg-white" : "bg-surface-sunken/20"
                  )}
                >
                  {/* Sr. No. */}
                  <td className="p-2 border-r border-border text-center text-ink-muted font-medium">
                    {index + 1}
                  </td>

                  {/* Column 1: Item / Process Name */}
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="text"
                      value={row.item_name}
                      disabled={readOnly}
                      onChange={(e) => handleRowFieldChange(index, "item_name", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && index === rows.length - 1 && !readOnly) {
                          handleAddRow();
                        }
                      }}
                      placeholder="e.g. Paper, Print, Matt Lamination, Creasing..."
                      className="w-full font-medium text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2.5 py-1 text-xs focus:outline-none transition shadow-none focus:shadow-2xs focus:ring-1 focus:ring-primary-100"
                    />
                  </td>

                  {/* Custom Columns */}
                  {customCols.map((c) => (
                    <td key={c.key} className="p-1.5 border-r border-border">
                      <input
                        type="text"
                        value={row.custom_fields?.[c.key] || ""}
                        disabled={readOnly}
                        onChange={(e) => handleCustomFieldChange(index, c.key, e.target.value)}
                        placeholder="—"
                        className="w-full text-center text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none transition shadow-none focus:shadow-2xs"
                      />
                    </td>
                  ))}

                  {/* Column 2: Qty. */}
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.qty}
                      disabled={readOnly}
                      onChange={(e) => handleRowFieldChange(index, "qty", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && index === rows.length - 1 && !readOnly) {
                          handleAddRow();
                        }
                      }}
                      placeholder="0"
                      className="w-full text-right font-mono text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none transition shadow-none focus:shadow-2xs focus:ring-1 focus:ring-primary-100"
                    />
                  </td>

                  {/* Column 3: Rate */}
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.rate}
                      disabled={readOnly}
                      onChange={(e) => handleRowFieldChange(index, "rate", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && index === rows.length - 1 && !readOnly) {
                          handleAddRow();
                        }
                      }}
                      placeholder="0.00"
                      className="w-full text-right font-mono text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none transition shadow-none focus:shadow-2xs focus:ring-1 focus:ring-primary-100"
                    />
                  </td>

                  {/* Column 4: Total Amount (Calculated) */}
                  <td className="p-2 border-r border-border text-right font-mono font-bold text-ink">
                    {rowTotal > 0 ? rowTotal.toFixed(2) : "0.00"}
                  </td>

                  {/* Delete Row Button */}
                  {!readOnly && (
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(index)}
                        className="p-1.5 rounded text-ink-faint hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                        title="Delete row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom 2-Column Responsive Section: Quantity Comparison on Left, Calculator on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 cols): Quantity Comparisons Table & Specs */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Card A: Multi-Quantity Comparison & Tier Pricing Table */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary-600" />
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-ink">
                    Quantity &amp; Rate Comparisons
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Compare tiered pricing for 1,000, 2,000, 5,000 pcs etc. (editable amounts &amp; rates)
                  </p>
                </div>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleAddQuantityTier()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50/80 hover:bg-primary-100 text-primary-700 px-2.5 py-1 text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Quantity Tier</span>
                </button>
              )}
            </div>

            {/* Comparison Tiers Table */}
            {(data.quantity_tiers || []).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-sunken/60 border-b border-border text-[11px] font-bold text-ink-muted uppercase">
                      <th className="w-10 px-2.5 py-2 text-center" title="Check to include in WhatsApp proposal">
                        WA
                      </th>
                      <th className="px-2.5 py-2 text-center">Qty (pcs)</th>
                      <th className="px-2.5 py-2 text-right">Total Amount ({currencyCode})</th>
                      <th className="px-2.5 py-2 text-right">Rate / pc ({currencyCode})</th>
                      <th className="px-2.5 py-2 text-left">Remarks</th>
                      {!readOnly && <th className="w-8 px-2 py-2 text-center" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data.quantity_tiers || []).map((tier) => (
                      <tr key={tier.id} className={tier.include_in_whatsapp !== false ? "bg-white" : "bg-neutral-50/60 opacity-60"}>
                        {/* Checkbox for WhatsApp */}
                        <td className="px-2.5 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={tier.include_in_whatsapp !== false}
                            disabled={readOnly}
                            onChange={(e) => handleUpdateQuantityTier(tier.id, "include_in_whatsapp", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            title="Include this tier in WhatsApp proposal"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="px-2.5 py-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            disabled={readOnly}
                            value={tier.qty}
                            onChange={(e) => handleUpdateQuantityTier(tier.id, "qty", e.target.value)}
                            placeholder="1000"
                            className="w-20 text-center font-bold font-mono text-ink bg-surface-sunken/30 border border-border rounded px-1.5 py-1 focus:border-primary-500 focus:outline-none"
                          />
                        </td>

                        {/* Total Amount (Editable!) */}
                        <td className="px-2.5 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={readOnly}
                            value={tier.total_amount}
                            onChange={(e) => handleUpdateQuantityTier(tier.id, "total_amount", e.target.value)}
                            placeholder="0.00"
                            className="w-24 text-right font-black font-mono text-primary-700 bg-surface-sunken/30 border border-border rounded px-1.5 py-1 focus:border-primary-500 focus:outline-none"
                          />
                        </td>

                        {/* Rate / pc (Editable!) */}
                        <td className="px-2.5 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={readOnly}
                            value={tier.unit_rate}
                            onChange={(e) => handleUpdateQuantityTier(tier.id, "unit_rate", e.target.value)}
                            placeholder="0.00"
                            className="w-20 text-right font-bold font-mono text-emerald-700 bg-surface-sunken/30 border border-border rounded px-1.5 py-1 focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        {/* Remarks */}
                        <td className="px-2.5 py-2">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={tier.notes || ""}
                            onChange={(e) => handleUpdateQuantityTier(tier.id, "notes", e.target.value)}
                            placeholder="e.g. Standard"
                            className="w-full text-xs text-ink bg-transparent border-b border-transparent hover:border-border focus:border-primary-500 focus:outline-none px-1 py-0.5"
                          />
                        </td>

                        {/* Delete */}
                        {!readOnly && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteQuantityTier(tier.id)}
                              className="text-neutral-400 hover:text-red-600 transition cursor-pointer p-1"
                              title="Delete this comparison tier"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-xs text-ink-muted">
                  No quantity comparisons added yet.
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleAddQuantityTier()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add First Comparison Tier (e.g. 1,000 pcs)</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick Add Preset Chips */}
            {!readOnly && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-ink-muted">Quick Add:</span>
                  {[1000, 2000, 3000, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddQuantityTier(String(preset))}
                      className="px-2 py-0.5 rounded text-[11px] font-medium border border-border bg-neutral-50 hover:bg-white hover:border-primary-400 text-ink cursor-pointer transition shadow-2xs"
                    >
                      +{preset.toLocaleString()}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {(data.quantity_tiers || []).filter((t) => t.include_in_whatsapp !== false).length} checked for WhatsApp
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Card B: Costing Production Notes */}
          <div className="rounded-xl border border-border bg-surface-sunken/40 p-4 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-600" />
              <label className="text-xs font-bold text-ink uppercase tracking-wide">
                Production Specs &amp; Internal Notes
              </label>
            </div>
            <textarea
              rows={3}
              disabled={readOnly}
              value={data.costing_notes || ""}
              onChange={(e) => updateDataAndRecalculate({ costing_notes: e.target.value })}
              placeholder="e.g. Paper 300 GSM Art Card, 4-color offset printing, plate size 20x30, matte thermal lamination front only, punch die ready with vendor..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-ink placeholder:italic placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-100 transition shadow-2xs resize-y"
            />
          </div>
        </div>

        {/* Right Column (5 cols): The Base Calculator Card & Process Tools */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface-sunken/60 p-4 shadow-2xs flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-ink">
                  Calculation Summary
                </h3>
              </div>
              <span className="text-[11px] font-bold text-ink-muted uppercase">
                {currencyCode}
              </span>
            </div>

            {/* Metric 1: Total Production Cost (Total Rs.) */}
            <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-border shadow-2xs">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
                  Total Rs.
                </span>
                <span className="text-[10px] text-ink-muted">
                  Sum of all row amounts
                </span>
              </div>
              <span className="text-base font-extrabold font-mono text-red-600">
                {formatCurrency(totalCostNumber, currencyCode, 2)}
              </span>
            </div>

            {/* Metric 2: Total Qty (Directly entered by user, not sum of rows!) */}
            <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-border shadow-2xs">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                  Total Qty.
                </span>
                <span className="text-[10px] text-ink-muted">
                  Production batch quantity
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="any"
                  min="1"
                  disabled={readOnly}
                  value={data.total_qty || "1000"}
                  onChange={(e) => updateDataAndRecalculate({ total_qty: e.target.value })}
                  placeholder="1000"
                  className="w-24 text-right font-black font-mono text-sm text-blue-600 bg-surface-sunken/40 border border-border rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs font-bold text-ink-muted">pcs</span>
              </div>
            </div>

            {/* Metric 3: Product Cost Per Piece */}
            <div className="flex items-center justify-between rounded-lg bg-red-50/50 p-3 border border-red-200 shadow-2xs">
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-red-700 uppercase tracking-wide">
                  Product Cost
                </span>
                <span className="text-[10px] text-red-600/80">
                  Total Rs. ÷ Total Qty ({totalCostNumber.toFixed(2)} ÷ {totalQtyNumber || 1})
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-black font-mono text-red-700">
                  {formatCurrency(unitCostNumber, currencyCode, 2)}
                </span>
                <span className="text-[11px] font-bold text-red-600/80 ml-1">/ pc</span>
              </div>
            </div>

            {/* Client Markup & Final Quotation Rate Section */}
            <div className="rounded-lg bg-white p-3 border border-border shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">Client Margin / Markup %:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    disabled={readOnly}
                    value={data.margin_percent || "0"}
                    onChange={(e) => updateDataAndRecalculate({ margin_percent: e.target.value })}
                    placeholder="0"
                    className="w-20 text-right font-mono text-xs text-ink bg-surface-sunken/40 border border-border rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
                  />
                  <span className="text-xs text-ink-muted font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                <span className="font-bold text-ink">Client Given Rate:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-emerald-700 text-sm">
                  <span>{formatCurrency(clientRateNumber, currencyCode, 2)}</span>
                  <span className="text-[10px] text-ink-muted font-normal">/ pc</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-border">
                <span className="font-extrabold text-primary-700">Client Quotation Subtotal:</span>
                <span className="font-mono font-extrabold text-primary-700 text-sm">
                  {formatCurrency(clientSubtotalNumber, currencyCode, 2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyWhatsappCosting}
                className="w-full mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Copy detailed component costing breakdown & checked quantity comparisons for WhatsApp"
              >
                <Copy className="h-3.5 w-3.5 text-emerald-700" />
                <span>Copy Costing WhatsApp Proposal</span>
              </button>
            </div>
          </div>

          {/* Quick Add Common Processes Chips with Add & Remove functionality */}
          {!readOnly && (
            <div className="rounded-xl border border-border bg-surface-sunken/40 p-3 shadow-2xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-ink uppercase tracking-wide">
                  Quick Add Common Process Rows:
                </span>
                <div className="flex items-center gap-1.5">
                  {!isAddingProcess && (
                    <button
                      type="button"
                      onClick={() => setIsAddingProcess(true)}
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary-600 hover:text-primary-700 cursor-pointer"
                      title="Add a custom process to this quick list"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  )}
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => setIsManagingProcesses((prev) => !prev)}
                    className={clsx(
                      "inline-flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer",
                      isManagingProcesses
                        ? "text-amber-800 font-bold underline"
                        : "text-ink-muted hover:text-ink"
                    )}
                    title={isManagingProcesses ? "Finish managing" : "Remove processes from this quick list"}
                  >
                    {isManagingProcesses ? "Done" : "Manage / Remove"}
                  </button>
                </div>
              </div>

              {/* Inline input to add a new process */}
              {isAddingProcess && (
                <div className="flex items-center gap-1.5 p-1 rounded-lg border border-primary-300 bg-white shadow-2xs">
                  <input
                    type="text"
                    value={newProcessInput}
                    onChange={(e) => setNewProcessInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveNewProcess();
                      } else if (e.key === "Escape") {
                        setIsAddingProcess(false);
                        setNewProcessInput("");
                      }
                    }}
                    placeholder="e.g. UV Varnish, Box Making, Embossing..."
                    className="flex-1 text-xs px-2 py-1 border border-border rounded focus:border-primary-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewProcess}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded transition cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProcess(false);
                      setNewProcessInput("");
                    }}
                    className="p-1 text-ink-muted hover:text-ink cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Process Chips */}
              <div className="flex flex-wrap gap-1.5">
                {quickProcesses.map((tmpl) => (
                  <div
                    key={tmpl}
                    className={clsx(
                      "group inline-flex items-center rounded-md border text-[11px] font-medium transition shadow-2xs",
                      isManagingProcesses
                        ? "border-amber-400 bg-amber-50 text-amber-950 font-semibold"
                        : "border-border bg-surface hover:bg-surface-hover hover:border-primary-400 text-ink"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isManagingProcesses) {
                          handleRemoveQuickProcess(tmpl);
                        } else {
                          handleAddRow(tmpl);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 cursor-pointer"
                      title={
                        isManagingProcesses
                          ? `Click to remove "${tmpl}" from quick list`
                          : `Add "${tmpl}" process row to table`
                      }
                    >
                      {!isManagingProcesses && <Plus className="h-3 w-3 text-primary-600" />}
                      <span>{tmpl}</span>
                    </button>

                    {/* Delete button (visible always in manage mode, or on hover in normal mode) */}
                    {isManagingProcesses ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveQuickProcess(tmpl);
                        }}
                        className="pr-1.5 pl-0.5 text-red-600 hover:text-red-800 transition cursor-pointer"
                        title={`Remove "${tmpl}" from quick list`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveQuickProcess(tmpl);
                        }}
                        className="opacity-0 group-hover:opacity-100 pr-1 pl-0.5 text-neutral-400 hover:text-red-600 transition cursor-pointer"
                        title={`Remove "${tmpl}" from quick list`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Manage mode footer with explanation & reset */}
              {isManagingProcesses && (
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10.5px]">
                  <span className="text-amber-800">
                    Click ✕ on any process to remove it from quick list.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetQuickProcesses}
                    className="text-ink-muted hover:text-ink underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
