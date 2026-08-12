// The shape of the standard input template, and the contract its parser relies on.
//
// PURE MODULE — no database, no `server-only`. The generator, the parser and the
// tests all import it, which is what stops the written layout and the read
// layout drifting apart.
//
// WHY A STANDARD TEMPLATE AT ALL
//
// The client's own monthly forms are matched by fuzzy LABEL against per-site
// site_form_field replicas that preserve their typos verbatim
// ("Grid Electricity consmuption", "Scarp - Wood -MT"), because site teams
// recognise their own paper and correcting it would make the screen stop
// matching what they are typing from.
//
// This template is the opposite situation: WE author it, so it can carry an
// explicit input_parameter.key in a hidden column and be read with zero
// ambiguity. It is also the one place the CANONICAL labels are shown — that is
// the visible difference between the two paths.
//
// THE PARSE CONTRACT
//
// Nothing is located by a fixed row or column index. The parser finds the header
// row by scanning for the key column's header text, then finds every other
// column by ITS header text within that same row. Consequence: inserting a row
// above the table, or a column between two others, cannot break an import.
// Both cases are asserted in scripts/test-standard-template.ts.

/** Bumped whenever the parse contract changes in a way that invalidates files. */
export const TEMPLATE_VERSION = "1.0.0";

/** Distinguishes our template from any other workbook someone may upload. */
export const TEMPLATE_ID = "PLATO.BEPL.STANDARD";

/**
 * Versions this build can read.
 *
 * A SET, not a `>=` comparison. A future 1.0.1 that only restyles cells is
 * readable and should be admitted deliberately by adding it here; a 1.1.0 that
 * moves a column is not. Range checks would silently admit the second.
 */
export const SUPPORTED_VERSIONS = new Set([TEMPLATE_VERSION]);

/** Hidden sheet holding the version stamp. Excel's `veryHidden` — not in the
 *  unhide list, so it cannot be casually deleted. */
export const META_SHEET = "_plato_meta";
export const META_CELLS = {
  templateId: "B1",
  version: "B2",
  generatedAt: "B3",
  siteCode: "B4",
  fiscalYear: "B5",
  monthNo: "B6",
} as const;

/** The visible instructions tab, and the data tab prefix. */
export const INSTRUCTIONS_SHEET = "Instructions";

/**
 * Column headers. The parser matches these case- and space-insensitively, so
 * "Parameter Key" and "parameter key" both resolve.
 *
 * `key` and `value` are REQUIRED — without them a file is not this template.
 * The rest degrade: a file missing "Not available" simply cannot express NA.
 */
export const HEADERS = {
  lineItem: "Line item",
  key: "Parameter key",
  value: "Value",
  unit: "Unit",
  notAvailable: "Not available",
  remarks: "Remarks",
} as const;

/** How many rows to scan for the header before giving up. */
export const HEADER_SCAN_ROWS = 40;

/** The single token that marks a row as explicitly unavailable. */
export const NA_TOKEN = "NA";

/**
 * Parameters deliberately absent from the template.
 *
 * These are NOT collected on a monthly site return, so a blank row for them
 * every month would train people to skip rows — the habit that makes a genuinely
 * missing figure invisible.
 */
export const EXCLUDED_KEYS = new Set([
  // Half-yearly stack monitoring, not a monthly form (output_parameter.frequency
  // says half_yearly for the air domain).
  "air.nox",
  "air.sox",
  "air.pm",
  // A signed correction to reported renewables, entered by the central team
  // after reconciliation — never by a site. See BIRLA_ESTATES.md open item 1.
  "elec.renewable_adjustment",
]);

/**
 * Sections rendered collapsed (Excel outline level 1).
 *
 * Collapsed, never omitted: a residential site has no tenant electricity and a
 * commercial one has no C&D waste, but Aurora is commercial and filed a
 * rainwater row in FY24 and not FY25 — so asset_type is a poor predictor of
 * which rows a given site-month legitimately has. Collapsing keeps every row
 * reachable while keeping the common case short.
 */
export const COLLAPSED_SECTIONS = new Set(["Refrigerants"]);

/** Section display order. Sections absent here fall to the end, by sort_order. */
export const SECTION_ORDER = [
  "Water",
  "Water for drinking",
  "Waste water generated",
  "Waste water recycled",
  "Electricity",
  "Electricity from renewables",
  "Fuel",
  "Waste",
  "Refrigerants",
];

/** One parameter as the template needs it. Mirrors esg.input_parameter. */
export interface TemplateParameter {
  key: string;
  section: string;
  label: string;
  unit: string | null;
  isMemo: boolean;
  sortOrder: number | null;
  notes: string | null;
}

export interface TemplateSection {
  name: string;
  collapsed: boolean;
  parameters: TemplateParameter[];
}

/**
 * Groups parameters into the sections the sheet renders, in display order.
 *
 * Drives the entire layout off the database: seeding a 58th parameter makes it
 * appear in the template with no code change here.
 */
export function buildSections(params: TemplateParameter[]): TemplateSection[] {
  const included = params.filter((p) => !EXCLUDED_KEYS.has(p.key));

  const bySection = new Map<string, TemplateParameter[]>();
  for (const p of included) {
    const name = p.section || "Other";
    if (!bySection.has(name)) bySection.set(name, []);
    bySection.get(name)!.push(p);
  }

  const rank = (name: string) => {
    const i = SECTION_ORDER.indexOf(name);
    return i === -1 ? SECTION_ORDER.length : i;
  };

  return [...bySection.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, list]) => ({
      name,
      collapsed: COLLAPSED_SECTIONS.has(name),
      parameters: list.sort(
        (x, y) => (x.sortOrder ?? 1e9) - (y.sortOrder ?? 1e9) || x.key.localeCompare(y.key)
      ),
    }));
}

/** Normalises a header cell for comparison. "Parameter Key " -> "parameter key". */
export function normaliseHeader(text: string): string {
  return (text ?? "").toString().replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Separator in `import_batch_row.source_label`, which this path writes as
 * `key — Canonical label` so the audit trail is readable without a join.
 *
 * Shared by the preview (which writes it) and the commit (which splits on it) so
 * the two cannot drift. Split on the FIRST occurrence only: a canonical label
 * may itself contain an em dash, while a parameter key never does.
 */
export const SOURCE_LABEL_SEP = " — ";

/** Splits a source_label back into its key and label halves. */
export function splitSourceLabel(label: string | null): {
  key: string;
  label: string | null;
} {
  const s = label ?? "";
  const i = s.indexOf(SOURCE_LABEL_SEP);
  if (i === -1) return { key: s.trim(), label: null };
  return {
    key: s.slice(0, i).trim(),
    label: s.slice(i + SOURCE_LABEL_SEP.length).trim() || null,
  };
}

/** Filename for a generated template. */
export function templateFilename(
  siteCode: string | null,
  fiscalYear: string,
  monthLabel: string | null
): string {
  const parts = ["BEPL-ESG-return", siteCode ?? "blank", fiscalYear.replace("/", "-")];
  if (monthLabel) parts.push(monthLabel);
  return `${parts.join("_")}.xlsx`;
}
