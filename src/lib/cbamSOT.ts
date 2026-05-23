/**
 * CBAM SOT (Source of Truth) — Hindalco Renukoot
 *
 * Each entry is one calculated value from `SOT - CBAM Calculation Hindalco Renukoot.xlsx`,
 * Output sheet, plus an explicit mapping to the cell(s) in the in-app CBAM report
 * where that number must appear.
 *
 * Shape of a mapping target:
 *   - For a `fields` question: { questionId, fieldId }
 *   - For a `table` question:  { questionId, fieldId, rowIndex }
 *
 * When the report renders, any field that has a calculated value pre-filled
 * shows up in **blue** with a small jump button. Clicking the value (or the
 * arrow) switches to the Requirements tab and scrolls to the corresponding
 * row anchored at `id="req-<valueId>"`.
 *
 * Provenance: Output rows are referenced like "SOT Output R56" — see the
 * `source` string for the exact pointer plus a plain-English formula.
 */

import type { RowValues } from "@/components/Fields";

export interface ReportTarget {
  questionId: string;
  fieldId: string;
  /** Required for `table` questions. Zero-indexed. */
  rowIndex?: number;
}

export interface CalculatedValue {
  /** Stable id used as the anchor in the Requirements tab and the link key. */
  id: string;
  /** Human-readable name shown in Requirements and on hover in the report. */
  label: string;
  /** Unit shown alongside the number in Requirements. */
  unit: string;
  /** The numeric value from the SOT (already aggregated). */
  value: number;
  /** SOT cell reference and a plain-English derivation. */
  source: string;
  /** Section letter in the SOT Output sheet (A–R). */
  sotSection: string;
  /** Every report field this value is meant to fill in. */
  targets: ReportTarget[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SOT values — Hindalco Renukoot, CY-25 annual
// ─────────────────────────────────────────────────────────────────────────────

export const calculatedValues: CalculatedValue[] = [
  // ─── Production volumes (SOT Input §1 + Output §L) ────────────────────────
  {
    id: "hot_metal_smelter_production",
    label: "Hot Metal (Smelter) production",
    unit: "MT",
    value: 407602.4401,
    source: "SOT Input!Hot Metal-Potroom!C13 — sum of monthly smelter output.",
    sotSection: "Input §1",
    targets: [{ questionId: "D.1", fieldId: "output", rowIndex: 0 }],
  },
  {
    id: "frp_net_production_gross_internal_scrap",
    label: "FRP net production (gross − internal scrap)",
    unit: "MT",
    value: 78331.425,
    source: "SOT Output!R111 = FRP!D6 = FRP gross 81,433 − internal coil 3,102.",
    sotSection: "Output §L",
    targets: [{ questionId: "D.1", fieldId: "output", rowIndex: 1 }],
  },
  {
    id: "extrusion_net_production_gross_scrap",
    label: "Extrusion net production (gross − scrap)",
    unit: "MT",
    value: 35292.4367,
    source: "SOT Output!R112 = Extrusion!D6 = D86 − D134 (external billet excluded).",
    sotSection: "Output §L",
    targets: [{ questionId: "D.1", fieldId: "output", rowIndex: 2 }],
  },

  // ─── Combined electricity emission factor ─────────────────────────────────
  {
    id: "combined_ef_sumproduct",
    label: "Combined electricity emission factor",
    unit: "tCO₂/MWh",
    value: 1.0631,
    source:
      "SOT Output!R45 = SUMPRODUCT(EF, MWh)/SUM(MWh) over CPP (1.086) + Cogen (0.7575) + Grid (0.71).",
    sotSection: "Output §D",
    targets: [
      { questionId: "D.1", fieldId: "elecEF", rowIndex: 0 },
      { questionId: "D.1", fieldId: "elecEF", rowIndex: 1 },
      { questionId: "D.1", fieldId: "elecEF", rowIndex: 2 },
    ],
  },

  // ─── Electricity consumption per process ──────────────────────────────────
  {
    id: "total_smelter_downstream_electricity_mwh",
    label: "Electricity consumption — P1 Unwrought Aluminium",
    unit: "MWh",
    value: 5828000,
    source:
      "SOT Output!R113 — Total smelter + downstream electricity = 5,828,168 MWh (Smelter 5,792k + Cold-metal 36k).",
    sotSection: "Output §L",
    targets: [{ questionId: "D.1", fieldId: "elecMWh", rowIndex: 0 }],
  },
  {
    id: "frp_electricity_power",
    label: "Electricity consumption — P2 FRP",
    unit: "MWh",
    value: 76667.5662,
    source: "SOT Output!R74 = FRP!D78 = 76,667,665.56 kWh ÷ 1000.",
    sotSection: "Output §H",
    targets: [{ questionId: "D.1", fieldId: "elecMWh", rowIndex: 1 }],
  },
  {
    id: "extrusion_electricity_power",
    label: "Electricity consumption — P3 Extrusion",
    unit: "MWh",
    value: 46819.0251,
    source: "SOT Output!R77 = Extrusion!D90 = 46,819,025.06 kWh ÷ 1000.",
    sotSection: "Output §H",
    targets: [{ questionId: "D.1", fieldId: "elecMWh", rowIndex: 2 }],
  },

  // ─── Per-process attributed direct emissions ──────────────────────────────
  {
    id: "direm_p1_unwrought_aluminium",
    label: "DirEm* — P1 Unwrought Aluminium",
    unit: "tCO₂e",
    value: 778804.4346,
    source:
      "SOT Output!R135 = Total installation direct emissions (782,070) − DirEm* P2 (1,714) − DirEm* P3 (1,552).",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "directEm", rowIndex: 0 }],
  },
  {
    id: "direm_p2_frp",
    label: "DirEm* — P2 FRP",
    unit: "tCO₂e",
    value: 1713.5954,
    source: "SOT Output!R136 = FRP!D82 = LSHS combustion in rolling.",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "directEm", rowIndex: 1 }],
  },
  {
    id: "direm_p3_extrusion",
    label: "DirEm* — P3 Extrusion",
    unit: "tCO₂e",
    value: 1551.9282,
    source: "SOT Output!R137 = Extrusion!D93 = Propane combustion in extrusion.",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "directEm", rowIndex: 2 }],
  },

  // ─── Per-process attributed indirect emissions ────────────────────────────
  {
    id: "indirect_emissions_p1",
    label: "Indirect emissions — P1 Unwrought Aluminium",
    unit: "tCO₂e",
    value: 6194593,
    source: "SOT Output!R138 = Electricity (P1) × Combined EF.",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "indirectEm", rowIndex: 0 }],
  },
  {
    id: "indirect_emissions_p2",
    label: "Indirect emissions — P2 FRP",
    unit: "tCO₂e",
    value: 81504.1599,
    source: "SOT Output!R139 = FRP!D81 = Electricity (P2) × Combined EF.",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "indirectEm", rowIndex: 1 }],
  },
  {
    id: "indirect_emissions_p3",
    label: "Indirect emissions — P3 Extrusion",
    unit: "tCO₂e",
    value: 49772.5512,
    source: "SOT Output!R140 = Extrusion!D92 = Electricity (P3) × Combined EF.",
    sotSection: "Output §O",
    targets: [{ questionId: "D.1", fieldId: "indirectEm", rowIndex: 2 }],
  },

  // ─── Installation-level emissions balance ─────────────────────────────────
  {
    id: "calculation_based_co2_emissions",
    label: "Calculation-based CO₂ emissions",
    unit: "tCO₂e",
    value: 662097.7894,
    source:
      "SOT Output!R123 — Sum of CO₂ from each B source stream (CPP coal/HSD/biomass + carbon anode + cold metal + cogen).",
    sotSection: "Output §N",
    targets: [{ questionId: "C.2", fieldId: "co2" }],
  },
  {
    id: "pfc_emissions_co2_equivalent",
    label: "Total PFC emissions (CO₂-equivalent)",
    unit: "tCO₂e",
    value: 119972.1688,
    source:
      "SOT Output!R128 = E_CF4 × GWP_CF4 + E_C2F6 × GWP_C2F6 (AR5: 6630, 11100). Slope method on smelter.",
    sotSection: "Output §N",
    targets: [{ questionId: "C.2", fieldId: "pfc" }],
  },
  {
    id: "biomass_emission_cpp",
    label: "Biomass emissions",
    unit: "tCO₂e",
    value: 108.13,
    source:
      "SOT Output!R18 + R34 — CPP biomass 34.08 + Cogen biomass 74.05 (treated as zero-rated under CBAM but reported).",
    sotSection: "Output §B/§C",
    targets: [{ questionId: "C.2", fieldId: "biomass" }],
  },
  {
    id: "total_n2o_emissions",
    label: "Total N₂O emissions",
    unit: "tCO₂e",
    value: 0,
    source: "SOT Output — not separately tracked for Renukoot (no nitric/adipic acid process).",
    sotSection: "Output §N",
    targets: [{ questionId: "C.2", fieldId: "n2o" }],
  },
  {
    id: "total_direct_emissions",
    label: "Total direct emissions",
    unit: "tCO₂e",
    value: 782069.9582,
    source:
      "SOT Output!R129 = Calculation-based CO₂ (662,098) + PFC (119,972). Excludes CPP/Cogen energy emissions.",
    sotSection: "Output §N",
    targets: [{ questionId: "C.2", fieldId: "direct" }],
  },
  {
    id: "total_indirect_emissions",
    label: "Total indirect emissions",
    unit: "tCO₂e",
    value: 6325870,
    source:
      "SOT Output!R130 = HM indirect 6,153,015 + Cold-metal 40,320 + FRP 81,504 + Extrusion 49,773.",
    sotSection: "Output §N",
    targets: [{ questionId: "C.2", fieldId: "indirect" }],
  },

  // ─── Purchased precursors (PP1-PP6) ────────────────────────────────────────
  {
    id: "pp1_tonnes_to_p2_frp",
    label: "PP1 — Hindalco-Hirakud, tonnes to FRP",
    unit: "t",
    value: 2371.263,
    source: "SOT Input precursor table, row PP1, col 'Tonnes to P2 (FRP)'.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 0 }],
  },
  {
    id: "pp1_see_direct_tco2e_t",
    label: "PP1 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 2.816,
    source: "SOT Input precursor table, row PP1, col 'SEE direct'.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 0 }],
  },
  {
    id: "pp1_specific_electricity_mwh_t",
    label: "PP1 — Specific electricity",
    unit: "MWh/t",
    value: 14.3620163,
    source: "SOT Input precursor table, row PP1, col 'Specific electricity'.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 0 }],
  },
  {
    id: "pp1_electricity_ef_tco2e_mwh",
    label: "PP1 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 1.20199,
    source: "SOT Input precursor table, row PP1, col 'Electricity EF'.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 0 }],
  },
  {
    id: "pp1_see_indirect_of_precursor",
    label: "PP1 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 17.263,
    source: "SOT Output!R165 = specific electricity × electricity EF.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 0 }],
  },

  {
    id: "pp2_tonnes_to_p2_frp",
    label: "PP2 — Hindalco-Taloja, tonnes to FRP",
    unit: "t",
    value: 702.504,
    source: "SOT Input precursor table, row PP2.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 1 }],
  },
  {
    id: "pp2_see_direct_tco2e_t",
    label: "PP2 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 2.57,
    source: "SOT Input precursor table, row PP2.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 1 }],
  },
  {
    id: "pp2_specific_electricity_mwh_t",
    label: "PP2 — Specific electricity",
    unit: "MWh/t",
    value: 12.82,
    source: "SOT Input precursor table, row PP2.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 1 }],
  },
  {
    id: "pp2_electricity_ef_tco2e_mwh",
    label: "PP2 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 1.21728306,
    source: "SOT Input precursor table, row PP2.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 1 }],
  },
  {
    id: "pp2_see_indirect_of_precursor",
    label: "PP2 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 15.6056,
    source: "SOT Output!R166.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 1 }],
  },

  {
    id: "pp3_tonnes_to_p3_extrusion",
    label: "PP3 — Hindalco-Mahan, tonnes to Extrusion",
    unit: "t",
    value: 4104.4313,
    source: "SOT Input precursor table, row PP3.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 2 }],
  },
  {
    id: "pp3_see_direct_tco2e_t",
    label: "PP3 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 1.562,
    source: "SOT Input precursor table, row PP3.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 2 }],
  },
  {
    id: "pp3_specific_electricity_mwh_t",
    label: "PP3 — Specific electricity",
    unit: "MWh/t",
    value: 14.1557444,
    source: "SOT Input precursor table, row PP3.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 2 }],
  },
  {
    id: "pp3_electricity_ef_tco2e_mwh",
    label: "PP3 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 0.95407893,
    source: "SOT Input precursor table, row PP3.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 2 }],
  },
  {
    id: "pp3_see_indirect_of_precursor",
    label: "PP3 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 13.5057,
    source: "SOT Output!R167.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 2 }],
  },

  {
    id: "pp4_tonnes_to_p3_extrusion",
    label: "PP4 — Hindalco-Alupuram, tonnes to Extrusion",
    unit: "t",
    value: 138.693,
    source: "SOT Input precursor table, row PP4.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 3 }],
  },
  {
    id: "pp4_see_direct_tco2e_t",
    label: "PP4 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 2.232,
    source: "SOT Input precursor table, row PP4.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 3 }],
  },
  {
    id: "pp4_specific_electricity_mwh_t",
    label: "PP4 — Specific electricity",
    unit: "MWh/t",
    value: 15.7965484,
    source: "SOT Input precursor table, row PP4.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 3 }],
  },
  {
    id: "pp4_electricity_ef_tco2e_mwh",
    label: "PP4 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 0.71,
    source: "SOT Input precursor table, row PP4 (CEA grid EF).",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 3 }],
  },
  {
    id: "pp4_see_indirect_of_precursor",
    label: "PP4 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 11.2155,
    source: "SOT Output!R168.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 3 }],
  },

  {
    id: "pp5_tonnes_to_p3_extrusion",
    label: "PP5 — Hindalco-Almex, tonnes to Extrusion",
    unit: "t",
    value: 77.15,
    source: "SOT Input precursor table, row PP5.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 4 }],
  },
  {
    id: "pp5_see_direct_tco2e_t",
    label: "PP5 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 1.337,
    source: "SOT Input precursor table, row PP5.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 4 }],
  },
  {
    id: "pp5_specific_electricity_mwh_t",
    label: "PP5 — Specific electricity",
    unit: "MWh/t",
    value: 11.4309855,
    source: "SOT Input precursor table, row PP5.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 4 }],
  },
  {
    id: "pp5_electricity_ef_tco2e_mwh",
    label: "PP5 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 0.71,
    source: "SOT Input precursor table, row PP5 (CEA grid EF).",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 4 }],
  },
  {
    id: "pp5_see_indirect_of_precursor",
    label: "PP5 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 8.116,
    source: "SOT Output!R169.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 4 }],
  },

  {
    id: "pp6_tonnes_to_p3_extrusion",
    label: "PP6 — CRM Green Tech, tonnes to Extrusion",
    unit: "t",
    value: 969.959,
    source: "SOT Input precursor table, row PP6.",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "mass", rowIndex: 5 }],
  },
  {
    id: "pp6_see_direct_tco2e_t",
    label: "PP6 — SEE (direct)",
    unit: "tCO₂e/t",
    value: 0,
    source: "SOT Input precursor table, row PP6 (recycled secondary, zero process emission).",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "seeDirect", rowIndex: 5 }],
  },
  {
    id: "pp6_specific_electricity_mwh_t",
    label: "PP6 — Specific electricity",
    unit: "MWh/t",
    value: 0,
    source: "SOT Input precursor table, row PP6 (not reported).",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecPerT", rowIndex: 5 }],
  },
  {
    id: "pp6_electricity_ef_tco2e_mwh",
    label: "PP6 — Electricity EF",
    unit: "tCO₂/MWh",
    value: 0.71,
    source: "SOT Input precursor table, row PP6 (CEA grid EF).",
    sotSection: "Input precursor",
    targets: [{ questionId: "E.1", fieldId: "elecEF", rowIndex: 5 }],
  },
  {
    id: "pp6_see_indirect_of_precursor",
    label: "PP6 — SEE (indirect)",
    unit: "tCO₂e/t",
    value: 0,
    source: "SOT Output!R170.",
    sotSection: "Output §R",
    targets: [{ questionId: "E.1", fieldId: "seeIndirect", rowIndex: 5 }],
  },

  // ─── Cogeneration tool inputs ─────────────────────────────────────────────
  {
    id: "cogen_ein_total_fuel_input",
    label: "Cogen — Total fuel input",
    unit: "TJ",
    value: 9657.85,
    source:
      "SOT Output!R29 = Ein,coal + Ein,HSD + Ein,biomass + Ein,waste-heat = 2.31e12 kcal × 4.1868e-9 (kcal→TJ).",
    sotSection: "Output §C",
    targets: [{ questionId: "F.1", fieldId: "fuelIn" }],
  },
  {
    id: "cogen_qnet_heat_produced",
    label: "Cogen — Heat output",
    unit: "TJ",
    value: 4648.62,
    source: "SOT Output!R30 = (HP+LP+PP steam × enthalpy) − condensate heat, converted to TJ.",
    sotSection: "Output §C",
    targets: [{ questionId: "F.1", fieldId: "heatOut" }],
  },
  {
    id: "cogen_sent_out_power",
    label: "Cogen — Electricity output",
    unit: "MWh",
    value: 283324.8404,
    source: "SOT Output!R22 = Cogen!B21 (sent-out, after auxiliary).",
    sotSection: "Output §C",
    targets: [{ questionId: "F.1", fieldId: "elecOut" }],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Indices for quick lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map from "{questionId}.{fieldId}" → calculated value id, for fields questions.
 * For tables, use `calculatedForRow(questionId, fieldId, rowIndex)`.
 */
export function calculatedForField(
  questionId: string,
  fieldId: string
): CalculatedValue | null {
  for (const v of calculatedValues) {
    for (const t of v.targets) {
      if (t.questionId === questionId && t.fieldId === fieldId && t.rowIndex === undefined) {
        return v;
      }
    }
  }
  return null;
}

export function calculatedForRow(
  questionId: string,
  fieldId: string,
  rowIndex: number
): CalculatedValue | null {
  for (const v of calculatedValues) {
    for (const t of v.targets) {
      if (
        t.questionId === questionId &&
        t.fieldId === fieldId &&
        t.rowIndex === rowIndex
      ) {
        return v;
      }
    }
  }
  return null;
}

export const calculatedById = new Map<string, CalculatedValue>(
  calculatedValues.map((v) => [v.id, v])
);

// ─────────────────────────────────────────────────────────────────────────────
// Runtime-added targets — set by the user when they pick a calculated value
// into a number field via the "+ Add requirement" picker. Persisted in
// localStorage so the linkage survives reloads.
// ─────────────────────────────────────────────────────────────────────────────

export const USER_TARGETS_KEY = "cbam-app/calculated-user-targets/v1";

export interface UserTarget {
  valueId: string;
  questionId: string;
  fieldId: string;
  rowIndex?: number;
}

export function readUserTargets(): UserTarget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_TARGETS_KEY);
    return raw ? (JSON.parse(raw) as UserTarget[]) : [];
  } catch {
    return [];
  }
}

