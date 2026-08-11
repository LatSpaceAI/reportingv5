// Tests the field -> canonical-parameter resolution that /api/esg/entry/save
// performs: unit conversion, multi-row aggregation, and the NA-vs-zero
// distinction. This is the step where a mistake silently corrupts a
// disclosure, so it is exercised against the real form shapes.
//
// The logic is duplicated here rather than imported because the route body is
// interleaved with Supabase calls. Keep the two in step — if you change the
// accumulation rules in the route, change them here and watch this fail first.
//
// Run: npx tsx scripts/test-entry-resolution.ts
import type { EntryValue } from "../src/lib/siteEntry/types";
import { parseQuantity } from "../src/lib/siteEntry/parseQuantity";

interface Field {
  id: number;
  parameterKey: string | null;
  unitFactor: number;
  label: string;
  formUnit?: string | null;
}

function toNumber(raw: string, formUnit?: string | null): number | null {
  const cleaned = (raw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  const parsed = parseQuantity(raw, formUnit);
  return parsed.notAvailable ? null : parsed.value;
}

/** Mirrors the accumulation in src/app/api/esg/entry/save/route.ts. */
function resolve(
  fields: Field[],
  values: Record<string, EntryValue>
): Record<string, { value: number | null; notAvailable: boolean }> {
  const acc = new Map<
    string,
    { sum: number; anyValue: boolean; anyNa: boolean; anyTouched: boolean }
  >();
  for (const f of fields) {
    if (!f.parameterKey) continue;
    const entry = values[String(f.id)];
    if (!entry) continue;
    const parsed = toNumber(entry.raw, f.formUnit);
    const isNa = Boolean(entry.notAvailable);
    const cur =
      acc.get(f.parameterKey) ??
      { sum: 0, anyValue: false, anyNa: false, anyTouched: false };
    if (isNa) {
      cur.anyNa = true;
      cur.anyTouched = true;
    } else if (parsed !== null) {
      cur.sum += parsed * f.unitFactor;
      cur.anyValue = true;
      cur.anyTouched = true;
    } else if (entry.raw?.trim()) {
      cur.anyTouched = true;
    }
    acc.set(f.parameterKey, cur);
  }
  const out: Record<string, { value: number | null; notAvailable: boolean }> = {};
  for (const [k, v] of acc) {
    // Untouched rows are not written at all — "never filled in" is not a fact
    // about the site, whereas "the site said NA" is.
    if (!v.anyTouched) continue;
    out[k] = { value: v.anyValue ? v.sum : null, notAvailable: !v.anyValue && v.anyNa };
  }
  return out;
}

const v = (raw: string, notAvailable = false): EntryValue => ({ raw, notAvailable });

let pass = 0, total = 0;
function expect(label: string, got: unknown, want: unknown) {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
}

// ── Unit conversion: the form says Ltrs, the model stores kL ────────────────
expect(
  "DG diesel 2000 Ltrs -> 2 kL",
  resolve(
    [{ id: 1, parameterKey: "fuel.diesel_dg", unitFactor: 0.001, label: "DG set - Diesel" }],
    { "1": v("2000") }
  ),
  { "fuel.diesel_dg": { value: 2, notAvailable: false } }
);

expect(
  "paint drums 4 kg -> 0.004 MT",
  resolve(
    [{ id: 1, parameterKey: "waste.paint_drums", unitFactor: 0.001, label: "paint drums - kg" }],
    { "1": v("4") }
  ),
  { "waste.paint_drums": { value: 0.004, notAvailable: false } }
);

// ── Aggregation: Aurora's two occupied floors feed one parameter ────────────
expect(
  "Level 8 + Level 13 sum into own-floor electricity",
  resolve(
    [
      { id: 1, parameterKey: "elec.own_floor_1", unitFactor: 1, label: "Level 8" },
      { id: 2, parameterKey: "elec.own_floor_2", unitFactor: 1, label: "Level 13" },
    ],
    { "1": v("13991"), "2": v("3122") }
  ),
  {
    "elec.own_floor_1": { value: 13991, notAvailable: false },
    "elec.own_floor_2": { value: 3122, notAvailable: false },
  }
);

// Aurora's three scrap rows collapse into one canonical scrap parameter.
expect(
  "three scrap rows sum into one parameter",
  resolve(
    [
      { id: 1, parameterKey: "waste.scrap", unitFactor: 1, label: "Scrap - Steel" },
      { id: 2, parameterKey: "waste.scrap", unitFactor: 1, label: "Scarp - Wood" },
      { id: 3, parameterKey: "waste.scrap", unitFactor: 1, label: "Scrap - Other" },
    ],
    { "1": v("0.02"), "2": v("0.15"), "3": v("3.5") }
  ),
  { "waste.scrap": { value: 3.67, notAvailable: false } }
);

// Tisya's five DG rows sum to 41.5 h.
expect(
  "five DG rows sum to total hours",
  resolve(
    [1, 2, 3, 4, 5].map((i) => ({
      id: i, parameterKey: "ops.dg_hours", unitFactor: 1, label: `DG${i}`,
    })),
    { "1": v("1"), "2": v("13"), "3": v("13"), "4": v("12"), "5": v("2.5") }
  ),
  { "ops.dg_hours": { value: 41.5, notAvailable: false } }
);

// ── NA is not zero ─────────────────────────────────────────────────────────
expect(
  "NA stores null and is flagged not-available",
  resolve(
    [{ id: 1, parameterKey: "water.tanker", unitFactor: 1, label: "From Tanker" }],
    { "1": v("", true) }
  ),
  { "water.tanker": { value: null, notAvailable: true } }
);

expect(
  "a reported zero is a real zero, not not-available",
  resolve(
    [{ id: 1, parameterKey: "water.municipal", unitFactor: 1, label: "Municipality" }],
    { "1": v("0") }
  ),
  { "water.municipal": { value: 0, notAvailable: false } }
);

// Partial NA across aggregated rows: one row NA, one with a value, so the
// parameter is NOT not-available.
expect(
  "partial NA across summed rows still yields a value",
  resolve(
    [
      { id: 1, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG1" },
      { id: 2, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG2" },
    ],
    { "1": v("410"), "2": v("", true) }
  ),
  { "ops.dg_hours": { value: 410, notAvailable: false } }
);

// All rows NA -> not available.
expect(
  "all summed rows NA yields not-available",
  resolve(
    [
      { id: 1, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG1" },
      { id: 2, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG2" },
    ],
    { "1": v("", true), "2": v("", true) }
  ),
  { "ops.dg_hours": { value: null, notAvailable: true } }
);

// ── Rows that feed nothing are dropped, not guessed at ─────────────────────
expect(
  "unmapped rows (agency, remarks) contribute nothing",
  resolve(
    [
      { id: 1, parameterKey: null, unitFactor: 1, label: "Name of Agency" },
      { id: 2, parameterKey: "waste.plastic", unitFactor: 1, label: "Plastic Waste" },
    ],
    { "1": v("Natural Gold"), "2": v("0.498") }
  ),
  { "waste.plastic": { value: 0.498, notAvailable: false } }
);

// ── Thousands separators survive ───────────────────────────────────────────
expect(
  "comma-formatted input parses",
  resolve(
    [{ id: 1, parameterKey: "elec.green", unitFactor: 1, label: "Green Energy" }],
    { "1": v("271,906") }
  ),
  { "elec.green": { value: 271906, notAvailable: false } }
);

// ── A blank row is neither a value nor an explicit NA ──────────────────────
// It is written nowhere: "nobody has filled this in" is a fact about our
// progress, not a fact about the site, and storing it as not-available would
// let an unfinished month masquerade as a complete one.
expect(
  "an untouched row is not written at all",
  resolve(
    [{ id: 1, parameterKey: "water.surface", unitFactor: 1, label: "Surface water" }],
    { "1": v("") }
  ),
  {}
);

expect(
  "a blank row alongside a filled one does not mark the parameter NA",
  resolve(
    [
      { id: 1, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG1" },
      { id: 2, parameterKey: "ops.dg_hours", unitFactor: 1, label: "DG2" },
    ],
    { "1": v("9"), "2": v("") }
  ),
  { "ops.dg_hours": { value: 9, notAvailable: false } }
);

// Unparseable text is retained (anyTouched) but yields no number.
expect(
  "unparseable text is recorded without inventing a number",
  resolve(
    [{ id: 1, parameterKey: "waste.scrap", unitFactor: 1, label: "Scrap" }],
    { "1": v("stored at site for disposal") }
  ),
  { "waste.scrap": { value: null, notAvailable: false } }
);

// ── The server must parse text the same way the screen previews it ─────────
// The UI shows "500 kg reads as 0.5 MT"; if the server stored null instead,
// the user would be shown one number and the disclosure built from another.
expect(
  "'500 kg' on an MT row is stored as 0.5, not null",
  resolve(
    [{ id: 1, parameterKey: "waste.municipal", unitFactor: 1, label: "Municipal", formUnit: "MT" }],
    { "1": v("500 kg") }
  ),
  { "waste.municipal": { value: 0.5, notAvailable: false } }
);

expect(
  "'58 kg' on an MT row is stored as 0.058",
  resolve(
    [{ id: 1, parameterKey: "waste.food", unitFactor: 1, label: "Food waste", formUnit: "MT" }],
    { "1": v("58 kg") }
  ),
  { "waste.food": { value: 0.058, notAvailable: false } }
);

expect(
  "a multi-part scrap row sums server-side",
  resolve(
    [{ id: 1, parameterKey: "waste.scrap", unitFactor: 1, label: "Scrap", formUnit: "MT" }],
    { "1": v("Rebar - 3.5 / Steel - 0.02 / Wood - 0.15") }
  ),
  { "waste.scrap": { value: 3.67, notAvailable: false } }
);

// Text parsing composes with the field's unit factor: the form prints Ltrs and
// the model stores kL, so "2000 L" must land as 2 kL, not 2000 or 0.002.
expect(
  "text parse composes with the field unit factor",
  resolve(
    [{ id: 1, parameterKey: "fuel.diesel_dg", unitFactor: 0.001, label: "DG diesel", formUnit: "Ltrs" }],
    { "1": v("2000") }
  ),
  { "fuel.diesel_dg": { value: 2, notAvailable: false } }
);

console.log(`\n${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
