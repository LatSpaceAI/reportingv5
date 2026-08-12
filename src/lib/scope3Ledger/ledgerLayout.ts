// The shape of the Scope 3 ledger workbook, and the contract its parser relies on.
//
// PURE MODULE — no database, no `server-only`. The generator, the parser and the
// tests all import it, which is what stops the written layout and the read
// layout drifting apart.
//
// WHY THIS IS NOT THE STANDARD TEMPLATE
//
// standardTemplate/ writes ONE ROW PER PARAMETER: a label, a key, a value. That
// is a monthly site return, and it is exactly the shape input_value stores.
//
// A Scope 3 ledger is the opposite. One row is a PURCHASE ORDER — supplier, HSN
// code, quantity, value, tag, spend category — and there are three hundred of
// them. The columns are fixed and the rows are unbounded, where the standard
// template has fixed rows and one value column. Nothing about the two layouts is
// shared beyond both being spreadsheets, so this is a sibling module rather than
// an option on that one.
//
// THE PARSE CONTRACT
//
// Nothing is located by a fixed row or column index. The parser finds the header
// row by scanning for the line-ID column's header text, then finds every other
// column by ITS header text within that same row. Consequence: inserting a row
// above the table, or a column between two others, cannot break an import. Both
// cases are asserted in scripts/test-scope3-ledger.ts.
//
// COLUMN HEADERS ARE THE CLIENT'S OWN, VERBATIM
//
// Every header below is copied from the client's workbook, including its
// spellings and its parenthetical units. The ESG team will have both files open
// side by side, and a header we "improved" is a header they cannot find.

/** Bumped whenever the parse contract changes in a way that invalidates files. */
export const LEDGER_TEMPLATE_VERSION = "1.0.0";

/** Distinguishes our ledger workbook from any other someone may upload. */
export const LEDGER_TEMPLATE_ID = "PLATO.BEPL.SCOPE3";

/**
 * Versions this build can read. A SET, not a `>=` comparison — see the same
 * reasoning in standardTemplate/templateLayout.ts.
 */
export const SUPPORTED_LEDGER_VERSIONS = new Set([LEDGER_TEMPLATE_VERSION]);

export const LEDGER_META_SHEET = "_plato_meta";
export const LEDGER_META_CELLS = {
  templateId: "B1",
  version: "B2",
  generatedAt: "B3",
  fiscalYear: "B4",
} as const;

export const LEDGER_INSTRUCTIONS_SHEET = "Instructions";

/** How many rows to scan for a header row before giving up on a sheet. */
export const HEADER_SCAN_ROWS = 40;

/**
 * The one column every ledger sheet carries, and the anchor the parser scans
 * for. A row with no line ID is not a row — it is the blank remainder of the
 * sheet, and the parser stops caring at that point.
 */
export const LINE_ID_HEADER = "Line ID";

/**
 * A column on a ledger sheet.
 *
 * `attr` is the key it writes into s3_line.attrs, and it MUST match the
 * per-ledger contract documented in supabase/esg/13_scope3_schema.sql. That
 * contract is what resolve-scope3.mjs reads; a mismatch here means a filed
 * figure that the computation silently cannot see, which is the worst failure
 * this path has. scripts/test-scope3-ledger.ts asserts the two agree.
 */
export interface LedgerColumn {
  /** Header text, exactly as printed in the client's workbook. */
  header: string;
  /** The s3_line.attrs key this column writes. */
  attr: string;
  /** How the cell is read. */
  type: "text" | "number" | "date" | "list";
  /** For `list` columns: the dropdown values. */
  options?: readonly string[];
  /** Column width in Excel character units. */
  width?: number;
  /**
   * True where the computation cannot proceed without it. Surfaced in the
   * preview as a warning — NEVER as a block, matching how the rest of this
   * codebase treats validation.
   */
  required?: boolean;
  /** Shown under the header as a comment. */
  help?: string;
}

// ---------------------------------------------------------------------------
// The nine dropdown lists, from 'CONSTANTS - Mappings' columns AB..AP.
//
// These are DATA VALIDATION, not free text, for one reason: every one of them
// is a lookup key into esg.s3_mapping, and a typo is not a cosmetic problem. An
// unmapped value contributes ZERO to its category and looks like nothing
// happened — the exact failure the workbook's VALIDATION sheet exists to catch.
// A dropdown makes the typo impossible at source.
//
// They are frozen here rather than read from s3_mapping because the template is
// generated for a fiscal year and then lives in someone's inbox for weeks; a
// dropdown that changed under a half-filled file would be worse than one that is
// slightly stale. The parser does NOT enforce them — it reports an unrecognised
// value and lets the mapping table have the final say, so extending the mapping
// table does not invalidate a file already in flight.
// ---------------------------------------------------------------------------

