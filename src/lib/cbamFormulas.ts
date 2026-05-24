/**
 * Formula registry for CBAM calculated values.
 *
 * Each entry says how a calculated value (output) is derived from named
 * inputs. The drill-down page uses this to render the Formula card and
 * the tabbed monthly tables, one per input.
 *
 * If a calculated value has no entry here, the drill-down still works —
 * it shows just the Output card and a single monthly table for the
 * output value. The Formula card and Input tabs only render when an
 * entry is present.
 *
 * Provenance: see `SOT - CBAM Calculation Hindalco Renukoot.xlsx`.
 */

export interface FormulaInput {
  /** Human-readable name for the tab label and tooltips. */
  label: string;
  /** Numeric value of this input (annual). */
  value: number;
  /** Unit displayed alongside the value. */
  unit?: string;
  /** Short identifier used internally for keys; doesn't need to be globally unique. */
  key: string;
}

export interface CbamFormula {
  /** id of the output CalculatedValue (matches cbamSOT.calculatedValues[].id). */
  outputId: string;
  /**
   * Plain-English formula string, with the same labels used in the inputs.
   * E.g. "FRP net production = FRP gross production - (PP1 + PP2 + ...)"
   */
  expression: string;
  inputs: FormulaInput[];
}

export const cbamFormulas: CbamFormula[] = [
  {
    outputId: "frp_net_production_gross_internal_scrap",
    expression:
      "FRP net production (gross − internal scrap) = FRP gross production − (PP1 Hindalco-Hirakud · Tonnes to P2 (FRP) + PP2 Hindalco-Taloja · Tonnes to P2 (FRP) + Others / Bellur coil into FRP (external))",
    inputs: [
      {
        key: "frp_gross_production",
        label: "FRP gross production",
        value: 81433.062,
        unit: "MT",
      },
      {
        key: "pp1_tonnes_to_p2_frp",
        label: "PP1 — Hindalco-Hirakud · Tonnes to P2 (FRP)",
        value: 2371.263,
        unit: "MT",
      },
      {
        key: "pp2_tonnes_to_p2_frp",
        label: "PP2 — Hindalco-Taloja · Tonnes to P2 (FRP)",
        value: 702.504,
        unit: "MT",
      },
      {
        key: "others_bellur_coil_into_frp_external",
        label: "Others / Bellur coil into FRP (external)",
        value: 27.87,
        unit: "MT",
      },
    ],
  },
];

const byId = new Map<string, CbamFormula>(cbamFormulas.map((f) => [f.outputId, f]));

export function cbamFormulaFor(outputId: string): CbamFormula | null {
  return byId.get(outputId) ?? null;
}
