import * as XLSX from "xlsx";
import { MOCK_DOCUMENTS } from "../lib/mock";
import type { WorkRecord } from "../lib/types";

export class ExportImportService {
  private static buildTableHtml(
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    subtitle?: string,
  ) {
    const head = headers
      .map((header) => `<th>${ExportImportService.escapeHtml(header)}</th>`)
      .join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${ExportImportService.escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`,
      )
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${ExportImportService.escapeHtml(title)}</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; padding: 28px; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      p { margin: 0 0 18px; color: #475569; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #e2e8f0; font-weight: 700; }
      tr:nth-child(even) td { background: #f8fafc; }
    </style>
  </head>
  <body>
    <h1>${ExportImportService.escapeHtml(title)}</h1>
    ${subtitle ? `<p>${ExportImportService.escapeHtml(subtitle)}</p>` : ""}
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
  }

  private static escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private static getDaysTaken(record: WorkRecord): number | "" {
    if (record.daysTaken != null) {
      return record.daysTaken;
    }

    if (record.date && record.closingDate) {
      const start = new Date(record.date).getTime();
      const end = new Date(record.closingDate).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        return Math.round((end - start) / (1000 * 60 * 60 * 24));
      }
    }

    return "";
  }

  // ─── Work Records ─────────────────────────────────────────────────────────

  static exportWorkRecordsCSV(records: WorkRecord[]): Blob {
    const headers = [
      "ID",
      "Description",
      "Category",
      "Type",
      "Status",
      "Start Date",
      "Closing Date",
      "Days Taken",
      "PL Number",
      "eOffice Case",
      "Target Days",
      "Assignee",
      "Verified By",
      "Remarks",
    ];
    const rows = records.map((r) => [
      r.id,
      r.description,
      r.workCategory,
      r.workType,
      r.status,
      r.date,
      r.closingDate || r.completionDate || "",
      ExportImportService.getDaysTaken(r),
      r.plNumber || "",
      r.eOfficeNumber || "",
      r.targetDays ?? "",
      r.userName,
      r.verifiedBy || "",
      r.remarks || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  }

  static exportWorkRecordsExcel(records: WorkRecord[]) {
    const headers = [
      "ID",
      "Description",
      "Category",
      "Type",
      "Status",
      "Start Date",
      "Closing Date",
      "Days Taken",
      "PL Number",
      "eOffice Case",
      "Target Days",
      "Assignee",
      "Verified By",
      "Remarks",
    ];
    const rows = records.map((r) => [
      r.id,
      r.description,
      r.workCategory,
      r.workType,
      r.status,
      r.date,
      r.closingDate || r.completionDate || "",
      ExportImportService.getDaysTaken(r),
      r.plNumber || "",
      r.eOfficeNumber || "",
      r.targetDays ?? "",
      r.userName,
      r.verifiedBy || "",
      r.remarks || "",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((_, i) => ({ wch: i === 1 ? 40 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Work Records");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `work-records-${date}.xlsx`);
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  static exportDocumentsCSV(): Blob {
    const headers = [
      "ID",
      "Name",
      "Type",
      "Status",
      "Revision",
      "Size",
      "OCR Status",
      "OCR Confidence",
    ];
    const rows = MOCK_DOCUMENTS.map((d) => [
      d.id,
      d.name,
      d.type,
      d.status,
      d.revision,
      d.size,
      d.ocrStatus || "Pending",
      d.ocrConfidence ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  }

  static exportDocumentsExcel() {
    const headers = [
      "ID",
      "Name",
      "Type",
      "Status",
      "Revision",
      "Size",
      "OCR Status",
      "OCR Confidence",
    ];
    const rows = MOCK_DOCUMENTS.map((d) => [
      d.id,
      d.name,
      d.type,
      d.status,
      d.revision,
      d.size,
      d.ocrStatus || "Pending",
      d.ocrConfidence ?? "",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((_, i) => ({ wch: i === 1 ? 45 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `documents-${date}.xlsx`);
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  static async parseCSVFile(file: File): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            defval: "",
          });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  static mapRowToWorkRecord(
    row: Record<string, string>,
    userId: string,
    userName: string,
  ): Partial<WorkRecord> {
    const startDate =
      row["Start Date"] || row.Date || row.date || new Date().toISOString().split("T")[0];
    const closingDate = row["Closing Date"] || row.closingDate || "";
    const parsedDays = Number(row["Days Taken"] || row.daysTaken || "");

    return {
      description: row.Description || row.description || "",
      workCategory: (row.Category || row.category || "GENERAL") as WorkRecord["workCategory"],
      workType: row.Type || row.type || "",
      status: (row.Status || row.status || "OPEN") as WorkRecord["status"],
      date: startDate,
      closingDate: closingDate || undefined,
      completionDate: closingDate || undefined,
      plNumber: row["PL Number"] || row.plNumber || "",
      eOfficeNumber: row["eOffice Case"] || row.eOfficeNumber || "",
      daysTaken: Number.isFinite(parsedDays) ? parsedDays : undefined,
      targetDays: Number(row["Target Days"] || row.targetDays || "") || undefined,
      remarks: row.Remarks || row.remarks || "",
      userId,
      userName,
    };
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  static downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  static downloadWorkRecordsCSV(records: WorkRecord[]) {
    const date = new Date().toISOString().split("T")[0];
    ExportImportService.downloadBlob(
      ExportImportService.exportWorkRecordsCSV(records),
      `work-records-${date}.csv`,
    );
  }

  static downloadDocumentsCSV() {
    const date = new Date().toISOString().split("T")[0];
    ExportImportService.downloadBlob(
      ExportImportService.exportDocumentsCSV(),
      `documents-${date}.csv`,
    );
  }

  static exportGenericTableExcel(
    sheetName: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    filenamePrefix: string,
  ) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((header) => ({
      wch: Math.max(16, Math.min(42, header.length + 8)),
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Report");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
  }

  static downloadGenericTableCSV(
    headers: string[],
    rows: Array<Array<string | number>>,
    filenamePrefix: string,
  ) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const date = new Date().toISOString().split("T")[0];
    ExportImportService.downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `${filenamePrefix}-${date}.csv`,
    );
  }

  static exportGenericTableJson(
    headers: string[],
    rows: Array<Array<string | number>>,
    filenamePrefix: string,
  ) {
    const payload = rows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    );
    const date = new Date().toISOString().split("T")[0];
    ExportImportService.downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" }),
      `${filenamePrefix}-${date}.json`,
    );
  }

  static exportGenericTableWord(
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    filenamePrefix: string,
    subtitle?: string,
  ) {
    const html = ExportImportService.buildTableHtml(title, headers, rows, subtitle);
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const date = new Date().toISOString().split("T")[0];
    ExportImportService.downloadBlob(blob, `${filenamePrefix}-${date}.doc`);
  }

  static exportGenericTablePdf(
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    subtitle?: string,
  ) {
    const html = ExportImportService.buildTableHtml(title, headers, rows, subtitle);
    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  static getImportTemplate(): Blob {
    const headers = [
      "Description",
      "Category",
      "Type",
      "Status",
      "Start Date",
      "Closing Date",
      "PL Number",
      "eOffice Case",
      "Days Taken",
      "Remarks",
    ];
    const example = [
      "Replace traction motor brush gear",
      "GENERAL",
      "Scheduled PM",
      "SUBMITTED",
      new Date().toISOString().split("T")[0],
      new Date().toISOString().split("T")[0],
      "PL-2026-001",
      "EOC-2026-001",
      "0",
      "Routine maintenance",
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
}
