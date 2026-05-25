import type ExcelJS from "exceljs";
import { bindings, type Binding, type FieldBinding, type TableBinding } from "./map";
import { countries } from "@/lib/codeLists";
import { CBAM_ANSWERS_KEY, readAnswers } from "@/lib/storage";
import { CBAM_SEED } from "@/lib/cbamSeed";
import { calculatedValues } from "@/lib/cbamSOT";

const TEMPLATE_URL = "/cbam-template.xlsx";

export type ExportPeriod =
  | { kind: "annual"; year: number }
  | { kind: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 };

function quarterRange(p: { year: number; quarter: 1 | 2 | 3 | 4 }) {
  const startMonth = (p.quarter - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(p.year, startMonth, 1));
  const end = new Date(Date.UTC(p.year, startMonth + 3, 0)); // last day of last month
  return { start, end };
}

function periodLabel(p: ExportPeriod): string {
  if (p.kind === "annual") return `Annual-${p.year}`;
  return `Q${p.quarter}-${p.year}`;
}

/**
 * Load the template, fill every binding from the stored answers, and trigger a
 * download. All work happens in the browser; no data leaves the device.
 *
 * When `period` is provided, the reporting-period cells in A_InstData (I9
 * start, L9 end) are stamped accordingly and the filename includes the period.
 */
export async function exportCbamFilled(period?: ExportPeriod): Promise<void> {
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
  // Backfill any cell the user's saved state is missing with the SOT
  // calculated values and the demo seed. The in-app hydration logic should
  // already populate these on first open, but if the user's localStorage
  // is stale (e.g. an earlier seed version stamped before we added the
  // A.5 supplier column, or a partially-saved state from before the
  // SOT-prefill effect persisted), the export will still produce a
  // correctly-populated workbook. User edits take priority — backfill only
  // touches cells that are null/undefined/"".
  backfillFromSOT(answers);
  backfillFromSeed(answers);

  for (const b of bindings) {
    try {
      applyBinding(wb, b, answers);
    } catch (err) {
      // Never fail the whole export because one binding missed; surface to console.
      console.warn("[cbam-export] binding failed", b, err);
    }
  }

  // A.4 "Relevant production processes" (section 4b at A_InstData rows 83-92).
  // The EU template requires this little table to be filled for D_Processes to
  // resolve good/route/units in its 10 production-process blocks — without
  // entries here, every value we wrote under D.1 lands in cells the template
  // can't pick up because the upstream G11/L11/H16 formulas all return blank.
  //
  // The table isn't surfaced in our UI as its own question (production-process
  // *name* and *included goods* are implied by D.1 + summary.1), so we derive
  // it at export time:
  //   • E83+i  = D.1.row[i].good                (aggregated goods category)
  //   • F83+i  = D.1.row[i].good                (included goods — same as E
  //                                             for non-bubble processes)
  //   • L83+i  = first summary.1 row's `process` whose `good` matches D.1
  //             row[i].good (i.e. the human-readable production-process name)
  applyA4ProductionProcesses(wb, answers);

  // D.1 internal consumption block (section (c) on D_Processes). Each
  // block lists the *other* production processes (not the current one)
  // and the amount of the current process's output consumed by each.
  // The cell row in section (c) is position-based, so the meaning of
  // "row 1 / row 2" depends on which block we're in:
  //   • P1 block — L32=consumedP2, L33=consumedP3
  //   • P2 block — L97=consumedP1, L98=consumedP3
  //   • P3 block — L162=consumedP1, L163=consumedP2
  applyD1InternalConsumption(wb, answers);

  // Period override — stamp the reporting period cells if the caller picked a
  // period explicitly via the export dialog. Overrides any A.1 entries.
  if (period) {
    const sheet = wb.getWorksheet("A_InstData");
    if (sheet) {
      let start: Date;
      let end: Date;
      if (period.kind === "annual") {
        start = new Date(Date.UTC(period.year, 0, 1));
        end = new Date(Date.UTC(period.year, 11, 31));
      } else {
        ({ start, end } = quarterRange(period));
      }
      sheet.getCell("I9").value = start;
      sheet.getCell("L9").value = end;
    }
  }

  const out = await wb.xlsx.writeBuffer();
  const stamp = period ? periodLabel(period) : new Date().toISOString().slice(0, 10);
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
      if (bind.readOnly) continue; // seed-only column; template computes the cell.
      const v = row[fieldId];
      if (v === undefined || v === null || v === "") continue;
      const rowNum = b.anchorRow + i * b.rowStride + (bind.offset ?? 0);
      const cell = sheet.getCell(`${bind.col}${rowNum}`);
      cell.value = coerce(v, bind.transform);
    }
  });
}

