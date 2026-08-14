// PURE — no `server-only`, no Supabase, so the offline tests can exercise it
// without a database and without Next's bundler. Same discipline as
// esgConstants/graph.ts and standardOutput/outputLayout.ts.

/**
 * Shift a fiscal year label by a number of years. "2024-25" + (-1) -> "2023-24".
 *
 * Parsed rather than looked up because esg.period seeds a year ahead, so the
 * target year may legitimately have no rows yet — and "no period" is a state
 * the caller must distinguish from "no value".
 */
export function shiftFiscalYear(fy: string, offset: number): string | null {
  const m = fy.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const start = Number(m[1]) + offset;
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}
