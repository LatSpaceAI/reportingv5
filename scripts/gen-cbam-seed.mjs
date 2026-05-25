// Generates src/lib/cbamSeed.ts — a static map of (questionId → field/row
// values) derived from the Hindalco Renukoot CBAM Communication workbook.
//
// Unlike CCTS (where field ids ARE cell coordinates and the seed is a simple
// row-by-row read), CBAM uses semantic field ids and a separate bindings
// table (`src/lib/cbamExport/map.ts`) to map (questionId, fieldId) →
// (sheet, cell). To seed, we walk that bindings list in reverse: for each
// binding, read the cell from the Hindalco workbook, apply the *inverse* of
// the export transform, and stash the value under the binding's
// (questionId, fieldId) path.
//
// Table bindings (anchorRow + rowStride) are read row-by-row until we hit
// the first row whose anchor column is blank, mirroring the human convention
// in the EU template (consecutive rows; blank row = end of data).
//
// The output is injected into localStorage on first open of /report/cbam by
// the same seed mechanism used for CCTS, with one priority rule: where a
// (question, field) already has an SOT-derived value, the seed defers to
// the SOT. We don't emit SOT-covered cells here — the Questionnaire's
// existing sotHydratedState pre-fills them on its own.

import { readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WORKBOOK = "CBAM Communication CY'25 (Hindalco- Renukoot).xlsx";

// ── Load bindings from the TS source (light parse, no TS compiler) ─────────
// map.ts is hand-authored and stable. We slurp the file and `eval` the
// bindings array literal in a tightly-scoped sandbox.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mapTs = await readFile(path.join(__dirname, "..", "src", "lib", "cbamExport", "map.ts"), "utf8");
// "export const bindings: Binding[] = [" — we want the [ AFTER the "=" sign,
// not the one inside the "Binding[]" type annotation.
const marker = "export const bindings: Binding[] =";
const markerEnd = mapTs.indexOf(marker) + marker.length;
const arrStart = mapTs.indexOf("[", markerEnd);
// Find matching ] for the bindings array.
let depth = 0, end = arrStart;
for (let i = arrStart; i < mapTs.length; i++) {
  const ch = mapTs[i];
  if (ch === "[") depth++;
  else if (ch === "]") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const bindingsArrayLiteral = mapTs.slice(arrStart, end);
// Strip TS type annotations and trailing commas to keep it valid JS.
const cleaned = bindingsArrayLiteral.replace(/\s+as\s+\w+/g, "");
// eslint-disable-next-line no-eval
const bindings = eval("(" + cleaned + ")");

// ── Load CBAM SOT to know which (questionId, fieldId, rowIndex) cells the
//    SOT already covers, so we can skip them in our seed output ──────────
const cbamSOTTs = await readFile(path.join(__dirname, "..", "src", "lib", "cbamSOT.ts"), "utf8");
// Parse calculatedValues entries enough to learn their targets.
// Lightweight regex over the file — we only need {questionId, fieldId, rowIndex} triples.
const sotCovered = new Set();
for (const m of cbamSOTTs.matchAll(/\{\s*questionId:\s*"([^"]+)"\s*,\s*fieldId:\s*"([^"]+)"(?:\s*,\s*rowIndex:\s*(\d+))?\s*\}/g)) {
  const key = `${m[1]}::${m[2]}::${m[3] ?? ""}`;
  sotCovered.add(key);
}

// ── Open the Hindalco workbook ─────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(WORKBOOK);
function getSheet(name) {
  const ws = wb.worksheets.find((w) => w.name === name);
  if (!ws) throw new Error(`Sheet ${name} not found`);
  return ws;
}

// ── Read a cell, returning the computed value when present ─────────────────
function readCellValue(cell) {
  const v = cell.value;
  if (v == null) return undefined;
  if (typeof v === "object") {
    if ("result" in v) {
      // Formula cell with a cached result. Recurse in case the result is
      // itself a {text} / {richText} object.
      const r = v.result;
      if (r == null) return undefined;
      if (typeof r === "object") {
        if ("text" in r) return r.text;
        if ("richText" in r) return r.richText.map((x) => x.text).join("");
        if ("error" in r) return undefined; // formula errored out
        return undefined;
      }
      return r;
    }
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text;
    if ("formula" in v || "sharedFormula" in v) return undefined; // formula with no cache → skip
    if (v instanceof Date) return v;
    if ("error" in v) return undefined;
  }
  return v;
}

// ── Inverse transforms — map workbook value → in-app answer value ─────────
function inverseTransform(raw, transform) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  switch (transform) {
    case "dateFromIso":
      // Workbook stores Date; app stores ISO yyyy-mm-dd.
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      if (typeof raw === "number") {
        // Excel serial — convert via 1900-based serial.
        const d = excelSerialToDate(raw);
        return d.toISOString().slice(0, 10);
      }
      return String(raw);
    case "yesNoFromBool":
      if (typeof raw === "boolean") return raw;
      if (typeof raw === "string") return /^yes$/i.test(raw.trim());
      return undefined;
    case "pct100to1":
      // In principle the export transform divides by 100 to land 0..1 in the
      // sheet. In practice the Hindalco workbook stores percent values as
      // 0..100 already (the EU template's input cell has no auto-conversion,
      // so the human just typed 100 to mean 100 %). So the inverse here is a
      // no-op — pass the number through unchanged.
      return raw;
    case "cnCodeOnly":
      // Workbook holds the CN code; app stores the full "<code> — <name>" string
      // typically. But we don't have the mapping wired up here — pass through
      // and let the UI display the code.
      return String(raw).trim();
    case "countryCodeFromName":
      // Workbook holds 2-letter country code; app expects "<code> — <name>".
      // We'll resolve via the countries list if we can; otherwise pass through.
      return String(raw).trim();
    default:
      // Numbers stay numbers; strings stay strings. Dates → ISO.
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      return raw;
  }
}

function excelSerialToDate(serial) {
  // Excel's "1900 leap year bug" — serials >= 60 are off by one.
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 24 * 60 * 60 * 1000;
  return new Date(utcMs);
}

// ── Country code → "<code> — <name>" resolver (mirror UI dropdown labels) ──
// We grab the country list at runtime from codeLists.ts. The `export const
// countries = [...]` literal has nested objects — slice from `[` to the
// matching `]`.
const codeListsTs = await readFile(path.join(__dirname, "..", "src", "lib", "codeLists.ts"), "utf8");
let countries = [];
{
  const m = "export const countries =";
  const i = codeListsTs.indexOf(m);
  if (i >= 0) {
    const start = codeListsTs.indexOf("[", i + m.length);
    let d = 0, j = start;
    for (; j < codeListsTs.length; j++) {
      const ch = codeListsTs[j];
      if (ch === "[") d++;
      else if (ch === "]") { d--; if (d === 0) { j++; break; } }
    }
    try {
      // eslint-disable-next-line no-eval
      countries = eval("(" + codeListsTs.slice(start, j).replace(/\s+as\s+const/g, "") + ")");
    } catch {}
  }
}
const countryNameByCode = new Map(countries.map((c) => [c.code, c.name]));

function resolveCountry(code) {
  const c = String(code).trim().toUpperCase();
  const name = countryNameByCode.get(c);
  return name ? `${c} — ${name}` : c;
}

// Also normalise A.2's "country" field — workbook stores the full English
// country name, but the in-app dropdown is keyed off `<code> — <name>`.
function nameToCountryLabel(name) {
  if (typeof name !== "string") return name;
  const hit = countries.find((c) => c.name === name.trim());
  return hit ? `${hit.code} — ${hit.name}` : name;
}

// ── Walk bindings and assemble the seed ────────────────────────────────────
const seed = {}; // { [questionId]: { values?: {...}, rows?: [...] } }
let fieldsWritten = 0;
let rowsWritten = 0;
let skippedSOT = 0;

for (const b of bindings) {
  if (b.kind === "field") {
    const sotKey = `${b.questionId}::${b.fieldId}::`;
    if (sotCovered.has(sotKey)) { skippedSOT++; continue; }
    const ws = getSheet(b.sheet);
    const raw = readCellValue(ws.getCell(b.cell));
    let v = inverseTransform(raw, b.transform);
    if (v === undefined || v === null || v === "") continue;
    if (b.transform === "countryCodeFromName" && typeof v === "string") {
      v = resolveCountry(v);
    }
    // A.2 country / A.3 verifierCountry / A.3 accreditationMS are
    // `selectCountry` fields with no transform — the workbook stores the
    // English name. Normalise to the "<CODE> — <Name>" format the dropdown
    // expects so the option matches.
    if (
      typeof v === "string" &&
      (b.fieldId === "country" || b.fieldId === "verifierCountry" || b.fieldId === "accreditationMS")
    ) {
      v = nameToCountryLabel(v);
    }
    // Round noisy floats lightly.
    if (typeof v === "number" && Number.isFinite(v)) {
      v = Math.round(v * 1e6) / 1e6;
    }
    // Trim long whitespace strings, e.g. "ADM Building, Renukoot   ".
    if (typeof v === "string") v = v.trim();
    // Lat/lng cells in the workbook are sometimes plain strings — coerce to
    // numbers so they match the in-app `number` field kind.
    if ((b.fieldId === "lat" || b.fieldId === "lng") && typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) v = n;
    }
    if (v === "" || v === null || v === undefined) continue;
    seed[b.questionId] = seed[b.questionId] ?? {};
    seed[b.questionId].values = seed[b.questionId].values ?? {};
    seed[b.questionId].values[b.fieldId] = v;
    fieldsWritten++;
  } else {
    // table binding
    const ws = getSheet(b.sheet);
    const colEntries = Object.entries(b.columns); // [[fieldId, {col, offset, transform}], ...]
    const anchorFieldEntry = colEntries[0]; // use the first column as the "row populated" signal
    const rows = [];
    for (let i = 0; i < b.maxRows; i++) {
      const rowBase = b.anchorRow + i * b.rowStride;
      const anchorCol = anchorFieldEntry[1].col;
      const anchorOffset = anchorFieldEntry[1].offset ?? 0;
      const anchorVal = readCellValue(ws.getCell(`${anchorCol}${rowBase + anchorOffset}`));
      if (anchorVal === undefined || anchorVal === null || anchorVal === "") {
        // First blank anchor row stops the read.
        break;
      }
      const row = {};
      for (const [fid, def] of colEntries) {
        const sotKey = `${b.questionId}::${fid}::${i}`;
        if (sotCovered.has(sotKey)) { skippedSOT++; continue; }
        const cellRef = `${def.col}${rowBase + (def.offset ?? 0)}`;
        const raw = readCellValue(ws.getCell(cellRef));
        let v = inverseTransform(raw, def.transform);
        if (v === undefined || v === null || v === "") continue;
        if (def.transform === "countryCodeFromName" && typeof v === "string") {
          v = resolveCountry(v);
        }
        if (typeof v === "string") v = v.trim();
        if (typeof v === "number" && Number.isFinite(v)) {
          v = Math.round(v * 1e6) / 1e6;
        }
        if (v === "" || v === null || v === undefined) continue;
        row[fid] = v;
      }
      rows.push(row);
      rowsWritten++;
    }
    if (rows.length > 0) {
      seed[b.questionId] = seed[b.questionId] ?? {};
      seed[b.questionId].rows = rows;
    }
  }
}

