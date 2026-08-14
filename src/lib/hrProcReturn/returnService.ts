// Database half of the HR/Procurement monthly-return module. The parser is
// pure; everything that touches Supabase lives here so the tests can exercise
// the contract offline.
//
// WHERE THESE VALUES ARE BOOKED
//
// HR and Procurement are company-level functions — there is no site return
// behind them. Values are booked against the GROUP site (a legal esg.site row,
// the same one the Scope 3 ledger batches use) at the selected month period.
// The dashboard reads GROUP-booked input rows directly, so the figures chart
// without any dashboard change; the Birla export takes, per parameter, the
// latest month that holds a value (the sheets are cumulative, so the latest
// month IS the year-to-date figure).

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AccumulatedValue } from "@/lib/esgCommit/commitValues";
import { RETURN_LAYOUTS } from "./layouts";
import type { ParsedReturnSheet } from "./parseReturn";
import type { ReturnDomain, SheetCell } from "./layoutTypes";

export interface ReturnTarget {
  site: { id: number; code: string; name: string };
  period: { id: number; fiscalYear: string; monthNo: number; monthLabel: string | null };
}

/** GROUP site + the requested month period. */
export async function resolveTarget(
  fiscalYear: string,
  monthNo: number
): Promise<{ ok: true; target: ReturnTarget } | { ok: false; error: string }> {
  const [{ data: site }, { data: period }] = await Promise.all([
    supabaseAdmin.from("site").select("id, code, name").eq("is_group", true).single(),
    supabaseAdmin
      .from("period")
      .select("id, fiscal_year, month_no, month_label")
      .eq("fiscal_year", fiscalYear)
      .eq("period_kind", "month")
      .eq("month_no", monthNo)
      .single(),
  ]);

  if (!site) return { ok: false, error: "No GROUP site is configured." };
  if (!period) {
    return { ok: false, error: `No month period exists for ${fiscalYear} month ${monthNo}.` };
  }
  return {
    ok: true,
    target: {
      site: { id: site.id as number, code: site.code as string, name: site.name as string },
      period: {
        id: period.id as number,
        fiscalYear: period.fiscal_year as string,
        monthNo: period.month_no as number,
        monthLabel: (period.month_label as string | null) ?? null,
      },
    },
  };
}

export interface DomainParameters {
  /** input_parameter.id by key, across both return domains. */
  idByKey: Map<string, number>;
  /** All parameter ids per domain — the supersession scope. */
  idsByDomain: Map<ReturnDomain, number[]>;
}

/**
 * Loads the seeded parameters for both return domains. An empty result means
 * migration 17 has not been applied — the caller turns that into a message
 * naming the migration rather than a mysterious "nothing matched".
 */
export async function loadDomainParameters(): Promise<DomainParameters> {
  const { data, error } = await supabaseAdmin
    .from("input_parameter")
    .select("id, key, domain")
    .in("domain", ["HR", "PROCUREMENT"]);
  if (error) throw error;

  const idByKey = new Map<string, number>();
  const idsByDomain = new Map<ReturnDomain, number[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    idByKey.set(row.key as string, row.id as number);
    const domain = row.domain as ReturnDomain;
    idsByDomain.set(domain, [...(idsByDomain.get(domain) ?? []), row.id as number]);
  }
  return { idByKey, idsByDomain };
}

/** Live (non-superseded) value counts per return domain for the site-month. */
export async function existingCountsByDomain(
  siteId: number,
  periodId: number,
  params: DomainParameters
): Promise<Record<string, number>> {
  const allIds = [...params.idsByDomain.values()].flat();
  if (!allIds.length) return {};
  const { data, error } = await supabaseAdmin
    .from("input_value")
    .select("parameter_id")
    .eq("site_id", siteId)
    .eq("period_id", periodId)
    .is("superseded_at", null)
    .in("parameter_id", allIds);
  if (error) throw error;

  const domainOfId = new Map<number, ReturnDomain>();
  for (const [domain, ids] of params.idsByDomain) {
    for (const id of ids) domainOfId.set(id, domain);
  }
  const counts: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const domain = domainOfId.get(row.parameter_id as number);
    if (domain) counts[domain] = (counts[domain] ?? 0) + 1;
  }
  return counts;
}

const cellByKey = new Map<string, SheetCell>(
  RETURN_LAYOUTS.flatMap((l) => l.cells.map((c) => [c.key, c] as const))
);

export function layoutCellByKey(key: string): SheetCell | undefined {
  return cellByKey.get(key);
}

/**
 * Turns parsed sheets into the commitValues shape. Each cell is one parameter
 * (nothing shares a key), so there is no summing — a numeric cell contributes
 * its value, a text cell its prose, an NA cell its marker.
 */
export function accumulate(sheets: ParsedReturnSheet[]): Map<string, AccumulatedValue> {
  const values = new Map<string, AccumulatedValue>();
  for (const sheet of sheets) {
    for (const cell of sheet.cells) {
      const acc: AccumulatedValue = {
        sum: cell.value ?? 0,
        anyValue: cell.value != null,
        anyNa: cell.isNotAvailable,
        text: cell.text,
        rawTexts: cell.rawText ? [cell.rawText] : [],
        cells: [`${sheet.sheetName}!${cell.sheetCell}`],
      };
      values.set(cell.key, acc);
    }
  }
  return values;
}