export const S3_TAGS = [
  "Cat 1 - Purchased goods and services",
  "Cat 2 - Capital goods",
  "EXCLUDE - counted by tonnage on Materials sheet",
  "EXCLUDE - freight counted on Inbound Freight sheet",
  "EXCLUDE - outside reporting boundary",
] as const;

export const WASTE_STREAMS = [
  "Battery waste",
  "Construction and demolition",
  "E-waste",
  "Food / organic",
  "Hazardous - oil soaked cotton waste",
  "Hazardous - paint and chemical containers",
  "Hazardous - used oil",
  "Metal scrap",
  "Municipal / general",
  "Paper and cardboard",
  "Plastic",
  "STP sludge",
  "Wood scrap",
] as const;

export const DISPOSAL_ROUTES = [
  "Anaerobic digestion",
  "Authorised handler",
  "Co-processing / recovery",
  "Composting",
  "Incineration",
  "Landfill",
  "Recycling",
  "Reused on site",
] as const;

export const MATERIAL_UNITS = ["MT (tonnes)", "m3", "kg", "nos", "litre", "bag"] as const;

export const TRANSPORT_MODES = ["Road", "Rail", "Sea", "Air"] as const;

export const AREA_BASES = [
  "Carpet area",
  "Built-up area",
  "Super built-up area",
  "Conditioned floor area",
] as const;

export const EPI_SOURCES = [
  "Energy simulation (design stage)",
  "ECBC compliance model",
  "Measured - operating asset",
  "Benchmark - sector default",
] as const;

export const YES_NO = ["Y", "N"] as const;

/** Material types, freight vehicles, spend categories, travel and commute modes
 *  and refrigerants come straight from the mapping blocks. Kept here so the
 *  dropdown and the lookup cannot disagree at generation time. */
export const MATERIAL_TYPES = [
  "Cement - OPC",
  "Cement - PPC (fly ash blended)",
  "Cement - PSC (slag blended)",
  "Ready-mix concrete",
  "Steel - reinforcement bar",
  "Steel - structural sections",
  "Bricks - fired clay",
  "Blocks - AAC",
  "Aggregate / sand / crushed stone",
  "Glass - float and glazing",
  "Aluminium - extrusions and facade",
  "Tiles - ceramic and vitrified",
  "Gypsum board and plaster",
  "Paint and coatings",
  "PVC / uPVC pipes and conduit",
  "Copper wire and cable",
  "Timber and plywood",
  "Bitumen and waterproofing",
] as const;

export const FREIGHT_VEHICLES = [
  "LCV up to 3.5t",
  "Rigid truck 7.5-16t",
  "Rigid truck 16-25t",
  "Articulated truck over 25t",
  "Transit mixer",
  "Rail wagon",
  "Sea container",
  "Air cargo",
] as const;

export const SPEND_CATEGORIES = [
  "Construction and civil works",
  "Cement lime and plaster",
  "Fabricated metal products",
  "Machinery and equipment",
  "Electrical equipment and cabling",
  "IT hardware and office equipment",
  "Furniture and fit-out",
  "Professional services",
  "IT and telecom services",
  "Financial and insurance services",
  "Advertising marketing and brokerage",
  "Facility management and manpower services",
  "Transport and logistics services",
  "Plant and equipment hire",
  "Other goods and services",
] as const;

export const TRAVEL_MODES = [
  "Air - domestic - economy",
  "Air - short haul international - economy",
  "Air - long haul - economy",
  "Air - long haul - business",
  "Rail",
  "Road - own or company car",
  "Road - taxi or cab",
  "Hotel stay - India",
] as const;

export const COMMUTE_MODES = [
  "Car - private",
  "Two-wheeler",
  "Auto rickshaw",
  "Public bus",
  "Company shuttle",
  "Metro or suburban rail",
  "Walk or cycle",
] as const;

export const REFRIGERANTS = ["R22", "R32", "R410A", "R134A", "R123", "R404A", "CO2"] as const;