// ── Hand-curated additions for cells that the bindings table can't reach
//    automatically. The export bindings only know about cells that have a
//    direct (sheet, cell) home in the EU template; values that live in a
//    different sheet (e.g. E.1's country code lives only on A_InstData) or
//    that are implied by the data (e.g. F.1 "hasCHP" being true because the
//    Cogen tool was used) need to be added here.
{
  // E.1 country and supplier: mirror A.5 entries into the E.1 table by
  // precursor index. The values live on A_InstData (rows 102+) — there's
  // no per-block country/supplier cell on E_PurchPrec — so the bindings
  // can't reach them. Copy across so the in-app table renders them and
  // the export round-trips the right text.
  const a5Rows = (seed["A.5"] && seed["A.5"].rows) || [];
  const e1 = seed["E.1"] = seed["E.1"] || { rows: [] };
  e1.rows = e1.rows || [];
  for (let i = 0; i < Math.min(a5Rows.length, e1.rows.length); i++) {
    if (a5Rows[i]?.country && !e1.rows[i].country) {
      e1.rows[i].country = a5Rows[i].country;
    }
    if (a5Rows[i]?.supplier && !e1.rows[i].supplier) {
      e1.rows[i].supplier = a5Rows[i].supplier;
    }
  }
}
{
  // F.1 hasCHP: Hindalco Renukoot's Cogen tool was used (SOT supplies
  // fuelIn/heatOut/elecOut), so the boolean defaults to true.
  seed["F.1"] = seed["F.1"] || {};
  seed["F.1"].values = seed["F.1"].values || {};
  if (seed["F.1"].values.hasCHP === undefined) {
    seed["F.1"].values.hasCHP = true;
  }
}
{
  // D.1 internal consumption (consumedP1 / consumedP2 / consumedP3): the
  // EU template's D_Processes section (c) lists the *other* processes
  // (not the current one) and the amount of the current process's output
  // consumed by each of them. So the *row position* of each cell carries
  // a different meaning depending on which block we're in:
  //   • P1 block — row 1 (L32) = consumed-by-FRP (P2), row 2 (L33) = consumed-by-Extrusion (P3)
  //   • P2 block — row 1 (L97) = consumed-by-Unwrought (P1), row 2 (L98) = consumed-by-Extrusion (P3)
  //   • P3 block — row 1 (L162) = consumed-by-Unwrought (P1), row 2 (L163) = consumed-by-FRP (P2)
  // Per-block "other" sequencing skips the current process. So:
  const ws = getSheet("D_Processes");
  const d1 = seed["D.1"] = seed["D.1"] || { rows: [] };
  d1.rows = d1.rows || [];
  while (d1.rows.length < 3) d1.rows.push({});
  // P1 block (anchor 15): row 1 at L32 → P2, row 2 at L33 → P3
  const r0 = d1.rows[0]; const r1 = d1.rows[1]; const r2 = d1.rows[2];
  const cellNum = (cell) => {
    const raw = readCellValue(ws.getCell(cell));
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 1e6) / 1e6;
    return undefined;
  };
  const isSOT = (qid, fid, row) => sotCovered.has(`${qid}::${fid}::${row}`);
  const maybeSet = (row, fid, rowIdx, cellRef) => {
    if (row[fid] !== undefined) return;
    if (isSOT("D.1", fid, rowIdx)) return;
    const v = cellNum(cellRef);
    if (v !== undefined) row[fid] = v;
  };
  maybeSet(r0, "consumedP2", 0, "L32");
  maybeSet(r0, "consumedP3", 0, "L33");
  maybeSet(r1, "consumedP1", 1, "L97");
  maybeSet(r1, "consumedP3", 1, "L98");
  maybeSet(r2, "consumedP1", 2, "L162");
  maybeSet(r2, "consumedP2", 2, "L163");
}

const out = `// AUTO-GENERATED by scripts/gen-cbam-seed.mjs.
// Demo-mode seed: Hindalco Renukoot CBAM Communication workbook values
// (CY'25), used to pre-populate the report on first open. The SOT-derived
// pre-fill (cbamSOT.ts → sotHydratedState) takes priority over anything in
// this map — cells already covered by the SOT are intentionally absent.

export interface CbamSeedEntry {
  values?: Record<string, string | number | boolean>;
  rows?: Array<Record<string, string | number | boolean>>;
}

export const CBAM_SEED: Record<string, CbamSeedEntry> = ${JSON.stringify(seed, null, 2)};

export const CBAM_SEED_VERSION = ${JSON.stringify(new Date().toISOString().slice(0, 10) + "-r5")};
`;

await writeFile(path.join(__dirname, "..", "src", "lib", "cbamSeed.ts"), out, "utf8");
console.log(`Wrote src/lib/cbamSeed.ts`);
console.log(`Seed: ${fieldsWritten} fields, ${rowsWritten} table rows across ${Object.keys(seed).length} questions`);
console.log(`Skipped (already covered by SOT): ${skippedSOT}`);
