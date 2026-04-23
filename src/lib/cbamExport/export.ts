import type ExcelJS from "exceljs";
import { bindings, type Binding, type FieldBinding, type TableBinding } from "./map";
import { countries } from "@/lib/codeLists";
import { CBAM_ANSWERS_KEY, readAnswers } from "@/lib/storage";

const TEMPLATE_URL = "/cbam-template.xlsx";

/**
 * Load the template, fill every binding from the stored answers, and trigger a
 * download. All work happens in the browser; no data leaves the device.
 */
export async function exportCbamFilled(): Promise<void> {
  const [ExcelJSMod, FileSaverMod] = await Promise.all([
    import("exceljs"),
    import("file-saver"),
  ]);
  const Workbook = (ExcelJSMod as any).Workbook ?? (ExcelJSMod as any).default?.Workbook;
  const saveAs =
    (FileSaverMod as any).saveAs ??
    (FileSaverMod as any).default?.saveAs ??
    (FileSaverMod as any).default;
  if (typeof Workbook !== "function") throw new Error("exceljs Workbook not found");
  if (typeof saveAs !== "function") throw new Error("file-saver saveAs not found");

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Failed to load template: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  const wb = new Workbook();
  await wb.xlsx.load(buffer);

  const answers = readAnswers(CBAM_ANSWERS_KEY);

  for (const b of bindings) {
    try {
      applyBinding(wb, b, answers);
    } catch (err) {
      // Never fail the whole export because one binding missed; surface to console.
      console.warn("[cbam-export] binding failed", b, err);
    }
  }

  const out = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([out]), `CBAM-Communication-${stamp}.xlsx`);
}

type Answers = ReturnType<typeof readAnswers>;

function applyBinding(wb: ExcelJS.Workbook, b: Binding, answers: Answers): void {
  if (b.kind === "field") return applyField(wb, b, answers);
  return applyTable(wb, b, answers);
}

function applyField(wb: ExcelJS.Workbook, b: FieldBinding, answers: Answers): void {
  const a = answers[b.questionId];
  if (!a) return;
  const raw = (a.values as Record<string, unknown>)[b.fieldId];
  if (raw === undefined || raw === null || raw === "") return;
  const sheet = wb.getWorksheet(b.sheet);
  if (!sheet) return;
  sheet.getCell(b.cell).value = coerce(raw, b.transform);
}

function applyTable(wb: ExcelJS.Workbook, b: TableBinding, answers: Answers): void {
  const a = answers[b.questionId];
  if (!a) return;
  const rows = (a.rows as Record<string, unknown>[]) ?? [];
  const sheet = wb.getWorksheet(b.sheet);
  if (!sheet) return;

  rows.slice(0, b.maxRows).forEach((row, i) => {
    for (const [fieldId, bind] of Object.entries(b.columns)) {
      const v = row[fieldId];
      if (v === undefined || v === null || v === "") continue;
      const rowNum = b.anchorRow + i * b.rowStride + (bind.offset ?? 0);
      const cell = sheet.getCell(`${bind.col}${rowNum}`);
      cell.value = coerce(v, bind.transform);
    }
  });
}

function coerce(v: unknown, transform?: FieldBinding["transform"]): ExcelJS.CellValue {
  switch (transform) {
    case "dateFromIso":
      if (typeof v === "string" && v) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? v : d;
      }
      return v as ExcelJS.CellValue;
    case "yesNoFromBool":
      return v ? "Yes" : "No";
    case "pct100to1":
      return typeof v === "number" ? v / 100 : (v as ExcelJS.CellValue);
    case "cnCodeOnly":
      if (typeof v === "string") {
        const m = v.match(/^\s*(\d[\d\s]*)/);
        return m ? m[1].replace(/\s+/g, "") : v;
      }
      return v as ExcelJS.CellValue;
    case "countryCodeFromName": {
      if (typeof v !== "string") return v as ExcelJS.CellValue;
      const hit = countries.find((c) => c.name === v || c.code === v);
      return hit ? hit.code : v;
    }
    default:
      return v as ExcelJS.CellValue;
  }
}
