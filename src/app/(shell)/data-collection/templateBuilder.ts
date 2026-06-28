// Client-side Excel template generation for the Data Collection → Excel Upload page.
//
// Builds the standardized "Plant Input Sheet" (a faithful copy of the master ESG
// workbook's per-site monthly input structure) and a placeholder "HR Data" sheet,
// then triggers a browser download. exceljs runs in the browser; we import it
// dynamically so it stays out of the initial bundle.

import { PLANT_TEMPLATE_ROWS } from "./plantTemplate";

// April→March financial-year ordering, matching the master workbook columns.
const FY_MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
] as const;

// Palette aligned with the app's brand (deep green) so the file looks on-brand.
const BRAND = "FF1F5F4E"; // header fill
const SECTION = "FF2E7D6B"; // section band
const SUBHEAD = "FFE8F1EE"; // sub-header tint
const HEADER_TXT = "FFFFFFFF";
const BORDER = "FFD9D9D9";

const thin = { style: "thin" as const, color: { argb: BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface TemplateMeta {
  site: string;
  month: string;
  year: number;
}

/**
 * Build the standardized Plant Input Sheet workbook and download it.
 * The structure (sections, sub-headers, S.No, Parameter, Units + 12 monthly
 * columns) is generated from PLANT_TEMPLATE_ROWS so it stays faithful to the
 * master ESG workbook and identical across all 7 sites.
 */
export async function downloadPlantInputTemplate(meta: TemplateMeta) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plato ESG";
  wb.created = new Date();

  const ws = wb.addWorksheet("Plant Input Sheet", {
    views: [{ state: "frozen", ySplit: 6, xSplit: 3 }],
  });

  // Column widths: S.No, Parameter, Units, then 12 months + FY total.
  ws.columns = [
    { width: 8 },
    { width: 52 },
    { width: 14 },
    ...FY_MONTHS.map(() => ({ width: 11 })),
    { width: 12 },
  ];

  const lastCol = 3 + FY_MONTHS.length + 1; // S.No..Units + 12 months + FY total
  const colLetter = (n: number) => ws.getColumn(n).letter;

  // ── Title banner ──────────────────────────────────────────────────────────
  const titleRow = ws.addRow([`PLANT INPUT SHEET — ${meta.site.toUpperCase()}`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, lastCol);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 14, color: { argb: HEADER_TXT } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleRow.height = 26;

  const metaRow = ws.addRow([
    `Reporting Period: ${meta.month} ${meta.year}   •   Financial Year: ${meta.year}-${(meta.year + 1)
      .toString()
      .slice(-2)}`,
  ]);
  ws.mergeCells(metaRow.number, 1, metaRow.number, lastCol);
  metaRow.getCell(1).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  metaRow.getCell(1).alignment = { indent: 1 };

  ws.addRow([]); // spacer

  // ── Column header row (repeats conceptually under each section) ────────────
  const headerLabels = ["S.No", "Parameter", "Units", ...FY_MONTHS, "FY Total"];
  const writeHeader = () => {
    const hr = ws.addRow(headerLabels);
    hr.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: HEADER_TXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = allBorders;
    });
    hr.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    hr.height = 22;
    return hr;
  };

  // Top header once; section bands re-announce columns visually.
  writeHeader();

  for (const row of PLANT_TEMPLATE_ROWS) {
    if (row.k === "s") {
      const sr = ws.addRow([row.t]);
      ws.mergeCells(sr.number, 1, sr.number, lastCol);
      const c = sr.getCell(1);
      c.font = { bold: true, size: 11, color: { argb: HEADER_TXT } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      sr.height = 20;
    } else if (row.k === "h") {
      const hr = ws.addRow([row.n, row.t]);
      ws.mergeCells(hr.number, 2, hr.number, lastCol);
      hr.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD } };
        cell.font = { bold: true, size: 10, color: { argb: "FF1F5F4E" } };
      });
      hr.getCell(2).alignment = { indent: 1 };
    } else {
      // data row — S.No, Parameter, Units, then 12 empty month cells (inputs).
      const dr = ws.addRow([row.n, row.t, row.u]);
      dr.getCell(1).alignment = { horizontal: "center" };
      dr.getCell(1).font = { size: 9, color: { argb: "FF888888" } };
      dr.getCell(2).alignment = { wrapText: true, vertical: "top" };
      dr.getCell(2).font = { size: 10 };
      dr.getCell(3).alignment = { horizontal: "center", vertical: "top" };
      dr.getCell(3).font = { size: 9, color: { argb: "FF555555" } };

      // Input cells for the 12 months get a light border + number format.
      for (let i = 0; i < FY_MONTHS.length; i++) {
        const cell = dr.getCell(4 + i);
        cell.border = allBorders;
        cell.numFmt = "#,##0.###;(#,##0.###);-";
      }
      // FY total formula across the 12 month columns.
      const first = colLetter(4);
      const last = colLetter(3 + FY_MONTHS.length);
      const totalCell = dr.getCell(lastCol);
      totalCell.value = { formula: `SUM(${first}${dr.number}:${last}${dr.number})` };
      totalCell.numFmt = "#,##0.###;(#,##0.###);-";
      totalCell.font = { size: 10, color: { argb: "FF555555" } };
      totalCell.border = allBorders;
    }
  }

  // Autofilter over the header row range for convenience.
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } };

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    buf as ArrayBuffer,
    `Plant Input Sheet - ${meta.site} - ${meta.month} ${meta.year}.xlsx`,
  );
}

// HR Data rows are TBD — the master ESG workbook has no social/HR sheet, so this
// is a standardized stub (S.No · Parameter · Units · 12 monthly columns) ready
// to be populated once the exact HR fields are provided. Keeping the same column
// shape as the plant sheet means populating it later is a drop-in change.
export async function downloadHrDataTemplate(meta: TemplateMeta) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plato ESG";
  wb.created = new Date();

  const ws = wb.addWorksheet("HR Data", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 3 }],
  });
  ws.columns = [
    { width: 8 },
    { width: 52 },
    { width: 14 },
    ...FY_MONTHS.map(() => ({ width: 11 })),
  ];
  const lastCol = 3 + FY_MONTHS.length;

  const titleRow = ws.addRow([`HR DATA — ${meta.site.toUpperCase()}`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, lastCol);
  const tc = titleRow.getCell(1);
  tc.font = { bold: true, size: 14, color: { argb: HEADER_TXT } };
  tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  tc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleRow.height = 26;

  const metaRow = ws.addRow([`Reporting Period: ${meta.month} ${meta.year}`]);
  ws.mergeCells(metaRow.number, 1, metaRow.number, lastCol);
  metaRow.getCell(1).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  metaRow.getCell(1).alignment = { indent: 1 };

  ws.addRow([]);

  const headerLabels = ["S.No", "Parameter", "Units", ...FY_MONTHS];
  const hr = ws.addRow(headerLabels);
  hr.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: HEADER_TXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = allBorders;
  });
  hr.getCell(2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  hr.height = 22;

  // A few empty input rows so the sheet is usable before the field list is final.
  for (let i = 0; i < 20; i++) {
    const dr = ws.addRow([i + 1]);
    dr.getCell(1).alignment = { horizontal: "center" };
    dr.getCell(1).font = { size: 9, color: { argb: "FF888888" } };
    for (let c = 2; c <= lastCol; c++) dr.getCell(c).border = allBorders;
  }

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(buf as ArrayBuffer, `HR Data - ${meta.site} - ${meta.month} ${meta.year}.xlsx`);
}
