// Regression tests for the free-text quantity parser, using the actual strings
// that appear on Birla Estates site returns. Run: npx tsx scripts/test-parse-quantity.mts
import { parseQuantity, looksLikeText } from "../src/lib/siteEntry/parseQuantity";

const cases: [string, string | null, number | null][] = [
  // kg on an MT-denominated row — the 1000x trap
  ["58 kg", "MT", 0.058],
  ["500 kg", "MT", 0.5],
  ["paint drums - kg: 4", "MT", 0.004],
  // multi-part scrap rows
  ["Rebar - 3.5\nSteel - 0.02\nWood - 0.15", "MT", 3.67],
  ["Rebar - 0.1\nWooden waste -4", "MT", 4.1],
  ["Paper & Card Board - 0.008", "MT", 0.008],
  ["Paper& Card Board - 3", "MT", 3],
  // already in the form's unit
  ["5 Kg", "Kg", 5],
  ["2", "Nos", 2],
  ["1824.63", "m3", 1824.63],
  ["0", "MT", 0],
  ["1,396", "m3", 1396],
  // minutes on an hours row
  ["60 min", "Hrs", 1],
  ["35 Min", "Hrs", 35 / 60],
  // not-available, which must never become zero
  ["NA", null, null],
  ["Nil", null, null],
  ["NIL", null, null],
  ["", null, null],
  ["No Qty Generated", null, null],
];

let pass = 0;
for (const [text, unit, want] of cases) {
  const r = parseQuantity(text, unit);
  const got = r.notAvailable ? null : r.value;
  const ok = want === null ? got === null : got !== null && Math.abs(got - want) < 1e-6;
  if (ok) pass++;
  const label = JSON.stringify(text).slice(0, 40).padEnd(42);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label} -> ${String(got).padEnd(9)}` +
      (ok ? "" : ` want ${want}`) +
      (r.explanation ? `   [${r.explanation}]` : "")
  );
}

// "NA" must be not-available, never a number, or a blank row silently becomes 0.
const na = parseQuantity("NA", "MT");
const naOk = na.notAvailable && na.value === null;
console.log(`${naOk ? "ok  " : "FAIL"} NA is not-available, not zero`);

const textOk = looksLikeText("58 kg") && !looksLikeText("58") && !looksLikeText("1824.63");
console.log(`${textOk ? "ok  " : "FAIL"} looksLikeText discriminates numbers from text`);

const total = cases.length + 2;
const passed = pass + (naOk ? 1 : 0) + (textOk ? 1 : 0);
console.log(`\n${passed}/${total}`);
process.exit(passed === total ? 0 : 1);