export function writeUserTargets(ts: UserTarget[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_TARGETS_KEY, JSON.stringify(ts));
}

/**
 * Build the initial `values` map for a `fields` question, prefilled from SOT.
 * Returns null if no fields are calculated for that question.
 */
export function sotValuesForFieldsQuestion(
  questionId: string,
  fieldIds: string[]
): RowValues | null {
  const out: RowValues = {};
  let any = false;
  for (const fid of fieldIds) {
    const v = calculatedForField(questionId, fid);
    if (v) {
      out[fid] = v.value;
      any = true;
    }
  }
  return any ? out : null;
}

/**
 * Build the initial `rows` for a `table` question, prefilled from SOT.
 * Returns the rows up to the highest SOT-targeted rowIndex (inclusive) — or
 * null if no SOT rows apply.
 */
export function sotRowsForTableQuestion(
  questionId: string,
  columnIds: string[]
): RowValues[] | null {
  // Find max rowIndex used by SOT for this question.
  let maxRow = -1;
  for (const v of calculatedValues) {
    for (const t of v.targets) {
      if (t.questionId === questionId && t.rowIndex !== undefined && t.rowIndex > maxRow) {
        maxRow = t.rowIndex;
      }
    }
  }
  if (maxRow < 0) return null;
  const rows: RowValues[] = [];
  for (let i = 0; i <= maxRow; i++) {
    const row: RowValues = {};
    for (const cid of columnIds) {
      const v = calculatedForRow(questionId, cid, i);
      row[cid] = v ? v.value : null;
    }
    rows.push(row);
  }
  return rows;
}
