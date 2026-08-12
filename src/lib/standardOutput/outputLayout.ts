// The shape of the standard output metrics workbook.
//
// PURE — no database, no `server-only`, so the test suite can assert the layout
// without Supabase. The loader (outputData.ts) and the writer
// (generateOutputWorkbook.ts) both read this.
//
// WHY A SECOND EXPORT AT ALL
//
// The existing export writes into the CLIENT'S OWN BRSR workbook, at its exact
// cells, and is therefore hostage to that file's layout — it 404s if the
// template is absent, and its grain is hardcoded as literal cell addresses
// (environmentMap.ts). This one is authored from scratch off output_parameter,
// so it needs no client file, works on a fresh clone, is testable in CI, and a
// 61st seeded parameter appears in it with no code change.
//
// GRAIN IS DRIVEN BY output_parameter.frequency, AND THIS IS THE SUBTLE PART
//
// `frequency` is declared on all 60 parameters and used NOWHERE — the resolver
// selects the column and never references it. Worse, esg.period has a CHECK
// constraint permitting only ('month','ytd','baseline'), so quarterly and
// half-yearly rows are SCHEMA-PROHIBITED, not merely unseeded.
//
// So for the 23 quarterly waste parameters and 3 half-yearly air parameters
// there is nothing to read at their declared grain, and this export must
// aggregate months itself. It does — and says so in the sheet, per cell, with a
// "Months in quarter" column. An aggregation nobody upstream performed, printed
// without saying so, would be the worst kind of quiet fiction.

/** Bumped when the sheet set or column contract changes. */
export const OUTPUT_TEMPLATE_VERSION = "1.0.0";

export type Frequency = "monthly" | "quarterly" | "half_yearly" | "annual";

export interface OutputParameter {
  key: string;
  domain: string;
  scope: string | null;
  label: string;
  unit: string | null;
  frequency: Frequency;
  sortOrder: number | null;
  notes: string | null;
}

/**
 * Which sheet a domain lands on.
 *
 * FUEL folds into ENERGY (same monthly grain, and diesel reads naturally beside
 * electricity). AIR and REFRIGERANT share PERIODIC because both are tiny and
 * both are reported outside the monthly forms. REFRIGERANT is deliberately NOT
 * under EMISSIONS: those are refill QUANTITIES in kg, not emissions, and one of
 * them (rf.r22) is excluded from Scope 1 by convention.
 *
 * `domain` is kept as an explicit column on every detail sheet, so folding does
 * not lose it as a filter dimension.
 */
export const DOMAIN_SHEET: Record<string, string> = {
  ENERGY: "ENERGY",
  FUEL: "ENERGY",
  WATER: "WATER",
  WASTE: "WASTE",
  EMISSIONS: "EMISSIONS",
  AIR: "PERIODIC",
  REFRIGERANT: "PERIODIC",
};

/** Sheet order in the workbook. READ FIRST is the tab Excel opens on. */
export const SHEET_ORDER = [
  "READ FIRST",
  "SUMMARY",
  "ENERGY",
  "WATER",
  "WASTE",
  "EMISSIONS",
  "PERIODIC",
  "CONSTANTS",
  "ASSUMPTIONS",
];

/** Sub-band order within a sheet, where a sheet holds more than one domain. */
export const BAND_ORDER: Record<string, string[]> = {
  ENERGY: ["FUEL", "ENERGY"],
  PERIODIC: ["AIR", "REFRIGERANT"],
};

/**
 * The four cell states.
 *
 * BRANCHED ON ROW EXISTENCE, NEVER ON THE NUMBER. resolve-birla.mjs writes no
 * output_value row at all for a site-month with no filed return, so the absence
 * of a row is the signal. `value ?? 0` must appear nowhere in this exporter —
 * it would turn "nobody filed" into "a return of zero", which is the single most
 * consequential lie this model could tell.
 */
export type CellState = "value" | "not_filed" | "not_computable" | "not_applicable";

export const STATE_TEXT: Record<Exclude<CellState, "value">, string> = {
  not_filed: "not filed",
  not_computable: "not computable",
  not_applicable: "n/a",
};

/**
 * Number formats by unit. Chosen so no real figure rounds away:
 * Aurora's April stationary diesel is 0.03 kL and waste runs to 0.0485 MT, so
 * two decimals would erase both.
 */
export const NUM_FMT: Record<string, string> = {
  kWh: "#,##0",
  GJ: "#,##0.00",
  kL: "#,##0.000",
  KL: "#,##0.00",
  MT: "#,##0.000",
  kg: "#,##0.00",
  tCO2e: "#,##0.00",
};

export const DEFAULT_NUM_FMT = "#,##0.00";

export function numFmtFor(unit: string | null): string {
  return (unit && NUM_FMT[unit]) || DEFAULT_NUM_FMT;
}

