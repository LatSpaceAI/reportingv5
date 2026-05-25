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
  transform?: "yesNoFromBool" | "boolRaw" | "dateFromIso" | "pct100to1" | "cnCodeOnly" | "countryCodeFromName" | "countryNameFromLabel";
}

export interface TableBinding {
  kind: "table";
  questionId: string;
  sheet: string;
  /** First row of block N=0. */
  anchorRow: number;
  /** Rows added per subsequent row/block. */
  rowStride: number;
  /** Column letter for each field id in the row.
   *
   * `readOnly: true` means the seed-generator reads this cell to populate
   * the in-app default (e.g. an aggregated good name shown in the row), but
   * the export skips writing it because the template computes the cell from
   * other inputs (CNTR_List lookups, shared formulas, etc.) and overwriting
   * it would either drop the formula or break exceljs's shared-formula
   * accounting. Keep export-writable cells `readOnly: false` or omitted. */
  columns: Record<string, { col: string; offset?: number; transform?: FieldBinding["transform"]; readOnly?: boolean }>;
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
  { kind: "field", questionId: "A.2", fieldId: "country",          sheet: "A_InstData", cell: "I26", transform: "countryNameFromLabel" },
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
  { kind: "field", questionId: "A.3", fieldId: "verifierCountry",    sheet: "A_InstData", cell: "I41", transform: "countryNameFromLabel" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepName",    sheet: "A_InstData", cell: "I45" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepEmail",   sheet: "A_InstData", cell: "I46" },
  { kind: "field", questionId: "A.3", fieldId: "verifierRepTel",     sheet: "A_InstData", cell: "I47" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationMS",    sheet: "A_InstData", cell: "I51", transform: "countryNameFromLabel" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationBody",  sheet: "A_InstData", cell: "I52" },
  { kind: "field", questionId: "A.3", fieldId: "accreditationRegNo", sheet: "A_InstData", cell: "I53" },

  // A.4 Aggregated goods table (rows 62-71, 10 rows). Cols: E=good, I–N=routes,
  // AH=PFC emissions relevant flag.
  {
    kind: "table",
    questionId: "A.4",
    sheet: "A_InstData",
    anchorRow: 62,
    rowStride: 1,
    maxRows: 10,
    columns: {
      good:         { col: "E" },
      route1:       { col: "I" },
      route2:       { col: "J" },
      // route3..6 unused in our UI; template has cols K-N for those.
      // pfcRelevant is computed by the template from the good (column E)
      // via a Parameters_Constants lookup, so seed reads it but export must
      // not write — writing replaces the formula and drops the live flag.
      pfcRelevant:  { col: "AH", transform: "yesNoFromBool", readOnly: true },
    },
  },

  // A.5 Purchased precursors (rows 102-121, 20 rows). Cols: E=good,
  // F=countryCode, G-K=routes, L=supplier free-text label.
  {
    kind: "table",
    questionId: "A.5",
    sheet: "A_InstData",
    anchorRow: 102,
    rowStride: 1,
    maxRows: 20,
    columns: {
      good:     { col: "E" },
      country:  { col: "F", transform: "countryCodeFromName" },
      route:    { col: "G" },
      supplier: { col: "L" },
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
  // Headers at row 96: AG=Frequency, AH=Duration, AI=SEF(CF4), AL=OVC, AM=F(C2F6).
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
      aeFreq:      { col: "AG" },
      aeDur:       { col: "AH" },
      slopeCF4:    { col: "AI" },
      overvoltage: { col: "AL" },
      slopeC2F6:   { col: "AM" },
    },
  },

