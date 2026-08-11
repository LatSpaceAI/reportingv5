// Cell map for the "Environment (Real Estate)" sheet of
// birla-estates/output/Real Estate BRSR and IR Data template FY25 V1.xlsx
//
// The export writes computed values into THESE EXACT CELLS of the real
// template file, preserving its layout, 137 merged ranges, and styling. Nothing
// is generated from scratch — the deliverable is the client's own workbook with
// our numbers in it.
//
// COLUMN GEOMETRY differs per block, which is why this is a table rather than a
// formula:
//
//   Energy       (rows 16-23)   F = FY total, G..R = Apr..Mar
//   Water        (rows 25-34)   C = FY total, D..O = Apr..Mar
//   Stressed     (rows 61-70)   D = FY total, E..P = Apr..Mar
//   Waste        (rows 124-208) D = FY total, F/H/J/L = Q1..Q4 offsite
//   Air          (rows 92-96)   per site, D..M = H1/H2 pairs
//   Refrigerants (rows 100-106) per site, E..I
//
// WHY WE REPLACE THE FORMULAS
// 108 of the 351 formulas on this sheet are external links into
// ".../ESG Data FY 24-25.xlsx" — a file on a personal OneDrive that nobody has.
// They read as #REF! or stale cached values on any other machine. We overwrite
// them with computed numbers, which is what makes the exported file usable
// standalone. The FY-total formulas that reference cells WITHIN the sheet
// (=SUM(G17:R17)) are deliberately left alone so the workbook still recalculates
// live if a user edits a month.

/** A monthly block: one output_parameter key -> one row. */
export interface MonthlyRow {
  /** esg.output_parameter.key */
  key: string;
  row: number;
  /** Column holding the fiscal-year total, or null to leave the sheet's own formula. */
  fyCol: string | null;
  /** Columns for Apr..Mar, in fiscal order. */
  monthCols: string[];
  label: string;
}

/** A quarterly waste block: generation and recovery rows for one category. */
export interface WasteRow {
  key: string;
  row: number;
  fyCol: string;
  /** Q1..Q4 columns (the "offsite" column of each quarter pair). */
  quarterCols: string[];
  label: string;
}

const SHEET = "Environment (Real Estate)";
export const ENVIRONMENT_SHEET = SHEET;

