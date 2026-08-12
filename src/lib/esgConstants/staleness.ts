// Are the computed figures behind the constants they rest on?
//
// DERIVED, never stored. See 12_constant_revision.sql for the full reasoning;
// the short version is that resolve-birla.mjs upserts without mentioning any
// staleness column, so a stored flag would latch on permanently after the first
// edit unless the resolver were taught to clear it — and putting a settings
// page's correctness inside the script that produces every published figure is
// the wrong trade.
//
// The comparison:
//
//   left   newest constant.updated_at among constants that ACTUALLY FEED A
//          FORMULA. An edit to an inert constant (CONV.l_to_kl, GWP.r22) changes
//          no computed figure, so it must not raise a banner telling the user to
//          re-run for nothing.
//   right  newest resolver_run.finished_at where status = 'succeeded' and not
//          dry_run. A dry run computes nothing, so counting it would falsely
//          clear staleness.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface Staleness {
  isStale: boolean;
  /** Constants edited since the last successful run, newest first. */
  staleKeys: string[];
  /** When those edits happened. */
  lastEditedAt: string | null;
  /** When the figures were last computed. */
  lastResolvedAt: string | null;
  /** Fiscal year the last run covered; null means all years. */
  lastResolvedFiscalYear: string | null;
  /** True when no successful run has ever been recorded. */
  neverResolved: boolean;
}

export async function computeStaleness(): Promise<Staleness> {
  // ---- Right side: the last real run --------------------------------------
  const { data: runs } = await supabaseAdmin
    .from("resolver_run")
    .select("finished_at, fiscal_year")
    .eq("status", "succeeded")
    .eq("dry_run", false)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);

  const lastRun = runs?.[0] ?? null;
  const lastResolvedAt = (lastRun?.finished_at as string | null) ?? null;

  // ---- Left side: constants that feed a formula ---------------------------
  // v_constant_settings carries direct_ref_count, so the filter for "actually
  // affects a computed figure" is one column rather than a second query.
  const { data: constants } = await supabaseAdmin
    .from("v_constant_settings")
    .select("key, updated_at, direct_ref_count")
    .gt("direct_ref_count", 0)
    .order("updated_at", { ascending: false });

  const live = constants ?? [];

  if (!lastResolvedAt) {
    // Nothing has ever been recorded as resolved. If figures exist they were
    // computed before this bookkeeping existed, and the migration's baseline row
    // covers that case — so reaching here means output_value is genuinely empty
    // or the migration has not been applied.
    return {
      isStale: live.length > 0,
      staleKeys: live.map((c) => c.key as string),
      lastEditedAt: (live[0]?.updated_at as string | null) ?? null,
      lastResolvedAt: null,
      lastResolvedFiscalYear: null,
      neverResolved: true,
    };
  }

  const resolvedMs = new Date(lastResolvedAt).getTime();
  const stale = live.filter(
    (c) => new Date(c.updated_at as string).getTime() > resolvedMs
  );

  return {
    isStale: stale.length > 0,
    staleKeys: stale.map((c) => c.key as string),
    lastEditedAt: (stale[0]?.updated_at as string | null) ?? null,
    lastResolvedAt,
    lastResolvedFiscalYear: (lastRun?.fiscal_year as string | null) ?? null,
    neverResolved: false,
  };
}