  // B.3 CEMS — B_EmInst rows 113 onward (rows 111-112 are EU examples).
  // Headers at row 110: D=Name, E=GHG, V=hourly conc avg, X=hours operating,
  // Z=flue gas flow average.
  {
    kind: "table",
    questionId: "B.3",
    sheet: "B_EmInst",
    anchorRow: 113,
    rowStride: 1,
    maxRows: 10,
    columns: {
      name:  { col: "D" },
      ghg:   { col: "E" },
      conc:  { col: "V" },
      hours: { col: "X" },
      flow:  { col: "Z" },
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
      // Aggregated good shown at L11 of each block (offset -4 from the
      // anchorRow=15 header). The template auto-computes this from
      // CNTR_List_ExistProdProc, so the seed reads it but the export skips
      // writing — overwriting the formula here also trips exceljs's
      // shared-formula accounting at E16.
      good:               { col: "L", offset: -4, readOnly: true },
      // ── Production amounts by route (L16-L19) ─────────────────────
      prodPrimary:        { col: "L", offset: 1 },
      prodSecondary:      { col: "L", offset: 2 },
      prodOther:          { col: "L", offset: 3 },
      prodUnknown:        { col: "L", offset: 4 },
      // L24 (offset 9) is =SUM(L16:L23); the template computes the total,
      // so `output` is read-only on export (the SOT pre-fill still shows
      // the value in the UI).
      output:             { col: "L", offset: 9, readOnly: true },
      // ── Production details (toMarket at L27) ───────────────────────
      toMarket:           { col: "L", offset: 12 },
      // ── Internal consumption (L32-L40 — one row per "other"
      //    production process referenced by name in section (c)).
      //    Note: the row mapping depends on the current process index —
      //    P1 lists FRP, Extrusion at L32/L33; P2 lists Unwrought,
      //    Extrusion at L97/L98; P3 lists Unwrought, FRP at L162/L163.
      //    See applyD1InternalConsumption() in export.ts for the
      //    process-aware re-mapping. We leave these blank in the static
      //    binding because the cell column is the same but the *meaning*
      //    of "row 1 / row 2" depends on the current process.
      // ── Non-CBAM consumption (L41) ────────────────────────────────
      nonCbam:            { col: "L", offset: 26 },
      // ── Applicable elements (K50/L50 — booleans for whether
      //    measurable heat / waste gases are relevant) ───────────────
      hasHeat:            { col: "K", offset: 35, transform: "boolRaw" },
      hasWasteGas:        { col: "L", offset: 35, transform: "boolRaw" },
      // ── Attributed direct emissions (L54) ──────────────────────────
      directEm:           { col: "L", offset: 39 },
      // ── Measurable heat balance (L57 imp / M57 exp / L58 EF) ──────
      heatImported:       { col: "L", offset: 42 },
      heatExported:       { col: "M", offset: 42 },
      heatEF:             { col: "L", offset: 43 },
      // ── Waste gas balance (L61 imp / M61 exp / L62 EF) ────────────
      wasteGasImported:   { col: "L", offset: 46 },
      wasteGasExported:   { col: "M", offset: 46 },
      wasteGasEF:         { col: "L", offset: 47 },
      // ── Indirect-emission electricity (L65 cons / L66 EF / L67 src) ─
      elecMWh:            { col: "L", offset: 50 },
      elecEF:             { col: "L", offset: 51 },
      elecSource:         { col: "L", offset: 52 },
      // ── Electricity exported from the process (L71 / L72) ─────────
      elecExportedMWh:    { col: "L", offset: 56 },
      elecExportedEF:     { col: "L", offset: 57 },
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
      // Aggregated good shown at L14 of each block (offset -2 from the
      // anchorRow=16 header). The template auto-computes this from
      // CNTR_List_ExistPurchPrec, so the seed reads it but the export skips
      // writing (see D.1 `good` for the same shared-formula reason).
      good:             { col: "L", offset: -2, readOnly: true },
      // Country and supplier live on A_InstData (A.5 binding handles
      // them at rows 102+); E_PurchPrec doesn't carry them. We omit the
      // bindings here entirely — these fields show up in the in-app E.1
      // table because the schema lists them, and the cross-sheet seed
      // post-processing in scripts/gen-cbam-seed.mjs / the country
      // mirror in export.ts populates them from A.5.
      // ── Total purchased by production route (L17-L20) ─────────────
      purchPrimary:     { col: "L", offset: 1 },
      purchSecondary:   { col: "L", offset: 2 },
      purchOther:       { col: "L", offset: 3 },
      purchUnknown:     { col: "L", offset: 4 },
      // L25 (offset 9) is =SUM(L17:L24); the template computes the total,
      // so `mass` is read-only on export.
      mass:             { col: "L", offset: 9, readOnly: true },
      // ── Consumption by process within installation (L28-L30):
      //    by convention block-row 1 = Unwrought, 2 = FRP, 3 = Extrusion. ─
      toUnwrought:      { col: "L", offset: 12 },
      toFRP:            { col: "L", offset: 13 },
      toExtrusion:      { col: "L", offset: 14 },
      // ── Consumed for other purposes (L38) ─────────────────────────
      consumedOther:    { col: "L", offset: 22 },
      // ── SEE direct (L49) + its source (M49) ───────────────────────
      seeDirect:        { col: "L", offset: 33 },
      seeDirectSource:  { col: "M", offset: 33 },
      // ── Specific electricity (L50) + its source (M50) ─────────────
      elecPerT:         { col: "L", offset: 34 },
      elecPerTSource:   { col: "M", offset: 34 },
      // ── Electricity EF (L51) + its source (M51) ───────────────────
      elecEF:           { col: "L", offset: 35 },
      elecSource:       { col: "M", offset: 35 },
      // ── SEE indirect (L52) — formula =L50*L51, read-only on export.
      seeIndirect:      { col: "L", offset: 36, readOnly: true },
      // ── Defaults justification (K54) ───────────────────────────────
      justification:    { col: "K", offset: 38 },
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

  // ───────────── Summary of products ─────────────
  // Summary_Products — single table starting at row 10 (row 9 is the EU
  // example). Hindalco filled rows 10-15. Most columns downstream of the
  // process name are formula-derived in the EU template; we still bind them
  // so the seed can read the cached results and round-trip through the UI.
  {
    kind: "table",
    questionId: "summary.1",
    sheet: "Summary_Products",
    anchorRow: 10,
    rowStride: 1,
    maxRows: 30,
    columns: {
      // Only D (process name), F (CN code), and H (product name) are
      // writable cells in the template. Every other column is a formula
      // that derives from D/F via CNTR_List or InputOutput lookups —
      // overwriting these drops the live formulas and trips exceljs's
      // shared-formula accounting on export. The seed still reads them so
      // the in-app summary table renders the right SEE / embedded-elec
      // values, but they're never written back to the workbook.
      process:      { col: "D" },
      good:         { col: "E", readOnly: true },
      cnCode:       { col: "F" },
      cnName:       { col: "G", readOnly: true },
      productName:  { col: "H" },
      seeDirect:    { col: "I", readOnly: true },
      seeIndirect:  { col: "J", readOnly: true },
      seeTotal:     { col: "K", readOnly: true },
      defaultShare: { col: "M", transform: "pct100to1", readOnly: true },
      elecEFSource: { col: "N", readOnly: true },
      embeddedElec: { col: "O", readOnly: true },
    },
  },

  // G_FurtherGuidance and Summary_Communication are still generated entirely
  // by template formulas from A-F; no user input is required so those sheets
  // are not surfaced in the UI and have no bindings here.
];