/** Fiscal-month order: 1 = April. */
export const MONTH_LABELS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

/** Which fiscal months make up each quarter. Q1 = Apr-Jun. */
export const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

/** Which fiscal months make up each half. H1 = Apr-Sep. */
export const HALF_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
};

/** The identity columns every detail sheet opens with. */
export const IDENTITY_COLUMNS = [
  { header: "Site code", width: 14 },
  { header: "Site name", width: 24 },
  { header: "Asset type", width: 13 },
  { header: "Region", width: 12 },
  { header: "Water stressed", width: 13 },
  { header: "Domain", width: 13 },
  { header: "Period", width: 14 },
  { header: "Period kind", width: 12 },
  { header: "Return filed", width: 13 },
] as const;

/** Column index (1-based) of the "Return filed" column, used by the test sweep. */
export const RETURN_FILED_COL = IDENTITY_COLUMNS.length;

/** First metric column on a detail sheet. */
export const FIRST_METRIC_COL = IDENTITY_COLUMNS.length + 1;

/** Header rows on a detail sheet: a label row and a `key (unit)` row. */
export const HEADER_ROWS = 2;

export interface SheetPlan {
  name: string;
  /** Grain the sheet renders at. */
  grain: "month" | "quarter" | "half" | "annual" | "mixed";
  /** Metric columns, in order, grouped into bands. */
  bands: { domain: string; frequency: Frequency; parameters: OutputParameter[] }[];
  /** True when this sheet's figures are aggregated by us rather than read. */
  aggregated: boolean;
}

/**
 * Groups parameters into sheets and bands.
 *
 * Everything comes off the parameter rows: sheet from `domain`, order from
 * `sort_order`, grain from `frequency`. Seeding a 61st parameter places it
 * automatically.
 */
export function planSheets(params: OutputParameter[]): SheetPlan[] {
  const bySheet = new Map<string, OutputParameter[]>();
  for (const p of params) {
    const sheet = DOMAIN_SHEET[p.domain] ?? "OTHER";
    if (!bySheet.has(sheet)) bySheet.set(sheet, []);
    bySheet.get(sheet)!.push(p);
  }

  const plans: SheetPlan[] = [];

  for (const name of SHEET_ORDER) {
    const rows = bySheet.get(name);
    if (!rows) continue;

    // Band by (domain, frequency): a domain can hold two grains — EMISSIONS has
    // 5 monthly and 2 annual parameters, and rendering the annual pair in a
    // monthly grid would leave 10 of 12 columns empty or, worse, zero-filled.
    const byBand = new Map<string, OutputParameter[]>();
    for (const p of rows) {
      const bandKey = `${p.domain}|${p.frequency}`;
      if (!byBand.has(bandKey)) byBand.set(bandKey, []);
      byBand.get(bandKey)!.push(p);
    }

    const order = BAND_ORDER[name] ?? [];
    const bands = [...byBand.entries()]
      .map(([bandKey, list]) => {
        const [domain, frequency] = bandKey.split("|");
        return {
          domain,
          frequency: frequency as Frequency,
          parameters: list.sort(
            (a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.key.localeCompare(b.key)
          ),
        };
      })
      .sort((a, b) => {
        const ai = order.indexOf(a.domain);
        const bi = order.indexOf(b.domain);
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        // Monthly before annual within one domain, so the build-up reads first.
        return freqRank(a.frequency) - freqRank(b.frequency);
      });

    const freqs = new Set(bands.map((b) => b.frequency));
    plans.push({
      name,
      grain:
        freqs.size > 1
          ? "mixed"
          : grainFor([...freqs][0]),
      bands,
      // Quarterly and half-yearly figures do not exist upstream, so any sheet
      // carrying them is doing an aggregation of its own.
      aggregated: bands.some(
        (b) => b.frequency === "quarterly" || b.frequency === "half_yearly"
      ),
    });
  }

  return plans;
}

function freqRank(f: Frequency): number {
  return { monthly: 0, quarterly: 1, half_yearly: 2, annual: 3 }[f];
}

function grainFor(f: Frequency): SheetPlan["grain"] {
  if (f === "quarterly") return "quarter";
  if (f === "half_yearly") return "half";
  if (f === "annual") return "annual";
  return "month";
}

/** Period column headers for a grain. */
export function periodColumns(grain: SheetPlan["grain"], fiscalYear: string): string[] {
  if (grain === "quarter") return ["Q1", "Q2", "Q3", "Q4"];
  if (grain === "half") return ["H1", "H2"];
  if (grain === "annual") return [`FY ${fiscalYear}`];
  return MONTH_LABELS;
}

export function outputFilename(fiscalYear: string): string {
  return `BEPL-ESG-metrics_${fiscalYear}.xlsx`;
}
