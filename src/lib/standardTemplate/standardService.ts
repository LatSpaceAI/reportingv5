// Database access for the standard template: what to put in a blank one, and
// how to turn a parsed one into something commitValues can persist.
//
// server-only. The pure layout/parse modules are deliberately separate so the
// round-trip test can run without Supabase.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AccumulatedValue } from "@/lib/esgCommit/commitValues";
import type { ParsedRow } from "./parseTemplate";
import type { TemplateParameter } from "./templateLayout";

/** Every active parameter, in seed order. Drives the whole template. */
export async function loadTemplateParameters(): Promise<TemplateParameter[]> {
  const { data, error } = await supabaseAdmin
    .from("input_parameter")
    .select("key, section, label, unit, is_memo, sort_order, notes, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((p) => ({
    key: p.key as string,
    section: (p.section as string) ?? "Other",
    label: p.label as string,
    unit: (p.unit as string) ?? null,
    isMemo: Boolean(p.is_memo),
    sortOrder: (p.sort_order as number) ?? null,
    notes: (p.notes as string) ?? null,
  }));
}

/** Real sites (never GROUP) for the site dropdown. */
export async function loadSiteOptions(): Promise<{ code: string; name: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("site")
    .select("code, name, is_group")
    .eq("is_group", false)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({ code: s.code as string, name: s.name as string }));
}