// ---------------------------------------------------------------------------
// THE NINE LEDGERS
//
// Sheet names, owners and grains mirror esg.s3_ledger, which mirrors the
// client's workbook. Column order mirrors the client's sheets too, so the two
// can be read side by side and a column can be copy-pasted across wholesale.
// ---------------------------------------------------------------------------

export interface LedgerSheet {
  /** esg.s3_ledger.code — the discriminator on s3_line. */
  code: string;
  /** Sheet name in OUR workbook. Kept short; Excel caps at 31 chars. */
  sheet: string;
  /** The client's own sheet name, shown in the subtitle so the two line up. */
  sourceSheet: string;
  title: string;
  owner: string;
  /** What one row means. The single most misunderstood thing about a ledger. */
  grain: string;
  /** Whether a row names a site, and whether it names a month. */
  hasSite: boolean;
  hasPeriod: boolean;
  /** Rows to pre-format. The client's sheets allow 50-300; we match. */
  rowCapacity: number;
  columns: readonly LedgerColumn[];
  /** Shown above the table. The traps a filler needs to know about. */
  notes?: readonly string[];
}

/**
 * `site_name` and `month` are read as TEXT and resolved against the database by
 * the service layer, not here. A sheet cannot know the site table, and a parser
 * that silently dropped an unrecognised site name would lose a whole project's
 * procurement. Unresolved names are reported instead.
 */
const SITE_COLUMN: LedgerColumn = {
  header: "Project / site",
  attr: "site_name",
  type: "text",
  width: 22,
  help: "Site or project name. Matched against the site register; an unknown name is reported, never dropped.",
};

const MONTH_COLUMN: LedgerColumn = {
  header: "Month (YYYY-MM)",
  attr: "month",
  type: "text",
  width: 15,
  required: true,
  help: "e.g. 2025-04 for April 2025. Must fall inside the fiscal year on the Instructions tab.",
};

