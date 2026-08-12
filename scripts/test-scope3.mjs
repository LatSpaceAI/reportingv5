#!/usr/bin/env node
// =============================================================================
// Unit tests for the Scope 3 category methods (scripts/lib/scope3-methods.mjs).
//
// EVERY TRAP DOCUMENTED IN THAT FILE HAS A TEST HERE, and each test states what
// the wrong answer would have been. That is the point: these methods are
// arithmetic whose mistakes produce plausible numbers. A test that only asserts
// the right answer tells the next reader nothing about why the code looks odd.
//
// The worked EXAMPLE ROW on row 6 of each input sheet is used as the fixture
// wherever one exists, so the expected values here are the client's own numbers
// rather than ours.
//
// No database. Run: node scripts/test-scope3.mjs
// =============================================================================

import {
  makeFactorLookup,
  computeSpendLine,
  computeMaterialLine,
  computeFreightLine,
  computeCat3,
  computeWasteLine,
  computeTravelLine,
  computeCommuteLine,
  grossUpCommute,
  computeSoldProductLine,
  computeCat13,
  checkDoubleCounting,
  EXCLUSION,
} from "./lib/scope3-methods.mjs";

// ---- fixtures ---------------------------------------------------------------
// The subset of the register and the mapping blocks these tests touch, with the
// workbook's own values.
const constants = [
  { key: "EF-ELEC-CEA-COMB", value: 0.727 },
  { key: "EF-ELEC-TD-LOSS", value: 0.175 },
  { key: "EF-ELEC-UPSTREAM", value: 0.05816 },
  { key: "EF-DSL-COMB", value: 2.66 },
  { key: "EF-DSL-WTT", value: 0.6 },
  { key: "EF-PET-WTT", value: 0.61 },
  { key: "EF-MAT-CEM-OPC", value: 900 },
  { key: "EF-MAT-SUPPLIER-EPD", value: 0 },      // no register value, by design
  { key: "EF-FRT-HGV-HEAVY", value: 0.12 },
  { key: "EF-FRT-HGV-ARTIC", value: 0.09 },
  { key: "EF-SPD-CEMENT-LIME", value: 3.5 },
  { key: "EF-SPD-CONSTRUCTION", value: 0.6 },
  { key: "EF-WST-CD-LANDFILL", value: 1.26 },
  { key: "EF-WST-ORG-LANDFILL", value: 626.9 },
  { key: "EF-TRV-AIR-DOM", value: 0.2446 },
  { key: "EF-TRV-AIR-DOM-WTT", value: 0.046 },
  { key: "EF-TRV-HOTEL-IN", value: 27 },
  { key: "EF-ZERO", value: 0 },
  { key: "EF-CMT-TWO-WHEELER", value: 0.0832 },
  { key: "EF-CMT-CAR", value: 0.17 },
  { key: "EF-CMT-WFH", value: 0.4 },
  { key: "GWP-R22", value: 1760 },
  { key: "GWP-R410A", value: 2256 },
];

const mappings = [
  { block: "material", lookup_key: "Cement - OPC", factor_key: "EF-MAT-CEM-OPC" },
  { block: "freight", lookup_key: "Rigid truck 16-25t", factor_key: "EF-FRT-HGV-HEAVY" },
  { block: "freight", lookup_key: "Articulated truck over 25t", factor_key: "EF-FRT-HGV-ARTIC" },
  { block: "spend", lookup_key: "Cement lime and plaster", factor_key: "EF-SPD-CEMENT-LIME" },
  { block: "spend", lookup_key: "Construction and civil works", factor_key: "EF-SPD-CONSTRUCTION" },
  { block: "waste", lookup_key: "Construction and demolition | Landfill", factor_key: "EF-WST-CD-LANDFILL" },
  { block: "waste", lookup_key: "Food / organic | Landfill", factor_key: "EF-WST-ORG-LANDFILL" },
  { block: "travel", lookup_key: "Air - domestic - economy", factor_key: "EF-TRV-AIR-DOM", factor_key_2: "EF-TRV-AIR-DOM-WTT" },
  { block: "travel", lookup_key: "Hotel stay - India", factor_key: "EF-TRV-HOTEL-IN", factor_key_2: "EF-ZERO" },
  { block: "commute", lookup_key: "Two-wheeler", factor_key: "EF-CMT-TWO-WHEELER" },
  { block: "commute", lookup_key: "Car - private", factor_key: "EF-CMT-CAR" },
  { block: "refrigerant", lookup_key: "R22", factor_key: "GWP-R22" },
  { block: "refrigerant", lookup_key: "R410A", factor_key: "GWP-R410A" },
];

