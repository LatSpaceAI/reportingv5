// Validation for a constant edit.
//
// PURE — no `server-only`, no Supabase import. Both the edit dialog and the
// PATCH route import this module, which is what guarantees the UI can never show
// a different verdict than the server enforces. That is the same discipline
// parseQuantity follows for the entry screen, and for the same reason:
// BIRLA_ESTATES.md records a bug where the UI previewed one number while the
// server stored another.
//
// A stray `supabaseAdmin` import here would break the client bundle at build
// time. Keep it pure.
//
// NEVER A SILENT BLOCK. The ESG team may legitimately hold a factor outside the
// IPCC range — a supplier-specific value, or a figure their assurer asked for.
// The app's job is to record it with a reason, not to refuse it. Only physically
// impossible or model-breaking values are hard-blocked; everything else warns
// and asks the user to confirm by typing the key. Consistent with data_flag's
// never-block philosophy (01_schema.sql:333-341).

export type Severity = "block" | "warn" | "ok";

export interface ValidationIssue {
  severity: Severity;
  message: string;
  /** True when the user must type the constant's key to proceed. */
  requiresTypedConfirm?: boolean;
}

export interface ValidateInput {
  key: string;
  category: string;
  /** The raw text from the input, so "2.6.5" and "" are catchable. */
  rawValue: string;
  currentValue: number;
  /** Number of formulas that reference this constant directly. */
  directRefCount: number;
}

/**
 * Plausible ranges per constant category. A value outside its range WARNS and
 * demands a typed confirmation; it is never refused.
 *
 * Keyed by category code with a permissive default, so seeding a new category
 * cannot brick the page.
 */
export const PLAUSIBLE_RANGES: Record<string, { min: number; max: number; note: string }> = {
  EF_GRID: {
    min: 0.3,
    max: 1.2,
    note: "grid factors sit around 0.7 kg CO2/kWh in India; 0.3-1.2 covers every plausible national average",
  },
  EF_FUEL: {
    min: 1.5,
    max: 4.0,
    note: "liquid fuels are 2.3-2.7 kg CO2e/L; outside 1.5-4.0 suggests a unit error",
  },
  GWP_REFRIG: {
    min: 1,
    max: 15000,
    note: "AR6 GWP-100 values for refrigerants span roughly 1 to 15,000",
  },
  CONVERSION: {
    min: 1e-9,
    max: 1e9,
    note: "unit conversions are exact by definition; changing one is almost never correct",
  },
  DATA_QUALITY: {
    min: 0.01,
    max: 1,
    note: "the anomaly tolerance is a FRACTION — 0.20 means 20%",
  },
  FINANCIAL: {
    min: 1e7,
    max: 1e13,
    note:
      "turnover is an absolute INR figure, not crores — ₹5,000 crore is 50000000000, not 5000. " +
      "The floor deliberately rejects the 1 placeholder these constants ship with",
  },
};

/** Fraction-valued constants, where a percentage typed as 20 would silently
 *  disable the check it drives. */
const FRACTION_KEYS = new Set(["qa.anomaly_tolerance"]);

/** A change larger than this demands a typed confirmation. */
const LARGE_CHANGE = 0.25;

/** The value a constant carries when it is a stand-in rather than a measurement.
 *  17_brsr_gap_metrics.sql seeds FIN.turnover as 1 deliberately: a plausible
 *  guess would yield a plausible-looking intensity that is wrong, whereas 1
 *  yields an obviously absurd one nobody can mistake for a disclosure. */
const PLACEHOLDER_VALUE = 1;

