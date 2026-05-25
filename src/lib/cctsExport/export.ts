import JSZip from "jszip";
import { sections } from "@/lib/cctsSections";
import { CCTS_ANSWERS_KEY, readAnswers, type Answers } from "@/lib/storage";

const TEMPLATE_URL = "/ccts-template.xlsx";

// Field-id prefix → workbook sheet name. Field ids in cctsSections.ts carry an
// explicit sheet prefix because the aluminium pro-forma routes user inputs
// across two sheets (Form Sa1 + Annex CPP), unlike the cement pro-forma which
// only used Form-Sb.
const SHEET_PREFIX: Record<string, string> = {
  FS1: "Form Sa1",
  ACPP: "Annex CPP",
};

/**
 * CCTS Aluminium-Sector Pro-Forma export — surgical XML patcher.
 *
 * Opens the BEE Aluminium Pro-Forma workbook as a zip and rewrites only the
 * cells the user filled. Every other sheet (General Information, Form 1,
 * Form E2, Form PE, Baseline Parameter, Summary Sheet, NF-2…NF-8,
 * Emission Factor & GWP Backup, Annex Addl Eqp List, Annex Project Activities,
 * N1-BQ Bauxite Quality, …) ships verbatim — formulas intact — so Excel
 * computes the rest when the user opens the file.
 *
 * Cell binding: each field id in cctsSections.ts is "<SHEET>!<cellref>"
 * (e.g. "FS1!I43", "ACPP!K25"), which maps to the cell on the named sheet
 * via SHEET_PREFIX above.
 */
