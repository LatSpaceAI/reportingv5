// Builds src/lib/cctsSeed.ts — a static map of (questionId → fieldId → value)
// pre-populated with Hindalco's baseline-year numbers from the source workbook.
//
// Rationale: per product spec we want users opening the questionnaire for the
// first time to see populated values (demo mode), not blank fields. The seed
// gets injected into localStorage on first visit; users can edit freely and
// their edits persist normally.
//
// Mapping:
//  Form Sa1 fields (FS1!I<row>)
//    → seeded from the same row's column E value (Baseline Year input)
//  Annex CPP fields (ACPP!<col><row>)
//    → seeded from the *baseline twin* column on the same row. The blocks
//      are laid out as baseline-cols (C-J) mirrored by assessment-cols (K-R),
//      so K↔C, L↔D, M↔E, N↔F, O↔G, P↔H, Q↔I, R↔J. Block 1 (OEM Curve / HBD)
//      doesn't have separate baseline / assessment blocks; we seed cols
//      directly from themselves (no mapping needed, the same column carries
//      the design value used both years).
import { readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";

const WORKBOOK = "ALM0009UP CCTS proforma FY'23-24 final V1.4.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(WORKBOOK);
const formSa1 = wb.worksheets.find((w) => /form[-\s_]*sa1/i.test(w.name));
const annexCpp = wb.worksheets.find((w) => /annex\s*cpp/i.test(w.name));
if (!formSa1 || !annexCpp) throw new Error("Form Sa1 or Annex CPP not found");

// Load the section schema we just generated so we know which (question, field)
// pairs exist and which cell each field id maps to. We parse the TS source by
// stripping everything up to the first '[' after "Section[] =" and everything
// after the matching final '];'. The body is plain JSON since the generator
// emits via JSON.stringify.
const tsSrc = await readFile("src/lib/cctsSections.ts", "utf8");
const marker = "Section[] =";
const markerIdx = tsSrc.indexOf(marker);
if (markerIdx < 0) throw new Error("Failed to find Section[] marker in cctsSections.ts");
const startIdx = tsSrc.indexOf("[", markerIdx + marker.length);
const endIdx = tsSrc.lastIndexOf("];");
if (startIdx < 0 || endIdx < 0) throw new Error("Failed to bound sections JSON");
const sections = JSON.parse(tsSrc.slice(startIdx, endIdx + 1));

function readVal(ws, ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return undefined;
  const col = m[1];
  const row = Number(m[2]);
  const cell = ws.getRow(row).getCell(col);
  const v = cell.value;
  if (v == null) return undefined;
  // Formulas: prefer the cached result so we get the computed value.
  if (typeof v === "object") {
    if ("result" in v) {
      const r = v.result;
      if (r == null) return undefined;
      if (typeof r === "object") return undefined; // skip errors
      return r;
    }
    if ("richText" in v) return v.richText.map((x) => x.text).join("");
    if ("text" in v) return typeof v.text === "string" ? v.text : undefined;
    return undefined;
  }
  return v;
}

// Mapping: assessment-col → baseline-col for Annex CPP blocks 2, 3.a, 3.b, 4
// (block 1 doesn't separate baseline/assessment).
const ACPP_BASELINE_TWIN = {
  K: "C", L: "D", M: "E", N: "F",
  O: "G", P: "H", Q: "I", R: "J", S: undefined,
  // Within Annex CPP block 1 (rows 7-16), cols C-L are design data — no
  // baseline/assessment split. We pass them through to themselves.
};

// Annex CPP block 1 rows where seeding pulls from the cell itself
const ACPP_BLOCK1_ROWS = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

function lookupValueForField(fieldId) {
  // FS1!<COL><ROW>
  let m = /^FS1!([A-Z]+)(\d+)$/.exec(fieldId);
  if (m) {
    // Form Sa1: assessment col is I; baseline is col E on the same row.
    const row = Number(m[2]);
    return readVal(formSa1, `E${row}`);
  }
  m = /^ACPP!([A-Z]+)(\d+)$/.exec(fieldId);
  if (m) {
    const col = m[1];
    const row = Number(m[2]);
    // Block 1 (rows 7-16): cols are design data; pull from the same cell
    if (ACPP_BLOCK1_ROWS.has(row)) {
      return readVal(annexCpp, `${col}${row}`);
    }
    // Other blocks: assessment col → baseline twin col
    const twin = ACPP_BASELINE_TWIN[col];
    if (!twin) return undefined;
    return readVal(annexCpp, `${twin}${row}`);
  }
  return undefined;
}

// Build the seed: questionId → values map
const seed = {};
let fieldsSeeded = 0;
let fieldsAttempted = 0;
for (const section of sections) {
  for (const question of section.questions) {
    if (question.kind !== "fields") continue;
    const values = {};
    for (const field of question.fields) {
      if (field.kind === "computed") continue;
      fieldsAttempted++;
      const v = lookupValueForField(field.id);
      if (v === undefined || v === null || v === "") continue;
      // Round float values to a sensible precision to keep the seed tidy.
      const coerced = typeof v === "number" && Number.isFinite(v)
        ? Math.round(v * 1e6) / 1e6
        : v;
      values[field.id] = coerced;
      fieldsSeeded++;
    }
    if (Object.keys(values).length > 0) seed[question.id] = values;
  }
}

const out = `// AUTO-GENERATED by scripts/gen-ccts-seed.mjs.
// Demo-mode seed: Hindalco baseline-year values from the source BEE Aluminium
// Pro-Forma workbook, repurposed as initial assessment-year values so users
// see a populated form on first open. Written to localStorage on first visit
// only — user edits override and persist normally.

export interface CctsSeedEntry {
  values: Record<string, string | number>;
}

export const CCTS_SEED: Record<string, CctsSeedEntry["values"]> = ${JSON.stringify(seed, null, 2)};

// Version tag — bump when the seed regenerates so the page knows to re-seed
// freshly-cleared storage instead of leaving it blank.
export const CCTS_SEED_VERSION = ${JSON.stringify(new Date().toISOString().slice(0, 10))};
`;

await writeFile("src/lib/cctsSeed.ts", out, "utf8");
console.log(`Wrote src/lib/cctsSeed.ts`);
console.log(`Seeded ${fieldsSeeded} / ${fieldsAttempted} fields across ${Object.keys(seed).length} questions`);
