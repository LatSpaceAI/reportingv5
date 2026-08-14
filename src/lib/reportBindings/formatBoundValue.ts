// PURE — shared by the Requirements tab and the tests.

/**
 * How a bound value should read in a table cell.
 *
 * Intensities are the reason this is not just toLocaleString: they are small
 * (1.1851 GJ/crore) and their significance lives in the decimals, while waste
 * and water are large and read better grouped. Four decimals matches the
 * resolver's own storage precision (round4 in resolve-birla.mjs:111), so this
 * never displays precision the database does not hold.
 *
 * Zero renders as "0", never as a dash: a filed zero is a reported fact, and
 * the absence of a return is a different state the caller renders separately.
 */
export function formatBoundValue(v: number, isIntensity = false): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);

  // Intensities keep all four decimals whatever their magnitude. 1.1851 GJ/crore
  // rounded to 1.19 loses the precision the ratio exists to carry, and it is
  // above 1 — so magnitude alone cannot decide this. The caller knows, from
  // output_parameter.is_intensity.
  if (isIntensity) return String(Number(v.toFixed(4)));

  if (abs < 1) return String(Number(v.toFixed(4)));
  if (abs < 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
