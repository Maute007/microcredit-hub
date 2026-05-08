import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export type CellValue = string | number | boolean | null | undefined;

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => CellValue;
  /** Largura da coluna em "characters" (Excel) e em pontos (PDF). */
  width?: number;
  /** Alinhamento na célula (PDF). */
  align?: "left" | "center" | "right";
  /** Formatador de string usado APENAS no PDF (no Excel mantemos número/data nativos). */
  pdfFormatter?: (value: CellValue) => string;
}

export interface ExportMeta {
  /** Título principal mostrado no topo do PDF e na primeira linha do Excel. */
  title: string;
  /** Subtítulo opcional (ex: período do relatório). */
  subtitle?: string;
  /** Nome da empresa/sistema (canto superior direito do PDF). */
  brand?: string;
  /** Linhas resumo opcionais ("KPI: valor") exibidas antes da tabela. */
  summary?: Array<{ label: string; value: string }>;
}

const today = () => new Date().toISOString().slice(0, 10);

function fileName(base: string, ext: string) {
  const safe = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe}-${today()}.${ext}`;
}

/* ============================================================
 * EXCEL (.xlsx) — usa SheetJS
 * ============================================================ */

export function exportToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ExportMeta,
): void {
  const wb = XLSX.utils.book_new();

  // Cabeçalho com título, subtítulo e resumo antes da tabela
  const headerRows: CellValue[][] = [];
  headerRows.push([meta.title]);
  if (meta.subtitle) headerRows.push([meta.subtitle]);
  if (meta.brand) headerRows.push([`Sistema: ${meta.brand}`]);
  headerRows.push([`Gerado em: ${new Date().toLocaleString("pt-PT")}`]);
  headerRows.push([]);
  if (meta.summary && meta.summary.length > 0) {
    meta.summary.forEach((s) => headerRows.push([s.label, s.value]));
    headerRows.push([]);
  }

  const tableHeader = columns.map((c) => c.header);
  const tableRows: CellValue[][] = rows.map((row) =>
    columns.map((c) => {
      const v = c.accessor(row);
      // Mantém number/boolean nativos para o Excel; null/undefined → ""
      if (v == null) return "";
      return v;
    }),
  );

  const aoa: CellValue[][] = [...headerRows, tableHeader, ...tableRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largura das colunas baseada no `width` ou no maior conteúdo
  ws["!cols"] = columns.map((c, idx) => {
    if (c.width) return { wch: c.width };
    const headerLen = c.header.length;
    const maxRowLen = tableRows.reduce((max, r) => {
      const cell = r[idx];
      return Math.max(max, String(cell ?? "").length);
    }, 0);
    return { wch: Math.min(Math.max(headerLen, maxRowLen) + 2, 40) };
  });

  // Mescla a célula do título no comprimento da tabela
  const lastCol = columns.length - 1;
  ws["!merges"] = ws["!merges"] || [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
  if (meta.subtitle) ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });

  // Estilos básicos para o título (negrito é só lido por Excel desktop, mas não faz mal)
  const titleCell = ws["A1"];
  if (titleCell) titleCell.s = { font: { bold: true, sz: 14 } };

  XLSX.utils.book_append_sheet(wb, ws, meta.title.slice(0, 28) || "Relatório");

  XLSX.writeFile(wb, fileName(meta.title, "xlsx"), {
    bookType: "xlsx",
    compression: true,
  });
}

/* ============================================================
 * PDF — usa jsPDF + jspdf-autotable
 * ============================================================ */

export function exportToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ExportMeta,
  options?: { orientation?: "portrait" | "landscape" },
): void {
  const orientation =
    options?.orientation ?? (columns.length > 6 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(meta.title, margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  if (meta.brand) {
    doc.text(meta.brand, pageWidth - margin, 40, { align: "right" });
  }
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-PT")}`,
    pageWidth - margin,
    52,
    { align: "right" },
  );

  let cursorY = 70;
  if (meta.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(meta.subtitle, margin, cursorY);
    cursorY += 16;
  }

  // Linha divisória
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 12;

  // Resumo / KPIs
  if (meta.summary && meta.summary.length > 0) {
    doc.setFontSize(9);
    const colW = (pageWidth - margin * 2) / Math.min(meta.summary.length, 4);
    meta.summary.forEach((kpi, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = margin + col * colW;
      const y = cursorY + row * 28;
      doc.setTextColor(140, 140, 140);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label.toUpperCase(), x, y);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(kpi.value, x, y + 12);
      doc.setFontSize(9);
    });
    cursorY +=
      28 * Math.ceil(meta.summary.length / 4) + 8;
  }

  // Tabela
  const head: RowInput[] = [columns.map((c) => c.header)];
  const body: RowInput[] = rows.map((row) =>
    columns.map((c) => {
      const raw = c.accessor(row);
      if (c.pdfFormatter) return c.pdfFormatter(raw);
      if (raw == null) return "";
      if (typeof raw === "number") {
        return Number.isInteger(raw)
          ? raw.toLocaleString("pt-PT")
          : raw.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(raw);
    }),
  );

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      overflow: "linebreak",
      lineColor: [230, 230, 230],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: columns.reduce(
      (acc, col, idx) => {
        acc[idx] = {
          halign: col.align ?? "left",
          ...(col.width ? { cellWidth: col.width } : {}),
        };
        return acc;
      },
      {} as Record<number, { halign: "left" | "center" | "right"; cellWidth?: number }>,
    ),
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const current = data.pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Página ${current} de ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" },
      );
      doc.text(
        meta.title,
        margin,
        doc.internal.pageSize.getHeight() - 16,
      );
    },
  });

  doc.save(fileName(meta.title, "pdf"));
}

/* ============================================================
 * CSV — fallback simples, mantido por compatibilidade
 * ============================================================ */

function escapeCsv(val: CellValue): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ExportMeta,
): void {
  const header = columns.map((c) => c.header).map(escapeCsv).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(c.accessor(row))).join(","),
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(meta.title, "csv");
  a.click();
  URL.revokeObjectURL(url);
}
