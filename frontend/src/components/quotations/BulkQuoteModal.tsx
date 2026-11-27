"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Calculator, Copy, Layers, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { useFormColumnWidths } from "@/lib/useFormColumnWidths";
import { FormResizableTh } from "@/components/ui/FormResizableTh";
import {
  DetailedCostingBulkQuote,
  DetailedCostingCustomColumn,
  DetailedCostingRow,
} from "@/lib/types";

const BULK_MODAL_DEFAULT_WIDTHS: Record<string, number> = {
  sr_no: 48,
  item: 300,
  qty: 110,
  rate: 120,
  total: 135,
};

interface BulkQuoteModalProps {
  open: boolean;
  initialQuote: DetailedCostingBulkQuote | null;
  mainRows: DetailedCostingRow[];
  mainCustomColumns: DetailedCostingCustomColumn[];
  mainMarginPercent: string;
  colLabels: {
    item: string;
    qty: string;
    rate: string;
    total: string;
  };
  quickProcesses: string[];
  currencyCode?: string;
  onClose: () => void;
  onSave: (saved: DetailedCostingBulkQuote) => void;
  onDelete?: (id: string) => void;
}

function makeRow(itemName = "", customFields: Record<string, string> = {}): DetailedCostingRow {
  return {
    id: `bq_row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    item_name: itemName,
    qty: "",
    rate: "",
    total: "0.00",
    custom_fields: { ...customFields },
  };
}

export function BulkQuoteModal({
  open,
  initialQuote,
  mainRows,
  mainCustomColumns,
  mainMarginPercent,
  colLabels,
  quickProcesses,
  currencyCode = "INR",
  onClose,
  onSave,
  onDelete,
}: BulkQuoteModalProps) {
  const toast = useToast();
  const [targetQty, setTargetQty] = useState("1000");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [marginPercent, setMarginPercent] = useState(mainMarginPercent || "0");
  const [customColumns, setCustomColumns] = useState<DetailedCostingCustomColumn[]>([]);
  const [rows, setRows] = useState<DetailedCostingRow[]>([]);

  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const colGrid = useFormColumnWidths("bulk_quote_modal_sheet", BULK_MODAL_DEFAULT_WIDTHS, 48);

  useEffect(() => {
    if (!open) return;
    setIsAddingCol(false);
    setNewColName("");

    if (initialQuote) {
      setTargetQty(initialQuote.target_qty || "1000");
      setLabel(initialQuote.label || "");
      setNotes(initialQuote.notes || "");
      setMarginPercent(initialQuote.margin_percent ?? (mainMarginPercent || "0"));
      setCustomColumns(
        (initialQuote.custom_columns || mainCustomColumns || []).map((c) => ({ ...c }))
      );
      setRows(
        initialQuote.rows && initialQuote.rows.length > 0
          ? initialQuote.rows.map((r) => ({
              ...r,
              custom_fields: { ...(r.custom_fields || {}) },
            }))
          : [makeRow(), makeRow()]
      );
    } else {
      setTargetQty("1000");
      setLabel("");
      setNotes("");
      setMarginPercent(mainMarginPercent || "0");
      setCustomColumns((mainCustomColumns || []).map((c) => ({ ...c })));
      const nonEmptyMain = (mainRows || []).filter(
        (r) =>
          (r.item_name && r.item_name.trim() !== "") ||
          (r.qty && r.qty !== "") ||
          (r.rate && r.rate !== "")
      );
      setRows(
        nonEmptyMain.length > 0
          ? nonEmptyMain.map((r) => makeRow(r.item_name || "", r.custom_fields || {}))
          : [makeRow(), makeRow(), makeRow(), makeRow()]
      );
    }
  }, [open, initialQuote, mainRows, mainCustomColumns, mainMarginPercent]);

  const totalCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = parseFloat(r.qty || "0") || 0;
      const rate = parseFloat(r.rate || "0") || 0;
      const tot = q > 0 || rate > 0 ? q * rate : parseFloat(r.total || "0") || 0;
      return sum + tot;
    }, 0);
  }, [rows]);

  const marginNum = parseFloat(marginPercent || "0") || 0;
  const qtyNum = parseFloat(targetQty || "0") || 0;
  const clientSubtotal = totalCost * (1 + marginNum / 100);
  const costPerUnit = qtyNum > 0 ? totalCost / qtyNum : 0;
  const clientRatePerUnit = qtyNum > 0 ? clientSubtotal / qtyNum : 0;

  const totalTableWidth = useMemo(() => {
    const customSum = customColumns.reduce((sum, c) => sum + colGrid.getWidth(c.key, 130), 0);
    return (
      colGrid.getWidth("sr_no") +
      colGrid.getWidth("item") +
      customSum +
      colGrid.getWidth("qty") +
      colGrid.getWidth("rate") +
      colGrid.getWidth("total") +
      44
    );
  }, [customColumns, colGrid]);

  function handleCopyMainValues() {
    const sourceRows = (mainRows || []).filter(
      (r) =>
        (r.item_name && r.item_name.trim() !== "") ||
        parseFloat(r.qty || "0") > 0 ||
        parseFloat(r.rate || "0") > 0
    );
    if (sourceRows.length === 0) {
      toast.error("Main sheet has no entered rows to copy.");
      return;
    }
    setRows(
      sourceRows.map((r) => {
        const q = parseFloat(r.qty || "0") || 0;
        const rate = parseFloat(r.rate || "0") || 0;
        const tot = q * rate;
        return {
          id: `bq_row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          item_name: r.item_name || "",
          qty: r.qty || "",
          rate: r.rate || "",
          total: tot > 0 ? tot.toFixed(2) : r.total || "0.00",
          custom_fields: { ...(r.custom_fields || {}) },
        };
      })
    );
    toast.success("Copied all rows and values from main sheet.");
  }

  function handleRowFieldChange(
    index: number,
    field: "item_name" | "qty" | "rate" | "total",
    val: string
  ) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (field === "total") {
        const q = parseFloat(cur.qty || "0") || 0;
        const tot = parseFloat(val || "0") || 0;
        const newRate = q > 0 && tot > 0 ? (tot / q).toFixed(2) : cur.rate;
        next[index] = { ...cur, rate: newRate, total: val };
      } else if (field === "rate") {
        const q = parseFloat(cur.qty || "0") || 0;
        const r = parseFloat(val || "0") || 0;
        const tot = q * r;
        next[index] = { ...cur, rate: val, total: tot > 0 ? tot.toFixed(2) : "0.00" };
      } else if (field === "qty") {
        const q = parseFloat(val || "0") || 0;
        const r = parseFloat(cur.rate || "0") || 0;
        const tot = q * r;
        next[index] = { ...cur, qty: val, total: tot > 0 ? tot.toFixed(2) : "0.00" };
      } else {
        next[index] = { ...cur, item_name: val };
      }
      return next;
    });
  }

  function handleCustomFieldChange(index: number, colKey: string, val: string) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, custom_fields: { ...(r.custom_fields || {}), [colKey]: val } } : r
      )
    );
  }

  function handleAddRow(itemName = "") {
    if (itemName) {
      const emptyIdx = rows.findIndex(
        (r) => (!r.item_name || !r.item_name.trim()) && (!r.qty || r.qty === "") && (!r.rate || r.rate === "")
      );
      if (emptyIdx !== -1) {
        setRows((prev) =>
          prev.map((r, i) => (i === emptyIdx ? { ...r, item_name: itemName } : r))
        );
        return;
      }
    }
    setRows((prev) => [...prev, makeRow(itemName)]);
  }

  function handleDeleteRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? [makeRow()] : prev.filter((_, i) => i !== index)));
  }

  function handleAddCustomColumn() {
    const clean = newColName.trim();
    if (!clean) return;
    const key = `bq_col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setCustomColumns((prev) => [...prev, { key, label: clean }]);
    setNewColName("");
    setIsAddingCol(false);
  }

  function handleDeleteCustomColumn(key: string) {
    setCustomColumns((prev) => prev.filter((c) => c.key !== key));
    setRows((prev) =>
      prev.map((r) => {
        const cf = { ...(r.custom_fields || {}) };
        delete cf[key];
        return { ...r, custom_fields: cf };
      })
    );
  }

  function handleSaveQuote() {
    const cleanQty = targetQty.replace(/[^0-9.]/g, "").trim();
    if (!cleanQty || parseFloat(cleanQty) <= 0) {
      toast.error("Please enter a valid Target Qty (e.g. 1000).");
      return;
    }

    const computedRows = rows.map((r) => {
      const q = parseFloat(r.qty || "0") || 0;
      const rate = parseFloat(r.rate || "0") || 0;
      const tot = q > 0 || rate > 0 ? q * rate : parseFloat(r.total || "0") || 0;
      return {
        ...r,
        total: tot > 0 ? tot.toFixed(2) : "0.00",
      };
    });

    const saved: DetailedCostingBulkQuote = {
      id: initialQuote?.id || `bq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: label.trim() || `${Number(cleanQty).toLocaleString()} pcs`,
      target_qty: cleanQty,
      margin_percent: String(marginPercent || "0"),
      col_item_label: colLabels.item,
      col_qty_label: colLabels.qty,
      col_rate_label: colLabels.rate,
      col_total_label: colLabels.total,
      custom_columns: customColumns,
      rows: computedRows,
      total_cost: totalCost.toFixed(2),
      cost_per_unit: costPerUnit.toFixed(2),
      client_rate: clientRatePerUnit.toFixed(2),
      client_subtotal: clientSubtotal.toFixed(2),
      notes: notes.trim(),
    };

    onSave(saved);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialQuote ? `Edit Bulk Quote (${Number(initialQuote.target_qty || 0).toLocaleString()} pcs)` : "Add Bulk Quote"}
      width="max-w-5xl"
      zIndex={70}
    >
      <div className="flex flex-col gap-4">
        {/* Top Meta Bar: Target Qty, Margin %, Optional Label & Copy Helper */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-sunken/40 p-3.5 sm:grid-cols-12 items-end">
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Target Batch Qty (pcs) *
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                step="any"
                value={targetQty}
                onChange={(e) => setTargetQty(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-ink focus:border-primary-500 focus:outline-none"
              />
              <div className="hidden md:flex items-center gap-1 shrink-0">
                {[1000, 2000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetQty(String(preset))}
                    className={clsx(
                      "rounded px-1.5 py-1 text-[10px] font-bold border transition cursor-pointer",
                      Number(targetQty) === preset
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-border bg-white text-ink-muted hover:text-ink"
                    )}
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Margin %
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-right text-ink focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Quote Label / Remarks (Opt.)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Offset Print Option"
              className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-ink focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyMainValues}
              className="h-8 gap-1.5 text-xs w-full sm:w-auto justify-center"
              title="Copy quantities and rates from the main costing sheet"
            >
              <Copy className="h-3.5 w-3.5 text-primary-600" />
              <span>Copy Rates from Main</span>
            </Button>
          </div>
        </div>

        {/* Quick Add Process Row Chips */}
        {quickProcesses.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-sunken/30 px-3.5 py-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-muted mr-1">
              Quick Add:
            </span>
            {quickProcesses.map((tmpl) => (
              <button
                key={tmpl}
                type="button"
                onClick={() => handleAddRow(tmpl)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-ink hover:border-primary-400 hover:bg-surface-hover transition cursor-pointer"
              >
                <Plus className="h-2.5 w-2.5 text-primary-600" />
                <span>{tmpl}</span>
              </button>
            ))}
          </div>
        )}

        {/* Toolbar for Bulk Sheet Table */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-sunken/40 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-ink">Bulk Costing Sheet</span>
            <span className="rounded-full border border-border bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted">
              {rows.filter((r) => r.item_name?.trim()).length} processes
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAddingCol ? (
              <div className="flex items-center gap-1 rounded-md border border-primary-400 bg-white px-1.5 py-0.5">
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomColumn();
                    }
                    if (e.key === "Escape") setIsAddingCol(false);
                  }}
                  placeholder="Column name..."
                  autoFocus
                  className="w-28 text-xs text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomColumn}
                  className="text-xs font-bold text-primary-600 hover:underline px-1 cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCol(false)}
                  className="text-ink-faint hover:text-ink cursor-pointer"
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
                className="h-7.5 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5 text-primary-600" /> Add Column
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddRow()}
              className="h-7.5 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5 text-primary-600" /> Add Row
            </Button>

            {colGrid.hasCustomWidths && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={colGrid.resetAllWidths}
                className="h-7.5 text-xs gap-1 text-ink-muted"
              >
                <RotateCcw className="h-3 w-3" /> Reset Widths
              </Button>
            )}
          </div>
        </div>

        {/* Full Costing Columns Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-2xs">
          <table
            style={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
            className="table-fixed text-left text-xs border-collapse"
          >
            <colgroup>
              <col style={{ width: `${colGrid.getWidth("sr_no")}px` }} />
              <col style={{ width: `${colGrid.getWidth("item")}px` }} />
              {customColumns.map((c) => (
                <col key={c.key} style={{ width: `${colGrid.getWidth(c.key, 130)}px` }} />
              ))}
              <col style={{ width: `${colGrid.getWidth("qty")}px` }} />
              <col style={{ width: `${colGrid.getWidth("rate")}px` }} />
              <col style={{ width: `${colGrid.getWidth("total")}px` }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
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
                <FormResizableTh
                  colKey="item"
                  width={colGrid.getWidth("item")}
                  isResizing={colGrid.resizingKey === "item"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-3 py-2.5 border-r border-border"
                >
                  {colLabels.item}
                </FormResizableTh>
                {customColumns.map((c) => (
                  <FormResizableTh
                    key={c.key}
                    colKey={c.key}
                    width={colGrid.getWidth(c.key, 130)}
                    isResizing={colGrid.resizingKey === c.key}
                    onResizeStart={colGrid.startResize}
                    onResetWidth={colGrid.resetWidth}
                    className="px-2.5 py-2.5 text-center border-r border-border"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{c.label}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomColumn(c.key)}
                        className="text-ink-faint hover:text-rose-600 shrink-0 cursor-pointer"
                        title="Remove column"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </FormResizableTh>
                ))}
                <FormResizableTh
                  colKey="qty"
                  width={colGrid.getWidth("qty")}
                  isResizing={colGrid.resizingKey === "qty"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-2.5 py-2.5 text-right border-r border-border"
                >
                  {colLabels.qty}
                </FormResizableTh>
                <FormResizableTh
                  colKey="rate"
                  width={colGrid.getWidth("rate")}
                  isResizing={colGrid.resizingKey === "rate"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-2.5 py-2.5 text-right border-r border-border"
                >
                  {colLabels.rate}
                </FormResizableTh>
                <FormResizableTh
                  colKey="total"
                  width={colGrid.getWidth("total")}
                  isResizing={colGrid.resizingKey === "total"}
                  onResizeStart={colGrid.startResize}
                  onResetWidth={colGrid.resetWidth}
                  className="px-2.5 py-2.5 text-right border-r border-border"
                >
                  {colLabels.total}
                </FormResizableTh>
                <th className="w-11 px-2 py-2.5 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-primary-50/20 group">
                  <td className="p-2 border-r border-border text-center text-ink-muted font-medium">
                    {idx + 1}
                  </td>
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="text"
                      value={row.item_name}
                      onChange={(e) => handleRowFieldChange(idx, "item_name", e.target.value)}
                      placeholder="e.g. Paper, Print, Matt Lamination..."
                      className="w-full font-medium text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </td>
                  {customColumns.map((c) => (
                    <td key={c.key} className="p-1.5 border-r border-border">
                      <input
                        type="text"
                        value={row.custom_fields?.[c.key] || ""}
                        onChange={(e) => handleCustomFieldChange(idx, c.key, e.target.value)}
                        placeholder="—"
                        className="w-full text-center text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.qty}
                      onChange={(e) => handleRowFieldChange(idx, "qty", e.target.value)}
                      placeholder="0"
                      className="w-full text-right font-mono text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.rate}
                      onChange={(e) => handleRowFieldChange(idx, "rate", e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right font-mono text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </td>
                  <td className="p-1.5 border-r border-border">
                    <input
                      type="number"
                      step="any"
                      value={row.total}
                      onChange={(e) => handleRowFieldChange(idx, "total", e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right font-mono font-bold text-ink bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-border/80 focus:border-primary-500 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1 rounded text-ink-faint hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      title="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-sunken/60 text-xs">
                <td
                  colSpan={4 + customColumns.length}
                  className="px-3 py-2 text-right font-extrabold uppercase tracking-wide text-ink border-r border-border"
                >
                  Total Cost
                </td>
                <td className="px-2.5 py-2 text-right font-extrabold font-mono text-red-700 border-r border-border tnum">
                  {formatCurrency(totalCost, currencyCode, 2)}
                </td>
                <td />
              </tr>
              {marginNum > 0 && (
                <tr className="border-t border-border bg-primary-50/40 text-xs">
                  <td
                    colSpan={4 + customColumns.length}
                    className="px-3 py-2 text-right font-extrabold uppercase tracking-wide text-primary-700 border-r border-border"
                  >
                    Client Quote (+{marginNum}%)
                  </td>
                  <td className="px-2.5 py-2 text-right font-extrabold font-mono text-primary-700 border-r border-border tnum">
                    {formatCurrency(clientSubtotal, currencyCode, 2)}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Live Summary + Save / Delete / Cancel Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken/60 px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-primary-600" />
              <span className="font-bold text-red-700 uppercase">Cost:</span>
              <span className="font-mono font-extrabold text-red-700 tnum">
                {formatCurrency(totalCost, currencyCode, 2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-muted font-semibold">Rate / pc:</span>
              <span className="font-mono font-bold text-emerald-700 tnum">
                {formatCurrency(clientRatePerUnit, currencyCode, 2)}/pc
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary-700 uppercase">Bulk Quote Total:</span>
              <span className="font-mono font-extrabold text-sm text-primary-700 tnum">
                {formatCurrency(clientSubtotal, currencyCode, 2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {initialQuote && onDelete && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onDelete(initialQuote.id)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Quote
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveQuote}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save Bulk Quote
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
