import type { ChartSpec } from "@/lib/dashboard/chart-spec";
import {
  type DashboardCatalogue,
  findParam,
  findPlant,
  findPeriod,
} from "@/lib/dashboard/catalogue";

export type ValidationResult =
  | { ok: true; spec: ChartSpec }
  | { ok: false; reason: string };

/**
 * Confirm a model-produced spec only references codes that exist in the
 * catalogue, and that its dimensions are coherent. This is the safety boundary:
 * even if the model hallucinates, nothing reaches the database that isn't a
 * known parameter/plant/period.
 */
export function validateSpec(
  spec: ChartSpec,
  cat: DashboardCatalogue
): ValidationResult {
  if (!findPeriod(cat, spec.period_code)) {
    const available = cat.periods.map((p) => p.code).join(", ");
    return {
      ok: false,
      reason: `Period "${spec.period_code}" doesn't exist. Available: ${available || "(none)"}`,
    };
  }

  const missingPlants = spec.plant_codes.filter((c) => !findPlant(cat, c));
  if (missingPlants.length > 0) {
    return {
      ok: false,
      reason: `Unknown plant code${missingPlants.length === 1 ? "" : "s"}: ${missingPlants.join(", ")}`,
    };
  }

  const missingParams = spec.parameter_codes.filter((c) => !findParam(cat, c));
  if (missingParams.length > 0) {
    return {
      ok: false,
      reason: `Unknown parameter code${missingParams.length === 1 ? "" : "s"}: ${missingParams.join(", ")}`,
    };
  }

  // Dimension coherence: comparing across time uses one plant on the x-axis of
  // periods; comparing across plants uses one period.
  if (spec.compare_by === "time" && spec.plant_codes.length !== 1) {
    return {
      ok: false,
      reason:
        "compare_by=\"time\" plots months for a single plant — pass exactly one plant_code.",
    };
  }

  if (spec.compare_by === "plant" && spec.granularity === "monthly") {
    return {
      ok: false,
      reason:
        "compare_by=\"plant\" compares plants for one period — use granularity=\"annual\".",
    };
  }

  // A "time" trend over a baseline/ytd period has no monthly breakdown.
  if (spec.compare_by === "time" && spec.granularity === "monthly") {
    const period = findPeriod(cat, spec.period_code)!;
    if (period.period_kind !== "month" && period.period_kind !== "ytd") {
      return {
        ok: false,
        reason:
          "A monthly trend needs a fiscal year with months — pick the YTD or a month of that year as the period.",
      };
    }
  }

  return { ok: true, spec };
}