export function validateConstantEdit(input: ValidateInput): ValidationIssue[] {
  const { key, category, rawValue, currentValue, directRefCount } = input;
  const issues: ValidationIssue[] = [];

  const text = (rawValue ?? "").trim();
  if (text === "") {
    return [{ severity: "block", message: "Enter a value." }];
  }

  const value = Number(text.replace(/,/g, ""));

  if (!Number.isFinite(value)) {
    return [{ severity: "block", message: `"${text}" is not a number.` }];
  }
  if (value <= 0) {
    // Every one of the 15 seeded constants is strictly positive. A future
    // signed constant would need a per-category allowNegative flag.
    return [
      {
        severity: "block",
        message:
          "A constant must be greater than zero. Every emission factor, GWP and " +
          "conversion in this model is positive.",
      },
    ];
  }
  if (decimalPlaces(text) > 8) {
    return [
      {
        severity: "block",
        message: "More than 8 decimal places is beyond the precision any source publishes.",
      },
    ];
  }

  // ---- Fractions -----------------------------------------------------------
  // Hard block, not a warning: qa.anomaly_tolerance is used as a fraction in
  // importService.ts, so 20 instead of 0.20 would silence every anomaly flag
  // rather than loosening it. A silent no-op is worse than a refusal.
  if (FRACTION_KEYS.has(key) && (value <= 0 || value > 1)) {
    return [
      {
        severity: "block",
        message:
          `${key} is a fraction between 0 and 1 — 0.20 means 20%. ` +
          `A value of ${value} would disable the check it drives rather than loosen it.`,
      },
    ];
  }

  // ---- Inert edits ---------------------------------------------------------
  if (directRefCount === 0) {
    issues.push({
      severity: "warn",
      message:
        "No formula references this constant, so changing it will not move any computed " +
        "figure. If you meant to change how entered figures are converted, that lives on " +
        "the form field (site_form_field.unit_factor), not here.",
      requiresTypedConfirm: true,
    });
  }

  // ---- Range ---------------------------------------------------------------
  const range = PLAUSIBLE_RANGES[category];
  if (range && (value < range.min || value > range.max)) {
    issues.push({
      severity: "warn",
      message:
        `${value} is outside the usual range for this kind of constant ` +
        `(${range.min}–${range.max}): ${range.note}. Proceed if you have a source for it.`,
      requiresTypedConfirm: true,
    });
  }

  // ---- Magnitude of change ------------------------------------------------
  //
  // PLACEHOLDER_VALUE is skipped here on purpose. Constants seeded to stand in
  // for a figure nobody has yet (FIN.turnover ships as 1) would otherwise
  // report a change of several billion percent on their first real edit — a
  // true number, phrased so absurdly that it teaches people to click through
  // the warning. The range check above still runs, and the reason is still
  // mandatory, so the edit is not unguarded; only this one message is
  // suppressed for the transition it cannot describe usefully.
  if (currentValue > PLACEHOLDER_VALUE && directRefCount > 0) {
    const delta = Math.abs(value - currentValue) / currentValue;
    if (delta > LARGE_CHANGE) {
      issues.push({
        severity: "warn",
        message:
          `That is a ${(delta * 100).toFixed(0)}% change from ${currentValue}. ` +
          `A move this size will visibly shift published figures.`,
        requiresTypedConfirm: true,
      });
    }
  } else if (currentValue === PLACEHOLDER_VALUE && directRefCount > 0) {
    issues.push({
      severity: "warn",
      message:
        `${key} is currently a placeholder, not a measured value — every figure ` +
        `derived from it so far is arithmetic, not a disclosure. Setting it here is ` +
        `what makes those figures real, so make sure this number is the assured one.`,
      requiresTypedConfirm: true,
    });
  }

  if (issues.length === 0) issues.push({ severity: "ok", message: "" });
  return issues;
}

/** True when nothing blocks the edit. */
export function isBlocked(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "block");
}

/** True when the user must type the constant's key to proceed. */
export function needsTypedConfirm(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.requiresTypedConfirm);
}

/** Minimum length of an edit reason. Enforced here so both sides agree. */
export const MIN_REASON_LENGTH = 8;

export function validateReason(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  if (r.length === 0) return "Give a reason for this change — it becomes the audit trail.";
  if (r.length < MIN_REASON_LENGTH) {
    return `A reason of at least ${MIN_REASON_LENGTH} characters. "${r}" will not mean anything in a year.`;
  }
  return null;
}

function decimalPlaces(text: string): number {
  const m = text.match(/\.(\d+)$/);
  return m ? m[1].length : 0;
}
