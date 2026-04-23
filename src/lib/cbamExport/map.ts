/**
 * Binding from in-app answers (question id + field id) → CBAM Excel template cells.
 *
 * Template reference: CBAM Communication template for installations v2.1.1 (2024-12-13).
 * Every binding records: sheet, cell, and the answer path.
 *
 * Two shapes:
 *   - "field"  → single cell for a fields-question field.
 *   - "table"  → repeating block: anchor row + row stride + per-column cell offsets.
 *
 * Cells with formulas in the template are left alone. We only fill the editable
 * input cells that the EU surfaces in their original template.
 */

export interface FieldBinding {
  kind: "field";
  questionId: string;
  fieldId: string;
  sheet: string;
  cell: string;
  /** Optional transformer (e.g. "Yes"/"No" → boolean Excel cell). */
  transform?: "yesNoFromBool" | "dateFromIso" | "pct100to1" | "cnCodeOnly" | "countryCodeFromName";
}

export interface TableBinding {
  kind: "table";
  questionId: string;
  sheet: string;
  /** First row of block N=0. */
  anchorRow: number;
  /** Rows added per subsequent row/block. */
  rowStride: number;
  /** Column letter for each field id in the row. */
  columns: Record<string, { col: string; offset?: number; transform?: FieldBinding["transform"] }>;
  /** Max rows we will write (protects us from exceeding the template's provision). */
  maxRows: number;
}

export type Binding = FieldBinding | TableBinding;

/**
 * A.1 Reporting period — dates at I9 (start) and L9 (end) on A_InstData.
 *
 * A.2 Installation identity — the template has a single block of label + value
 * rows from row 19 downward. Inputs begin at column I (text) or I-N (for country dropdown).
 */
