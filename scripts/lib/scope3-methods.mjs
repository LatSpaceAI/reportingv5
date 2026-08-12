// =============================================================================
// SCOPE 3 — the category methods, as pure functions.
//
// Every function here takes plain data and returns plain data. No database, no
// network, no clock. That is deliberate: the arithmetic in this file is where
// the traps are, and a trap you cannot unit-test is a trap you find in a
// disclosure.
//
// WHY THIS IS NOT AN EXTENSION OF formula-eval.mjs
//
//   That parser binds three token kinds, each to ONE number. Every method below
//   is a set operation — sum over ledger lines where tag = X. Teaching the
//   grammar SUMIFS over a joined ledger would turn a tiny, deliberately-not-eval
//   expression parser into a query language, and the property that makes it safe
//   (expressions come from a database table, and the worst a malformed one can
//   do is fail to parse) would become much harder to reason about.
//
//   So Scope 3 is computed in plain JavaScript, per line, and only the finished
//   category totals go back into output_value as ordinary rows.
//
// SOURCE OF EVERY FORMULA
//
//   birla-estates/Birla Estates - Scope 3 Calculator (Template) v1.0.xlsx.
//   Each method names the OUTPUT sheet and cell it reproduces. Where the
//   workbook's arithmetic is non-obvious, the comment says why it is that way —
//   those are the places a well-meaning simplification would silently change a
//   published number.
//
// UNITS, ONCE
//
//   Every factor in the register is in kg CO2e per its denominator. Every
//   category total is in TONNES. The /1000 happens exactly once per line, at
//   the point of emission, and never again.
// =============================================================================

/** kg -> tonnes. The only unit conversion in this file, named so it cannot be
 *  mistaken for a factor. */
export const KG_TO_T = 1 / 1000;

/**
 * Outcomes a line can have. A line that contributes nothing must say WHY —
 * "silently excluded" is the failure mode the workbook's VALIDATION sheet
 * exists to prevent, and an untagged procurement line is exactly that: it
 * understates the category and looks like nothing happened.
 */
