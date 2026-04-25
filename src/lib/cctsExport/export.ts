import JSZip from "jszip";
import { sections } from "@/lib/cctsSections";
import { CCTS_ANSWERS_KEY, readAnswers, type Answers } from "@/lib/storage";

const TEMPLATE_URL = "/ccts-template.xlsx";
const TARGET_SHEET = "Form-Sb";

/**
 * CCTS Pro-Forma export — surgical XML patcher.
 *
 * Mirrors the RCO export approach: open the BEE Cement Pro-Forma workbook as
 * a zip and rewrite only the cells we filled. Every other sheet (General
 * Information, Form 1, Form E2, Baseline Parameters, Summary Sheet, NF-1…NF-8,
 * Form-PE, Emission Factor & GWP Backup, …) ships verbatim — formulas intact —
 * so Excel computes the rest when the user opens the file.
 *
 * Cell binding is implicit: every field in cctsSections.ts has an id of the
 * shape `I<row>` (e.g. "I31"), which is exactly the cell on Form-Sb to write.
 * The Year-1 baseline columns (E/F/G) are intentionally left blank — only the
 * Current/Assessment Year column (I) is populated by this build.
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
  const formSbPath = sheetNameToPath.get(TARGET_SHEET);
  if (!formSbPath) throw new Error(`Sheet "${TARGET_SHEET}" not found in template`);

  const answers = readAnswers(CCTS_ANSWERS_KEY);
  const patches = collectPatches(answers);
  if (patches.length === 0) {
    console.warn("[ccts-export] no answers to write — exporting empty template");
  }

  const formSbFile = zip.file(formSbPath);
  if (!formSbFile) throw new Error(`Sheet xml for ${TARGET_SHEET} missing`);
  const xml = await formSbFile.async("string");
  const updated = applyPatches(xml, patches);
  zip.file(formSbPath, updated);

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
  saveAs(out, `CCTS-Cement-Proforma-${stamp}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────────
// Patch collection — walk sections → questions → fields and stage one patch
// per filled answer. Each field id is already the cell ref on Form-Sb.
// ────────────────────────────────────────────────────────────────────────────

interface Patch {
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
        const ref = field.id; // e.g. "I31"
        if (!/^[A-Z]+\d+$/.test(ref)) continue; // safety — skip ids that aren't cell refs
        const split = splitRef(ref);
        patches.push({ cellRef: ref, rowNum: split.row, colLetter: split.col, value: coerced });
      }
    }
  }
  return patches;
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

function applyPatches(xml: string, patches: Patch[]): string {
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
      console.warn(`[ccts-export] row ${rowNum} not found in Form-Sb`);
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
