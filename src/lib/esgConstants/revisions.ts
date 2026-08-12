// Writing and reading the constant audit trail.
//
// ORDERING IS LOAD-BEARING: the revision row is written BEFORE the constant is
// updated.
//
// PostgREST gives us no transaction across two statements, so one of the two
// failure modes has to be chosen deliberately. A revision row with no
// corresponding change is detectable (its old_value still matches the live
// value) and harmless. A changed value with no audit row is the exact failure
// this feature exists to prevent — an unexplained move in a published figure.
// So the audit row goes first.
//
// A cleaner fix is an esg.apply_constant_revision() RPC doing both in one
// statement. Flagged rather than built: it moves logic into the database that
// currently reads clearly here.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ConstantRow {
  id: number;
  key: string;
  category: string;
  categoryName: string;
  label: string;
  value: number;
  unit: string | null;
  source: string | null;
  sourceDate: string | null;
  isAssumption: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string | null;
  directRefCount: number;
  editCount: number;
}

export interface Revision {
  id: number;
  constantKey: string;
  oldValue: number | null;
  newValue: number;
  oldIsAssumption: boolean | null;
  newIsAssumption: boolean | null;
  oldSource: string | null;
  newSource: string | null;
  reason: string | null;
  changeKind: "edit" | "revert" | "seed";
  revertedRevisionId: number | null;
  affectedOutputKeys: string[] | null;
  affectedRowCount: number | null;
  changedBy: string | null;
  changedAt: string;
}

export async function listConstants(): Promise<ConstantRow[]> {
  const { data, error } = await supabaseAdmin
    .from("v_constant_settings")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id as number,
    key: c.key as string,
    category: c.category as string,
    categoryName: (c.category_name as string) ?? (c.category as string),
    label: c.label as string,
    value: Number(c.value),
    unit: (c.unit as string) ?? null,
    source: (c.source as string) ?? null,
    sourceDate: (c.source_date as string) ?? null,
    isAssumption: Boolean(c.is_assumption),
    notes: (c.notes as string) ?? null,
    updatedAt: c.updated_at as string,
    updatedBy: (c.updated_by as string) ?? null,
    directRefCount: Number(c.direct_ref_count ?? 0),
    editCount: Number(c.edit_count ?? 0),
  }));
}

export async function listRevisions(constantKey: string): Promise<Revision[]> {
  const { data, error } = await supabaseAdmin
    .from("constant_revision")
    .select("*")
    .eq("constant_key", constantKey)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRevision);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRevision(r: any): Revision {
  return {
    id: r.id as number,
    constantKey: r.constant_key as string,
    oldValue: r.old_value == null ? null : Number(r.old_value),
    newValue: Number(r.new_value),
    oldIsAssumption: r.old_is_assumption ?? null,
    newIsAssumption: r.new_is_assumption ?? null,
    oldSource: r.old_source ?? null,
    newSource: r.new_source ?? null,
    reason: r.reason ?? null,
    changeKind: r.change_kind as "edit" | "revert" | "seed",
    revertedRevisionId: r.reverted_revision_id ?? null,
    affectedOutputKeys: r.affected_output_keys ?? null,
    affectedRowCount: r.affected_row_count ?? null,
    changedBy: r.changed_by ?? null,
    changedAt: r.changed_at as string,
  };
}

export interface ApplyEditInput {
  constant: ConstantRow;
  newValue: number;
  newIsAssumption: boolean;
  newSource: string | null;
  newSourceDate: string | null;
  reason: string;
  changedBy: string;
  changeKind: "edit" | "revert";
  revertedRevisionId?: number | null;
  /** The blast radius as shown to the user, stored with the revision. */
  affectedOutputKeys: string[];
  affectedRowCount: number;
}

/**
 * Writes the audit row, then the constant. Returns the revision id.
 *
 * Restores value, is_assumption, source and source_date TOGETHER — a partial
 * write would leave a value whose recorded source describes a different number,
 * which is worse than either change alone.
 */
export async function applyEdit(input: ApplyEditInput): Promise<number> {
  const { constant: c } = input;

  const { data: rev, error: revErr } = await supabaseAdmin
    .from("constant_revision")
    .insert({
      constant_id: c.id,
      constant_key: c.key,
      old_value: c.value,
      new_value: input.newValue,
      old_is_assumption: c.isAssumption,
      new_is_assumption: input.newIsAssumption,
      old_source: c.source,
      new_source: input.newSource,
      old_source_date: c.sourceDate,
      new_source_date: input.newSourceDate,
      reason: input.reason,
      change_kind: input.changeKind,
      reverted_revision_id: input.revertedRevisionId ?? null,
      affected_output_keys: input.affectedOutputKeys,
      affected_row_count: input.affectedRowCount,
      changed_by: input.changedBy,
    })
    .select("id")
    .single();
  if (revErr) throw revErr;

  const { error: updErr } = await supabaseAdmin
    .from("constant")
    .update({
      value: input.newValue,
      is_assumption: input.newIsAssumption,
      source: input.newSource,
      source_date: input.newSourceDate,
      updated_by: input.changedBy,
      // updated_at is stamped by the constant_set_updated_at trigger, which is
      // what the staleness comparison reads. Not set here, so the database owns
      // the clock.
    })
    .eq("id", c.id);
  if (updErr) {
    // The audit row now describes a change that did not happen. Detectable —
    // its old_value still equals the live value — and harmless, but say so
    // loudly rather than swallow it.
    throw new Error(
      `The audit row was written (revision ${rev.id}) but updating ${c.key} failed: ` +
        `${updErr.message}. The constant is unchanged; the revision records an ` +
        `attempt that did not take effect.`
    );
  }

  return rev.id as number;
}
