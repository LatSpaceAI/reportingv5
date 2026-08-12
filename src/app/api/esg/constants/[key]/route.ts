// Edit one constant.
//
//   PATCH /api/esg/constants/EF.diesel
//   { value?, isAssumption?, source?, sourceDate?, reason, changedBy,
//     expectedValue, confirmInert? }
//
// THE THINGS THIS ROUTE REFUSES, AND WHY
//
//   no reason              The audit trail is the point. A value that moved with
//                          no recorded reason is indistinguishable from a typo.
//   expectedValue mismatch Optimistic concurrency. Two people editing EF.diesel
//                          from stale pages would otherwise overwrite each other,
//                          and the loser's revision row would record a bogus
//                          old_value — corrupting the trail, not just the value.
//   inert without consent  Editing a constant no formula references changes
//                          nothing. Refusing without confirmInert makes the
//                          no-op explicit rather than letting someone believe
//                          they fixed something.
//
// Validation is re-run SERVER-SIDE from the same pure module the dialog uses, so
// the UI cannot show one verdict while the server enforces another.

import { NextRequest } from "next/server";

import { CURRENT_USER } from "@/lib/currentUser";
import { computeBlastRadius } from "@/lib/esgConstants/blastRadius";
import { listConstants, applyEdit } from "@/lib/esgConstants/revisions";
import {
  validateConstantEdit,
  validateReason,
  isBlocked,
} from "@/lib/esgConstants/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  value?: number | string;
  isAssumption?: boolean;
  source?: string | null;
  sourceDate?: string | null;
  reason?: string;
  changedBy?: string;
  /** The value the UI last showed. Guards against a concurrent edit. */
  expectedValue?: number;
  confirmInert?: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
): Promise<Response> {
  const { key } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  try {
    const constants = await listConstants();
    const constant = constants.find((c) => c.key === key);
    if (!constant) return json({ ok: false, error: `Unknown constant '${key}'.` }, 404);

    // ---- Reason -----------------------------------------------------------
    const reasonError = validateReason(body.reason);
    if (reasonError) return json({ ok: false, error: reasonError }, 400);

    // ---- Optimistic concurrency ------------------------------------------
    if (
      body.expectedValue !== undefined &&
      Number(body.expectedValue) !== Number(constant.value)
    ) {
      return json(
        {
          ok: false,
          error:
            `${key} has changed since this page loaded — it is now ${constant.value}, ` +
            `not ${body.expectedValue}. Reload before editing so the audit trail records ` +
            `the right starting value.`,
          currentValue: constant.value,
        },
        409
      );
    }

    // ---- What is being changed ------------------------------------------
    // A value is optional: confirming an assumption WITHOUT changing the number
    // is the primary ESG-team workflow, and a naive "nothing changed" guard
    // would block exactly that.
    const rawValue =
      body.value === undefined ? String(constant.value) : String(body.value);
    const newIsAssumption =
      body.isAssumption === undefined ? constant.isAssumption : Boolean(body.isAssumption);

    const valueChanged = Number(rawValue) !== Number(constant.value);
    const assumptionChanged = newIsAssumption !== constant.isAssumption;
    const sourceChanged =
      body.source !== undefined && (body.source ?? null) !== constant.source;

    if (!valueChanged && !assumptionChanged && !sourceChanged) {
      return json(
        {
          ok: false,
          error:
            "Nothing would change. Adjust the value, mark it confirmed, or update the source.",
        },
        400
      );
    }

    // ---- Blast radius, computed server-side -----------------------------
    // Never trusted from the client: it is what the refusals below key off, and
    // it is stored with the revision as what the user was shown.
    const radius = await computeBlastRadius(key);

    // ---- Validation, same module as the dialog --------------------------
    const issues = validateConstantEdit({
      key,
      category: constant.category,
      rawValue,
      currentValue: constant.value,
      directRefCount: radius.directKeys.length,
    });
    if (isBlocked(issues)) {
      return json(
        { ok: false, error: issues.find((i) => i.severity === "block")!.message, issues },
        400
      );
    }

    // ---- Inert edits need explicit consent ------------------------------
    // Only when the VALUE moves. Marking an inert constant confirmed is a
    // documentation act with no computational effect, and demanding a second
    // confirmation for it would be noise.
    if (valueChanged && radius.outputs.length === 0 && !body.confirmInert) {
      return json(
        {
          ok: false,
          requiresInertConfirm: true,
          inertReason: radius.inertReason,
          error:
            `No formula references ${key}, so changing its value will not move any ` +
            `computed figure. If you meant to change how entered figures are converted, ` +
            `that lives on the form field (site_form_field.unit_factor), not here. ` +
            `Confirm to record the change anyway.`,
        },
        400
      );
    }

    const revisionId = await applyEdit({
      constant,
      newValue: Number(rawValue),
      newIsAssumption,
      newSource: body.source === undefined ? constant.source : body.source,
      newSourceDate: body.sourceDate === undefined ? constant.sourceDate : body.sourceDate,
      reason: body.reason!.trim(),
      changedBy: body.changedBy ?? CURRENT_USER.id,
      changeKind: "edit",
      affectedOutputKeys: radius.outputs.map((o) => o.key),
      affectedRowCount: radius.existingRowCount,
    });

    return json({
      ok: true,
      revisionId,
      // Only a value change makes the computed figures stale. Confirming an
      // assumption changes no arithmetic, so the banner must not appear.
      createsStaleness: valueChanged && radius.outputs.length > 0,
      radius: {
        outputs: radius.outputs,
        existingRowCount: radius.existingRowCount,
        driftDetected: radius.driftDetected,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants/patch] failed", { key, message });
    return json({ ok: false, error: message }, 500);
  }
}