const lookup = makeFactorLookup({ mappings, constants });
const CTL = { fxInrPerEur: 92, deflator: 1.2, defaultCircuity: 1.3, headcount: 462 };

// ---- harness ----------------------------------------------------------------
let pass = 0;
let fail = 0;
const near = (a, b, tol = 1e-6) => a != null && b != null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

function check(name, got, expected, note) {
  const ok = typeof expected === "number" ? near(got, expected) : got === expected;
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}\n        got ${got}, expected ${expected}${note ? `\n        ${note}` : ""}`);
  }
}

console.log("SCOPE 3 — category methods\n" + "=".repeat(72) + "\n");

// =============================================================================
// Cat 1 spend / Cat 2
// =============================================================================
console.log("-- Category 1 (spend) and Category 2 --");

{
  // 4,200,000 INR of cement spend / 92 / 1.2 = 38,043.478 EUR x 3.5 kg / 1000
  const line = { attrs: { s3_tag: "Cat 1 - Purchased goods and services",
                          spend_category: "Cement lime and plaster", order_value_inr: 4200000 } };
  const r = computeSpendLine(line, { ...CTL, lookup });
  const expectedEur = 4200000 / 92 / 1.2;
  check("spend: EUR conversion divides by FX and deflator", r.quantity, expectedEur,
        "Multiplying by the deflator instead would give 4200000/92*1.2 = 54,782 EUR, +44%.");
  check("spend: emissions = EUR x EF / 1000", r.emissions_t, (expectedEur * 3.5) / 1000);
  check("spend: category from tag", r.category, "cat1_spend");
}

{
  const line = { attrs: { s3_tag: "Cat 2 - Capital goods",
                          spend_category: "Construction and civil works", order_value_inr: 1000000 } };
  const r = computeSpendLine(line, { ...CTL, lookup });
  check("spend: Cat 2 tag routes to capital goods", r.category, "cat2_capital");
}

{
  // The workbook's own example row 6: cement excluded because it is counted by
  // tonnage on the materials sheet.
  const line = { attrs: { s3_tag: "EXCLUDE - counted by tonnage on Materials sheet",
                          spend_category: "Cement lime and plaster", order_value_inr: 4200000 } };
  const r = computeSpendLine(line, { ...CTL, lookup });
  check("spend: EXCLUDE tag contributes zero", r.emissions_t, 0);
  check("spend: EXCLUDE is recorded as a decision", r.exclusion_reason, EXCLUSION.EXCLUDED_TAG);
}

{
  // THE TRAP: an untagged line and an excluded line both contribute zero, but
  // one is a decision and the other is a gap. The workbook conflates them.
  const line = { attrs: { s3_tag: "", spend_category: "Cement lime and plaster", order_value_inr: 4200000 } };
  const r = computeSpendLine(line, { ...CTL, lookup });
  check("spend: UNTAGGED is distinguished from EXCLUDED", r.exclusion_reason, EXCLUSION.UNTAGGED,
        "Conflating them makes a forgotten tag invisible — the total is understated with no symptom.");
}

{
  const line = { attrs: { s3_tag: "Cat 1", spend_category: "Nonexistent category", order_value_inr: 500000 } };
  const r = computeSpendLine(line, { ...CTL, lookup });
  check("spend: unmapped category contributes zero, flagged", r.emissions_t, 0);
  check("spend: unmapped reason recorded", r.exclusion_reason, EXCLUSION.UNMAPPED_FACTOR);
}

// =============================================================================
// Cat 1 materials + Cat 4 material freight
// =============================================================================
console.log("\n-- Category 1 (materials) and Category 4 (material freight) --");

{
  // INPUT 2 example row: 600 MT of OPC cement, 38 km straight line, circuity
  // 1.3, rigid truck 16-25t.
  const line = { attrs: { material_type: "Cement - OPC", quantity_recorded: 600, tonnes_conversion: 1,
                          epd_available: "N", distance_km: 38, circuity: 1.3,
                          vehicle_type: "Rigid truck 16-25t" } };
  const r = computeMaterialLine(line, { ...CTL, lookup });
  check("materials: tonnes = quantity x conversion", r.quantity, 600);
  check("materials: embodied = tonnes x EF / 1000", r.emissions_t, (600 * 900) / 1000);
  check("materials: road km = straight-line x circuity", r.road_km, 38 * 1.3,
        "Circuity is a DETOUR factor. Omitting it would understate freight by 23%.");
  check("materials: freight = tonnes x road-km x EF / 1000", r.emissions_t_2, (600 * 38 * 1.3 * 0.12) / 1000);
}

{
  // THE TRAP: a supplier EPD is per line. Reading EF-MAT-SUPPLIER-EPD from the
  // register (seeded 0) would silently compute zero.
  const line = { attrs: { material_type: "Cement - OPC", quantity_recorded: 600, tonnes_conversion: 1,
                          epd_available: "Y", epd_factor: 712 } };
  const r = computeMaterialLine(line, { ...CTL, lookup });
  check("materials: supplier EPD overrides the library factor", r.emissions_t, (600 * 712) / 1000,
        "Reading the register value (0) instead would give exactly 0 and look computed.");
  check("materials: EPD line records the EPD factor key", r.factor_key, "EF-MAT-SUPPLIER-EPD");
}

{
  const line = { attrs: { material_type: "Cement - OPC", quantity_recorded: 600, tonnes_conversion: 1,
                          epd_available: "Y" } };  // claims an EPD, supplies no figure
  const r = computeMaterialLine(line, { ...CTL, lookup });
  check("materials: EPD claimed but missing does NOT fall back to the library", r.emissions_t, 0,
        "Falling back would substitute a country average for a supplier-specific claim, silently.");
  check("materials: missing EPD is flagged", r.exclusion_reason, EXCLUSION.MISSING_FACTOR);
}

{
  // m3 of ready-mix recorded, converted to tonnes at 2.4 t/m3.
  const line = { attrs: { material_type: "Cement - OPC", quantity_recorded: 10, tonnes_conversion: 2.4,
                          epd_available: "N" } };
  const r = computeMaterialLine(line, { ...CTL, lookup });
  check("materials: unit conversion applied before the factor", r.quantity, 24);
}

{
  // No circuity on the line: the CONTROL default applies.
  const line = { attrs: { material_type: "Cement - OPC", quantity_recorded: 100, tonnes_conversion: 1,
                          epd_available: "N", distance_km: 100, vehicle_type: "Rigid truck 16-25t" } };
  const r = computeMaterialLine(line, { ...CTL, lookup });
  check("materials: circuity falls back to the CONTROL default", r.road_km, 130);
}

// =============================================================================
// Cat 4 inbound freight
// =============================================================================
console.log("\n-- Category 4 (inbound freight) --");

{
  // INPUT 3 example row: 18 t, 842 km straight line, circuity 1.3, artic truck.
  const line = { attrs: { weight_tonnes: 18, distance_km: 842, circuity: 1.3,
                          vehicle_type: "Articulated truck over 25t" } };
  const r = computeFreightLine(line, { ...CTL, lookup });
  check("freight: tonne-km = tonnes x straight-line x circuity", r.quantity, 18 * 842 * 1.3);
  check("freight: emissions", r.emissions_t, (18 * 842 * 1.3 * 0.09) / 1000);
}

// =============================================================================
// Cat 3 — the gross-up trap
// =============================================================================
console.log("\n-- Category 3 (fuel and energy related) --");

{
  const lines = [
    { attrs: { grid_kwh: 271906, renewable_openaccess_kwh: 235918, renewable_onsite_kwh: 50000,
               diesel_stationary_l: 1240, diesel_mobile_l: 860, petrol_l: 0 } },
  ];
  const r = computeCat3({ lines, lookup });

  const basis = 271906 + 235918;
  check("cat3: T&D basis is grid + open access", r.basis.td_basis_kwh, basis);
  check("cat3: onsite renewable is EXCLUDED from the basis", r.basis.td_basis_kwh, basis,
        "Onsite generation never enters the grid, so it incurs no transmission loss.");

  // THE TRAP: L/(1-L), not L.
  const L = 0.175;
  const correct = basis * (L / (1 - L));
  const naive = basis * L;
  check("cat3: T&D loss grossed up as L/(1-L)", r.basis.td_loss_kwh, correct,
        `The naive basis x L gives ${Math.round(naive)} kWh — a ${(((correct - naive) / correct) * 100).toFixed(1)}% understatement.`);

  const td = r.detail.find((d) => d.component === "td_losses");
  check("cat3: T&D losses priced at the CEA grid factor", td.emissions_t, (correct * 0.727) / 1000);

  const dslStat = r.detail.find((d) => d.component === "diesel_wtt_stat");
  check("cat3: diesel uses the WTT factor, not combustion", dslStat.factor_key, "EF-DSL-WTT",
        "Combustion of our own diesel is Scope 1. Using 2.66 here would double-count it 4.4x.");
  check("cat3: diesel WTT emissions", dslStat.emissions_t, (1240 * 0.6) / 1000);

  const expectedTotal =
    (correct * 0.727) / 1000 + (basis * 0.05816) / 1000 + (1240 * 0.6) / 1000 + (860 * 0.6) / 1000;
  check("cat3: total", r.total_t, expectedTotal);
}

{
  // A loss share at or above 1 would divide by zero or go negative. Refusing is
  // better than writing a nonsense figure to output_value.
  const noLoss = makeFactorLookup({
    mappings,
    constants: constants.map((c) => (c.key === "EF-ELEC-TD-LOSS" ? { ...c, value: 1 } : c)),
  });
  const r = computeCat3({ lines: [{ attrs: { grid_kwh: 1000 } }], lookup: noLoss });
  check("cat3: a loss share of 1 refuses rather than producing Infinity", r.basis.td_loss_kwh, null);
}

// =============================================================================
// Cat 5 — the composite key
// =============================================================================
console.log("\n-- Category 5 (waste) --");

{
  // INPUT 5 example row: 145.5 t of C&D to landfill.
  const line = { attrs: { waste_stream: "Construction and demolition", disposal_route: "Landfill",
                          quantity_tonnes: 145.5 } };
  const r = computeWasteLine(line, { lookup });
  check("waste: composite key is 'stream | route'", r.lookup_key, "Construction and demolition | Landfill");
  check("waste: C&D to landfill", r.emissions_t, (145.5 * 1.26) / 1000);
}

{
  // THE TRAP: the same tonnage down a different stream is 500x the emissions.
  const line = { attrs: { waste_stream: "Food / organic", disposal_route: "Landfill", quantity_tonnes: 145.5 } };
  const r = computeWasteLine(line, { lookup });
  check("waste: organic to landfill is ~500x C&D to landfill", r.emissions_t, (145.5 * 626.9) / 1000,
        "This is why the route is part of the key and a single 'generated' tonnage cannot be costed.");
}

{
  const line = { attrs: { waste_stream: "Construction and demolition", disposal_route: "Mars",
                          quantity_tonnes: 100 } };
  const r = computeWasteLine(line, { lookup });
  check("waste: an unmapped stream/route is flagged, not dropped", r.exclusion_reason, EXCLUSION.UNMAPPED_FACTOR);
}

// =============================================================================
// Cat 6 — two factors, travellers multiply
// =============================================================================
console.log("\n-- Category 6 (business travel) --");

{
  // INPUT 6 example row: 1,710 km, 2 travellers, domestic economy.
  const line = { attrs: { travel_mode: "Air - domestic - economy", quantity: 1710, travellers: 2 } };
  const r = computeTravelLine(line, { lookup });
  check("travel: passenger-km = quantity x travellers", r.quantity, 3420);
  check("travel: combustion AND WTT are added before multiplying", r.emissions_t,
        (3420 * (0.2446 + 0.046)) / 1000,
        "Omitting the WTT factor would understate this trip by 19%.");
}

{
  const line = { attrs: { travel_mode: "Air - domestic - economy", quantity: 1000, travellers: 0 } };
  const r = computeTravelLine(line, { lookup });
  check("travel: zero travellers means one, not zero emissions", r.quantity, 1000);
}

{
  // Hotel: WTT is EF-ZERO, a deliberate zero rather than a missing factor.
  const line = { attrs: { travel_mode: "Hotel stay - India", quantity: 12, travellers: 1 } };
  const r = computeTravelLine(line, { lookup });
  check("travel: hotel room-nights at the India factor", r.emissions_t, (12 * 27) / 1000);
  check("travel: EF-ZERO is a deliberate zero, not a missing factor", r.exclusion_reason, undefined);
}

// =============================================================================
// Cat 7 — return leg, occupancy, gross-up
// =============================================================================
console.log("\n-- Category 7 (employee commuting) --");

{
  // INPUT 7 example row: 84 two-wheeler respondents, 11.5 km one way, 5 d/wk,
  // 46 wk/yr, occupancy 1, 12 WFH days.
  const line = { attrs: { commute_mode: "Two-wheeler", respondents: 84, one_way_km: 11.5,
                          days_per_week: 5, weeks_per_year: 46, occupancy: 1, wfh_days: 12 } };
  const r = computeCommuteLine(line, { lookup, wfhFactor: 0.4 });
  const annualPerPerson = 11.5 * 2 * 5 * 46;
  check("commute: x2 for the return leg", r.quantity, 84 * annualPerPerson,
        "Omitting the return leg halves the category.");
  check("commute: emissions", r.emissions_t, (84 * annualPerPerson * 0.0832) / 1000);
  check("commute: WFH counted per respondent-day", r.emissions_t_2, (84 * 12 * 0.4) / 1000);
}

{
  // THE TRAP: occupancy DIVIDES. Four people car-pooling produce one car's worth.
  const line = { attrs: { commute_mode: "Car - private", respondents: 40, one_way_km: 10,
                          days_per_week: 5, weeks_per_year: 46, occupancy: 4, wfh_days: 0 } };
  const r = computeCommuteLine(line, { lookup, wfhFactor: 0.4 });
  const annual = 10 * 2 * 5 * 46;
  check("commute: occupancy divides", r.quantity, (40 * annual) / 4,
        "Ignoring occupancy would overstate a 4-person car-pool by 4x.");
}

{
  const g = grossUpCommute({ surveyedCommuteT: 10, surveyedWfhT: 2, respondents: 200, headcount: 462 });
  check("commute: gross-up factor = headcount / respondents", g.factor, 462 / 200);
  check("commute: gross-up applied once to the total", g.total_t, 12 * (462 / 200),
        "Applying it per line as well would square it.");
}

{
  // THE TRAP: a zero survey base. Dividing would produce Infinity and write it.
  const g = grossUpCommute({ surveyedCommuteT: 0, surveyedWfhT: 0, respondents: 0, headcount: 462 });
  check("commute: a zero survey base refuses rather than dividing", g.total_t, null,
        "'Nobody was surveyed' is not 'nobody commuted' — no row must be written.");
}

// =============================================================================
// Cat 11 — the lifetime multiplier
// =============================================================================
console.log("\n-- Category 11 (use of sold products) --");

{
  // INPUT 8 example row: 42,500 sq m carpet, 1.54 conversion, EPI 95, 50 years.
  const line = { attrs: { area_sqm: 42500, area_conversion: 1.54, epi_kwh_sqm_yr: 95, lifetime_years: 50 } };
  const r = computeSoldProductLine(line, { lookup });
  const floor = 42500 * 1.54;
  check("cat11: floor area = area x conversion", r.quantity, floor * 95 * 50);
  check("cat11: area x conversion x EPI x lifetime x grid EF", r.emissions_t,
        (floor * 95 * 50 * 0.727) / 1000,
        "The 50-year lifetime is why this category is ~99.5% of the total.");
}

{
  // THE TRAP: a missing lifetime must not default to 1.
  const line = { attrs: { area_sqm: 42500, area_conversion: 1.54, epi_kwh_sqm_yr: 95 } };
  const r = computeSoldProductLine(line, { lookup });
  check("cat11: a missing lifetime refuses rather than defaulting to 1", r.emissions_t, 0);
  check("cat11: missing lifetime is flagged", r.exclusion_reason, EXCLUSION.MISSING_LIFETIME,
        "Defaulting to 1 would understate the category ~50x while looking computed.");
}

// =============================================================================
// Cat 13 — tenant load and refrigerants
// =============================================================================
console.log("\n-- Category 13 (downstream leased assets) --");

{
  // INPUT 9 example row: 204,660 kWh tenant electricity, 4.5 kg R22 top-up.
  const lines = [
    { attrs: { tenant_electricity_kwh: 204660, tenant_diesel_l: 0, refrigerant_type: "R22", refrigerant_topup_kg: 4.5 } },
    { attrs: { tenant_electricity_kwh: 100000, tenant_diesel_l: 500, refrigerant_type: "R410A", refrigerant_topup_kg: 2 } },
  ];
  const r = computeCat13({ lines, lookup });
  const elec = ((204660 + 100000) * 0.727) / 1000;
  const diesel = (500 * 2.66) / 1000;
  const r22 = (4.5 * 1760) / 1000;
  const r410a = (2 * 2256) / 1000;
  check("cat13: tenant electricity at the grid factor",
        r.detail.find((d) => d.component === "tenant_electricity").emissions_t, elec);
  check("cat13: tenant diesel uses COMBUSTION, not WTT",
        r.detail.find((d) => d.component === "tenant_diesel").factor_key, "EF-DSL-COMB",
        "It is the tenant's Scope 1, which is our Cat 13. WTT (0.6) would understate it 4.4x.");
  check("cat13: refrigerant summed by gas, each at its own GWP",
        r.detail.find((d) => d.component === "refrigerant_R22").emissions_t, r22);
  check("cat13: AR6 GWP for R22 is 1760, not the AR4 1810",
        r.detail.find((d) => d.component === "refrigerant_R22").factor_value, 1760);
  check("cat13: total", r.total_t, elec + diesel + r22 + r410a);
}

// =============================================================================
// The double-counting guard
// =============================================================================
console.log("\n-- The double-counting guard --");

{
  const procurementResults = [
    { line_no: 1, category: "cat1_spend", attrs: { supplier: "Example Cement Ltd" } },
    { line_no: 2, category: "excluded", exclusion_reason: EXCLUSION.EXCLUDED_TAG,
      attrs: { supplier: "Example Cement Ltd" } },
    { line_no: 3, category: "excluded", exclusion_reason: EXCLUSION.UNTAGGED,
      attrs: { supplier: "Someone Else" } },
  ];
  const materialLines = [{ attrs: { supplier: "Example Cement Ltd" } }];
  const dc = checkDoubleCounting({ procurementResults, materialLines });

  check("guard: untagged lines are counted", dc.untagged_count, 1);
  check("guard: the untagged line is named", dc.untagged_lines[0], 3);
  check("guard: a supplier on both ledgers without EXCLUDE is a suspect", dc.suspect_count, 1);
  check("guard: a correctly EXCLUDEd line is not a suspect", dc.suspect_lines[0].line_no, 1,
        "Line 2 is excluded by tag and must not be flagged.");
}

{
  // Case-insensitive supplier matching: 'EXAMPLE CEMENT LTD' from SAP and
  // 'Example Cement Ltd' from the site sheet are the same supplier.
  const dc = checkDoubleCounting({
    procurementResults: [{ line_no: 1, category: "cat1_spend", attrs: { supplier: "EXAMPLE  CEMENT LTD" } }],
    materialLines: [{ attrs: { supplier: "Example Cement Ltd" } }],
  });
  check("guard: supplier matching is case- and whitespace-insensitive", dc.suspect_count, 1);
}

// =============================================================================
console.log("\n" + "=".repeat(72));
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