export const EXCLUSION = {
  EXCLUDED_TAG: "excluded_tag",         // deliberately excluded, counted elsewhere
  UNTAGGED: "untagged",                 // NO tag at all — a data-entry gap, not a decision
  UNMAPPED_FACTOR: "unmapped_factor",   // the dropdown value has no mapping row
  MISSING_FACTOR: "missing_factor",     // mapped, but the constant does not exist
  NO_QUANTITY: "no_quantity",           // nothing to multiply
  MISSING_LIFETIME: "missing_lifetime", // Cat 11 without a lifetime understates by ~the lifetime
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

/** Case- and whitespace-insensitive lookup key, so 'Cement - OPC' matches
 *  'cement - opc' typed on a different sheet. Values are stored as printed. */
export const normKey = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * A factor resolver bound to the mapping table and the constant register.
 *
 * Returns { key, value } or { key: null, reason } — never a silent zero. A
 * missing factor that evaluated to 0 would produce a category total that looks
 * computed and is wrong, which is worse than one that refuses to compute.
 */
export function makeFactorLookup({ mappings, constants }) {
  const mapByBlock = new Map();
  for (const m of mappings) {
    if (m.is_active === false) continue;
    const block = mapByBlock.get(m.block) ?? new Map();
    block.set(normKey(m.lookup_key), m);
    mapByBlock.set(m.block, block);
  }
  const constByKey = new Map(constants.map((c) => [c.key, c]));

  /** Resolve a dropdown value through a mapping block to a factor. */
  const resolve = (block, lookupKey) => {
    const b = mapByBlock.get(block);
    const row = b?.get(normKey(lookupKey));
    if (!row) return { key: null, reason: EXCLUSION.UNMAPPED_FACTOR };
    const c = constByKey.get(row.factor_key);
    if (!c) return { key: row.factor_key, value: null, reason: EXCLUSION.MISSING_FACTOR };
    const out = { key: row.factor_key, value: Number(c.value) };
    // A second factor where the block carries one. Travel modes pair a
    // combustion factor with a well-to-tank factor; the hotel row points at
    // EF-ZERO rather than null, so "no WTT applies" is a visible decision.
    if (row.factor_key_2) {
      const c2 = constByKey.get(row.factor_key_2);
      out.key2 = row.factor_key_2;
      out.value2 = c2 ? Number(c2.value) : null;
      if (!c2) out.reason = EXCLUSION.MISSING_FACTOR;
    }
    return out;
  };

  /** Read a factor directly by key, for the fixed lookups (grid EF, WTT). */
  const byKey = (key) => {
    const c = constByKey.get(key);
    if (!c) return { key, value: null, reason: EXCLUSION.MISSING_FACTOR };
    return { key, value: Number(c.value) };
  };

  return { resolve, byKey, has: (key) => constByKey.has(key) };
}

// =============================================================================
// CATEGORY 1 (spend) and CATEGORY 2 — 'OUTPUT - C1 C2 Spend'
//
// Workbook: E = D / CONTROL!C18 / CONTROL!C19 ; H = E * G / 1000
//
// TRAP — THE FX RATE IS A MARKET RATE, NOT PPP.
//   EXIOBASE is denominated in EUR at basic prices. Using PPP would inflate the
//   spend base AND apply US production technology to Indian supply chains. The
//   workbook is emphatic about this and it is an easy, invisible mistake.
//
// TRAP — THE DEFLATOR DIVIDES, IT DOES NOT MULTIPLY.
//   Reporting-year rupees are deflated BACK to the EXIOBASE reference year's
//   price level. Multiplying would inflate Category 1 by the deflator squared
//   relative to the truth, and nothing in the output would look wrong.
//
// TRAP — AN UNTAGGED LINE IS NOT AN EXCLUDED LINE.
//   The workbook's category formula sends anything not starting 'Cat 1'/'Cat 2'
//   to "Excluded", which means a line someone forgot to tag disappears from the
//   total with no symptom. We distinguish the two: a line whose tag begins
//   EXCLUDE is a decision (EXCLUDED_TAG); a line with no tag at all is a gap
//   (UNTAGGED), and the validation pass counts it.
// =============================================================================
export function computeSpendLine(line, { fxInrPerEur, deflator, lookup }) {
  const a = line.attrs ?? {};
  const tag = String(a.s3_tag ?? "").trim();
  const valueInr = num(a.order_value_inr);

  if (!tag) {
    return { category: "excluded", exclusion_reason: EXCLUSION.UNTAGGED, emissions_t: 0 };
  }
  if (/^EXCLUDE/i.test(tag)) {
    return { category: "excluded", exclusion_reason: EXCLUSION.EXCLUDED_TAG, emissions_t: 0,
             quantity: valueInr, quantity_unit: "INR" };
  }
  if (valueInr === null) {
    return { category: "excluded", exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0 };
  }

  const category = /^Cat 1/i.test(tag) ? "cat1_spend"
                 : /^Cat 2/i.test(tag) ? "cat2_capital"
                 : null;
  if (!category) {
    // A tag that is neither Cat 1, Cat 2, nor an EXCLUDE reason. Not a silent
    // drop: an unrecognised tag is a data problem and is reported as one.
    return { category: "excluded", exclusion_reason: EXCLUSION.UNTAGGED, emissions_t: 0 };
  }

  const f = lookup.resolve("spend", a.spend_category);
  // Deflate to the EF reference year, at a MARKET rate. Both divide.
  const spendEur = valueInr / fxInrPerEur / deflator;
  if (f.value === null || f.value === undefined) {
    return { category, exclusion_reason: f.reason, emissions_t: 0,
             factor_key: f.key, quantity: spendEur, quantity_unit: "EUR" };
  }
  return {
    category,
    factor_key: f.key,
    factor_value: f.value,
    quantity: spendEur,
    quantity_unit: "EUR",
    emissions_t: spendEur * f.value * KG_TO_T,
  };
}

// =============================================================================
// CATEGORY 1 (materials) and CATEGORY 4 (material freight)
// 'OUTPUT - C1b C4b Materials'
//
// ONE FILED LINE PRODUCES TWO DISCLOSURES:
//   G = C * F / 1000                    embodied  -> cat1_materials
//   N = C * K * M / 1000                freight   -> cat4_materials
//   where C = quantity x tonnes_conversion
//         K = straight-line distance x circuity
//
// TRAP — CIRCUITY IS A DETOUR FACTOR, NOT A CURVATURE CORRECTION.
//   Great-circle distance already accounts for the curvature of the earth. 1.3
//   is the GLEC road-detour multiplier: roads do not run straight between two
//   pincodes. Someone "fixing" this as a curvature term would be wrong twice.
//
// TRAP — A SUPPLIER EPD OVERRIDES THE LIBRARY FACTOR AND IS PER LINE.
//   EF-MAT-SUPPLIER-EPD carries NO value in the register (it is seeded 0). If a
//   line marked epd_available='Y' read the register instead of its own EPD
//   figure, it would compute exactly zero and look like a real result. This is
//   asserted rather than assumed.
// =============================================================================
export function computeMaterialLine(line, { defaultCircuity, lookup }) {
  const a = line.attrs ?? {};
  const qty = num(a.quantity_recorded);
  const conv = num(a.tonnes_conversion) ?? 1;
  const tonnes = qty === null ? null : qty * conv;

  const out = { category: "cat1_materials", quantity: tonnes, quantity_unit: "tonnes" };
  if (tonnes === null) {
    return { ...out, exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0, emissions_t_2: 0 };
  }

  // ---- embodied carbon ------------------------------------------------------
  const usesEpd = String(a.epd_available ?? "").trim().toUpperCase() === "Y";
  if (usesEpd) {
    const epd = num(a.epd_factor);
    if (epd === null) {
      // Marked as having an EPD but no figure supplied. NOT a fallback to the
      // library factor — that would substitute a country average for a
      // supplier-specific claim without saying so.
      out.exclusion_reason = EXCLUSION.MISSING_FACTOR;
      out.factor_key = "EF-MAT-SUPPLIER-EPD";
      out.emissions_t = 0;
    } else {
      out.factor_key = "EF-MAT-SUPPLIER-EPD";
      out.factor_value = epd;
      out.emissions_t = tonnes * epd * KG_TO_T;
    }
  } else {
    const f = lookup.resolve("material", a.material_type);
    out.factor_key = f.key;
    if (f.value === null || f.value === undefined) {
      out.exclusion_reason = f.reason;
      out.emissions_t = 0;
    } else {
      out.factor_value = f.value;
      out.emissions_t = tonnes * f.value * KG_TO_T;
    }
  }

  // ---- the delivery leg -----------------------------------------------------
  // A material line with no vehicle type is not a freight error: not every
  // delivery is reported. It contributes zero freight and says so.
  const straightKm = num(a.distance_km);
  const circuity = num(a.circuity) || defaultCircuity;
  const vehicle = a.vehicle_type;
  if (straightKm === null || !vehicle) {
    out.emissions_t_2 = 0;
    out.freight_reason = EXCLUSION.NO_QUANTITY;
    return out;
  }
  const roadKm = straightKm * circuity;
  const ff = lookup.resolve("freight", vehicle);
  out.factor_key_2 = ff.key;
  out.road_km = roadKm;
  if (ff.value === null || ff.value === undefined) {
    out.emissions_t_2 = 0;
    out.freight_reason = ff.reason;
    return out;
  }
  out.factor_value_2 = ff.value;
  out.emissions_t_2 = tonnes * roadKm * ff.value * KG_TO_T;
  return out;
}

// =============================================================================
// CATEGORY 4 (inbound freight) — 'OUTPUT - C4a Inbound Freight'
//   G = B * D * F / 1000,  D = straight-line x circuity
// =============================================================================
export function computeFreightLine(line, { defaultCircuity, lookup }) {
  const a = line.attrs ?? {};
  const tonnes = num(a.weight_tonnes);
  const straightKm = num(a.distance_km);
  const circuity = num(a.circuity) || defaultCircuity;

  if (tonnes === null || straightKm === null) {
    return { category: "cat4_freight", exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0 };
  }
  const roadKm = straightKm * circuity;
  const tkm = tonnes * roadKm;
  const f = lookup.resolve("freight", a.vehicle_type);
  const out = {
    category: "cat4_freight",
    factor_key: f.key,
    quantity: tkm,
    quantity_unit: "tonne-km",
  };
  if (f.value === null || f.value === undefined) {
    return { ...out, exclusion_reason: f.reason, emissions_t: 0 };
  }
  return { ...out, factor_value: f.value, emissions_t: tkm * f.value * KG_TO_T };
}

// =============================================================================
// CATEGORY 3 — 'OUTPUT - C3 FERA'
//
// An AGGREGATE, not a per-line method: it sums the energy ledger and applies
// five factors to the totals.
//
// TRAP — THE T&D GROSS-UP IS L/(1-L), NOT L.
//   To DELIVER B kWh when a share L is lost in transmission, B/(1-L) must enter
//   the grid. Losses are therefore B x L/(1-L), not B x L. At L = 0.175 that is
//   0.2121 vs 0.175 — a 21% understatement of the category if done the obvious
//   way, and the result still looks entirely plausible.
//
// TRAP — ONSITE RENEWABLE IS EXCLUDED FROM THE T&D BASIS.
//   Behind-the-meter generation never enters the grid, so it incurs no
//   transmission loss. Open-access renewable IS delivered through the grid and
//   IS in the basis. The workbook's VALIDATION check 11 tests exactly this.
//
// TRAP — WHAT IS *NOT* HERE.
//   The combustion of this fuel is Scope 1 and the grid electricity itself is
//   Scope 2. Only the upstream portion belongs in Cat 3. Adding combustion here
//   would double-count against the model's own Scope 1/2 figures.
// =============================================================================
export function computeCat3({ lines, lookup }) {
  const sum = (key) => lines.reduce((t, l) => t + (num(l.attrs?.[key]) ?? 0), 0);

  const gridKwh = sum("grid_kwh");
  const openAccessKwh = sum("renewable_openaccess_kwh");
  const onsiteKwh = sum("renewable_onsite_kwh");
  const dieselStationaryL = sum("diesel_stationary_l");
  const dieselMobileL = sum("diesel_mobile_l");
  const petrolL = sum("petrol_l");

  // Grid-delivered only. Onsite is deliberately absent.
  const tdBasisKwh = gridKwh + openAccessKwh;

  const loss = lookup.byKey("EF-ELEC-TD-LOSS");
  const gridEf = lookup.byKey("EF-ELEC-CEA-COMB");
  const upstreamEf = lookup.byKey("EF-ELEC-UPSTREAM");
  const dieselWtt = lookup.byKey("EF-DSL-WTT");
  const petrolWtt = lookup.byKey("EF-PET-WTT");

  const L = loss.value;
  // Guard the asymptote. L >= 1 would mean the grid delivers nothing, and the
  // gross-up would divide by zero or go negative — a nonsense number is worse
  // than a refusal, because it would still be written to output_value.
  const lossKwh = L === null || L >= 1 ? null : tdBasisKwh * (L / (1 - L));

  const components = [
    { key: "td_losses",       qty: lossKwh,           unit: "kWh",    factor: gridEf },
    { key: "grid_upstream",   qty: tdBasisKwh,        unit: "kWh",    factor: upstreamEf },
    { key: "diesel_wtt_stat", qty: dieselStationaryL, unit: "litres", factor: dieselWtt },
    { key: "diesel_wtt_mob",  qty: dieselMobileL,     unit: "litres", factor: dieselWtt },
    { key: "petrol_wtt",      qty: petrolL,           unit: "litres", factor: petrolWtt },
  ];

  let total = 0;
  const detail = [];
  for (const c of components) {
    const ok = c.qty !== null && c.factor.value !== null;
    const t = ok ? c.qty * c.factor.value * KG_TO_T : 0;
    total += t;
    detail.push({
      component: c.key,
      quantity: c.qty,
      quantity_unit: c.unit,
      factor_key: c.factor.key,
      factor_value: c.factor.value,
      emissions_t: t,
      exclusion_reason: ok ? null : (c.factor.value === null ? EXCLUSION.MISSING_FACTOR : EXCLUSION.NO_QUANTITY),
    });
  }

  return {
    total_t: total,
    detail,
    basis: {
      grid_kwh: gridKwh,
      open_access_kwh: openAccessKwh,
      onsite_kwh: onsiteKwh,          // reported, and deliberately NOT in the basis
      td_basis_kwh: tdBasisKwh,
      td_loss_share: L,
      td_loss_kwh: lossKwh,
    },
  };
}

// =============================================================================
// CATEGORY 5 — 'OUTPUT - C5 Waste'
//   H = E * G / 1000, factor looked up by the COMPOSITE key 'stream | route'.
//
// TRAP — THE ROUTE IS PART OF THE KEY.
//   C&D to landfill is 1.26 kgCO2e/t; organic to landfill is 626.9. Applying a
//   single "waste generated" factor to a total tonnage is the largest available
//   error in this category, by a factor of five hundred. An unmapped
//   stream/route pair is reported, never silently dropped.
// =============================================================================
export function computeWasteLine(line, { lookup }) {
  const a = line.attrs ?? {};
  const tonnes = num(a.quantity_tonnes);
  const compositeKey = `${String(a.waste_stream ?? "").trim()} | ${String(a.disposal_route ?? "").trim()}`;

  const out = { category: "cat5_waste", quantity: tonnes, quantity_unit: "tonnes", lookup_key: compositeKey };
  if (tonnes === null) return { ...out, exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0 };

  const f = lookup.resolve("waste", compositeKey);
  out.factor_key = f.key;
  if (f.value === null || f.value === undefined) {
    return { ...out, exclusion_reason: f.reason, emissions_t: 0 };
  }
  return { ...out, factor_value: f.value, emissions_t: tonnes * f.value * KG_TO_T };
}

// =============================================================================
// CATEGORY 6 — 'OUTPUT - C6 Travel'
//   I = C * D * (F + H) / 1000
//
// Each mode carries TWO factors: combustion and well-to-tank, ADDED before
// multiplying. The hotel row's WTT points at EF-ZERO rather than null, so a
// missing second factor is distinguishable from a deliberate zero.
//
// TRAP — TRAVELLERS MULTIPLY, AND DEFAULT TO 1.
//   A trip of 1,710 km with 2 travellers is 3,420 passenger-km. A zero or blank
//   traveller count means one traveller, not zero emissions.
//
// NOTE — car and taxi factors are per VEHICLE-km, not passenger-km. Multiplying
//   those by traveller count overstates a shared cab. The workbook does exactly
//   this and it is flagged in the register's own notes; reproduced faithfully
//   rather than silently corrected, because changing it would make our figure
//   differ from the client's workbook with no record of why.
// =============================================================================
export function computeTravelLine(line, { lookup }) {
  const a = line.attrs ?? {};
  const qty = num(a.quantity);
  const travellers = num(a.travellers) || 1;

  const out = { category: "cat6_travel", quantity_unit: "passenger-km or room-nights" };
  if (qty === null) return { ...out, exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0 };

  const pkm = qty * travellers;
  out.quantity = pkm;

  const f = lookup.resolve("travel", a.travel_mode);
  out.factor_key = f.key;
  out.factor_key_2 = f.key2 ?? null;
  if (f.value === null || f.value === undefined) {
    return { ...out, exclusion_reason: f.reason, emissions_t: 0 };
  }
  // A mode whose WTT factor is missing entirely (as opposed to EF-ZERO) is
  // reported: its combustion still counts, but the line is flagged so the gap
  // is visible rather than quietly understating the trip.
  const wtt = f.value2 ?? 0;
  out.factor_value = f.value;
  out.factor_value_2 = f.value2 ?? null;
  if (f.key2 && f.value2 === null) out.exclusion_reason = EXCLUSION.MISSING_FACTOR;
  out.emissions_t = pkm * (f.value + wtt) * KG_TO_T;
  return out;
}

// =============================================================================
// CATEGORY 7 — 'OUTPUT - C7 Commute'
//
// Per mode:  C = one_way_km x 2 x days_per_week x weeks_per_year   (annual km)
//            G = respondents x C / occupancy x EF / 1000
//            I = respondents x wfh_days x EF-CMT-WFH / 1000
// Then:      total = (sum G + sum I) x headcount / respondents
//
// TRAP — THE x2 IS THE RETURN LEG. One-way distance, twice a day.
//
// TRAP — OCCUPANCY DIVIDES. Four people car-pooling produce one car's
//   emissions, not four. Multiplying (or omitting) overstates a car-pool by the
//   occupancy factor.
//
// TRAP — THE GROSS-UP IS HEADCOUNT / RESPONDENTS, applied to the TOTAL, once.
//   Applying it per line as well would square it.
//
// TRAP — A ZERO SURVEY BASE CANNOT BE GROSSED UP. The workbook's VALIDATION
//   check 9 tests for it; dividing by zero here would produce Infinity and
//   write it as a disclosure.
// =============================================================================
export function computeCommuteLine(line, { lookup, wfhFactor }) {
  const a = line.attrs ?? {};
  const respondents = num(a.respondents) ?? 0;
  const oneWayKm = num(a.one_way_km);
  const daysPerWeek = num(a.days_per_week);
  const weeksPerYear = num(a.weeks_per_year);
  const occupancy = num(a.occupancy) || 1;
  const wfhDays = num(a.wfh_days) ?? 0;

  const out = { category: "cat7_commute", quantity_unit: "passenger-km", respondents };
  if (oneWayKm === null || daysPerWeek === null || weeksPerYear === null) {
    return { ...out, exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0, emissions_t_2: 0 };
  }

  // x2 for the return leg.
  const annualKmPerRespondent = oneWayKm * 2 * daysPerWeek * weeksPerYear;
  // Occupancy DIVIDES: a shared vehicle's emissions are shared.
  const vehicleKm = (respondents * annualKmPerRespondent) / occupancy;
  out.quantity = vehicleKm;

  const f = lookup.resolve("commute", a.commute_mode);
  out.factor_key = f.key;
  if (f.value === null || f.value === undefined) {
    out.exclusion_reason = f.reason;
    out.emissions_t = 0;
  } else {
    out.factor_value = f.value;
    out.emissions_t = vehicleKm * f.value * KG_TO_T;
  }

  // Working from home, counted per respondent-day. Optional under the GHG
  // Protocol but expected by most reporters, and the workbook includes it.
  const wfhTotalDays = respondents * wfhDays;
  out.wfh_days = wfhTotalDays;
  out.factor_key_2 = "EF-CMT-WFH";
  out.factor_value_2 = wfhFactor;
  out.emissions_t_2 = wfhFactor === null ? 0 : wfhTotalDays * wfhFactor * KG_TO_T;
  return out;
}

/**
 * The gross-up, applied ONCE to the summed survey result.
 *
 * Returns null total when the survey base is zero — a category that cannot be
 * computed must not be written as 0, because 0 is a claim about the world and
 * "we did not survey anyone" is not.
 */
export function grossUpCommute({ surveyedCommuteT, surveyedWfhT, respondents, headcount }) {
  const surveyed = surveyedCommuteT + surveyedWfhT;
  if (!respondents || respondents <= 0) {
    return { total_t: null, factor: null, reason: EXCLUSION.NO_QUANTITY,
             surveyed_t: surveyed, respondents, headcount };
  }
  const factor = headcount / respondents;
  return { total_t: surveyed * factor, factor, surveyed_t: surveyed, respondents, headcount };
}

// =============================================================================
// CATEGORY 11 — 'OUTPUT - C11 C13 Downstream'
//   D = area x conversion ;  H = D * EPI * lifetime * gridEF / 1000
//
// TRAP — THE LIFETIME MULTIPLIER IS WHY THIS CATEGORY DOMINATES.
//   Annual operating energy multiplied by a 50-year expected life makes Cat 11
//   roughly 99.5% of total Scope 3. That is CORRECT per the GHG Protocol — the
//   whole use phase is booked in the year of sale — but it means the total is
//   insensitive to improvement anywhere else, and it should be presented with
//   that stated rather than left to be read as a modelling artefact.
//
// TRAP — A MISSING LIFETIME IS NOT A LIFETIME OF ONE.
//   Defaulting to 1 would understate the category by roughly the lifetime
//   multiple (50x) while producing a number that looks computed. The workbook's
//   VALIDATION check 8 counts these; here the line refuses to compute.
// =============================================================================
export function computeSoldProductLine(line, { lookup }) {
  const a = line.attrs ?? {};
  const area = num(a.area_sqm);
  const conversion = num(a.area_conversion) || 1;
  const epi = num(a.epi_kwh_sqm_yr);
  const lifetime = num(a.lifetime_years);

  const out = { category: "cat11_sold", quantity_unit: "kWh over lifetime" };
  if (area === null || epi === null) {
    return { ...out, exclusion_reason: EXCLUSION.NO_QUANTITY, emissions_t: 0 };
  }
  if (lifetime === null || lifetime <= 0) {
    return { ...out, exclusion_reason: EXCLUSION.MISSING_LIFETIME, emissions_t: 0 };
  }

  const floorArea = area * conversion;
  const lifetimeKwh = floorArea * epi * lifetime;
  const gridEf = lookup.byKey("EF-ELEC-CEA-COMB");
  out.quantity = lifetimeKwh;
  out.factor_key = gridEf.key;
  if (gridEf.value === null) {
    return { ...out, exclusion_reason: EXCLUSION.MISSING_FACTOR, emissions_t: 0 };
  }
  out.factor_value = gridEf.value;
  out.emissions_t = lifetimeKwh * gridEf.value * KG_TO_T;
  return out;
}

// =============================================================================
// CATEGORY 13 — 'OUTPUT - C11 C13 Downstream' rows 60-68
//
// An AGGREGATE over the leased-assets ledger: tenant electricity at the grid
// factor, tenant diesel at the COMBUSTION factor (it is the tenant's Scope 1,
// which is our Cat 13), and refrigerant top-up at AR6 GWPs by gas.
//
// TRAP — THIS IS THE LOAD REMOVED FROM SCOPE 2.
//   Tenant electricity was taken out of the Scope 2 boundary in FY24. If it is
//   not booked here it vanishes from the inventory entirely, which is exactly
//   the failure the two-disclosure structure exists to prevent.
//
// TRAP — DIESEL USES THE COMBUSTION FACTOR HERE, NOT WTT.
//   Cat 3 takes the upstream portion of OUR fuel. Cat 13 takes the tenant's
//   whole combustion. Using EF-DSL-WTT here would understate it ~4.4x.
// =============================================================================
export function computeCat13({ lines, lookup }) {
  const sum = (key) => lines.reduce((t, l) => t + (num(l.attrs?.[key]) ?? 0), 0);

  const tenantKwh = sum("tenant_electricity_kwh");
  const tenantDieselL = sum("tenant_diesel_l");

  // Refrigerant is summed BY GAS, because each carries its own GWP.
  const byGas = new Map();
  for (const l of lines) {
    const gas = String(l.attrs?.refrigerant_type ?? "").trim();
    const kg = num(l.attrs?.refrigerant_topup_kg);
    if (!gas || kg === null || kg === 0) continue;
    byGas.set(gas, (byGas.get(gas) ?? 0) + kg);
  }

  const components = [
    { key: "tenant_electricity", qty: tenantKwh, unit: "kWh", factor: lookup.byKey("EF-ELEC-CEA-COMB") },
    { key: "tenant_diesel", qty: tenantDieselL, unit: "litres", factor: lookup.byKey("EF-DSL-COMB") },
  ];
  for (const [gas, kg] of [...byGas].sort((a, b) => a[0].localeCompare(b[0]))) {
    const f = lookup.resolve("refrigerant", gas);
    components.push({ key: `refrigerant_${gas}`, qty: kg, unit: "kg", factor: f });
  }

  let total = 0;
  const detail = [];
  for (const c of components) {
    const ok = c.qty !== null && c.factor.value !== null && c.factor.value !== undefined;
    const t = ok ? c.qty * c.factor.value * KG_TO_T : 0;
    total += t;
    detail.push({
      component: c.key,
      quantity: c.qty,
      quantity_unit: c.unit,
      factor_key: c.factor.key,
      factor_value: c.factor.value ?? null,
      emissions_t: t,
      exclusion_reason: ok ? null : (c.factor.reason ?? EXCLUSION.MISSING_FACTOR),
    });
  }
  return { total_t: total, detail, refrigerants: Object.fromEntries(byGas) };
}

// =============================================================================
// THE DOUBLE-COUNTING GUARD
//
// The single most important validation rule in Scope 3, and nothing like it
// exists in the Scope 1/2 model. validation.ts checks one site-month's values
// against each other and against last year — a value-level check. This is
// different in kind: A RUPEE OF SPEND BELONGS TO EXACTLY ONE METHOD.
//
// If a material is counted by tonnage on the materials ledger, its purchase
// order must be tagged EXCLUDE on the procurement ledger. Otherwise the same
// cement is counted twice: once at 900 kgCO2e/tonne and once at 3.5 kgCO2e/EUR.
//
// WHY THIS IS A BLOCKING-AT-EXPORT CHECK RATHER THAN A PER-ROW ENTRY FLAG
//   An untagged line is SILENTLY EXCLUDED from the total. The failure is
//   invisible at entry time — nothing looks wrong on the row — and shows up
//   only as an understated category months later. It has to be counted at the
//   point the number leaves the building.
// =============================================================================
export function checkDoubleCounting({ procurementResults, materialLines }) {
  const untagged = procurementResults.filter((r) => r.exclusion_reason === EXCLUSION.UNTAGGED);

  // Suppliers appearing on both ledgers where the procurement line was NOT
  // excluded — the shape of an actual double count. A warning, not a verdict:
  // a supplier can legitimately sell both a tonnage-counted material and an
  // unrelated service.
  const materialSuppliers = new Set(
    materialLines.map((l) => normKey(l.attrs?.supplier)).filter(Boolean)
  );
  const suspects = procurementResults.filter(
    (r) =>
      r.exclusion_reason !== EXCLUSION.EXCLUDED_TAG &&
      r.category !== "excluded" &&
      materialSuppliers.has(normKey(r.attrs?.supplier))
  );

  return {
    untagged_count: untagged.length,
    untagged_lines: untagged.map((r) => r.line_no),
    suspect_count: suspects.length,
    suspect_lines: suspects.map((r) => ({
      line_no: r.line_no,
      supplier: r.attrs?.supplier,
      category: r.category,
    })),
  };
}