export const LEDGER_SHEETS: readonly LedgerSheet[] = [
  {
    code: "procurement",
    sheet: "1 Procurement",
    sourceSheet: "INPUT - 1 Procurement",
    title: "Procurement ledger",
    owner: "Procurement / IT (SAP extract)",
    grain: "one purchase-order line, or one aggregated supplier-category line",
    hasSite: true,
    hasPeriod: false,
    rowCapacity: 300,
    notes: [
      "EVERY LINE MUST CARRY A SCOPE 3 TAG. An untagged line is silently excluded from the total — the figure comes out understated with nothing on the sheet looking wrong.",
      "If a material is counted by tonnage on sheet 2, its purchase order MUST be tagged EXCLUDE here. A rupee of spend belongs to exactly one method.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Project / plant code", attr: "project_code" },
      { header: "Document date", attr: "doc_date", type: "date", width: 13 },
      { header: "Supplier name", attr: "supplier", type: "text", width: 26 },
      { header: "Supplier code", attr: "supplier_code", type: "text", width: 12 },
      { header: "Short text (description)", attr: "description", type: "text", width: 32 },
      { header: "HSN / SAC code", attr: "hsn_code", type: "text", width: 30,
        help: "Helps classify the line. See the HSN reference on the Lists tab." },
      { header: "Order unit", attr: "order_unit", type: "text", width: 10 },
      { header: "Quantity", attr: "quantity", type: "number", width: 11 },
      { header: "Net order value (INR)", attr: "order_value_inr", type: "number", width: 18, required: true },
      { header: "Scope 3 tag", attr: "s3_tag", type: "list", options: S3_TAGS, width: 44, required: true,
        help: "REQUIRED. An untagged line is silently excluded." },
      { header: "Spend category", attr: "spend_category", type: "list", options: SPEND_CATEGORIES, width: 34, required: true },
      { header: "Notes", attr: "notes", type: "text", width: 30 },
    ],
  },
  {
    code: "materials",
    sheet: "2 Materials",
    sourceSheet: "INPUT - 2 Materials",
    title: "Building materials by tonnage",
    owner: "Site EHS / Planning",
    grain: "one material per supplier per project",
    hasSite: true,
    hasPeriod: false,
    rowCapacity: 200,
    notes: [
      "ONE ROW PRODUCES TWO DISCLOSURES: the embodied carbon of the material (Cat 1) and the emissions of delivering it (Cat 4).",
      "A supplier EPD beats a library factor. Set 'Supplier EPD available?' to Y and enter the figure — leaving the figure blank does NOT fall back to the library factor, because that would substitute a country average for a supplier-specific claim.",
      "Straight-line distance is multiplied by the circuity factor to get road distance. Circuity is a DETOUR factor (roads do not run straight) — it is not a correction for the curvature of the earth.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Project / site", attr: "project" },
      { header: "Material type", attr: "material_type", type: "list", options: MATERIAL_TYPES, width: 30, required: true },
      { header: "Supplier", attr: "supplier", type: "text", width: 26 },
      { header: "Quantity as recorded", attr: "quantity_recorded", type: "number", width: 18, required: true },
      { header: "Unit", attr: "unit", type: "list", options: MATERIAL_UNITS, width: 12 },
      { header: "Conversion to tonnes", attr: "tonnes_conversion", type: "number", width: 18,
        help: "Multiplier from the recorded unit to tonnes. 1 if already in tonnes; ~2.4 for m3 of concrete." },
      { header: "Supplier EPD available? (Y/N)", attr: "epd_available", type: "list", options: YES_NO, width: 24 },
      { header: "Supplier EPD factor (kgCO2e per tonne)", attr: "epd_factor", type: "number", width: 30 },
      { header: "Supplier pincode", attr: "supplier_pincode", type: "text", width: 15 },
      { header: "Site pincode", attr: "site_pincode", type: "text", width: 13 },
      { header: "Straight-line distance (km)", attr: "distance_km", type: "number", width: 22 },
      { header: "Road circuity factor", attr: "circuity", type: "number", width: 17,
        help: "Leave blank to use the default from the constants register (1.3)." },
      { header: "Transport mode", attr: "transport_mode", type: "list", options: TRANSPORT_MODES, width: 15 },
      { header: "Freight vehicle type", attr: "vehicle_type", type: "list", options: FREIGHT_VEHICLES, width: 24 },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "inbound_freight",
    sheet: "3 Inbound Freight",
    sourceSheet: "INPUT - 3 Inbound Freight",
    title: "Inbound freight for goods NOT on the materials sheet",
    owner: "Procurement / Logistics",
    grain: "one delivery",
    hasSite: true,
    hasPeriod: false,
    rowCapacity: 200,
    notes: [
      "ONLY for goods whose delivery is not already captured on sheet 2. Entering a material delivery here as well counts its freight twice.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Project / site", attr: "project" },
      { header: "Supplier", attr: "supplier", type: "text", width: 26 },
      { header: "Goods description", attr: "description", type: "text", width: 30 },
      { header: "Weight (tonnes)", attr: "weight_tonnes", type: "number", width: 15, required: true },
      { header: "Supplier pincode", attr: "supplier_pincode", type: "text", width: 15 },
      { header: "Site pincode", attr: "site_pincode", type: "text", width: 13 },
      { header: "Straight-line distance (km)", attr: "distance_km", type: "number", width: 22, required: true },
      { header: "Road circuity factor", attr: "circuity", type: "number", width: 17 },
      { header: "Transport mode", attr: "transport_mode", type: "list", options: TRANSPORT_MODES, width: 15 },
      { header: "Freight vehicle type", attr: "vehicle_type", type: "list", options: FREIGHT_VEHICLES, width: 24, required: true },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "energy_fuel",
    sheet: "4 Energy and Fuel",
    sourceSheet: "INPUT - 4 Energy and Fuel",
    title: "Energy and fuel",
    owner: "Site EHS",
    grain: "one site per month",
    hasSite: true,
    hasPeriod: true,
    rowCapacity: 200,
    notes: [
      "These are the SAME quantities used for Scope 1 and 2 — they must reconcile with the monthly site returns.",
      "Only the UPSTREAM portion of these lands in Scope 3. Burning the diesel is Scope 1; the grid electricity is Scope 2. This sheet computes the transmission losses and the well-to-tank share.",
      "Onsite renewable generation is kept SEPARATE from open-access renewable on purpose: behind-the-meter generation never enters the grid, so it incurs no transmission loss.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Site", attr: "site_name", required: true },
      { ...MONTH_COLUMN },
      { header: "Grid electricity (kWh)", attr: "grid_kwh", type: "number", width: 20 },
      { header: "Renewable - open access or green tariff (kWh)", attr: "renewable_openaccess_kwh", type: "number", width: 38 },
      { header: "Renewable - onsite generation (kWh)", attr: "renewable_onsite_kwh", type: "number", width: 32,
        help: "Behind the meter. EXCLUDED from the transmission-loss basis." },
      { header: "Diesel - stationary DG (litres)", attr: "diesel_stationary_l", type: "number", width: 26 },
      { header: "Diesel - mobile plant and vehicles (litres)", attr: "diesel_mobile_l", type: "number", width: 34 },
      { header: "Petrol (litres)", attr: "petrol_l", type: "number", width: 14 },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "waste",
    sheet: "5 Waste",
    sourceSheet: "INPUT - 5 Waste",
    title: "Waste by disposal route",
    owner: "Site EHS",
    grain: "one site per month per waste stream per disposal route",
    hasSite: true,
    hasPeriod: true,
    rowCapacity: 200,
    notes: [
      "ONE ROW PER DISPOSAL ROUTE. Split the tonnage — do not report a single 'generated' figure.",
      "The stream and the route TOGETHER choose the factor. Construction waste to landfill is 1.26 kgCO2e per tonne; food waste to landfill is 626.9. Reporting one combined tonnage is the largest error available on this sheet.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Site", attr: "site_name", required: true },
      { ...MONTH_COLUMN },
      { header: "Waste stream", attr: "waste_stream", type: "list", options: WASTE_STREAMS, width: 34, required: true },
      { header: "Hazardous? (Y/N)", attr: "is_hazardous", type: "list", options: YES_NO, width: 16 },
      { header: "Quantity (tonnes)", attr: "quantity_tonnes", type: "number", width: 17, required: true },
      { header: "Disposal route", attr: "disposal_route", type: "list", options: DISPOSAL_ROUTES, width: 22, required: true },
      { header: "Authorised agency", attr: "agency", type: "text", width: 28 },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "business_travel",
    sheet: "6 Business Travel",
    sourceSheet: "INPUT - 6 Business Travel",
    title: "Business travel, including accommodation",
    owner: "HR / Admin (travel portal extract)",
    grain: "one trip; hotel stays as room-nights with 1 traveller",
    hasSite: false,
    hasPeriod: false,
    rowCapacity: 150,
    notes: [
      "Quantity is kilometres for travel and ROOM-NIGHTS for a hotel stay. Enter a hotel stay with 1 traveller.",
      "Number of travellers MULTIPLIES the quantity. A 1,710 km return trip taken by two people is entered once with 2 travellers, not twice.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { header: "Function / department", attr: "function", type: "text", width: 22 },
      { header: "Month (YYYY-MM)", attr: "month", type: "text", width: 15 },
      { header: "Travel mode and class", attr: "travel_mode", type: "list", options: TRAVEL_MODES, width: 38, required: true },
      { header: "Quantity (km, or room-nights for hotel)", attr: "quantity", type: "number", width: 32, required: true },
      { header: "Number of travellers", attr: "travellers", type: "number", width: 18,
        help: "Blank or 0 is read as one traveller." },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "commute",
    sheet: "7 Employee Commute",
    sourceSheet: "INPUT - 7 Employee Commute",
    title: "Employee commute survey",
    owner: "HR / Sustainability",
    grain: "one commute mode across the whole surveyed population",
    hasSite: false,
    hasPeriod: false,
    rowCapacity: 25,
    notes: [
      "NOT a list of people. One row per MODE, summarising everyone who commutes that way.",
      "Distance is ONE WAY. The calculation doubles it for the return leg.",
      "Occupancy DIVIDES: four people sharing a car produce one car's emissions, not four. Leave it blank or 1 for a single occupant.",
      "The survey is grossed up to total headcount, which lives in the constants register (s3.headcount). A survey with no respondents cannot be grossed up and the category will be left unreported rather than written as zero.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { header: "Commute mode", attr: "commute_mode", type: "list", options: COMMUTE_MODES, width: 24, required: true },
      { header: "Survey respondents using this mode", attr: "respondents", type: "number", width: 30, required: true },
      { header: "Average one-way distance (km)", attr: "one_way_km", type: "number", width: 26, required: true },
      { header: "Average commuting days per week", attr: "days_per_week", type: "number", width: 28, required: true },
      { header: "Working weeks per year", attr: "weeks_per_year", type: "number", width: 21, required: true },
      { header: "Average vehicle occupancy", attr: "occupancy", type: "number", width: 23,
        help: "Blank or 0 is read as 1. Divides the emissions." },
      { header: "WFH days per respondent per year", attr: "wfh_days", type: "number", width: 29 },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "sold_products",
    sheet: "8 Sold Products",
    sourceSheet: "INPUT - 8 Sold Products",
    title: "Sold residential and commercial units",
    owner: "Sales + Design/MEP",
    grain: "one project handed over in the fiscal year",
    hasSite: true,
    hasPeriod: false,
    rowCapacity: 50,
    notes: [
      "EXPECTED LIFETIME IS REQUIRED. The whole use phase of a building is booked in the year it is sold, so a missing lifetime understates the line by roughly the lifetime multiple. A row without one is reported and excluded rather than computed at one year.",
      "This category normally dominates total Scope 3 — around 99% — and that is correct, not a mistake.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Project", attr: "project", required: true },
      { header: "Handover FY", attr: "handover_fy", type: "text", width: 14 },
      { header: "Area sold (sq m)", attr: "area_sqm", type: "number", width: 16, required: true },
      { header: "Area basis", attr: "area_basis", type: "list", options: AREA_BASES, width: 22 },
      { header: "Conversion to the floor area the EPI applies to", attr: "area_conversion", type: "number", width: 38,
        help: "e.g. 1.54 to gross carpet area up to built-up. Blank or 0 is read as 1." },
      { header: "EPI (kWh per sq m per year)", attr: "epi_kwh_sqm_yr", type: "number", width: 24, required: true },
      { header: "EPI source", attr: "epi_source", type: "list", options: EPI_SOURCES, width: 30 },
      { header: "Expected lifetime (years)", attr: "lifetime_years", type: "number", width: 22, required: true },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
  {
    code: "leased_assets",
    sheet: "9 Leased Assets",
    sourceSheet: "INPUT - 9 Leased Assets",
    title: "Downstream leased assets - tenant energy and refrigerants",
    owner: "Commercial asset management",
    grain: "one property per month",
    hasSite: true,
    hasPeriod: true,
    rowCapacity: 150,
    notes: [
      "This is the tenant consumption that was REMOVED from the Scope 2 boundary. If it is not entered here it disappears from the inventory entirely.",
    ],
    columns: [
      { header: "Line ID", attr: "line_no", type: "number", width: 8, required: true },
      { ...SITE_COLUMN, header: "Property", attr: "property", required: true },
      { ...MONTH_COLUMN },
      { header: "Tenant electricity (kWh)", attr: "tenant_electricity_kwh", type: "number", width: 22 },
      { header: "Tenant diesel (litres)", attr: "tenant_diesel_l", type: "number", width: 20 },
      { header: "Refrigerant type", attr: "refrigerant_type", type: "list", options: REFRIGERANTS, width: 17 },
      { header: "Refrigerant top-up (kg)", attr: "refrigerant_topup_kg", type: "number", width: 21 },
      { header: "Notes", attr: "notes", type: "text", width: 28 },
    ],
  },
] as const;

/** Look a ledger up by its code. */
export function ledgerByCode(code: string): LedgerSheet | undefined {
  return LEDGER_SHEETS.find((l) => l.code === code);
}

/** Look a ledger up by OUR sheet name. */
export function ledgerBySheet(sheet: string): LedgerSheet | undefined {
  const n = normaliseHeader(sheet);
  return LEDGER_SHEETS.find((l) => normaliseHeader(l.sheet) === n);
}

/** Normalises a header cell for comparison. "Line ID " -> "line id". */
export function normaliseHeader(text: string): string {
  return (text ?? "").toString().replace(/\s+/g, " ").trim().toLowerCase();
}

/** Filename for a generated ledger workbook. */
export function ledgerFilename(fiscalYear: string, ledgerCode?: string): string {
  const parts = ["BEPL-Scope3-ledgers", fiscalYear.replace("/", "-")];
  if (ledgerCode) parts.push(ledgerCode);
  return `${parts.join("_")}.xlsx`;
}

/**
 * The attrs contract, as a flat map, for the test that asserts this file and
 * supabase/esg/13_scope3_schema.sql agree.
 *
 * A column whose `attr` the computation does not read is dead data entry: the
 * filler spends time on it and nothing consumes it. A key the computation reads
 * that no column writes is worse — the category silently computes without it.
 */
export function attrsByLedger(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of LEDGER_SHEETS) {
    out[l.code] = l.columns.map((c) => c.attr).filter((a) => a !== "line_no");
  }
  return out;
}