type MutableAnswerCell = { values: Record<string, unknown>; rows: Record<string, unknown>[]; status: string };

function ensureMutable(answers: Answers, qid: string): MutableAnswerCell {
  const store = answers as unknown as Record<string, MutableAnswerCell>;
  if (!store[qid]) store[qid] = { values: {}, rows: [], status: "in-progress" };
  if (!store[qid].values) store[qid].values = {};
  if (!store[qid].rows) store[qid].rows = [];
  return store[qid];
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function backfillFromSOT(answers: Answers): void {
  for (const cv of calculatedValues) {
    for (const t of cv.targets) {
      const a = ensureMutable(answers, t.questionId);
      if (t.rowIndex === undefined) {
        if (isEmpty(a.values[t.fieldId])) a.values[t.fieldId] = cv.value;
      } else {
        while (a.rows.length <= t.rowIndex) a.rows.push({});
        if (isEmpty(a.rows[t.rowIndex][t.fieldId])) a.rows[t.rowIndex][t.fieldId] = cv.value;
      }
    }
  }
}

function backfillFromSeed(answers: Answers): void {
  for (const [qid, entry] of Object.entries(CBAM_SEED)) {
    const a = ensureMutable(answers, qid);
    if (entry.values) {
      for (const [fid, v] of Object.entries(entry.values)) {
        if (isEmpty(a.values[fid])) a.values[fid] = v;
      }
    }
    if (entry.rows) {
      for (let i = 0; i < entry.rows.length; i++) {
        while (a.rows.length <= i) a.rows.push({});
        for (const [fid, v] of Object.entries(entry.rows[i])) {
          if (isEmpty(a.rows[i][fid])) a.rows[i][fid] = v;
        }
      }
    }
  }
}

function applyD1InternalConsumption(wb: ExcelJS.Workbook, answers: Answers): void {
  const d1 = answers["D.1"];
  if (!d1 || !d1.rows || d1.rows.length === 0) return;
  const sheet = wb.getWorksheet("D_Processes");
  if (!sheet) return;

  // For each row i (process P{i+1}), the "other" processes (in section c)
  // are everyone EXCEPT P{i+1}, listed in increasing index order. So:
  //   D.1 row i, "other" position j → target process index =
  //     j-th element of [0..n-1] excluding i.
  // Block anchor for row i is 15 + 65*i; section (c) starts at offset 17
  // (L{32 + 65*i}). The j-th "other" cell is L{32 + 65*i + j}.
  const rows = d1.rows as Record<string, unknown>[];
  const n = rows.length;
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    if (!r) continue;
    const blockAnchor = 15 + 65 * i;
    // Build the list of target process indices for the "other" rows.
    const targets: number[] = [];
    for (let t = 0; t < n; t++) if (t !== i) targets.push(t);
    targets.forEach((targetIdx, otherPos) => {
      // Semantic field id: consumedP{targetIdx+1}
      const fid = `consumedP${targetIdx + 1}`;
      const v = r[fid];
      if (v === undefined || v === null || v === "") return;
      const rowNum = blockAnchor + 17 + otherPos; // L32, L33, ... for block 0
      sheet.getCell(`L${rowNum}`).value = typeof v === "number" ? v : Number(v);
    });
  }
}

