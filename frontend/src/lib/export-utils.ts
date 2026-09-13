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
  imageAccessor?: (row: T) => string | string[] | null | undefined;
  category?: string;
  defaultSelected?: boolean;
}

export type ExportFormat = "excel" | "csv" | "pdf";

export interface ExportOptions {
  companyName?: string;
  logoUrl?: string | null;
  watermarkLogoUrl?: string | null;
  primaryColor?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * Helper to safely convert hex color string to RGB numbers
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = (hex || "#C31432").replace("#", "");
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r, g, b];
  }
  return [195, 20, 50]; // default crimson
}

/**
 * Helper to load an image URL into an HTMLImageElement for jsPDF
 */
function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url || typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Extract image URL from a column/row if available
 */
function getRowImageUrl<T>(col: ExportColumn<T>, row: T): string | null {
  if (col.imageAccessor) {
    const res = col.imageAccessor(row);
    if (Array.isArray(res) && res.length > 0) {
      const first = res[0];
      if (typeof first === "string" && first.trim().length > 0) return first.trim();
    } else if (typeof res === "string" && res.trim().length > 0) {
      return res.trim();
    }
  }
  const raw = col.accessor(row);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:image") || s.startsWith("/media/")) {
      return s.split(",")[0].trim();
    }
  }
  return null;
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
 * Empty or undefined/null values return "-" as requested.
 */
export function formatCellValue(val: unknown, emptyPlaceholder = "-"): string {
  if (val === null || val === undefined) return emptyPlaceholder;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") {
    if (isNaN(val)) return emptyPlaceholder;
    return String(val);
  }
  const str = String(val).trim();
  if (
    str === "" ||
    str === "null" ||
    str === "undefined" ||
    str === "NaN" ||
    str === "—" ||
    str === "-" ||
    str === "--"
  ) {
    return emptyPlaceholder;
  }
  // Sanitize raw cloudinary / long media URLs from breaking tables
  if (str.includes("res.cloudinary.com") || (str.includes("http") && str.includes("/media/"))) {
    const urls = str.split(",").filter((s) => s.trim().length > 0);
    return urls.length === 1 ? "1 Image Attached" : `${urls.length} Images Attached`;
  }
  return str;
}

/**
 * Determine column horizontal alignment based on header name / content type.
 */
export function getColumnHalign(header: string): "left" | "center" | "right" {
  const h = header.toLowerCase();
  if (
    h.includes("total") ||
    h.includes("amount") ||
    h.includes("price") ||
    h.includes("balance") ||
    h.includes("due") ||
    h.includes("paid") ||
    h.includes("tax") ||
    h.includes("subtotal") ||
    h.includes("rate") ||
    h.includes("revenue") ||
    h.includes("cost") ||
    h.includes("profit") ||
    h.includes("bill") ||
    h.includes("gst") ||
    h.includes("%")
  ) {
    if (h.includes("status") || h.includes("type")) return "center";
    return "right";
  }
  if (
    h.includes("no") ||
    h.includes("date") ||
    h.includes("status") ||
    h.includes("code") ||
    h.includes("currency") ||
    h.includes("phone") ||
    h.includes("count") ||
    h.includes("qty") ||
    h.includes("quantity") ||
    h.includes("tier") ||
    h.includes("type") ||
    h.includes("id") ||
    h.includes("image") ||
    h.includes("preview") ||
    h.includes("logo") ||
    h.includes("proof")
  ) {
    return "center";
  }
  return "left";
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
        const val = formatCellValue(c.accessor(row), "-");
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
  const rows = data.map((row) => columns.map((c) => formatCellValue(c.accessor(row), "-")));

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
 * Helper to draw a subtle, centered brand logo watermark across PDF pages
 */
function drawPageWatermark(doc: jsPDF, logoImg: HTMLImageElement | null) {
  if (!logoImg || logoImg.naturalWidth <= 0 || logoImg.naturalHeight <= 0) return;
  try {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const isLandscape = pageWidth > pageHeight;
    const maxW = isLandscape ? 380 : 280;
    const maxH = isLandscape ? 220 : 170;
    const scale = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight, 1);
    const w = logoImg.naturalWidth * scale;
    const h = logoImg.naturalHeight * scale;
    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2 + 10;

    const GState = (doc as any).GState || (jsPDF as any).GState;
    if (GState && typeof (doc as any).saveGraphicsState === "function" && typeof (doc as any).setGState === "function") {
      (doc as any).saveGraphicsState();
      const gState = new GState({ opacity: 0.07 });
      (doc as any).setGState(gState);
      doc.addImage(logoImg, "PNG", x, y, w, h, undefined, "FAST");
      (doc as any).restoreGraphicsState();
    } else {
      doc.addImage(logoImg, "PNG", x, y, w, h, undefined, "FAST");
    }
  } catch (err) {
    console.warn("Watermark draw error:", err);
  }
}

