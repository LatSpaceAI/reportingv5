// Print just the user-input rows of Form-Sb (column E has no formula, has a label).
// Each row -> "row | code | unit | label  [validation: kind / formula]".
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(process.env.TEMP + "/formsb.json", "utf8"));

let section = null;
let printedEmptyHeader = false;
for (const r of data) {
  // section headers: code is roman numeral or single capital letter and label is non-empty,
  // unit/basis often empty.
  const isSectionHeader =
    r.label && (
      /^[IVX]+$/i.test(r.code) ||
      /^[A-Z]$/.test(r.code) ||
      /^[A-Z][0-9]*$/.test(r.code) && !r.unit && !r.eFormula
    );

  if (isSectionHeader) {
    console.log("");
    console.log(`### [${r.row}] ${r.code} — ${r.label}`);
    section = r.label;
    printedEmptyHeader = true;
    continue;
  }

  // Skip rows with no E formula AND no label AND no unit — pure empty rows.
  if (!r.label && !r.unit && !r.eFormula) continue;

  // Mark formula rows so we know they're computed, not user-entered.
  const tag = r.eFormula ? "[CALC]" : "[INPUT]";
  const validation = r.eValidationKind ? ` <${r.eValidationKind}: ${JSON.stringify(r.eValidationFormula)}>` : "";
  const def = r.eDefault != null && r.eDefault !== "" ? ` default=${JSON.stringify(r.eDefault)}` : "";
  const unit = r.unit ? ` (${r.unit})` : "";
  console.log(`  ${tag} row=${r.row}  ${r.code.padEnd(8)} ${r.label}${unit}${validation}${def}`);
}
