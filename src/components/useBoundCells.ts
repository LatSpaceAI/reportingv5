"use client";

// Bound cells for the Requirements tab.
//
// Fetches once per (framework, fiscal year) and hands back a lookup keyed by
// QuantCell id. Deliberately NOT react-query: the questionnaire is otherwise
// localStorage-only and pulling a cache provider into it for one read would be
// the largest change in this feature.
//
// FAILURE IS A STATE, NOT A THROW. If the bindings table is missing, or the
// database is unreachable, the Requirements tab must still render — it worked
// without bound values before this feature and must keep working. So the error
// is returned for the caller to surface quietly, and every cell simply reads as
// unbound.

import { useEffect, useState } from "react";

export interface BoundCell {
  quantCellId: string;
  outputKey: string;
  siteCode: string;
  periodKind: string;
  yearOffset: number;
  outputLabel: string;
  unit: string | null;
  isIntensity: boolean;
  fiscalYear: string | null;
  value: number | null;
  unresolvedReason: "no_period" | "no_value" | null;
  sitesReporting: number | null;
  sitesExpected: number | null;
  formulaExpression: string | null;
  isAssumption: boolean;
  note: string | null;
  staleLabel: { boundAs: string; nowReads: string } | null;
}

export interface BoundCellsState {
  byCellId: Map<string, BoundCell>;
  loading: boolean;
  error: string | null;
}

export function useBoundCells(
  frameworkId: string,
  fiscalYear: string | null
): BoundCellsState {
  const [state, setState] = useState<BoundCellsState>({
    byCellId: new Map(),
    loading: Boolean(fiscalYear),
    error: null,
  });

  useEffect(() => {
    if (!fiscalYear) {
      setState({ byCellId: new Map(), loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const res = await fetch(
          `/api/esg/bindings?framework=${encodeURIComponent(frameworkId)}&fy=${encodeURIComponent(fiscalYear)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setState({ byCellId: new Map(), loading: false, error: data.error ?? "Could not load bound metrics." });
          return;
        }
        const m = new Map<string, BoundCell>();
        for (const c of data.cells as BoundCell[]) m.set(c.quantCellId, c);
        setState({ byCellId: m, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          byCellId: new Map(),
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frameworkId, fiscalYear]);

  return state;
}

export { formatBoundValue } from "@/lib/reportBindings/formatBoundValue";
