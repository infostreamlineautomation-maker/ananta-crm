"use client";

import { useId, useState, useMemo, useEffect, Fragment } from "react";
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
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  DetailedCostingBulkQuote,
  DetailedCostingCustomColumn,
  DetailedCostingData,
  DetailedCostingRow,
  DetailedCostingQuantityTier,
} from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { useFormColumnWidths } from "@/lib/useFormColumnWidths";
import { FormResizableTh } from "@/components/ui/FormResizableTh";
import { BulkQuoteModal } from "./BulkQuoteModal";

const DETAILED_DEFAULT_WIDTHS: Record<string, number> = {
  sr_no: 52,
  item: 320,
  qty: 110,
  rate: 120,
  total: 135,
  actions: 44,
};

function newRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function formatCalculatedRate(num: number): string {
  if (num <= 0 || isNaN(num) || !isFinite(num)) return "";
  const rounded2 = Math.round(num * 100) / 100;
  if (Math.abs(num - rounded2) < 0.0001) {
    return num.toFixed(2);
  }
  return parseFloat(num.toFixed(4)).toString();
}

export function createBlankDetailedRow(itemName: string = ""): DetailedCostingRow {
  return {
    id: newRowId(),
    item_name: itemName,
    qty: "",
    rate: "",
    total: "0.00",
    custom_fields: {},
    comparisons: {},
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
    total_qty: "",
    col_item_label: "Item / Process Name",
    col_qty_label: "Qty.",
    col_rate_label: "Rate / pc",
    col_total_label: "Total Amount",
    custom_columns: [],
    comparison_columns: [],
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
  const totalQtyNum = parseFloat(data.total_qty || "0") || 0;
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
    if (totalQtyNum > 0 && clientRate > 0) {
      lines.push(`📦 *Quantity:* ${totalQtyNum.toLocaleString()} pcs`);
      lines.push(`🏷️ *Product Rate:* Rs. ${clientRate.toFixed(2)}/- + GST per pc`);
    }
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
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingBulkQuote, setEditingBulkQuote] = useState<DetailedCostingBulkQuote | null>(null);

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
  const [showQuickProcesses, setShowQuickProcesses] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ananta_crm_show_quick_processes");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });

  function toggleQuickProcesses() {
    setShowQuickProcesses((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("ananta_crm_show_quick_processes", String(next));
        } catch {}
      }
      return next;
    });
  }

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
  const bulkQuotes = data.bulk_quotes || [];
  const rows = data.rows?.length > 0 ? data.rows : [createBlankDetailedRow()];
  const isCustomQtyMode = data.qty_mode === "custom";
  const colGrid = useFormColumnWidths("detailed_costing_grid", DETAILED_DEFAULT_WIDTHS, 50);

  const detailedTotalWidth = useMemo(() => {
    const customSum = customCols.reduce((sum, c) => sum + colGrid.getWidth(c.key, 135), 0);
    return (
      colGrid.getWidth("sr_no") +
      colGrid.getWidth("item") +
      customSum +
      colGrid.getWidth("qty") +
      colGrid.getWidth("rate") +
      colGrid.getWidth("total") +
      (readOnly ? 0 : 44)
    );
  }, [customCols, colGrid, readOnly]);

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
    // Clear legacy horizontal comparison columns format
    nextData.comparison_columns = [];
    nextData.selected_comparison_id = null;

    const marginPct = parseFloat(nextData.margin_percent || "0") || 0;
    const baseClientSubtotal = totalCost * (1 + marginPct / 100);

    const savedBulkQuotes = nextData.bulk_quotes || [];
    nextData.total_qty = "";
    nextData.cost_per_unit = "0.00";
    nextData.client_rate = "0.00";
    nextData.client_subtotal =
      baseClientSubtotal > 0 ? baseClientSubtotal.toFixed(2) : nextData.total_cost;

    // Sync saved bulk quotes to quantity_tiers so WhatsApp, Print PDF & Portal views stay accurate
    nextData.quantity_tiers = savedBulkQuotes.map((bq) => ({
      id: bq.id,
      qty: bq.target_qty,
      total_amount: bq.client_subtotal || bq.total_cost || "0.00",
      unit_rate: bq.client_rate || bq.cost_per_unit || "0.00",
      margin_percent: bq.margin_percent,
      include_in_whatsapp: true,
      notes: bq.notes || bq.label || `${Number(bq.target_qty || 0).toLocaleString()} pcs Bulk Quote`,
    }));

    onChange(nextData);
  }

  // Row modifications (supporting 2-way sync between Qty, Rate and Total Amount)
  function handleRowFieldChange(
    index: number,
    field: "item_name" | "qty" | "rate" | "total",
    val: string
  ) {
    const updatedRows = [...rows];
    const currentRow = updatedRows[index];

    if (field === "total") {
      const q = parseFloat(currentRow.qty) || 0;
      const tot = parseFloat(val) || 0;
      const newRate = q > 0 && tot > 0 ? (tot / q).toFixed(2) : currentRow.rate;
      updatedRows[index] = {
        ...currentRow,
        rate: newRate,
        total: val,
      };
    } else if (field === "rate") {
      const q = parseFloat(currentRow.qty) || 0;
      const r = parseFloat(val) || 0;
      const tot = q * r;
      updatedRows[index] = {
        ...currentRow,
        rate: val,
        total: tot > 0 ? tot.toFixed(2) : "0.00",
      };
    } else if (field === "qty") {
      const q = parseFloat(val) || 0;
      const r = parseFloat(currentRow.rate) || 0;
      const tot = q * r;
      updatedRows[index] = {
        ...currentRow,
        qty: val,
        total: tot > 0 ? tot.toFixed(2) : "0.00",
      };
    } else {
      updatedRows[index] = {
        ...currentRow,
        [field]: val,
      };
    }
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
    const newRow = createBlankDetailedRow(itemName);
    const updatedRows = [...rows, newRow];
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

  function handleSaveBulkQuote(saved: DetailedCostingBulkQuote) {
    const existing = data.bulk_quotes || [];
    const exists = existing.some((bq) => bq.id === saved.id);
    const nextBulkQuotes = exists
      ? existing.map((bq) => (bq.id === saved.id ? saved : bq))
      : [...existing, saved];

    updateDataAndRecalculate({ bulk_quotes: nextBulkQuotes });
    setBulkModalOpen(false);
    setEditingBulkQuote(null);
    toast.success(
      exists
        ? `Updated bulk quote (${Number(saved.target_qty).toLocaleString()} pcs).`
        : `Saved bulk quote (${Number(saved.target_qty).toLocaleString()} pcs).`
    );
  }

  function handleDeleteBulkQuote(id: string) {
    const existing = data.bulk_quotes || [];
    const target = existing.find((bq) => bq.id === id);
    const nextBulkQuotes = existing.filter((bq) => bq.id !== id);
    updateDataAndRecalculate({ bulk_quotes: nextBulkQuotes });
    setBulkModalOpen(false);
    setEditingBulkQuote(null);
    toast.success(
      `Removed ${target?.target_qty ? Number(target.target_qty).toLocaleString() + " pcs " : ""}bulk quote.`
    );
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

  const colItemLabel = data.col_item_label || "Item / Process Name";
  const colQtyLabel = data.col_qty_label || "Qty.";
  const colRateLabel = !data.col_rate_label || data.col_rate_label === "Rate" ? "Rate / pc" : data.col_rate_label;
  const colTotalLabel = data.col_total_label || "Total Amount";

  const totalCostNumber = parseFloat(data.total_cost || "0") || 0;
  const marginPctNumber = parseFloat(data.margin_percent || "0") || 0;
  const baseClientSubtotalNumber = totalCostNumber * (1 + marginPctNumber / 100);

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
    <div className="flex flex-col gap-3.5">
      {/* Quick Add Common Processes Recommendation Stripe (Default unhidden, toggleable) */}
      {!readOnly && showQuickProcesses && (
        <div className="rounded-xl border border-border bg-surface-sunken/40 px-4 py-2.5 shadow-2xs flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-ink uppercase tracking-wide">
              Quick Add Common Process Rows:
            </span>
            <div className="flex items-center gap-2">
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
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={toggleQuickProcesses}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-ink transition cursor-pointer"
                title="Hide Quick Add process suggestions"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>Hide</span>
              </button>
            </div>
          </div>

          {isAddingProcess && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg border border-primary-300 bg-white shadow-2xs max-w-md">
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

      {/* Detailed Costing Sheet Action Toolbar (Directly above table) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-5 py-2.5 rounded-lg">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-ink">
            Detailed Costing Sheet
          </span>
          <span className="text-[11px] font-semibold text-ink-muted bg-surface px-2 py-0.5 rounded-full border border-border">
            {rows.filter((r) => r.item_name && r.item_name.trim()).length} processes entered
          </span>
          {!readOnly && !showQuickProcesses && (
            <button
              type="button"
              onClick={toggleQuickProcesses}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted hover:text-primary-700 hover:border-primary-300 transition cursor-pointer"
              title="Show Quick Add Common Process Rows"
            >
              <Eye className="h-3 w-3 text-primary-600" />
              <span>Quick Add Processes</span>
            </button>
          )}
        </div>

        {/* Action Buttons: Add Column, Add Comparison Qty & Add Row */}
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
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
                  className="p-1 rounded bg-primary-600 text-white hover:bg-primary-700 transition cursor-pointer"
                  title="Add column"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCol(false)}
                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-sunken transition cursor-pointer"
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

            {/* Add Bulk Quote Modal Trigger */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingBulkQuote(null);
                setBulkModalOpen(true);
              }}
              className="text-xs h-8 gap-1.5 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-800 font-bold"
              title="Open full Detailed Costing sheet for a bulk quantity quote"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>+ Add Bulk Quote</span>
            </Button>

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

            {colGrid.hasCustomWidths && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={colGrid.resetAllWidths}
                className="text-xs h-8 gap-1 border-border text-ink-muted hover:text-ink"
                title="Reset column widths to default"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Widths</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Spreadsheet Table in CRM Theme */}
      <div className="overflow-x-auto rounded-lg border border-border shadow-2xs bg-white">
        <table
          style={{ width: `${detailedTotalWidth}px`, minWidth: "100%" }}
          className="table-fixed text-left text-xs border-collapse"
        >
          <colgroup>
            <col style={{ width: `${colGrid.getWidth("sr_no")}px` }} />
            <col style={{ width: `${colGrid.getWidth("item")}px` }} />
            {customCols.map((c) => (
              <col key={c.key} style={{ width: `${colGrid.getWidth(c.key, 135)}px` }} />
            ))}
            <col style={{ width: `${colGrid.getWidth("qty")}px` }} />
            <col style={{ width: `${colGrid.getWidth("rate")}px` }} />
            <col style={{ width: `${colGrid.getWidth("total")}px` }} />
            {!readOnly && <col style={{ width: "44px" }} />}
          </colgroup>
          {/* Header Row */}
          <thead>
              <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                {/* Sr. No. */}
                <FormResizableTh
                  colKey="sr_no"
                  width={colGrid.getWidth("sr_no")}
                  isResizing={colGrid.resizingKey === "sr_no"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-2 py-2.5 text-center border-r border-border"
                >
                  #
                </FormResizableTh>

                {/* Column 1: Item / Process Name */}
                <FormResizableTh
                  colKey="item"
                  width={colGrid.getWidth("item")}
                  isResizing={colGrid.resizingKey === "item"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-3.5 py-2.5 border-r border-border"
                >
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
                </FormResizableTh>

                {/* Custom Columns */}
                {customCols.map((c) => (
                  <FormResizableTh
                    key={c.key}
                    colKey={c.key}
                    width={colGrid.getWidth(c.key, 135)}
                    isResizing={colGrid.resizingKey === c.key}
                    onResizeStart={colGrid.startResize}
                    onResetWidth={colGrid.resetWidth}
                    className="px-3 py-2.5 text-center border-r border-border"
                  >
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
                  </FormResizableTh>
                ))}

                {/* Column 2: Qty. */}
                <FormResizableTh
                  colKey="qty"
                  width={colGrid.getWidth("qty")}
                  isResizing={colGrid.resizingKey === "qty"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-3 py-2.5 text-right border-r border-border"
                >
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
                </FormResizableTh>

                {/* Column 3: Rate */}
                <FormResizableTh
                  colKey="rate"
                  width={colGrid.getWidth("rate")}
                  isResizing={colGrid.resizingKey === "rate"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-3 py-2.5 text-right border-r border-border"
                >
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
                </FormResizableTh>

                {/* Column 4: Total Amount */}
                <FormResizableTh
                  colKey="total"
                  width={colGrid.getWidth("total")}
                  isResizing={colGrid.resizingKey === "total"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-3 py-2.5 text-right border-r border-border"
                >
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
                </FormResizableTh>

                {/* Actions Header */}
                {!readOnly && (
                  <th className="w-11 px-2 py-2.5 text-center">
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

                  {/* Column 4: Total Amount (Editable, updates Rate automatically) */}
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.total}
                      disabled={readOnly}
                      onChange={(e) => handleRowFieldChange(index, "total", e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right font-mono font-bold text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none transition shadow-none focus:shadow-2xs focus:ring-1 focus:ring-primary-100"
                      title="Total process cost (updates Rate if changed)"
                    />
                  </td>

                  {/* Delete Row Button */}
                  {!readOnly && (
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(index)}
                        className="p-1.5 rounded text-ink-faint hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 cursor-pointer"
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
          <tfoot>
            {/* Footer Row 1: Total Cost */}
            <tr className="border-t-2 border-border bg-surface-sunken/70 text-xs">
              <td
                colSpan={4 + customCols.length}
                className="px-3 py-2 text-right font-extrabold uppercase tracking-wide text-ink border-r border-border"
              >
                Total Cost
              </td>
              <td className="px-2.5 py-2 text-right font-extrabold font-mono text-red-700 border-r border-border tnum">
                {formatCurrency(totalCostNumber, currencyCode, 2)}
              </td>
              {!readOnly && <td className="px-2 py-2" />}
            </tr>

            {/* Footer Row 2: Main Sheet Client Quote with Margin (only displayed when Margin % > 0) */}
            {marginPctNumber > 0 && (
              <tr className="border-t border-border bg-primary-50/40 text-xs">
                <td
                  colSpan={4 + customCols.length}
                  className="px-3 py-2 text-right font-extrabold uppercase tracking-wide text-primary-700 border-r border-border"
                >
                  Main Client Quote (+{marginPctNumber}%)
                </td>
                <td className="px-2.5 py-2 text-right font-extrabold font-mono text-primary-700 border-r border-border tnum">
                  {formatCurrency(baseClientSubtotalNumber, currencyCode, 2)}
                </td>
                {!readOnly && <td className="px-2 py-2" />}
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Summary Bar: Base Cost, Margin %, Saved Bulk Quote Chips & Combined Client Subtotal */}
      <div className="rounded-xl border border-border bg-surface-sunken/60 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-ink">
            <Calculator className="h-4 w-4 text-primary-600 shrink-0" />
            <span>Summary</span>
            <span className="text-[10.5px] font-bold text-ink-muted">({currencyCode})</span>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-red-600 uppercase text-[11px]">Base Cost:</span>
            <span className="font-extrabold font-mono text-red-600 text-sm tnum">
              {formatCurrency(totalCostNumber, currencyCode, 2)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-ink">Margin %:</span>
            <input
              type="number"
              step="any"
              min="0"
              disabled={readOnly}
              value={data.margin_percent || "0"}
              onChange={(e) => updateDataAndRecalculate({ margin_percent: e.target.value })}
              placeholder="0"
              className="w-16 text-right font-mono text-xs text-ink bg-white border border-border rounded px-2 py-1 focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Saved Bulk Quote Chips */}
          {bulkQuotes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-border">
              {bulkQuotes.map((bq, idx) => {
                const qtyNum = parseFloat(bq.target_qty || "0") || 0;
                const bqTotal = parseFloat(bq.client_subtotal || bq.total_cost || "0") || 0;
                const bqRate = parseFloat(bq.client_rate || bq.cost_per_unit || "0") || 0;
                const chipLabel =
                  bq.label?.trim() ||
                  (qtyNum > 0 ? `${qtyNum.toLocaleString()} pcs` : `Bulk #${idx + 1}`);

                return (
                  <div
                    key={bq.id}
                    className="group/chip inline-flex items-center rounded-lg border border-emerald-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 shadow-2xs transition"
                  >
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        setEditingBulkQuote(bq);
                        setBulkModalOpen(true);
                      }}
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-ink",
                        readOnly ? "cursor-default" : "cursor-pointer"
                      )}
                      title={
                        readOnly
                          ? `${chipLabel}: ${formatCurrency(bqTotal, currencyCode, 2)}`
                          : `Click to view / edit ${chipLabel} bulk quote`
                      }
                    >
                      <span className="font-mono font-extrabold text-emerald-800">
                        {chipLabel}
                      </span>
                      {bqRate > 0 && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span className="font-mono text-ink-muted tnum">
                            {formatCurrency(bqRate, currencyCode, 2)}/pc
                          </span>
                        </>
                      )}
                      <span className="text-ink-faint">·</span>
                      <span className="font-mono font-extrabold text-primary-700 tnum">
                        {formatCurrency(bqTotal, currencyCode, 2)}
                      </span>
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBulkQuote(bq.id)}
                        className="pr-2 pl-0.5 py-1 text-ink-faint hover:text-red-600 transition cursor-pointer"
                        title={`Remove ${chipLabel} bulk quote`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Costing Production Specs & Internal Notes */}
      <div className="rounded-xl border border-border bg-surface-sunken/40 p-4 shadow-2xs flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary-600" />
          <label className="text-xs font-bold text-ink uppercase tracking-wide">
            Production Specs &amp; Internal Notes
          </label>
        </div>
        <textarea
          rows={2}
          disabled={readOnly}
          value={data.costing_notes || ""}
          onChange={(e) => updateDataAndRecalculate({ costing_notes: e.target.value })}
          placeholder="e.g. Paper 300 GSM Art Card, 4-color offset printing, plate size 20x30, matte thermal lamination front only, punch die ready with vendor..."
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-ink placeholder:italic placeholder:text-ink-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-100 transition shadow-2xs resize-y"
        />
      </div>

      {/* Full Detailed Costing Sheet Modal for Adding / Editing Bulk Quotes */}
      {!readOnly && (
        <BulkQuoteModal
          open={bulkModalOpen}
          initialQuote={editingBulkQuote}
          mainRows={rows}
          mainCustomColumns={customCols}
          mainMarginPercent={data.margin_percent || "0"}
          colLabels={{
            item: colItemLabel,
            qty: colQtyLabel,
            rate: colRateLabel,
            total: colTotalLabel,
          }}
          quickProcesses={quickProcesses}
          currencyCode={currencyCode}
          onClose={() => {
            setBulkModalOpen(false);
            setEditingBulkQuote(null);
          }}
          onSave={handleSaveBulkQuote}
          onDelete={handleDeleteBulkQuote}
        />
      )}
    </div>
  );
}
