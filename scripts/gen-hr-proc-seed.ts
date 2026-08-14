#!/usr/bin/env node
// Emits supabase/esg/17_hr_procurement_inputs.sql from the HR/Procurement
// return layouts — the layouts are the single source of truth, the SQL is a
// build artifact that gets checked in and applied by hand (repo convention).
//
// Regenerate after any layout change:
//
//   npx tsx scripts/gen-hr-proc-seed.ts
//
// test-hr-proc-return.ts asserts the checked-in file agrees with the layouts,
// so forgetting to regenerate fails esg:check rather than drifting silently.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { RETURN_LAYOUTS } from "../src/lib/hrProcReturn/layouts";
import { templateCellRef } from "../src/lib/hrProcReturn/layoutTypes";

export const SEED_SQL_PATH = join("supabase", "esg", "17_hr_procurement_inputs.sql");

const q = (s: string | null | undefined) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

const DOMAIN_OF = { HR: "HR", PROCUREMENT: "PROCUREMENT" } as const;

export function buildSeedSql(): string {
  const lines: string[] = [];
  lines.push(`-- =============================================================================
-- BIRLA ESTATES — HR & PROCUREMENT MONTHLY RETURN INPUT PARAMETERS
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   npx tsx scripts/gen-hr-proc-seed.ts
--
-- One input_parameter per data cell of the two monthly workbooks ("BRSR - HR"
-- and "BRSR - Procurement"), as declared in src/lib/hrProcReturn/. The sheets
-- are filled CUMULATIVELY (each month carries FY-to-date figures), values are
-- booked against the GROUP site at month periods, and the export takes the
-- latest month per parameter. Cells the template computes with its own
-- formulas are deliberately absent.
--
-- Apply after 16_dashboard_presets.sql.
-- =============================================================================

set search_path = esg, public;

-- Two new domains; the lookup table is extended by insert (SCOPE3 precedent).
insert into esg.domain (code, name, sort_order) values
    ('HR', 'Human Resources & People', 90),
    ('PROCUREMENT', 'Procurement, Supply Chain & Marketing', 95)
on conflict (code) do nothing;

-- input_value_history predates text values; commitValues archives value_text
-- on supersession from now on, so history must be able to hold it.
alter table esg.input_value_history add column if not exists value_text text;
`);

  for (const layout of RETURN_LAYOUTS) {
    const domain = DOMAIN_OF[layout.domain];
    lines.push(`
-- -----------------------------------------------------------------------------
-- ${layout.title} (sheet "${layout.sheetName}") — ${layout.cells.length} parameters
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, value_type, is_memo, sort_order, notes) values`);

    const rows = layout.cells.map((cell, i) => {
      const ref = templateCellRef(cell);
      const note = ref
        ? `Template cell ${layout.sheetName}!${ref}`
        : `List slot ${cell.slot} beyond the template's placeholder rows: ingested and chartable, but the export has no cell for it`;
      const sortOrder = (i + 1) * 10;
      return (
        `(${q(cell.key)}, ${q(domain)}, ${q(cell.blockId)}, ${q(cell.label)}, ` +
        `${q(cell.unit ?? null)}, ${q(cell.kind)}, false, ${sortOrder}, ${q(note)})`
      );
    });
    lines.push(rows.join(",\n"));
    lines.push(`on conflict (key) do update set
    domain = excluded.domain,
    section = excluded.section,
    label = excluded.label,
    unit = excluded.unit,
    value_type = excluded.value_type,
    is_memo = excluded.is_memo,
    sort_order = excluded.sort_order,
    notes = excluded.notes;`);
  }

  lines.push(`
notify pgrst, 'reload schema';
`);

  return lines.join("\n");
}

// tsx runs this file directly; the import.meta check keeps the test's import
// of buildSeedSql side-effect free.
if (process.argv[1] && /gen-hr-proc-seed/.test(process.argv[1])) {
  writeFileSync(SEED_SQL_PATH, buildSeedSql(), "utf8");
  console.log(`wrote ${SEED_SQL_PATH}`);
}
