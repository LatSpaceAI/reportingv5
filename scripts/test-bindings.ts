// Offline tests for the report-binding read path.
//
// No database: the two things worth pinning here are pure. shiftFiscalYear is
// arithmetic on a label, and normaliseFiscalYear is the gate that decides
// whether bound metrics resolve at all — a wrong answer there attaches real
// numbers to the wrong reporting period, silently.

import { shiftFiscalYear } from "../src/lib/reportBindings/shiftFiscalYear";
import { normaliseFiscalYear } from "../src/lib/reportBindings/normaliseFiscalYear";
import { formatBoundValue } from "../src/lib/reportBindings/formatBoundValue";

let pass = 0;
let fail = 0;

function t(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`ok   ${name.padEnd(66)} ${detail}`);
  } else {
    fail++;
    console.log(`FAIL ${name.padEnd(66)} ${detail}`);
  }
}

// ---- shiftFiscalYear -------------------------------------------------------
t("current year is unchanged at offset 0", shiftFiscalYear("2024-25", 0) === "2024-25");
t("previous FY is one year back", shiftFiscalYear("2024-25", -1) === "2023-24", "2024-25 -> 2023-24");
t("two years back", shiftFiscalYear("2024-25", -2) === "2022-23");
t("century rollover pads the short year",
  shiftFiscalYear("2000-01", -1) === "1999-00", "1999-00, not 1999-0");
t("a malformed year yields null", shiftFiscalYear("FY25", -1) === null);

// ---- normaliseFiscalYear ---------------------------------------------------
t("the canonical form passes through", normaliseFiscalYear("2024-25") === "2024-25");
t("whitespace is trimmed", normaliseFiscalYear("  2024-25  ") === "2024-25");
t("an FY prefix is accepted", normaliseFiscalYear("FY2024-25") === "2024-25");
t("an FY prefix with a space is accepted", normaliseFiscalYear("FY 2024-25") === "2024-25");
t("lowercase fy is accepted", normaliseFiscalYear("fy2024-25") === "2024-25");
t("a four-digit end year is narrowed", normaliseFiscalYear("2024-2025") === "2024-25");
t("a slash separator is accepted", normaliseFiscalYear("2024/25") === "2024-25");

// The typo cases. These MUST fail closed: resolving "2024-24" as if it were
// 2024-25 would bind this year's cells to a period the user did not name.
t("a non-consecutive year is rejected", normaliseFiscalYear("2024-24") === null, "not a fiscal year");
t("a skipped year is rejected", normaliseFiscalYear("2024-26") === null);
t("a bare calendar year is rejected", normaliseFiscalYear("2024") === null);
t("free text is rejected", normaliseFiscalYear("last year") === null);
t("an empty string is rejected", normaliseFiscalYear("") === null);
t("a non-string is rejected", normaliseFiscalYear(undefined) === null);
t("a number is rejected", normaliseFiscalYear(2024) === null);

// ---- formatBoundValue ------------------------------------------------------
// Intensities are small and live in their decimals; waste and water are large
// and read better grouped. Both must survive the same formatter.
t("an intensity keeps four decimals", formatBoundValue(1.1851, true) === "1.1851",
  "1.19 would lose what the ratio exists to carry");
t("a small intensity keeps its significance", formatBoundValue(0.0237, true) === "0.0237");
t("an intensity above 1 is NOT rounded to two decimals",
  formatBoundValue(2.8563, true) === "2.8563", "magnitude alone cannot decide this");
t("a non-intensity above 1 still rounds to two decimals",
  formatBoundValue(1.1851) === "1.19");
t("a mid-size figure keeps two decimals", formatBoundValue(218.125).startsWith("218.1"));
t("a large figure is grouped without decimals",
  !formatBoundValue(1551983.2592).includes("."), formatBoundValue(1551983.2592));
t("zero renders as a bare zero, not a dash", formatBoundValue(0) === "0", "a filed zero is a fact");

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
