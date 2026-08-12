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

  // WHY THE REVISION TRAIL AND NOT JUST updated_at
  //
  // updated_at moves on ANY edit, but only a change of VALUE makes the computed
  // figures wrong. Marking a factor "confirmed against its source" — which is
  // the primary ESG-team workflow, and deliberately allowed without touching the
  // number — changes no arithmetic whatsoever. Keying off updated_at alone told
  // the user to re-run the resolver after every confirmation, which would train
  // them to ignore the banner precisely when it matters.
  //
  // So a constant is stale only if a revision that ACTUALLY MOVED ITS VALUE
  // landed after the last successful run. The trail already records old_value
  // and new_value per revision, so this needs no new column.
  const { data: valueChanges } = await supabaseAdmin
    .from("constant_revision")
    .select("constant_key, old_value, new_value, changed_at")
    .neq("change_kind", "seed")
    .order("changed_at", { ascending: false })
    .limit(500);

  /** Newest revision per key that changed the number, keyed by constant. */
  const lastValueChangeByKey = new Map<string, string>();
  for (const r of valueChanges ?? []) {
    const key = r.constant_key as string;
    if (lastValueChangeByKey.has(key)) continue; // ordered desc, first wins
    if (Number(r.old_value) === Number(r.new_value)) continue; // confirm-only
    lastValueChangeByKey.set(key, r.changed_at as string);
  }

  if (!lastResolvedAt) {
    // Nothing has ever been recorded as resolved. If figures exist they were
    // computed before this bookkeeping existed, and the migration's baseline row
    // covers that case — so reaching here means output_value is genuinely empty
    // or the migration has not been applied.
    // Nothing has ever been recorded as resolved, so every live constant is
    // unapplied by definition — but only report the ones that feed a formula,
    // for the same reason as below.
    const unapplied = live.filter((c) => lastValueChangeByKey.has(c.key as string));
    return {
      isStale: live.length > 0,
      staleKeys: unapplied.map((c) => c.key as string),
      lastEditedAt: (live[0]?.updated_at as string | null) ?? null,
      lastResolvedAt: null,
      lastResolvedFiscalYear: null,
      neverResolved: true,
    };
  }

  const resolvedMs = new Date(lastResolvedAt).getTime();

  // A constant is stale when it feeds a formula AND its value moved after the
  // last run. Both halves are required: an inert constant's value change moves
  // nothing, and a live constant's confirmation changes no arithmetic.
  const stale = live.filter((c) => {
    const movedAt = lastValueChangeByKey.get(c.key as string);
    return movedAt !== undefined && new Date(movedAt).getTime() > resolvedMs;
  });

  return {
    isStale: stale.length > 0,
    staleKeys: stale.map((c) => c.key as string),
    lastEditedAt:
      stale.length > 0 ? lastValueChangeByKey.get(stale[0].key as string) ?? null : null,
    lastResolvedAt,
    lastResolvedFiscalYear: (lastRun?.fiscal_year as string | null) ?? null,
    neverResolved: false,
  };
}