export const bindings: Binding[] = [
  // ───────────── A. Installation Data ─────────────
  { kind: "field", questionId: "A.1", fieldId: "start", sheet: "A_InstData", cell: "I9", transform: "dateFromIso" },
  { kind: "field", questionId: "A.1", fieldId: "end",   sheet: "A_InstData", cell: "L9", transform: "dateFromIso" },

  { kind: "field", questionId: "A.2", fieldId: "nameLocal",        sheet: "A_InstData", cell: "I19" },
  { kind: "field", questionId: "A.2", fieldId: "nameEn",           sheet: "A_InstData", cell: "I20" },
  { kind: "field", questionId: "A.2", fieldId: "street",           sheet: "A_InstData", cell: "I21" },
  { kind: "field", questionId: "A.2", fieldId: "economicActivity", sheet: "A_InstData", cell: "I22" },
  { kind: "field", questionId: "A.2", fieldId: "postcode",         sheet: "A_InstData", cell: "I23" },
  { kind: "field", questionId: "A.2", fieldId: "poBox",            sheet: "A_InstData", cell: "I24" },
  { kind: "field", questionId: "A.2", fieldId: "city",             sheet: "A_InstData", cell: "I25" },
  { kind: "field", questionId: "A.2", fieldId: "country",          sheet: "A_InstData", cell: "I26" },
  { kind: "field", questionId: "A.2", fieldId: "unlocode",         sheet: "A_InstData", cell: "I27" },
  { kind: "field", questionId: "A.2", fieldId: "lat",              sheet: "A_InstData", cell: "I28" },
  { kind: "field", questionId: "A.2", fieldId: "lng",              sheet: "A_InstData", cell: "I29" },
  { kind: "field", questionId: "A.2", fieldId: "repName",          sheet: "A_InstData", cell: "I30" },
  { kind: "field", questionId: "A.2", fieldId: "repEmail",         sheet: "A_InstData", cell: "I31" },
  { kind: "field", questionId: "A.2", fieldId: "repTel",           sheet: "A_InstData", cell: "I32" },

  { kind: "field", questionId: "A.3", fieldId: "verifierCompany",    sheet: "A_InstData", cell: "I37" },
  { kind: "field", questionId: "A.3", fieldId: "verifierStreet",     sheet: "A_InstData", cell: "I38" },
  { kind: "field", questionId: "A.3", fieldId: "verifierCity",       sheet: "A_InstData", cell: "I39" },
  { kind: "field", questionId: "A.3", fieldId: "verifierPostcode",   sheet: "A_InstData", cell: "I40" },
  { kind: "field", questionId: "A.3", fieldId: "verifierCountry",    sheet: "A_InstData", cell: "I41" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepName",    sheet: "A_InstData", cell: "I45" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepEmail",   sheet: "A_InstData", cell: "I46" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepTel",     sheet: "A_InstData", cell: "I47" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationMS",    sheet: "A_InstData", cell: "I51" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationBody",  sheet: "A_InstData", cell: "I52" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationRegNo", sheet: "A_InstData", cell: "I53" },

  // A.4 Aggregated goods table (rows 62-71, 10 rows). Cols: E=good, I–N=routes
  {
    kind: "table",
    questionId: "A.4",
    sheet: "A_InstData",
    anchorRow: 62,
    rowStride: 1,
    maxRows: 10,
    columns: {
      good:   { col: "E" },
      route1: { col: "I" },
      route2: { col: "J" },
      // route3..6 unused in our UI; template has cols K-N for those.
    },
  },

  // A.5 Purchased precursors (rows 102-121, 20 rows). Cols: E=good, F=countryCode, G-K=routes
  {
    kind: "table",
    questionId: "A.5",
    sheet: "A_InstData",
    anchorRow: 102,
    rowStride: 1,
    maxRows: 20,
    columns: {
      good:    { col: "E" },
      country: { col: "F", transform: "countryCodeFromName" },
      route:   { col: "G" },
    },
  },

  // ───────────── B. Emissions ─────────────
  // B.1 Source streams — B_EmInst, data rows 17 onward (Ex rows 14-16 are examples).
  {
    kind: "table",
    questionId: "B.1",
    sheet: "B_EmInst",
    anchorRow: 17,
    rowStride: 1,
    maxRows: 75,
    columns: {
      method:   { col: "D" },
      name:     { col: "E" },
      ad:       { col: "F" },
      adUnit:   { col: "G" },
      ncv:      { col: "H" },
      ef:       { col: "J" },
      efUnit:   { col: "K" },
      cContent: { col: "L", transform: "pct100to1" },
      oxF:      { col: "N", transform: "pct100to1" },
      convF:    { col: "P", transform: "pct100to1" },
      biomass:  { col: "R", transform: "pct100to1" },
    },
  },

  // B.2 PFC — B_EmInst rows 98 onward (row 97 is the example).
  {
    kind: "table",
    questionId: "B.2",
    sheet: "B_EmInst",
    anchorRow: 98,
    rowStride: 1,
    maxRows: 10,
    columns: {
      method:      { col: "D" },
      tech:        { col: "E" },
      tAl:         { col: "F" },
      aeFreq:      { col: "H" },
      aeDur:       { col: "J" },
      overvoltage: { col: "L" },
      slopeCF4:    { col: "N" },
      slopeC2F6:   { col: "P" },
    },
  },

  // B.3 CEMS — B_EmInst rows 111 onward.
  {
    kind: "table",
    questionId: "B.3",
    sheet: "B_EmInst",
    anchorRow: 111,
    rowStride: 1,
    maxRows: 10,
    columns: {
      name:  { col: "D" },
      ghg:   { col: "E" },
      conc:  { col: "F" },
      flow:  { col: "H" },
      hours: { col: "J" },
    },
  },

  // ───────────── C. Installation-level emissions & energy ─────────────
  // C.1 Fuel balance — manual row is 16. Cols H..L.
  { kind: "field", questionId: "C.1", fieldId: "cbamDirect",  sheet: "C_Emissions&Energy", cell: "I16" },
  { kind: "field", questionId: "C.1", fieldId: "electricity", sheet: "C_Emissions&Energy", cell: "J16" },
  { kind: "field", questionId: "C.1", fieldId: "nonCbam",     sheet: "C_Emissions&Energy", cell: "K16" },
  { kind: "field", questionId: "C.1", fieldId: "rest",        sheet: "C_Emissions&Energy", cell: "L16" },

  // C.2 GHG balance — manual row is 26. Cols H..M.
  { kind: "field", questionId: "C.2", fieldId: "co2",      sheet: "C_Emissions&Energy", cell: "H26" },
  { kind: "field", questionId: "C.2", fieldId: "biomass",  sheet: "C_Emissions&Energy", cell: "I26" },
  { kind: "field", questionId: "C.2", fieldId: "n2o",      sheet: "C_Emissions&Energy", cell: "J26" },
  { kind: "field", questionId: "C.2", fieldId: "pfc",      sheet: "C_Emissions&Energy", cell: "K26" },
  { kind: "field", questionId: "C.2", fieldId: "direct",   sheet: "C_Emissions&Energy", cell: "L26" },
  { kind: "field", questionId: "C.2", fieldId: "indirect", sheet: "C_Emissions&Energy", cell: "M26" },

  // C.3 Data quality selections at row 40-42, col H.
  { kind: "field", questionId: "C.3", fieldId: "quality",       sheet: "C_Emissions&Energy", cell: "H40" },
  { kind: "field", questionId: "C.3", fieldId: "justification", sheet: "C_Emissions&Energy", cell: "H41" },
  { kind: "field", questionId: "C.3", fieldId: "verification",  sheet: "C_Emissions&Energy", cell: "H42" },

  // ───────────── D. Production processes ─────────────
  // D.1 — 10 blocks of 65 rows each, starting at row 15.
  // Within a block: L15=total production (but we write Output into L16 row first data row is 16).
  // Simpler: each P row maps onto a block. We put Output at block+1 (total prod), direct em at block+39, etc.
  // Based on inspection: block anchor row N. Within it:
  //   L16..L23 — production amounts (we use L16 for Output).
  //   L54 — directly attributable emissions.
  //   L57 — heat imported ; M57 — heat exported.
  //   L61 — waste gas imported ; M61 — exported.
  //   L65 — electricity consumption.
  //   L67 — electricity source.
  //   L66 — electricity EF.
  //   L71 — electricity exported (amount).
  // Block stride = 65.
  {
    kind: "table",
    questionId: "D.1",
    sheet: "D_Processes",
    anchorRow: 15,
    rowStride: 65,
    maxRows: 10,
    columns: {
      good:         { col: "E" },
      output:       { col: "L", offset: 1 },
      directEm:     { col: "L", offset: 39 },
      heatProduced: { col: "L", offset: 42 },
      heatConsumed: { col: "L", offset: 43 },
      heatImported: { col: "L", offset: 42 },
      heatExported: { col: "M", offset: 42 },
      elecMWh:      { col: "L", offset: 50 },
      elecEF:       { col: "L", offset: 51 },
      elecSource:   { col: "L", offset: 52 },
    },
  },

  // ───────────── E. Purchased precursors SEE ─────────────
  // E.1 — 20 blocks of 44 rows each, anchor 16.
  // Within block: L16 total purchased; L49 SEE direct; L50 spec elec consumption;
  // L51 electricity EF; L52 SEE indirect; M49 source; K54 justification; M51 elec source; M49 measurement.
  {
    kind: "table",
    questionId: "E.1",
    sheet: "E_PurchPrec",
    anchorRow: 16,
    rowStride: 44,
    maxRows: 20,
    columns: {
      good:         { col: "E" },
      country:      { col: "F", transform: "countryCodeFromName" },
      mass:         { col: "L", offset: 1 },
      seeDirect:    { col: "L", offset: 33 },
      elecPerT:     { col: "L", offset: 34 },
      elecEF:       { col: "L", offset: 35 },
      seeIndirect:  { col: "L", offset: 36 },
      measurement:  { col: "M", offset: 33 },
      elecSource:   { col: "M", offset: 35 },
      justification:{ col: "K", offset: 38 },
    },
  },

  // ───────────── F. Tools ─────────────
  // F.1 CHP — rows 21 and 26 (inputs and outputs), columns J-L.
  { kind: "field", questionId: "F.1", fieldId: "fuelIn",  sheet: "F_Tools", cell: "J21" },
  { kind: "field", questionId: "F.1", fieldId: "heatOut", sheet: "F_Tools", cell: "K21" },
  { kind: "field", questionId: "F.1", fieldId: "elecOut", sheet: "F_Tools", cell: "L21" },

  // F.2 Carbon price — currency at J97, per-process rows 101..130 col H (price), L (amount due), N (notes).
  { kind: "field", questionId: "F.2", fieldId: "currency",    sheet: "F_Tools", cell: "J97" },
  { kind: "field", questionId: "F.2", fieldId: "pricePerTon", sheet: "F_Tools", cell: "H101" },
  { kind: "field", questionId: "F.2", fieldId: "priceType",   sheet: "F_Tools", cell: "E97"  },
  { kind: "field", questionId: "F.2", fieldId: "rebateType",  sheet: "F_Tools", cell: "F97"  },
  { kind: "field", questionId: "F.2", fieldId: "amountDue",   sheet: "F_Tools", cell: "H102" },
  { kind: "field", questionId: "F.2", fieldId: "notes",       sheet: "F_Tools", cell: "E130" },

  // ───────────── G. Further guidance ─────────────
  { kind: "field", questionId: "G.1", fieldId: "notes", sheet: "G_FurtherGuidance", cell: "E10" },

  // ───────────── SP, SC — Summaries ─────────────
  // The template computes these automatically from A-F. Where users have entered data
  // into our SP/SC questions (they can override), write them to the summary sheet's
  // manual-entry cells. These sheets are heavily formula-driven so we skip them safely.
  // A future iteration can map SP.1 rows to Summary_Products.
];
