/**
 * CCTS Requirements registry.
 *
 * Unlike CBAM (whose SOT mapping is hand-curated in cbamSOT.ts), CCTS derives
 * its requirements from the demo seed: every seeded field is exposed as one
 * requirement so users can:
 *   - See pre-filled numbers in blue, with a jump-to-Requirements ↗ button.
 *   - Browse the Requirements tab to inspect every baseline-derived value.
 *
 * The data flows seed → requirements at module load:
 *   id      = field id (e.g. "FS1!I43") — already globally unique
 *   label   = field label from cctsSections.ts (lookup by id)
 *   unit    = field unit from cctsSections.ts (lookup by id)
 *   value   = the seeded value (string | number)
 *   source  = empty by design — the BEE workbook provenance is implicit
 *   target  = { questionId, fieldId } — the cell to link back to
 */
import { sections as cctsSections } from "@/lib/cctsSections";
import { CCTS_SEED } from "@/lib/cctsSeed";
import { cctsDisplayId } from "@/lib/cctsDisplayIds";

export interface CctsRequirement {
  /**
   * Internal stable id. Matches the field id used by the export logic
   * (FormSheet!Cell coordinate like "FS1!I43"). Also used as the DOM
   * anchor and storage key.
   */
  id: string;
  /**
   * CSV-aligned slug from `CCTS_CBAM - Params.csv` (e.g.
   * "hydrate_alumina__electrical_sec_of_hydrated_alumina"). Falls back
   * to `id` when no CSV match exists. This is the value rendered in
   * the "ID" column of the Requirements tab.
   */
  displayId: string;
  label: string;
  unit?: string;
  /** Numeric value only — string answers (Yes / No / Not Applicable) are not requirements. */
  value: number;
  /** Section title where the field lives, e.g. "A. Production and capacity utilization details". */
  sectionTitle: string;
  /** Question label where the field lives. Used for the "Location in Report" column. */
  questionLabel: string;
  /** Sub-block / sub-section path within the section (best-effort). */
  sectionShort: string;
  target: { questionId: string; fieldId: string };
}

// Build a (fieldId → metadata) lookup once at module load.
interface FieldMeta {
  label: string;
  unit?: string;
  sectionTitle: string;
  questionLabel: string;
  questionId: string;
}

const fieldMeta = new Map<string, FieldMeta>();
for (const section of cctsSections) {
  for (const question of section.questions) {
    if (question.kind !== "fields") continue;
    for (const field of question.fields) {
      fieldMeta.set(field.id, {
        label: field.label,
        unit: field.unit,
        sectionTitle: section.title,
        questionLabel: question.label,
        questionId: question.id,
      });
    }
  }
}

// Now derive one requirement per seeded field. Only numeric values become
// requirements — string answers like "Yes" / "No" / "Not Applicable" on
// Boundary Coverage rows are not part of the Requirements registry and don't
// render in blue on the Document tab either.
export const cctsRequirements: CctsRequirement[] = [];
for (const [questionId, values] of Object.entries(CCTS_SEED)) {
  for (const [fieldId, value] of Object.entries(values)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const meta = fieldMeta.get(fieldId);
    if (!meta) continue; // seed references a field that no longer exists — skip
    cctsRequirements.push({
      id: fieldId,
      displayId: cctsDisplayId(fieldId),
      label: meta.label,
      unit: meta.unit,
      value,
      sectionTitle: meta.sectionTitle,
      questionLabel: meta.questionLabel,
      sectionShort: meta.sectionTitle.replace(/^[A-Z0-9]+\.\s*/, ""),
      target: { questionId, fieldId },
    });
  }
}

// Fast lookups for the Questionnaire blue-number wiring.
export const cctsRequirementByFieldId = new Map<string, CctsRequirement>(
  cctsRequirements.map((r) => [r.id, r])
);

/** Same set keyed by requirement.id — id == fieldId for natively-seeded fields, but
 *  user-picked requirements may share a value id with their original cell while
 *  living at a different (questionId, fieldId). */
export const cctsRequirementById = cctsRequirementByFieldId;

/**
 * Resolve a requirement that is *natively* anchored at (questionId, fieldId)
 * (i.e. the seed put it there). Runtime user picks are tracked separately
 * via `cctsUserTargets` so the lookup combines the two in
 * `cctsRequirementForCell` below.
 */
export function cctsRequirementForField(
  questionId: string,
  fieldId: string
): CctsRequirement | null {
  const r = cctsRequirementByFieldId.get(fieldId);
  if (!r) return null;
  if (r.target.questionId !== questionId) return null;
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime-added user targets — set by the user when they pick a requirement
// into a number field via the "+ Add requirement" picker. Persisted in
// localStorage so the linkage survives reloads. Mirrors cbamSOT's UserTarget.
// ─────────────────────────────────────────────────────────────────────────────

export const CCTS_USER_TARGETS_KEY = "ccts-app/requirement-user-targets/v1";

export interface CctsUserTarget {
  /** Requirement id (matches CctsRequirement.id, also the source field id). */
  valueId: string;
  /** Where the user picked the value into. */
  questionId: string;
  fieldId: string;
}

export function readCctsUserTargets(): CctsUserTarget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CCTS_USER_TARGETS_KEY);
    return raw ? (JSON.parse(raw) as CctsUserTarget[]) : [];
  } catch {
    return [];
  }
}

export function writeCctsUserTargets(ts: CctsUserTarget[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CCTS_USER_TARGETS_KEY, JSON.stringify(ts));
}
