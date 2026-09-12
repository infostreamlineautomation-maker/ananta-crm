/**
 * Universal Multi-Format Export Utility (Excel, CSV, PDF)
 * Supports custom column mappings, auto column widths, and branded PDF tables.
 */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn<T> {
  key?: string;
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  category?: string;
  defaultSelected?: boolean;
}

export type ExportFormat = "excel" | "csv" | "pdf";

export interface ExportOptions {
  companyName?: string;
  primaryColor?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * Format clean organization prefix for file naming:
 * e.g., "Ananta Graphics" -> "Ananta_Graphics_"
 * e.g., "Meewa Industries" -> "Meewa_Industries_"
 */
export function getOrgPrefix(companyName?: string): string {
  if (!companyName) return "";
  const cleaned = companyName.trim().replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  return cleaned ? `${cleaned}_` : "";
}

/**
 * Clean and format raw cell values into printable strings / numbers.
 */
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val).trim();
}

/**
 * 1. Export Data to CSV (.csv) with UTF-8 BOM for Excel compatibility.
 */
export function exportToCsv<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options?: ExportOptions,
) {
  if (!data || data.length === 0) return;

  const prefix = getOrgPrefix(options?.companyName);
  const headerRow = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = formatCellValue(c.accessor(row));
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(","),
  );

  const csvContent = "\ufeff" + [headerRow, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${prefix}${filename}_${getTimestamp()}.csv`);
}

/**
 * 2. Export Data to Microsoft Excel (.xlsx) with auto column widths and company title.
 */
export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = "Data",
  options?: ExportOptions,
) {
  if (!data || data.length === 0) return;

  const prefix = getOrgPrefix(options?.companyName);
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) => columns.map((c) => formatCellValue(c.accessor(row))));

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto calculate column widths
  const colWidths = headers.map((header, colIdx) => {
    const maxLen = Math.max(
      header.length,
      ...rows.map((row) => (row[colIdx] ? String(row[colIdx]).length : 0)),
    );
    return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  if (options?.companyName) {
    wb.Props = {
      Title: filename.replace(/_/g, " "),
      Author: options.companyName,
      Company: options.companyName,
    };
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${prefix}${filename}_${getTimestamp()}.xlsx`);
}

/**
 * 3. Export Data to Branded PDF (.pdf) explicitly mentioning company name in headers and metadata.
 */