/**
 * 3. Export Data to Branded PDF (.pdf) with Clean White Background,
 * Centered Brand Logo Watermark, Top-Left Logo, Top-Right Report Name,
 * Image Preview Thumbnails, smart column alignment, and adaptive landscape formatting.
 */
export async function exportToPdf<T>(
  data: T[],
  columns: ExportColumn<T>[],
  title: string,
  filename: string,
  options?: ExportOptions,
) {
  if (!data || data.length === 0) return;

  const company = options?.companyName || "Ananta Graphics";
  const prefix = getOrgPrefix(options?.companyName);
  // Default to landscape whenever there are more than 5 columns to eliminate text clipping
  const orientation = options?.orientation || (columns.length > 5 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

  const primaryRgb = hexToRgb(options?.primaryColor || "#C31432");
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const leftMargin = 28;
  const rightMargin = 28;

  // 1. PRELOAD LOGOS: Header Logo vs Main Brand Logo (for Watermark)
  let logoImg: HTMLImageElement | null = null;
  let watermarkImg: HTMLImageElement | null = null;
  if (options?.logoUrl) {
    try {
      logoImg = await loadImageElement(options.logoUrl);
    } catch {}
  }
  if (options?.watermarkLogoUrl) {
    try {
      watermarkImg = await loadImageElement(options.watermarkLogoUrl);
    } catch {}
  } else {
    watermarkImg = logoImg;
  }

  // 2. DRAW CENTERED WATERMARK ON PAGE 1 USING MAIN BRAND LOGO
  drawPageWatermark(doc, watermarkImg);

  // 3. TOP-LEFT: Company Logo (Image) or Brand Text Fallback
  let logoDrawn = false;
  if (logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
    try {
      const maxW = 120;
      const maxH = 38;
      const scale = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight, 1);
      const w = logoImg.naturalWidth * scale;
      const h = logoImg.naturalHeight * scale;
      doc.addImage(logoImg, "PNG", leftMargin, 16, w, h);
      logoDrawn = true;
    } catch {}
  }

  if (!logoDrawn) {
    // Brand Name Fallback
    doc.setFontSize(14);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setFont("helvetica", "bold");
    doc.text(company.toUpperCase(), leftMargin, 34);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("Business Management System", leftMargin, 46);
  }

  // 2. TOP-RIGHT: Report Title & Metadata (Right-Aligned)
  doc.setFontSize(14);
  doc.setTextColor(20, 24, 33);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), pageWidth - rightMargin, 30, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-IN")}  ·  Total Records: ${data.length}`,
    pageWidth - rightMargin,
    44,
    { align: "right" }
  );

  // 3. Preload all cell image thumbnails (e.g. proof images, item photos, company logos)
  const uniqueCellImageUrls = new Set<string>();
  data.forEach((row) => {
    columns.forEach((col) => {
      const url = getRowImageUrl(col, row);
      if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image") || url.startsWith("/media/"))) {
        uniqueCellImageUrls.add(url);
      }
    });
  });

  const cellImageCache = new Map<string, HTMLImageElement>();
  if (uniqueCellImageUrls.size > 0) {
    await Promise.all(
      Array.from(uniqueCellImageUrls).map(async (url) => {
        try {
          const img = await loadImageElement(url);
          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            cellImageCache.set(url, img);
          }
        } catch {}
      }),
    );
  }

  const hasAnyCellImage = cellImageCache.size > 0;

  // 4. Dynamic Font Sizing & Padding based on column count
  const colCount = columns.length;
  const fontSize = colCount > 14 ? 5.5 : colCount > 10 ? 6.5 : colCount > 6 ? 7.5 : 8.5;
  const headFontSize = colCount > 14 ? 6.0 : colCount > 10 ? 7.0 : colCount > 6 ? 8.0 : 8.5;
  const cellPadding = colCount > 14 ? 2.0 : colCount > 10 ? 2.5 : colCount > 6 ? 3.5 : 4.5;

  const headers = columns.map((c) => c.header);
  const body = data.map((row) =>
    columns.map((c) => {
      const imgUrl = getRowImageUrl(c, row);
      if (imgUrl && cellImageCache.has(imgUrl)) {
        return ""; // Leave blank so didDrawCell renders the image thumbnail
      }
      return formatCellValue(c.accessor(row), "-");
    }),
  );

  const columnStyles: Record<number, any> = {};
  columns.forEach((col, idx) => {
    const align = getColumnHalign(col.header);
    const isImageCol = col.imageAccessor !== undefined || col.header.toLowerCase().includes("image") || col.header.toLowerCase().includes("proof") || col.header.toLowerCase().includes("logo") || col.header.toLowerCase().includes("thumbnail");
    columnStyles[idx] = {
      halign: align,
      cellWidth: isImageCol ? (colCount > 10 ? 38 : 46) : undefined,
    };
  });

  // AutoTable
  autoTable(doc, {
    startY: 64,
    head: [headers],
    body: body,
    theme: "striped",
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: headFontSize,
      valign: "middle",
      cellPadding: cellPadding,
      lineColor: primaryRgb,
      lineWidth: 0.5,
    },
    styles: {
      fontSize: fontSize,
      cellPadding: cellPadding,
      overflow: "linebreak",
      textColor: [30, 41, 59],
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      font: "helvetica",
      minCellHeight: hasAnyCellImage ? (colCount > 10 ? 26 : 30) : undefined,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    willDrawPage: () => {
      drawPageWatermark(doc, watermarkImg);
    },
    didParseCell: (hookData) => {
      const colIdx = hookData.column.index;
      const col = columns[colIdx];
      if (col) {
        const align = getColumnHalign(col.header);
        hookData.cell.styles.halign = align;
      }
      // If cell content is empty or '-' style as muted
      if (hookData.section === "body" && (hookData.cell.raw === "-" || hookData.cell.text?.[0] === "-")) {
        hookData.cell.styles.textColor = [148, 163, 184]; // muted grey for dashes
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section === "body") {
        const rowIdx = hookData.row.index;
        const colIdx = hookData.column.index;
        const col = columns[colIdx];
        const rowData = data[rowIdx];
        if (col && rowData) {
          const imgUrl = getRowImageUrl(col, rowData);
          if (imgUrl && cellImageCache.has(imgUrl)) {
            const imgElement = cellImageCache.get(imgUrl)!;
            const cell = hookData.cell;
            const padding = 3;
            const maxW = Math.max(cell.width - padding * 2, 8);
            const maxH = Math.max(cell.height - padding * 2, 8);
            const scale = Math.min(maxW / imgElement.naturalWidth, maxH / imgElement.naturalHeight, 1);
            const w = Math.min(imgElement.naturalWidth * scale, maxW);
            const h = Math.min(imgElement.naturalHeight * scale, maxH);
            const x = cell.x + (cell.width - w) / 2;
            const y = cell.y + (cell.height - h) / 2;

            // Thumbnail container card
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x - 1, y - 1, w + 2, h + 2, 1.5, 1.5, "FD");

            try {
              doc.addImage(imgElement, "JPEG", x, y, w, h, undefined, "FAST");
              // Make image thumbnail clickable to open original high-resolution image
              if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://") || imgUrl.startsWith("blob:") || imgUrl.startsWith("data:")) {
                (doc as any).link(x - 1, y - 1, w + 2, h + 2, { url: imgUrl });
              }
            } catch {}
          }
        }
      }
    },
    margin: { left: leftMargin, right: rightMargin, bottom: 28 },
    didDrawPage: (dataInfo) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${dataInfo.pageNumber} of ${pageCount}  ·  ${company}  ·  Confidential`,
        doc.internal.pageSize.width - rightMargin,
        doc.internal.pageSize.height - 12,
        { align: "right" },
      );
    },
  });

  doc.save(`${prefix}${filename}_${getTimestamp()}.pdf`);
}

/**
 * Universal Dispatcher: Handles exporting in any requested format with company branding.
 */
export async function exportData<T>(
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
    await exportToPdf(data, columns, title, filename, options);
  }
}

import type { AnalyticsReport } from "@/lib/types";

/**
 * 4. Export Analytics Report in Excel, CSV, or PDF
 */
/**
 * 4. Export Analytics Report in Excel, CSV, or PDF
 */
export async function exportAnalyticsReport(
  format: ExportFormat,
  report: AnalyticsReport,
  companyName?: string,
  options?: ExportOptions & { reportType?: "overview" | "clients" | "products" | "pipeline" }
) {
  const company = companyName || options?.companyName || "Ananta Graphics × Meewa Industries";
  const prefix = getOrgPrefix(company);
  const baseCurr = report.base_currency_code || "INR";
  const reportType = options?.reportType || "overview";
  const typeSuffix = reportType === "clients" ? "client_wise" : reportType === "products" ? "product_wise" : "financial_summary";
  const filename = `${prefix}${typeSuffix}_${baseCurr}_${report.date_from}_to_${report.date_to}`;

  if (format === "excel") {
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${typeSuffix.replace("_", " ").toUpperCase()} - ${company}`,
      Author: company,
      Company: company,
    };

    if (reportType === "clients") {
      const clientHeaders = ["Client Name", "Company Name", "Contact Email", "Phone", "Orders Count", `Total Revenue (${baseCurr})`, `Paid Amount (${baseCurr})`, `Pending Due (${baseCurr})`, `Avg Order Value (${baseCurr})`, "Share (%)"];
      const clientRows = (report.top_clients || []).map((c) => [
        c.name,
        c.company_name || "-",
        c.email || "-",
        c.phone || "-",
        c.order_count,
        c.revenue,
        c.paid_revenue ?? "-",
        c.pending_revenue ?? "-",
        c.avg_order_value ?? "-",
        `${c.share_pct}%`,
      ]);
      const wsClient = XLSX.utils.aoa_to_sheet([
        [`CLIENT-WISE PERFORMANCE REPORT (${baseCurr})`],
        [`Organization: ${company}`, `Period: ${report.date_from} to ${report.date_to}`],
        [],
        clientHeaders,
        ...clientRows,
      ]);
      wsClient["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsClient, "Client_Wise_Report");
    } else if (reportType === "products") {
      const prodHeaders = ["Product Name", "Units Sold", "Orders Count", `Total Revenue (${baseCurr})`, `Avg Selling Price (${baseCurr})`, "Revenue Share (%)"];
      const prodRows = (report.top_products || []).map((p) => [
        p.name,
        p.qty,
        p.orders_count ?? "-",
        p.revenue,
        p.avg_price ?? "-",
        `${p.share_pct}%`,
      ]);
      const wsProd = XLSX.utils.aoa_to_sheet([
        [`PRODUCT-WISE SALES & REVENUE REPORT (${baseCurr})`],
        [`Organization: ${company}`, `Period: ${report.date_from} to ${report.date_to}`],
        [],
        prodHeaders,
        ...prodRows,
      ]);
      wsProd["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsProd, "Product_Wise_Report");
    } else {
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
      if (report.top_products && report.top_products.length > 0) {
        const prodHeaders = ["Product Name", "Units Sold", "Orders", `Total Revenue (${baseCurr})`, "Revenue Share (%)"];
        const prodRows = report.top_products.map((p) => [p.name, p.qty, p.orders_count ?? "-", p.revenue, `${p.share_pct}%`]);
        const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
        wsProd["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsProd, "Products_Sales");
      }

      // Sheet 3: Top Clients
      if (report.top_clients && report.top_clients.length > 0) {
        const clientHeaders = ["Client Name", "Company", "Orders", `Total Revenue (${baseCurr})`, `Paid (${baseCurr})`, `Due (${baseCurr})`, "Revenue Share (%)"];
        const clientRows = report.top_clients.map((c) => [c.name, c.company_name || "-", c.order_count, c.revenue, c.paid_revenue ?? "-", c.pending_revenue ?? "-", `${c.share_pct}%`]);
        const wsClient = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]);
        wsClient["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsClient, "Clients_Sales");
      }

      // Sheet 4: Daily Trend
      if (report.trend && report.trend.length > 0) {
        const trendHeaders = ["Date", `Revenue (${baseCurr})`, "Orders Count", `Paid Amount (${baseCurr})`];
        const trendRows = report.trend.map((t) => [t.date, t.revenue, t.orders_count, t.paid]);
        const wsTrend = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
        wsTrend["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsTrend, "Daily_Trend");
      }
    }

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, `${filename}.xlsx`);
    return;
  }

  if (format === "pdf") {
    const isLandscape = reportType === "clients";
    const doc = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 32;
    const rightMargin = 32;
    const primaryRgb = hexToRgb(options?.primaryColor || "#C31432");

    // 1. PRELOAD LOGOS: Header Logo vs Main Brand Logo (for Watermark)
    let logoImg: HTMLImageElement | null = null;
    let watermarkImg: HTMLImageElement | null = null;
    if (options?.logoUrl) {
      try {
        logoImg = await loadImageElement(options.logoUrl);
      } catch {}
    }
    if (options?.watermarkLogoUrl) {
      try {
        watermarkImg = await loadImageElement(options.watermarkLogoUrl);
      } catch {}
    } else {
      watermarkImg = logoImg;
    }

    // 2. DRAW CENTERED WATERMARK ON PAGE 1 USING MAIN BRAND LOGO
    drawPageWatermark(doc, watermarkImg);

    // 3. TOP-LEFT: Company Logo (Image) or Brand Text Fallback
    let logoDrawn = false;
    if (logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
      try {
        const maxW = 120;
        const maxH = 38;
        const scale = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight, 1);
        const w = logoImg.naturalWidth * scale;
        const h = logoImg.naturalHeight * scale;
        doc.addImage(logoImg, "PNG", leftMargin, 16, w, h);
        logoDrawn = true;
      } catch {}
    }

    if (!logoDrawn) {
      doc.setFontSize(13);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.setFont("helvetica", "bold");
      doc.text(company.toUpperCase(), leftMargin, 30);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("Executive Analytics & Reporting", leftMargin, 42);
    }

    // 4. TOP-RIGHT: Report Title & Metadata
    const reportTitleText =
      reportType === "clients"
        ? "CLIENT-WISE SALES & REVENUE REPORT"
        : reportType === "products"
        ? "PRODUCT-WISE SALES & REVENUE REPORT"
        : "FINANCIAL ANALYTICS & EXECUTIVE REPORT";

    doc.setFontSize(13);
    doc.setTextColor(20, 24, 33);
    doc.setFont("helvetica", "bold");
    doc.text(reportTitleText, pageWidth - rightMargin, 28, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Period: ${report.date_from} to ${report.date_to}  ·  Base Currency: ${baseCurr}  ·  Generated: ${new Date().toLocaleDateString("en-IN")}`,
      pageWidth - rightMargin,
      40,
      { align: "right" }
    );

    let startY = 64;

    if (reportType === "clients") {
      // Detailed Client Wise Report Table
      autoTable(doc, {
        startY,
        head: [["#", "Client Name", "Company", "Contact", "Orders", `Total Revenue (${baseCurr})`, `Paid (${baseCurr})`, `Due (${baseCurr})`, `AOV (${baseCurr})`, "Share %"]],
        body: (report.top_clients || []).map((c, i) => [
          String(i + 1),
          c.name,
          c.company_name || "-",
          c.phone || c.email || "-",
          String(c.order_count),
          c.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          (c.paid_revenue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          (c.pending_revenue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          (c.avg_order_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          `${c.share_pct}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 4 },
        columnStyles: {
          0: { halign: "center", cellWidth: 22 },
          1: { fontStyle: "bold" },
          4: { halign: "center" },
          5: { halign: "right", fontStyle: "bold" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
          9: { halign: "right" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: leftMargin, right: rightMargin },
        willDrawPage: () => {
          drawPageWatermark(doc, watermarkImg);
        },
      });
    } else if (reportType === "products") {
      // Detailed Product Wise Report Table
      autoTable(doc, {
        startY,
        head: [["#", "Product Name", "Units Sold", "Orders Count", `Total Revenue (${baseCurr})`, `Avg Selling Price (${baseCurr})`, "Market Share %"]],
        body: (report.top_products || []).map((p, i) => [
          String(i + 1),
          p.name,
          p.qty.toLocaleString("en-IN"),
          String(p.orders_count ?? "-"),
          p.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          (p.avg_price ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          `${p.share_pct}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 4.5 },
        columnStyles: {
          0: { halign: "center", cellWidth: 24 },
          1: { fontStyle: "bold" },
          2: { halign: "right" },
          3: { halign: "center" },
          4: { halign: "right", fontStyle: "bold" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: leftMargin, right: rightMargin },
        willDrawPage: () => {
          drawPageWatermark(doc, watermarkImg);
        },
      });
    } else {
      // Executive Overview Summary
      autoTable(doc, {
        startY,
        head: [["Executive KPI Metric", "Value", "Status & Comparison"]],
        body: [
          ["Total Revenue", `${baseCurr} ${report.kpis.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, `${report.kpis.revenue_growth >= 0 ? "+" : ""}${report.kpis.revenue_growth}% vs previous period`],
          ["Collections (Paid)", `${baseCurr} ${report.kpis.paid_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, `${report.kpis.total_revenue > 0 ? ((report.kpis.paid_revenue / report.kpis.total_revenue) * 100).toFixed(0) : 0}% Collected`],
          ["Outstanding Balance (Due)", `${baseCurr} ${report.kpis.pending_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "Pending Follow-up"],
          ["Total Orders & Volume", `${report.kpis.total_orders} Orders`, `Avg Order Value: ${baseCurr} ${report.kpis.avg_order_value.toLocaleString("en-IN")}`],
          ["Quotation Win Rate", `${report.quotation_funnel?.conversion_rate || 0}%`, `${report.quotation_funnel?.accepted || 0} Won / ${report.quotation_funnel?.sent || 0} Sent Proposals`],
        ],
        theme: "striped",
        headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 5 },
        alternateRowStyles: { fillColor: [253, 248, 247] },
        margin: { left: leftMargin, right: rightMargin },
        willDrawPage: () => {
          drawPageWatermark(doc, watermarkImg);
        },
      });

      // Top Products Summary
      if (report.top_products && report.top_products.length > 0) {
        const finalY = (doc as any).lastAutoTable?.finalY || 200;
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Top Products by Revenue", leftMargin, finalY + 22);

        autoTable(doc, {
          startY: finalY + 28,
          head: [["Product Name", "Units Sold", `Revenue (${baseCurr})`, "Share %"]],
          body: report.top_products.slice(0, 10).map((p) => [
            p.name,
            p.qty.toLocaleString("en-IN"),
            p.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            `${p.share_pct}%`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3.5 },
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right", fontStyle: "bold" },
            3: { halign: "right" },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: leftMargin, right: rightMargin },
          willDrawPage: () => {
            drawPageWatermark(doc, watermarkImg);
          },
        });
      }

      // Top Clients Summary
      if (report.top_clients && report.top_clients.length > 0) {
        const finalY2 = (doc as any).lastAutoTable?.finalY || 350;
        let clientStartY = finalY2 + 22;
        if (finalY2 > pageHeight - 160) {
          doc.addPage();
          drawPageWatermark(doc, watermarkImg);
          clientStartY = 45;
        }

        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Top Client Accounts", leftMargin, clientStartY);

        autoTable(doc, {
          startY: clientStartY + 6,
          head: [["Client Name", "Orders Count", `Revenue (${baseCurr})`, "Share %"]],
          body: report.top_clients.slice(0, 10).map((c) => [
            c.name,
            String(c.order_count),
            c.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
            `${c.share_pct}%`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3.5 },
          columnStyles: {
            1: { halign: "center" },
            2: { halign: "right", fontStyle: "bold" },
            3: { halign: "right" },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: leftMargin, right: rightMargin },
          willDrawPage: () => {
            drawPageWatermark(doc, watermarkImg);
          },
        });
      }
    }

    // Page numbering & footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages}  ·  ${company}`, pageWidth - rightMargin, pageHeight - 16, {
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
