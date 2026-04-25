import JSZip from "jszip";
import { bindings, type FieldBinding } from "./map";
import { RCO_ANSWERS_KEY, readAnswers } from "@/lib/storage";

const TEMPLATE_URL = "/rco-template.xlsx";

/**
 * RCO export — surgical XML patcher.
 *
 * The MoP RCO workbook contains parts that ExcelJS cannot round-trip:
 *  - 66 external-link relationships (rIds referenced by definedNames)
 *  - drawings, calcChain, metadata, printer settings, per-sheet rels
 *
 * If we let ExcelJS re-serialize the workbook, those parts are silently
 * dropped while the workbook's [Content_Types].xml and rels still reference
 * them — the result is a file that Excel reports as corrupt and offers to
 * "repair" (losing data validations, named ranges, and the Targets lookup).
 *
 * Instead we treat the .xlsx as a zip and edit only the cell XML for the cells
 * we need to fill. Every other part of the template is preserved byte-for-byte.
 */
export async function exportRcoFilled(): Promise<void> {
  const FileSaverMod = await import("file-saver");
  const saveAs =
    (FileSaverMod as any).saveAs ??
    (FileSaverMod as any).default?.saveAs ??
    (FileSaverMod as any).default;
  if (typeof saveAs !== "function") throw new Error("file-saver saveAs not found");

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Failed to load RCO template: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  const zip = await JSZip.loadAsync(buffer);
  const sheetNameToPath = await buildSheetMap(zip);
  const answers = readAnswers(RCO_ANSWERS_KEY);

  // Group bindings by physical sheet xml so we only parse and serialize each
  // sheet once.
  const bySheet = new Map<string, FieldBinding[]>();
  for (const b of bindings) {
    const path = sheetNameToPath.get(b.sheet);
    if (!path) {
      console.warn(`[rco-export] sheet "${b.sheet}" not found in template`);
      continue;
    }
    if (!bySheet.has(path)) bySheet.set(path, []);
    bySheet.get(path)!.push(b);
  }

  for (const [path, sheetBindings] of bySheet) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const updated = applyToSheet(xml, sheetBindings, answers);
    zip.file(path, updated);
  }

  // Drop calcChain.xml so Excel rebuilds it on open. The original chain
  // becomes stale once we overwrite cells, and a stale chain triggers the
  // same "we recovered your file" dialog Excel uses for corruption.
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
  saveAs(out, `RCO-Compliance-${stamp}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────────
// Workbook structure helpers
// ────────────────────────────────────────────────────────────────────────────

async function buildSheetMap(zip: JSZip): Promise<Map<string, string>> {
  const wbXml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const relsXml = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";

  // r:id → target file path (relative to xl/)
  const rIdToTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\s+([^>]*)\/?>/g)) {
    const attrs = parseAttrs(m[1]);
    const id = attrs["Id"];
    const target = attrs["Target"];
    if (!id || !target) continue;
    rIdToTarget.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  // sheet name → r:id (allow both r:id and r:Id, namespace-agnostic)
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

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Sheet XML cell editing
// ────────────────────────────────────────────────────────────────────────────

type Answers = ReturnType<typeof readAnswers>;

function applyToSheet(xml: string, sheetBindings: FieldBinding[], answers: Answers): string {
  // Compute the patches we need to apply for this sheet.
  // Each patch = { cellRef, rowNum, colLetter, value, kind }.
  type Patch = {
    cellRef: string;
    rowNum: number;
    colLetter: string;
    value: string | number;
  };

  const patches: Patch[] = [];
  for (const b of sheetBindings) {
    const a = answers[b.questionId];
    if (!a) continue;
    const raw = (a.values as Record<string, unknown>)[b.fieldId];
    if (raw === undefined || raw === null || raw === "") continue;

    const coerced = coerce(raw, b.transform);
    if (coerced === undefined) continue;

    const { col, row } = splitRef(b.cell);
    patches.push({ cellRef: b.cell, rowNum: row, colLetter: col, value: coerced });
  }

  if (patches.length === 0) return xml;

  // Group by row.
  const byRow = new Map<number, Patch[]>();
  for (const p of patches) {
    if (!byRow.has(p.rowNum)) byRow.set(p.rowNum, []);
    byRow.get(p.rowNum)!.push(p);
  }

  // Walk each row in the patches list, locate <row r="N"...> ... </row>, and
  // patch each cell.
  let result = xml;
  for (const [rowNum, rowPatches] of byRow) {
    const rowRe = new RegExp(`<row\\b([^>]*?\\sr="${rowNum}")([^>]*)>([\\s\\S]*?)</row>`, "g");
    const match = rowRe.exec(result);
    if (!match) {
      console.warn(`[rco-export] row ${rowNum} not found in sheet`);
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

function patchRow(inner: string, patches: { cellRef: string; colLetter: string; value: string | number }[]): string {
  // Parse existing <c> tags.
  type Cell = { ref: string; col: string; full: string; index: number };
  const cells: Cell[] = [];
  for (const m of inner.matchAll(/<c\s+([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = parseAttrs(m[1]);
    const ref = attrs["r"] ?? "";
    if (!ref) continue;
    const { col } = splitRef(ref);
    cells.push({ ref, col, full: m[0], index: m.index ?? 0 });
  }

  let out = inner;
  for (const p of patches) {
    const target = cells.find((c) => c.ref === p.cellRef);
    if (target) {
      // Replace the existing cell, preserving its `s=""` style attribute when present.
      const attrs = parseAttrs(/<c\s+([^>]*?)(?:\/>|>)/.exec(target.full)?.[1] ?? "");
      const styleAttr = attrs["s"] ? ` s="${attrs["s"]}"` : "";
      const newCellXml = renderCell(p.cellRef, styleAttr, p.value);
      out = out.replace(target.full, newCellXml);
    } else {
      // Cell doesn't exist yet — insert it, in column order.
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
  // Inline string — Excel accepts <c t="inlineStr"><is><t>...</t></is></c>.
  const text = String(value);
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
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

// ────────────────────────────────────────────────────────────────────────────
// Coercion (mirrors prior export coerce() exactly)
// ────────────────────────────────────────────────────────────────────────────

function coerce(v: unknown, transform?: FieldBinding["transform"]): string | number | undefined {
  switch (transform) {
    case "pct100to1":
      return typeof v === "number" ? v / 100 : asNumberOrString(v);
    case "stateNameOnly":
      if (typeof v === "string") {
        const m = v.match(/^(.*)\s*\([^)]+\)\s*$/);
        return m ? m[1].trim() : v;
      }
      return asNumberOrString(v);
    default:
      return asNumberOrString(v);
  }
}

function asNumberOrString(v: unknown): string | number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// calcChain cleanup
// ────────────────────────────────────────────────────────────────────────────

async function removeCalcChainContentType(zip: JSZip): Promise<void> {
  const file = zip.file("[Content_Types].xml");
  if (!file) return;
  let xml = await file.async("string");
  xml = xml.replace(
    /<Override\s+PartName="\/xl\/calcChain\.xml"[^/]*\/>/g,
    ""
  );
  zip.file("[Content_Types].xml", xml);

  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!relsFile) return;
  let rels = await relsFile.async("string");
  rels = rels.replace(
    /<Relationship\s+[^>]*Target="calcChain\.xml"[^>]*\/>/g,
    ""
  );
  zip.file("xl/_rels/workbook.xml.rels", rels);
}
