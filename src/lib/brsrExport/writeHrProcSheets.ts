// The pure half of the HR/Procurement export: takes a workbook and a value
// index, writes the cells, reports every change. No database, no server-only —
// the offline round-trip test drives this directly against the bundled
// template with stubbed values.

import type ExcelJS from "exceljs";

import { normalizeSharedFormulas } from "./normalizeSharedFormulas";
import { RETURN_LAYOUTS } from "@/lib/hrProcReturn/layouts";
import { templateCellRef } from "@/lib/hrProcReturn/layoutTypes";
import type { ExportCellChange } from "./exportEnvironment";

export interface ReturnValue {
  num: number | null;
  text: string | null;
  /** Fiscal month (1 = April) the value came from — the latest filed. */
  monthNo: number;
}

export interface HrProcWriteResult {
  changes: ExportCellChange[];
  /**
   * Keys with data in their domain but no value themselves. A domain with no
   * data at all contributes nothing here — an untouched tab is not three
   * hundred "missing" metrics, it is one unfiled return.
   */
  missingKeys: string[];
  /** Values held in list slots the template has no placeholder row for. */
  unwritableListValues: { key: string; label: string }[];
  sharedFormulasExpanded: number;
  /** Highest month a value was taken from, per sheet title. */
  latestMonthBySheet: Record<string, number>;
}

const MONTH_NAMES = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

export function writeReturnSheets(
  wb: ExcelJS.Workbook,
  values: Map<string, ReturnValue>
): HrProcWriteResult {
  const changes: ExportCellChange[] = [];
  const missingKeys: string[] = [];
  const unwritableListValues: { key: string; label: string }[] = [];
  const latestMonthBySheet: Record<string, number> = {};
  let sharedFormulasExpanded = 0;

  for (const layout of RETURN_LAYOUTS) {
    const domainHasData = layout.cells.some((c) => values.has(c.key));
    if (!domainHasData) continue;

    const ws = wb.getWorksheet(layout.sheetName);
    if (!ws) throw new Error(`Sheet "${layout.sheetName}" not found in the template`);

    // Same discipline as the Environment sheet: expand shared-formula groups
    // before any write, or ExcelJS refuses to serialise the workbook. The HR
    // tab has 30 shared-formula clones in its Total rows.
    sharedFormulasExpanded += normalizeSharedFormulas(ws);

    for (const spec of layout.cells) {
      const value = values.get(spec.key);
      if (!value) {
        missingKeys.push(spec.key);
        continue;
      }

      latestMonthBySheet[layout.title] = Math.max(
        latestMonthBySheet[layout.title] ?? 0,
        value.monthNo
      );

      const ref = templateCellRef(spec);
      if (ref == null) {
        // A surplus list slot: ingested and chartable, but the template offers
        // no row to land it in. Reported, never silently dropped.
        unwritableListValues.push({ key: spec.key, label: spec.label });
        continue;
      }

      const written = spec.kind === "text" ? value.text : value.num;
      if (written == null) continue;

      const cell = ws.getCell(ref);
      const before = cell.value;
      const isFormula =
        before != null &&
        typeof before === "object" &&
        ("formula" in before || "sharedFormula" in before);
      cell.value = written;
      changes.push({
        sheet: layout.sheetName,
        cell: ref,
        label: `${spec.label} — as of ${MONTH_NAMES[value.monthNo - 1] ?? `month ${value.monthNo}`}`,
        previous:
          before == null
            ? null
            : isFormula
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                `=${(before as any).formula ?? (before as any).sharedFormula}`
              : typeof before === "number" || typeof before === "string"
                ? before
                : String(before),
        written,
        replacedFormula: isFormula,
      });
    }
  }

  return {
    changes,
    missingKeys: missingKeys.sort(),
    unwritableListValues,
    sharedFormulasExpanded,
    latestMonthBySheet,
  };
}
