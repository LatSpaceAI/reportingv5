// PURE — no React, no `server-only`. The Questionnaire imports it to read the
// report's own reporting-year answer; the tests import it directly.

/**
 * Coerce the free-text "financial year" answer (Section A item 9) to the
 * "2024-25" form the esg.period table uses.
 *
 * Returns null on anything it cannot read confidently. That is deliberate:
 * resolving bound metrics against a guessed year would attach real computed
 * numbers to the wrong reporting period, and nothing downstream would say so.
 * Failing closed shows "No reporting year set", which a user can fix.
 */
export function normaliseFiscalYear(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  // 2024-25 | FY2024-25 | FY 2024-25 | 2024-2025 | 2024/25
  const m = s.match(/^(?:FY\s*)?(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/i);
  if (!m) return null;
  const start = Number(m[1]);
  const endRaw = m[2];
  const end = endRaw.length === 4 ? Number(endRaw) % 100 : Number(endRaw);
  // The second half must be the year after the first, or it is not a fiscal
  // year — "2024-24" and "2024-26" are typos, not periods we should resolve.
  if ((start + 1) % 100 !== end) return null;
  return `${start}-${String(end).padStart(2, "0")}`;
}
