// PURE — shared by the drilldown resolver and its tests.

/**
 * Render one substituted value inside the shown working.
 *
 * Large operands are grouped and rounded; SMALL ONES KEEP THEIR SIGNIFICANT
 * DIGITS. A blanket 4-decimal round turns the kWh->GJ factor 0.0036 into
 * "0.004" and the rupees->crore factor 1e-7 into "0" — printing arithmetic that
 * could not have produced the number beside it, which is precisely the
 * discrepancy a reviewer opens a drilldown to catch.
 */
export function formatFactor(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs < 0.001) return n.toExponential(2);
  if (abs < 1) return String(Number(n.toPrecision(4)));
  // maximumFractionDigits is NOT optional here. toLocaleString() defaults to 3,
  // so 1551983.2592 would print as "1,551,983.259" — a fourth decimal quietly
  // dropped from working that is meant to reconcile exactly with the stored
  // figure. 4 matches the resolver's own round4 storage precision.
  return Number(n.toFixed(4)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