// Apr..Mar for the energy block.
const ENERGY_MONTHS = ["G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
// Apr..Mar for the water block.
const WATER_MONTHS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
// Apr..Mar for the water-stressed block.
const STRESSED_MONTHS = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
// Q1..Q4 offsite columns in the waste blocks.
const WASTE_QUARTERS = ["F", "H", "J", "L"];

// ---------------------------------------------------------------------------
// ENERGY — template rows 17-23
// ---------------------------------------------------------------------------
export const ENERGY_ROWS: MonthlyRow[] = [
  { key: "en.diesel_stationary", row: 17, fyCol: null, monthCols: ENERGY_MONTHS, label: "Diesel (Stationary Combustion)" },
  // Row 18's FY cell (F18) has NO formula in the template — 72% of diesel had
  // no annual roll-up in the published file. We write the total explicitly.
  { key: "en.diesel_mobile", row: 18, fyCol: "F", monthCols: ENERGY_MONTHS, label: "Diesel (Mobile Combustion)" },
  { key: "en.petrol", row: 19, fyCol: null, monthCols: ENERGY_MONTHS, label: "Petrol (Mobile)" },
  { key: "en.electricity_nonrenew", row: 20, fyCol: null, monthCols: ENERGY_MONTHS, label: "Electricity - non-renewable" },
  { key: "en.electricity_renew", row: 23, fyCol: null, monthCols: ENERGY_MONTHS, label: "Electricity - renewable" },
];

// ---------------------------------------------------------------------------
// WATER — template rows 27-34
// ---------------------------------------------------------------------------
export const WATER_ROWS: MonthlyRow[] = [
  { key: "wtr.surface", row: 27, fyCol: null, monthCols: WATER_MONTHS, label: "(i) Surface Water" },
  { key: "wtr.groundwater", row: 28, fyCol: null, monthCols: WATER_MONTHS, label: "(ii) Ground Water" },
  { key: "wtr.third_party", row: 29, fyCol: null, monthCols: WATER_MONTHS, label: "(iii) Third party water" },
  { key: "wtr.seawater", row: 30, fyCol: null, monthCols: WATER_MONTHS, label: "(iv) Seawater / desalinated" },
  { key: "wtr.treated", row: 31, fyCol: null, monthCols: WATER_MONTHS, label: "(v) Others - treated water" },
  // Row 32 (total withdrawal) is =SUM(D27:D31) per column — left to the sheet.
  // Row 34 shows 0 in the published file because its monthly cells were never
  // filled. We write them, which makes the sheet's own FY formula correct.
  { key: "wtr.consumption", row: 34, fyCol: null, monthCols: WATER_MONTHS, label: "Total water consumption" },
];

// ---------------------------------------------------------------------------
// WATER-STRESSED ("Bangalore & NCR") — template rows 63-70
// ---------------------------------------------------------------------------
export const STRESSED_ROWS: MonthlyRow[] = [
  { key: "wtr.ws_groundwater", row: 64, fyCol: null, monthCols: STRESSED_MONTHS, label: "(ii) Groundwater, stressed" },
  { key: "wtr.ws_third_party", row: 65, fyCol: null, monthCols: STRESSED_MONTHS, label: "(iii) Third party, stressed" },
  { key: "wtr.ws_treated", row: 67, fyCol: null, monthCols: STRESSED_MONTHS, label: "(v) Treated water, stressed" },
  // Row 68 (total) is =SUM(E63:E67) per column — correct, left to the sheet.
  // Row 70's own formula =SUM(E65:E69) is DEFECTIVE: the range spans its own
  // subtotal (row 68) and skips groundwater (row 64), roughly doubling the
  // figure. We overwrite the monthly cells with the correct consumption.
  { key: "wtr.ws_consumption", row: 70, fyCol: null, monthCols: STRESSED_MONTHS, label: "Water consumption, stressed" },
];

// ---------------------------------------------------------------------------
// WASTE — quarterly, template rows 127-208
//
// Each category is an 8-row block: Generated, Recycled, Reused, Other recovery,
// Incinerated, Landfilled, Other disposal.
// ---------------------------------------------------------------------------
export const WASTE_ROWS: WasteRow[] = [
  { key: "wst.biomedical_generated", row: 127, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Bio-medical - generated" },
  { key: "wst.biomedical_incinerated", row: 131, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Bio-medical - incinerated" },

  { key: "wst.plastic_generated", row: 135, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Plastic - generated" },
  // The template's FY formula for this row (D136) references the GENERATED row
  // instead of the recycled one. Same value here, wrong cell; we write both.
  { key: "wst.plastic_recycled", row: 136, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Plastic - recycled" },

  { key: "wst.oil_filters_generated", row: 143, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Oil filters - generated" },
  { key: "wst.oil_filters_incinerated", row: 147, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Oil filters - incinerated" },

  { key: "wst.cnd_generated", row: 151, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "C&D - generated" },
  { key: "wst.cnd_reused", row: 153, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "C&D - reused" },
  { key: "wst.cnd_landfilled", row: 156, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "C&D - landfilled" },

  { key: "wst.used_oil_generated", row: 159, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Used oil - generated" },
  { key: "wst.used_oil_recycled", row: 160, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Used oil - recycled" },

  { key: "wst.battery_generated", row: 167, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Battery - generated" },
  { key: "wst.battery_recycled", row: 168, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Battery - recycled" },

  { key: "wst.cotton_rags_generated", row: 175, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Cotton rags - generated" },
  { key: "wst.cotton_rags_incinerated", row: 179, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Cotton rags - incinerated" },

  // The template's Q2/Q3 formulas for this row point at the cotton-rags row
  // (81 instead of 80 in the source file), so its published quarterly split
  // duplicates cotton-rags values. Overwriting fixes it.
  { key: "wst.other_haz_generated", row: 183, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Other hazardous - generated" },
  { key: "wst.other_haz_incinerated", row: 187, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Other hazardous - incinerated" },

  { key: "wst.municipal_generated", row: 193, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Municipal - generated" },
  { key: "wst.municipal_recycled", row: 194, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Municipal - recycled" },

  { key: "wst.food_generated", row: 201, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Food - generated" },
  { key: "wst.food_recycled", row: 202, fyCol: "D", quarterCols: WASTE_QUARTERS, label: "Food - recycled" },
];

// ---------------------------------------------------------------------------
// AIR EMISSIONS — half-yearly, per site, template rows 94-96
//
// Column pairs are (H1, H2) per site in the order the template names them.
// These come from half-yearly stack/DG monitoring reports, NOT the monthly
// returns, so unless that data has been entered these cells stay untouched.
// ---------------------------------------------------------------------------
export const AIR_SITE_COLUMNS: { siteCode: string; h1: string; h2: string }[] = [
  { siteCode: "AURORA", h1: "D", h2: "E" },
  { siteCode: "CENTURION", h1: "F", h2: "G" },
  { siteCode: "TISYA", h1: "H", h2: "I" },
  { siteCode: "TRIMAYA", h1: "J", h2: "K" },
  { siteCode: "NAVYA", h1: "L", h2: "M" },
];

export const AIR_ROWS: { key: string; row: number; label: string }[] = [
  { key: "air.nox_total", row: 94, label: "NOx" },
  { key: "air.sox_total", row: 95, label: "SOx" },
  { key: "air.pm_total", row: 96, label: "Particulate Matter" },
];

// ---------------------------------------------------------------------------
// REFRIGERANTS — annual, per site, template rows 101-106
// ---------------------------------------------------------------------------
export const REFRIGERANT_SITE_COLUMNS: { siteCode: string; col: string }[] = [
  { siteCode: "AURORA", col: "E" },
  { siteCode: "CENTURION", col: "F" },
];

export const REFRIGERANT_ROWS: { key: string; row: number; label: string }[] = [
  { key: "rf.r404a", row: 101, label: "R404A" },
  { key: "rf.r410a", row: 102, label: "R410A" },
  { key: "rf.r407c", row: 103, label: "R407C" },
  { key: "rf.r22", row: 104, label: "R22" },
  { key: "rf.r134a", row: 105, label: "R134a" },
  { key: "rf.co2_extinguisher", row: 106, label: "CO2 extinguisher refills" },
];

/**
 * Corrections this export makes to the template's own formulas, surfaced in the
 * accompanying diff report so nothing changes silently.
 */
export const KNOWN_TEMPLATE_DEFECTS = [
  {
    cell: "F18",
    what: "Mobile diesel had no annual roll-up formula — 72% of diesel was missing from the FY total.",
    fix: "FY total written explicitly.",
  },
  {
    cell: "C34 / D34:O34",
    what: "Total water consumption showed 0 because its monthly cells were never filled.",
    fix: "Monthly consumption written; the sheet's own FY sum then computes correctly.",
  },
  {
    cell: "E70:P70",
    what: "Stressed-area consumption used =SUM(E65:E69), a range that spans its own subtotal row and skips groundwater — roughly double the true figure.",
    fix: "Correct monthly consumption written over the defective formula.",
  },
  {
    cell: "D136",
    what: "Plastic recycled FY total referenced the generated row instead of the recycled row.",
    fix: "Both rows written explicitly.",
  },
  {
    cell: "H183 / J183",
    what: "Other-hazardous Q2/Q3 referenced the cotton-rags row, duplicating its values.",
    fix: "Correct quarterly values written.",
  },
  {
    cell: "108 external links",
    what: "Formulas referencing '.../ESG Data FY 24-25.xlsx', a file on a personal OneDrive, which resolve to #REF! or stale values elsewhere.",
    fix: "Replaced with computed values so the workbook stands alone.",
  },
] as const;
