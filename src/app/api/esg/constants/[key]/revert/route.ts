// Undo a constant edit.
//
//   POST /api/esg/constants/EF.diesel/revert
//   { revisionId, reason, changedBy }
//
// A revert is an EDIT, not an erasure: it writes a new revision whose new_value
// is the target's old_value, and points at what it undid. The trail stays
// append-only, so "we tried 2.58 for a week and went back" remains visible —
// which is exactly what an assurer would want to see.
//
// It restores value, is_assumption, source AND source_date together. A partial
// revert would leave a value whose recorded source describes a different number,
// which is harder to explain than either change alone.
//
// Reverting moves a published figure exactly as an edit does, so it demands a
// reason on the same terms.

import { NextRequest } from "next/server";

import { CURRENT_USER } from "@/lib/currentUser";
import { computeBlastRadius } from "@/lib/esgConstants/blastRadius";
import { listConstants, listRevisions, applyEdit } from "@/lib/esgConstants/revisions";
import { validateReason } from "@/lib/esgConstants/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
): Promise<Response> {
  const { key } = await ctx.params;

  let body: { revisionId?: number; reason?: string; changedBy?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (!body.revisionId) {
    return json({ ok: false, error: "revisionId is required" }, 400);
  }

  const reasonError = validateReason(body.reason);
  if (reasonError) return json({ ok: false, error: reasonError }, 400);

  try {
    const constants = await listConstants();
    const constant = constants.find((c) => c.key === key);
    if (!constant) return json({ ok: false, error: `Unknown constant '${key}'.` }, 404);

    const revisions = await listRevisions(key);
    const target = revisions.find((r) => r.id === body.revisionId);
    if (!target) {
      return json(
        { ok: false, error: `Revision ${body.revisionId} does not belong to ${key}.` },
        404
      );
    }

    // A seed revision has no old_value — there is nothing before it to go back
    // to, so it cannot be the target of a revert.
    if (target.oldValue == null) {
      return json(
        {
          ok: false,
          error:
            "That is the original seeded value, so there is nothing earlier to revert to.",
        },
        400
      );
    }

    if (Number(target.oldValue) === Number(constant.value)) {
      return json(
        {
          ok: false,
          error: `${key} is already ${constant.value}. That revision has nothing left to undo.`,
        },
        400
      );
    }

    const radius = await computeBlastRadius(key);

    const revisionId = await applyEdit({
      constant,
      newValue: Number(target.oldValue),
      // Restored together with the value: a value whose source describes a
      // different number is worse than either alone.
      newIsAssumption: target.oldIsAssumption ?? constant.isAssumption,
      newSource: target.oldSource ?? constant.source,
      newSourceDate: constant.sourceDate,
      reason: body.reason!.trim(),
      changedBy: body.changedBy ?? CURRENT_USER.id,
      changeKind: "revert",
      revertedRevisionId: target.id,
      affectedOutputKeys: radius.outputs.map((o) => o.key),
      affectedRowCount: radius.existingRowCount,
    });

    return json({
      ok: true,
      revisionId,
      restoredValue: Number(target.oldValue),
      createsStaleness: radius.outputs.length > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants/revert] failed", { key, message });
    return json({ ok: false, error: message }, 500);
  }
}
