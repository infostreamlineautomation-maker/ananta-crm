/**
 * Universal CSV Export utility for CRM tables and reports.
 * Formats arrays of objects with custom column mappings and triggers download.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

export function exportToCsv<T>(data: T[], columns: CsvColumn<T>[], filename: string) {
  if (!data || data.length === 0) return;

  const headerRow = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = c.accessor(row);
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(","),
  );

  // Add UTF-8 BOM so Excel opens with proper accents and currency symbols
  const csvContent = "\ufeff" + [headerRow, ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