export function exportToPdf<T>(
  data: T[],
  columns: ExportColumn<T>[],
  title: string,
  filename: string,
  options?: ExportOptions,
) {
  if (!data || data.length === 0) return;

  const company = options?.companyName || "Ananta Graphics × Meewa Industries";
  const prefix = getOrgPrefix(options?.companyName);
  const orientation = options?.orientation || (columns.length > 5 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

  // 1. Top Organization Banner / Pill
  doc.setFontSize(9);
  doc.setTextColor(195, 20, 50); // Primary Crimson
  doc.setFont("helvetica", "bold");
  doc.text(`EXPORTED FOR: ${company.toUpperCase()}`, 40, 32);

  // 2. Main Title
  doc.setFontSize(16);
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, 50);

  // 3. Metadata Subtitle
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`Company: ${company} · Exported on: ${new Date().toLocaleString("en-IN")} · Total Records: ${data.length}`, 40, 65);

  const headers = columns.map((c) => c.header);
  const body = data.map((row) => columns.map((c) => formatCellValue(c.accessor(row))));

  // AutoTable
  autoTable(doc, {
    startY: 78,
    head: [headers],
    body: body,
    theme: "striped",
    headStyles: {
      fillColor: [195, 20, 50], // #C31432
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      overflow: "linebreak",
      textColor: [36, 23, 21],
    },
    alternateRowStyles: {
      fillColor: [253, 248, 247],
    },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: (dataInfo) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${dataInfo.pageNumber} of ${pageCount} · ${company}`,
        doc.internal.pageSize.width - 40,
        doc.internal.pageSize.height - 20,
        { align: "right" },
      );
    },
  });

  doc.save(`${prefix}${filename}_${getTimestamp()}.pdf`);
}

/**
 * Universal Dispatcher: Handles exporting in any requested format with company branding.
 */
export function exportData<T>(
  format: ExportFormat,
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title = "Exported Report",
  options?: ExportOptions,
) {
  if (format === "excel") {
    exportToExcel(data, columns, filename, "Data", options);
  } else if (format === "csv") {
    exportToCsv(data, columns, filename, options);
  } else if (format === "pdf") {
    exportToPdf(data, columns, title, filename, options);
  }
}

import type { AnalyticsReport } from "@/lib/types";

/**
 * 4. Export Analytics Report in Excel, CSV, or PDF
 */
export function exportAnalyticsReport(
  format: ExportFormat,
  report: AnalyticsReport,
  companyName?: string,
) {
  const company = companyName || "Ananta Graphics × Meewa Industries";
  const prefix = getOrgPrefix(companyName);
  const baseCurr = report.base_currency_code || "INR";
  const filename = `${prefix}financial_report_${baseCurr}_${report.date_from}_to_${report.date_to}`;

  if (format === "excel") {
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `Financial Report - ${company}`,
      Author: company,
      Company: company,
    };

    // Sheet 1: KPIs
    const kpiData = [
      ["ANALYTICS & FINANCIAL SUMMARY REPORT"],
      [`Exported for: ${company}`],
      [`Period: ${report.date_from} to ${report.date_to}`, `Base Currency: ${baseCurr}`],
      [],
      ["Metric", "Value"],
      ["Company", company],
      ["Total Revenue", `${baseCurr} ${report.kpis.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
      ["Paid Revenue (Collected)", `${baseCurr} ${report.kpis.paid_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
      ["Pending Balance (Due)", `${baseCurr} ${report.kpis.pending_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
      ["Total Orders Count", report.kpis.total_orders],
      ["Average Order Value (AOV)", `${baseCurr} ${report.kpis.avg_order_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
      ["Active Clients", report.kpis.active_clients],
      ["Revenue Growth vs Prev Period", `${report.kpis.revenue_growth}%`],
      ["Quotation Win Rate", `${report.quotation_funnel?.conversion_rate || 0}%`],
    ];
    const wsKpis = XLSX.utils.aoa_to_sheet(kpiData);
    wsKpis["!cols"] = [{ wch: 32 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsKpis, "KPI_Summary");

    // Sheet 2: Top Products
    if (report.top_products.length > 0) {
      const prodHeaders = ["Product Name", "Units Sold", `Total Revenue (${baseCurr})`, "Revenue Share (%)"];
      const prodRows = report.top_products.map((p) => [p.name, p.qty, p.revenue, `${p.share_pct}%`]);
      const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
      wsProd["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsProd, "Top_Products");
    }

    // Sheet 3: Top Clients
    if (report.top_clients.length > 0) {
      const clientHeaders = ["Client Name", "Orders Count", `Total Revenue (${baseCurr})`, "Revenue Share (%)"];
      const clientRows = report.top_clients.map((c) => [c.name, c.order_count, c.revenue, `${c.share_pct}%`]);
      const wsClient = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]);
      wsClient["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsClient, "Top_Clients");
    }

    // Sheet 4: Daily Trend
    if (report.trend.length > 0) {
      const trendHeaders = ["Date", `Revenue (${baseCurr})`, "Orders Count", `Paid Amount (${baseCurr})`];
      const trendRows = report.trend.map((t) => [t.date, t.revenue, t.orders_count, t.paid]);
      const wsTrend = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
      wsTrend["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsTrend, "Daily_Trend");
    }

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, `${filename}.xlsx`);
    return;
  }

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // 1. Top Organization Pill
    doc.setFontSize(9);
    doc.setTextColor(195, 20, 50);
    doc.setFont("helvetica", "bold");
    doc.text(`EXPORTED FOR: ${company.toUpperCase()}`, 40, 32);

    // 2. Header
    doc.setFontSize(16);
    doc.setTextColor(20, 24, 33);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Analytics & Intelligence Report", 40, 50);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`Company: ${company} · Period: ${report.date_from} to ${report.date_to} · Base Currency: ${baseCurr}`, 40, 65);

    let startY = 80;

    // 1. KPI Summary Table
    autoTable(doc, {
      startY,
      head: [["KPI Metric", "Value", "Status"]],
      body: [
        ["Total Revenue", `${baseCurr} ${report.kpis.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, `${report.kpis.revenue_growth >= 0 ? "+" : ""}${report.kpis.revenue_growth}% vs prev`],
        ["Collections (Paid)", `${baseCurr} ${report.kpis.paid_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "Collected"],
        ["Outstanding Balance (Due)", `${baseCurr} ${report.kpis.pending_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "Pending"],
        ["Total Orders & Volume", `${report.kpis.total_orders} orders`, `AOV: ${baseCurr} ${report.kpis.avg_order_value.toLocaleString("en-IN")}`],
        ["Quotation Win Rate", `${report.quotation_funnel?.conversion_rate || 0}%`, `${report.quotation_funnel?.accepted || 0} won / ${report.quotation_funnel?.sent || 0} sent`],
      ],
      theme: "striped",
      headStyles: { fillColor: [195, 20, 50], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 5 },
      alternateRowStyles: { fillColor: [253, 248, 247] },
      margin: { left: 40, right: 40 },
    });

    // 2. Top Products Table
    if (report.top_products.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 200;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Top Products Performance", 40, finalY + 25);

      autoTable(doc, {
        startY: finalY + 32,
        head: [["Product Name", "Units Sold", `Revenue (${baseCurr})`, "Share %"]],
        body: report.top_products.slice(0, 10).map((p) => [
          p.name,
          p.qty.toLocaleString("en-IN"),
          p.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          `${p.share_pct}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      });
    }

    // 3. Top Clients Table
    if (report.top_clients.length > 0) {
      const finalY2 = (doc as any).lastAutoTable?.finalY || 350;
      if (finalY2 > 650) {
        doc.addPage();
        startY = 45;
      } else {
        startY = finalY2 + 25;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Top Client Accounts", 40, startY);

      autoTable(doc, {
        startY: startY + 8,
        head: [["Client Name", "Orders Count", `Revenue (${baseCurr})`, "Share %"]],
        body: report.top_clients.slice(0, 10).map((c) => [
          c.name,
          String(c.order_count),
          c.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          `${c.share_pct}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      });
    }

    // Page numbering
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages} · ${company}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 20, {
        align: "right",
      });
    }

    doc.save(`${filename}.pdf`);
    return;
  }
}

/**
 * Helper: Download Blob as a File
 */
function downloadBlob(blob: Blob, fullFilename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fullFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getTimestamp() {
  return new Date().toISOString().slice(0, 10);
}