export async function exportCctsFilled(): Promise<void> {
  const FileSaverMod = await import("file-saver");
  const saveAs =
    (FileSaverMod as { saveAs?: unknown; default?: { saveAs?: unknown } }).saveAs ??
    (FileSaverMod as { default?: { saveAs?: unknown } }).default?.saveAs ??
    (FileSaverMod as { default?: unknown }).default;
  if (typeof saveAs !== "function") throw new Error("file-saver saveAs not found");

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Failed to load CCTS template: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  const zip = await JSZip.loadAsync(buffer);
  const sheetNameToPath = await buildSheetMap(zip);

  const answers = readAnswers(CCTS_ANSWERS_KEY);
  const allPatches = collectPatches(answers);
  if (allPatches.length === 0) {
    console.warn("[ccts-export] no answers to write — exporting empty template");
  }

  // Group patches by target sheet name and apply each sheet's XML in one pass.
  const patchesBySheet = new Map<string, Patch[]>();
  for (const p of allPatches) {
    if (!patchesBySheet.has(p.sheetName)) patchesBySheet.set(p.sheetName, []);
    patchesBySheet.get(p.sheetName)!.push(p);
  }
  for (const [sheetName, patches] of patchesBySheet) {
    const path = sheetNameToPath.get(sheetName);
    if (!path) {
      console.warn(`[ccts-export] sheet "${sheetName}" not found in template — skipping ${patches.length} patches`);
      continue;
    }
    const file = zip.file(path);
    if (!file) {
      console.warn(`[ccts-export] sheet xml missing for "${sheetName}" (${path})`);
      continue;
    }
    const xml = await file.async("string");
    const updated = applyPatches(xml, patches, sheetName);
    zip.file(path, updated);
  }

  // Drop calcChain so Excel rebuilds it on open. Stale calcChain triggers the
  // "recovered file" dialog Excel uses for corrupt workbooks.
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    await removeCalcChainContentType(zip);
  }

  const out = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(out, `CCTS-Aluminium-Proforma-${stamp}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────────
// Patch collection — walk sections → questions → fields and stage one patch
// per filled answer. Field ids are of the shape "<PREFIX>!<COL><ROW>" and the
// prefix selects the target sheet via SHEET_PREFIX.
// ────────────────────────────────────────────────────────────────────────────

interface Patch {
  sheetName: string;
  cellRef: string;
  rowNum: number;
  colLetter: string;
  value: string | number;
}

function collectPatches(answers: Answers): Patch[] {
  const patches: Patch[] = [];
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.kind !== "fields") continue;
      const saved = answers[question.id];
      if (!saved) continue;
      const values = saved.values ?? {};
      for (const field of question.fields) {
        if (field.kind === "computed") continue;
        const raw = (values as Record<string, unknown>)[field.id];
        const coerced = coerce(raw);
        if (coerced === undefined) continue;
        const parsed = parseFieldId(field.id);
        if (!parsed) continue;
        patches.push({
          sheetName: parsed.sheetName,
          cellRef: parsed.cellRef,
          rowNum: parsed.row,
          colLetter: parsed.col,
          value: coerced,
        });
      }
    }
  }
  return patches;
}

function parseFieldId(id: string): { sheetName: string; cellRef: string; col: string; row: number } | null {
  // Expected shape: "<PREFIX>!<COL><ROW>" e.g. "FS1!I43", "ACPP!K25".
  const m = /^([A-Z0-9]+)!([A-Z]+)(\d+)$/.exec(id);
  if (!m) return null;
  const sheetName = SHEET_PREFIX[m[1]];
  if (!sheetName) return null;
  return { sheetName, cellRef: m[2] + m[3], col: m[2], row: Number(m[3]) };
}

function coerce(v: unknown): string | number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Workbook structure — sheet name → physical path
// ────────────────────────────────────────────────────────────────────────────

async function buildSheetMap(zip: JSZip): Promise<Map<string, string>> {
  const wbXml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const relsXml = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";

  const rIdToTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\s+([^>]*)\/?>/g)) {
    const attrs = parseAttrs(m[1]);
    const id = attrs["Id"];
    const target = attrs["Target"];
    if (!id || !target) continue;
    rIdToTarget.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  const nameToPath = new Map<string, string>();
  for (const m of wbXml.matchAll(/<sheet\s+([^/]*)\/>/g)) {
    const attrs = parseAttrs(m[1]);
    const name = decodeXmlEntities(attrs["name"] ?? "");
    const rid = attrs["r:id"] ?? attrs["r:Id"];
    if (!name || !rid) continue;
    const target = rIdToTarget.get(rid);
    if (target) nameToPath.set(name, target);
  }
  return nameToPath;
}

// ────────────────────────────────────────────────────────────────────────────
// Sheet XML editing
// ────────────────────────────────────────────────────────────────────────────

function applyPatches(xml: string, patches: Patch[], sheetName: string): string {
  if (patches.length === 0) return xml;

  const byRow = new Map<number, Patch[]>();
  for (const p of patches) {
    if (!byRow.has(p.rowNum)) byRow.set(p.rowNum, []);
    byRow.get(p.rowNum)!.push(p);
  }

  let result = xml;
  for (const [rowNum, rowPatches] of byRow) {
    const rowRe = new RegExp(`<row\\b([^>]*?\\sr="${rowNum}")([^>]*)>([\\s\\S]*?)</row>`, "g");
    const match = rowRe.exec(result);
    if (!match) {
      console.warn(`[ccts-export] row ${rowNum} not found in ${sheetName}`);
      continue;
    }
    const [whole, , attrsTail, inner] = match;
    const newInner = patchRow(inner, rowPatches);
    const newRow = `<row${match[1]}${attrsTail}>${newInner}</row>`;
    result = result.slice(0, match.index) + newRow + result.slice(match.index + whole.length);
    rowRe.lastIndex = match.index + newRow.length;
  }
  return result;
}

function patchRow(inner: string, patches: Patch[]): string {
  type Cell = { ref: string; col: string; full: string };
  const cells: Cell[] = [];
  for (const m of inner.matchAll(/<c\s+([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = parseAttrs(m[1]);
    const ref = attrs["r"] ?? "";
    if (!ref) continue;
    const { col } = splitRef(ref);
    cells.push({ ref, col, full: m[0] });
  }

  let out = inner;
  for (const p of patches) {
    const target = cells.find((c) => c.ref === p.cellRef);
    if (target) {
      const attrs = parseAttrs(/<c\s+([^>]*?)(?:\/>|>)/.exec(target.full)?.[1] ?? "");
      const styleAttr = attrs["s"] ? ` s="${attrs["s"]}"` : "";
      const newCellXml = renderCell(p.cellRef, styleAttr, p.value);
      out = out.replace(target.full, newCellXml);
    } else {
      const newCellXml = renderCell(p.cellRef, "", p.value);
      const insertBefore = cells.find((c) => compareCol(c.col, p.colLetter) > 0);
      if (insertBefore) {
        out = out.replace(insertBefore.full, newCellXml + insertBefore.full);
      } else {
        out = out + newCellXml;
      }
    }
  }
  return out;
}

function renderCell(ref: string, styleAttr: string, value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  }
  const text = String(value);
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function splitRef(ref: string): { col: string; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Invalid cell ref: ${ref}`);
  return { col: m[1], row: Number(m[2]) };
}

function compareCol(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

async function removeCalcChainContentType(zip: JSZip): Promise<void> {
  const file = zip.file("[Content_Types].xml");
  if (!file) return;
  let xml = await file.async("string");
  xml = xml.replace(/<Override\s+PartName="\/xl\/calcChain\.xml"[^/]*\/>/g, "");
  zip.file("[Content_Types].xml", xml);

  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!relsFile) return;
  let rels = await relsFile.async("string");
  rels = rels.replace(/<Relationship\s+[^>]*Target="calcChain\.xml"[^>]*\/>/g, "");
  zip.file("xl/_rels/workbook.xml.rels", rels);
}