function applyA4ProductionProcesses(wb: ExcelJS.Workbook, answers: Answers): void {
  const d1 = answers["D.1"];
  if (!d1 || !d1.rows || d1.rows.length === 0) return;
  const sheet = wb.getWorksheet("A_InstData");
  if (!sheet) return;
  const summary = answers["summary.1"];
  const summaryRows = (summary?.rows as Record<string, unknown>[] | undefined) ?? [];

  // Build a good → first matching process-name map from the summary, walking
  // in row order so the first occurrence wins (matches the EU template's
  // "first hit" semantics for the dropdown lookup).
  const processByGood = new Map<string, string>();
  for (const r of summaryRows) {
    const g = typeof r.good === "string" ? r.good : "";
    const p = typeof r.process === "string" ? r.process : "";
    if (g && p && !processByGood.has(g)) processByGood.set(g, p);
  }
  // When two D.1 rows share the same good (e.g. P2 FRP and P3 Extrusion both
  // = "Aluminium products"), the first-match map alone collapses them — so
  // track which process names we've already used and pick the next summary
  // hit for the same good on a repeat.
  const allProcessesByGood = new Map<string, string[]>();
  for (const r of summaryRows) {
    const g = typeof r.good === "string" ? r.good : "";
    const p = typeof r.process === "string" ? r.process : "";
    if (!g || !p) continue;
    const list = allProcessesByGood.get(g) ?? [];
    if (!list.includes(p)) list.push(p);
    allProcessesByGood.set(g, list);
  }
  const usedByGood = new Map<string, number>();

  const rows = d1.rows as Record<string, unknown>[];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    const good = typeof r.good === "string" ? r.good : "";
    if (!good) continue;
    const rowNum = 83 + i;
    sheet.getCell(`E${rowNum}`).value = good;
    sheet.getCell(`F${rowNum}`).value = good;
    const list = allProcessesByGood.get(good) ?? [];
    const used = usedByGood.get(good) ?? 0;
    const processName = list[used] ?? processByGood.get(good) ?? good;
    usedByGood.set(good, used + 1);
    sheet.getCell(`L${rowNum}`).value = processName;
  }
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
    case "boolRaw":
      // Some EU-template cells (e.g. D_Processes K50/L50 "applicable
      // elements" toggles) validate against CONST_TrueFalse — a list of
      // raw True/False booleans, not the "Yes"/"No" strings. Coerce
      // truthy/falsy in to a boolean; null/undefined stay empty.
      if (v === null || v === undefined || v === "") return v as ExcelJS.CellValue;
      return Boolean(v);
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
      // Strip the "CODE — Name" prefix the in-app dropdown uses, then
      // resolve back to the 2-letter ISO code for cells that take codes.
      const trimmed = v.replace(/^[A-Z]{2}\s*—\s*/, "").trim();
      const hit = countries.find((c) => c.name === trimmed || c.code === trimmed || c.code === v);
      return hit ? hit.code : trimmed;
    }
    case "countryNameFromLabel": {
      // The in-app dropdown stores country as "CODE — Name" (e.g.
      // "IN — India"). The EU template's A_InstData I26 / I41 / I51 cells
      // expect the plain English name from CNTR_ListCountriesName ("India"),
      // which a sibling cell reverse-looks-up into the code. Strip the
      // "CODE — " prefix; if the input is already a bare name, return it.
      if (typeof v !== "string") return v as ExcelJS.CellValue;
      const m = v.match(/^[A-Z]{2}\s*—\s*(.+)$/);
      const name = m ? m[1].trim() : v.trim();
      const hit = countries.find((c) => c.name === name || c.code === name);
      return hit ? hit.name : name;
    }
    default:
      return v as ExcelJS.CellValue;
  }
}