/** The twelve months of a fiscal year, in fiscal order (1 = April). */
export async function loadMonthOptions(
  fiscalYear: string
): Promise<{ monthNo: number; monthLabel: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("period")
    .select("month_no, month_label")
    .eq("fiscal_year", fiscalYear)
    .eq("period_kind", "month")
    .order("month_no", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((p) => p.month_no != null)
    .map((p) => ({
      monthNo: p.month_no as number,
      monthLabel: (p.month_label as string) ?? `Month ${p.month_no}`,
    }));
}

export interface ResolvedTarget {
  site: { id: number; code: string; name: string };
  period: { id: number; monthNo: number; monthLabel: string | null; fiscalYear: string };
}

/**
 * Resolves what a parsed file says it is for against the database.
 *
 * The file carries both a stamped site CODE and a visible site NAME, because the
 * user may have changed the dropdown after downloading. The visible name wins
 * when the two disagree — they picked it deliberately — but a name that resolves
 * to nothing is an error rather than a silent fallback to the stamp, since
 * committing a return to the wrong site is unrecoverable in practice.
 */
export async function resolveTarget(
  header: {
    siteCode: string | null;
    siteName: string | null;
    fiscalYear: string | null;
    monthNo: number | null;
    monthLabel: string | null;
  },
  override?: { siteCode?: string; fiscalYear?: string; monthNo?: number }
): Promise<{ ok: true; target: ResolvedTarget } | { ok: false; error: string }> {
  const fiscalYear = override?.fiscalYear ?? header.fiscalYear;
  if (!fiscalYear) {
    return { ok: false, error: "The file does not say which fiscal year it is for." };
  }

  // ---- Site ---------------------------------------------------------------
  let siteRow: { id: number; code: string; name: string } | null = null;

  if (override?.siteCode) {
    const { data } = await supabaseAdmin
      .from("site")
      .select("id, code, name")
      .eq("code", override.siteCode)
      .maybeSingle();
    siteRow = (data as typeof siteRow) ?? null;
    if (!siteRow) return { ok: false, error: `Unknown site '${override.siteCode}'.` };
  } else if (header.siteName) {
    const { data } = await supabaseAdmin
      .from("site")
      .select("id, code, name")
      .eq("name", header.siteName)
      .maybeSingle();
    siteRow = (data as typeof siteRow) ?? null;
    if (!siteRow) {
      return {
        ok: false,
        error:
          `The site named in the file, "${header.siteName}", is not one of the ` +
          `portfolio's sites. Pick a site from the dropdown and re-upload.`,
      };
    }
  } else if (header.siteCode) {
    const { data } = await supabaseAdmin
      .from("site")
      .select("id, code, name")
      .eq("code", header.siteCode)
      .maybeSingle();
    siteRow = (data as typeof siteRow) ?? null;
  }

  if (!siteRow) {
    return { ok: false, error: "The file does not say which site it is for." };
  }

  // ---- Period -------------------------------------------------------------
  // A month label the user picked from the dropdown is more trustworthy than
  // the stamped number, for the same reason as the site.
  let monthNo = override?.monthNo ?? null;
  if (monthNo == null && header.monthLabel) {
    const { data } = await supabaseAdmin
      .from("period")
      .select("month_no")
      .eq("fiscal_year", fiscalYear)
      .eq("period_kind", "month")
      .ilike("month_label", header.monthLabel)
      .maybeSingle();
    if (data?.month_no != null) monthNo = data.month_no as number;
  }
  if (monthNo == null) monthNo = header.monthNo;

  if (monthNo == null) {
    return { ok: false, error: "The file does not say which month it is for." };
  }

  const { data: period } = await supabaseAdmin
    .from("period")
    .select("id, month_no, month_label, fiscal_year")
    .eq("fiscal_year", fiscalYear)
    .eq("period_kind", "month")
    .eq("month_no", monthNo)
    .maybeSingle();

  if (!period) {
    return {
      ok: false,
      error: `No period exists for ${fiscalYear} month ${monthNo}.`,
    };
  }

  return {
    ok: true,
    target: {
      site: siteRow,
      period: {
        id: period.id as number,
        monthNo: period.month_no as number,
        monthLabel: (period.month_label as string) ?? null,
        fiscalYear: period.fiscal_year as string,
      },
    },
  };
}

export interface ResolvedRows {
  /** Ready for commitValues. */
  values: Map<string, AccumulatedValue>;
  /** Keys the file carried that no active parameter matches. */
  unknownKeys: string[];
  /** Canonical labels, for flag messages. */
  labelsByKey: Record<string, string>;
}

/**
 * Turns parsed rows into the accumulator commitValues expects.
 *
 * NO UNIT FACTOR. The template asks for figures in each parameter's canonical
 * unit and prints that unit beside the input, so what the site types is already
 * canonical — unlike the client's own forms, where a row says "Ltrs" and the
 * disclosure wants kL and site_form_field.unit_factor bridges the two. Any
 * in-cell conversion ("58 kg" on an MT row) has already been applied by
 * parseQuantity during parsing, with its working recorded.
 *
 * Rows sharing a key are still summed, so a template that grows a second row for
 * one parameter keeps working.
 */
export async function resolveRows(rows: ParsedRow[]): Promise<ResolvedRows> {
  const keys = [...new Set(rows.map((r) => r.key))];
  const { data, error } = await supabaseAdmin
    .from("input_parameter")
    .select("key, label, is_active")
    .in("key", keys);
  if (error) throw error;

  const known = new Map(
    (data ?? [])
      .filter((p) => p.is_active !== false)
      .map((p) => [p.key as string, p.label as string])
  );

  const values = new Map<string, AccumulatedValue>();
  const unknownKeys: string[] = [];
  const labelsByKey: Record<string, string> = {};

  for (const r of rows) {
    if (!known.has(r.key)) {
      if (!unknownKeys.includes(r.key)) unknownKeys.push(r.key);
      continue;
    }
    labelsByKey[r.key] = known.get(r.key)!;

    const cur =
      values.get(r.key) ??
      ({ sum: 0, anyValue: false, anyNa: false, rawTexts: [], cells: [] } as AccumulatedValue);

    if (r.isNotAvailable) {
      cur.anyNa = true;
    } else if (r.value != null) {
      cur.sum += r.value;
      cur.anyValue = true;
    }
    if (r.rawText) cur.rawTexts.push(r.rawText);
    if (r.cell) cur.cells.push(r.cell);

    values.set(r.key, cur);
  }

  return { values, unknownKeys, labelsByKey };
}
