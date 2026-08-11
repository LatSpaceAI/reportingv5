// Parses the four real site returns in birla-estates/input and asserts the
// figures against what the files actually contain.
//
// The assertions that matter most are the electricity ones. Aurora's form moved
// grid electricity from row 12 to row 13 in February 2024 and simultaneously
// changed its meaning from non-renewable to renewable. These tests pin both
// sides of that boundary, so a regression to row-position matching fails here
// rather than in a published disclosure.
//
//   npx tsx scripts/test-import.ts

import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

import {
  parseWorkbook,
  parseSheet,
  detectPeriod,
  normaliseLabel,
  matchField,
} from "../src/lib/siteEntry/importWorkbook";
import type { FormField } from "../src/lib/siteEntry/types";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`ok   ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? `  ${detail}` : ""}`);
  }
}

function near(a: number | null, b: number, tol = 1e-6): boolean {
  return a !== null && Math.abs(a - b) <= tol;
}

// ---------------------------------------------------------------------------
// Form fixtures — mirroring 05_site_forms_seed.sql closely enough to test the
// matcher. Labels are copied verbatim from the seed, typos included.
// ---------------------------------------------------------------------------
let nextId = 1;
function f(
  label: string,
  parameterKey: string,
  formUnit: string,
  unitFactor = 1,
  extra: Partial<FormField> = {}
): FormField {
  return {
    fieldId: nextId++,
    groupLabel: null,
    rowOrder: nextId * 10,
    label,
    formUnit,
    columnKind: "quantity",
    parameterKey,
    parameterLabel: parameterKey,
    parameterUnit: null,
    unitFactor,
    aggregateKey: null,
    isFormTotal: false,
    isRequired: false,
    isMemo: false,
    helpText: null,
    notes: null,
    ...extra,
  };
}

/** FORM.RESIDENTIAL.V1 — Tisya, Sangamwadi. */
function residentialForm(): FormField[] {
  nextId = 1000;
  return [
    f("Total fresh water consumption", "water.total_reported", "m3", 1, { isFormTotal: true }),
    f("from Municipality", "water.municipal", "m3"),
    f("From Ground Water ( onsite)", "water.groundwater", "m3"),
    f("From Tanker ( offsite)", "water.tanker", "m3"),
    f("Sewage Generated - STP inlet", "water.stp_inlet", "m3"),
    f("Treated Water used", "water.treated_used", "m3"),
    f("Water for drinking", "water.drinking", "m3"),
    f("Grid Electricity consmuption", "elec.grid", "KWh"),
    f("Electricty from renewables", "elec.renewable", "KWh"),
    f("DG set - Diesel", "fuel.diesel_dg", "Ltrs", 0.001),
    f("Diesel for plant and Machinery", "fuel.diesel_plant", "Ltrs", 0.001),
    f("Petrol", "fuel.petrol", "Ltrs", 0.001),
    f("C&D Waste - Debris -MT", "waste.cnd", "MT"),
    f("Scrap (Rebar, steel, Threading, Wooden - MT", "waste.scrap", "MT"),
    f(
      "Municipal solid waste ( General waste,Paper, cardboard, Cement bags,Plastic waste)  MT",
      "waste.municipal",
      "MT"
    ),
    f("food waste - From site -MT", "waste.food", "MT"),
    f("Used Oil - Litres", "waste.used_oil", "Litres"),
    f("Oil Filters - Nos", "waste.oil_filters_no", "Nos"),
    f("Other Contaminated Waste - kg", "waste.contaminated", "kg", 0.001),
    f("Battery Waste - Nos", "waste.battery_no", "Nos"),
    f("Electronic waste - kg", "waste.ewaste", "kg", 0.001),
    f("Cotton rags for Cleaning Hazardous Waste - Kg", "waste.cotton_rags", "kg", 0.001),
    f("paint drums - kg", "waste.paint_drums", "kg", 0.001),
    f("Collant Oil form HVAC - Litres", "waste.coolant_oil", "Litres"),
  ];
}

/** FORM.COMMERCIAL.FY24 — Aurora up to Jan-2024. Grid is NON-renewable. */
function commercialFy24Form(): FormField[] {
  nextId = 2000;
  return [
    f("Total fresh water consumption", "water.total_reported", "M3", 1, { isFormTotal: true }),
    f("from Municipality", "water.municipal", "M3"),
    f("From Ground Water ( onsite)", "water.groundwater", "M3"),
    f("From Tanker ( offsite)", "water.tanker", "M3"),
    f("From rain water Harvesting", "water.rainwater", "M3"),
    f("Sewage Generated - STP inlet", "water.stp_inlet", "M3"),
    f("Sewage Recycled - STP Outlet", "water.stp_outlet", "M3"),
    // The FY24 label — plain grid draw, booked as NON-renewable.
    f("Grid Electricity consumption", "elec.grid", "KWh"),
    f("Tenant Electricity consumption", "elec.tenant", "KWh"),
    f("Electricity from renewables", "elec.renewable", "KWh"),
    f("Level 8 Electricity consumption", "elec.own_floor_1", "KWh"),
    f("Level 13 Electricity consumption", "elec.own_floor_2", "KWh"),
    f("DG set - Diesel", "fuel.diesel_dg", "Ltrs", 0.001),
    f("Diesel for plant and Machinery", "fuel.diesel_plant", "Ltrs", 0.001),
    f("Petrol", "fuel.petrol", "Ltrs", 0.001),
    f("C&D Waste", "waste.cnd", "MT"),
    f("Municipal solid waste (Plastic, cardboard etc)", "waste.municipal", "MT"),
    f("food waste", "waste.food", "MT"),
  ];
}

/** FORM.COMMERCIAL.V1 — Aurora from Feb-2024. Green energy is RENEWABLE. */
function commercialV1Form(): FormField[] {
  nextId = 3000;
  return [
    f("Total fresh water consumption", "water.total_reported", "m3", 1, { isFormTotal: true }),
    f("from Municipality", "water.municipal", "m3"),
    f("From Ground Water ( onsite)", "water.groundwater", "m3"),
    f("From Tanker ( offsite)", "water.tanker", "m3"),
    f("Sewage Generated - STP inlet", "water.stp_inlet", "m3"),
    f("Sewage Recycled - STP Outlet", "water.stp_outlet", "m3"),
    // The revised label — a green-power purchase, booked as RENEWABLE.
    f("Grid Electricity consmuption ( Green Energy)", "elec.green", "KWh"),
    f("Electricty from renewables", "elec.renewable", "KWh"),
    f("Tenant Electricity consumption", "elec.tenant", "KWh"),
    f("Level 8 Electricity consumption", "elec.own_floor_1", "KWh"),
    f("Level 13 Electricity consumption", "elec.own_floor_2", "KWh"),
    f("DG set - Diesel", "fuel.diesel_dg", "Ltrs", 0.001),
    f("Diesel for plant and Machinery", "fuel.diesel_plant", "Ltrs", 0.001),
    f("Petrol", "fuel.petrol", "Ltrs", 0.001),
    f("C&D Waste", "waste.cnd", "MT"),
    f("Municipal solid waste (Plastic, cardboard etc)", "waste.municipal", "MT"),
    f("food waste", "waste.food", "MT"),
  ];
}

/** FORM.RESIDENTIAL.F17 — Trimaya. */
function f17Form(): FormField[] {
  nextId = 4000;
  return [
    f("Total fresh water consumption", "water.total_reported", "m3", 1, { isFormTotal: true }),
    f("from Municipality", "water.municipal", "m3"),
    f("From Ground Water ( onsite)", "water.groundwater", "m3"),
    f("From Tanker ( offsite)", "water.tanker", "m3"),
    f("From Tanker - Treated", "water.tanker_treated", "m3"),
    f("Sewage Generated - STP inlet", "water.stp_inlet", "m3"),
    f("Sewage Recycled - STP Outlet", "water.stp_outlet", "m3"),
    f("Grid Electricity consmuption", "elec.grid", "KWh"),
    f("Electricty from renewables", "elec.renewable", "KWh"),
    f("DG set - Diesel", "fuel.diesel_dg", "Ltrs", 0.001),
    f("Diesel for plant and Machinery", "fuel.diesel_plant", "Ltrs", 0.001),
    f("Petrol", "fuel.petrol", "Ltrs", 0.001),
    f("C&D Waste", "waste.cnd", "MT"),
    f("Municipal solid waste (Plastic, cardboard etc)", "waste.municipal", "MT"),
    f("Used Oil", "waste.used_oil", "Litres"),
    f("Oil Filters", "waste.oil_filters_no", "Nos"),
    f("Battery Waste", "waste.battery_no", "Nos"),
    f("Electronic waste", "waste.ewaste", "kg", 0.001),
    f("Other Contaminated Waste", "waste.contaminated", "kg", 0.001),
    f("Bio-Medical waste", "waste.biomedical", "kg", 0.001),
  ];
}

const DIR = "birla-estates/input";

async function load(path: string): Promise<ArrayBuffer> {
  const buf = await readFile(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function valueOf(cells: { parameterKey: string | null; canonicalValue: number | null }[], key: string) {
  return cells.find((c) => c.parameterKey === key)?.canonicalValue ?? null;
}

async function main() {
  console.log("\n--- period detection ---");
  ok("Apr'24 -> month 1 FY2024-25", (() => {
    const p = detectPeriod("Apr'24");
    return p.monthNo === 1 && p.fiscalYear === "2024-25";
  })());
  ok("Dec'24 -> month 9 FY2024-25", (() => {
    const p = detectPeriod("Dec'24");
    return p.monthNo === 9 && p.fiscalYear === "2024-25";
  })());
  ok("Feb-25 -> month 11 FY2024-25", (() => {
    const p = detectPeriod("Feb-25");
    return p.monthNo === 11 && p.fiscalYear === "2024-25";
  })());
  ok("date range uses the END month", (() => {
    const p = detectPeriod("31/03/23 to 30/04/23");
    return p.monthNo === 1 && p.fiscalYear === "2023-24";
  })());
  ok("March is fiscal month 12", (() => {
    const p = detectPeriod("Mar'25");
    return p.monthNo === 12 && p.fiscalYear === "2024-25";
  })());

  console.log("\n--- label normalisation keeps meaning distinct ---");
  ok(
    "the 'consmuption' typo does NOT normalise onto 'consumption'",
    normaliseLabel("Grid Electricity consmuption ( Green Energy)") !==
      normaliseLabel("Grid Electricity consumption")
  );
  ok(
    "punctuation and case are ignored",
    normaliseLabel("From Tanker ( offsite)") === normaliseLabel("from tanker  offsite")
  );

  console.log("\n--- Tisya Apr-24 (residential) ---");
  {
    const fields = residentialForm();
    const res = await parseWorkbook(
      await load(`${DIR}/Monthy ESG Report - Residential Assets - Birla Tisya- Apr'24.xlsx`),
      fields
    );
    ok("workbook parses", res.ok, res.error ?? "");
    const cells = res.sheet?.cells ?? [];
    ok("site detected", res.sheet?.detectedSiteName?.includes("Tisya") ?? false,
      res.sheet?.detectedSiteName ?? "");
    ok("period detected as Apr FY2024-25",
      res.sheet?.detectedPeriod.monthNo === 1 &&
        res.sheet?.detectedPeriod.fiscalYear === "2024-25");
    ok("groundwater = 1396 KL", near(valueOf(cells, "water.groundwater"), 1396));
    ok("tanker = 428.63 KL", near(valueOf(cells, "water.tanker"), 428.63));
    ok("treated water used = 612.88 KL", near(valueOf(cells, "water.treated_used"), 612.88));
    ok("grid electricity = 23,935.5 kWh", near(valueOf(cells, "elec.grid"), 23935.5));
    ok("renewable = 1,522.76 kWh", near(valueOf(cells, "elec.renewable"), 1522.76));
    ok("DG diesel 180 Ltrs -> 0.18 kL", near(valueOf(cells, "fuel.diesel_dg"), 0.18));
    ok("plant diesel 1345 Ltrs -> 1.345 kL", near(valueOf(cells, "fuel.diesel_plant"), 1.345));
    ok("C&D = 180.38 MT", near(valueOf(cells, "waste.cnd"), 180.38));
    // "Rebar - 3.5 / Steel - 0.02 / Wood - 0.15"
    ok("multi-part scrap text sums to 3.67 MT",
      near(valueOf(cells, "waste.scrap"), 3.67, 1e-9),
      String(valueOf(cells, "waste.scrap")));
    // "58 kg" on an MT-denominated row
    ok("'58 kg' on an MT row -> 0.058 MT", near(valueOf(cells, "waste.food"), 0.058, 1e-9),
      String(valueOf(cells, "waste.food")));
  }

  console.log("\n--- Sangamwadi Dec-24 (residential) ---");
  {
    const fields = residentialForm();
    const res = await parseWorkbook(
      await load(`${DIR}/Monthy ESG Report - Sangamwadi_Dec'24.xlsx`),
      fields
    );
    ok("workbook parses", res.ok, res.error ?? "");
    const cells = res.sheet?.cells ?? [];
    ok("period detected as Dec FY2024-25",
      res.sheet?.detectedPeriod.monthNo === 9 &&
        res.sheet?.detectedPeriod.fiscalYear === "2024-25");
    ok("tanker = 280 KL", near(valueOf(cells, "water.tanker"), 280));
    ok("drinking water = 3.2 KL", near(valueOf(cells, "water.drinking"), 3.2));
    ok("grid electricity = 1,709 kWh", near(valueOf(cells, "elec.grid"), 1709));
    ok("DG diesel 2000 Ltrs -> 2 kL", near(valueOf(cells, "fuel.diesel_dg"), 2));
    // "Rebar - 0.1 / Wooden waste -4"
    ok("scrap text sums to 4.1 MT", near(valueOf(cells, "waste.scrap"), 4.1, 1e-9),
      String(valueOf(cells, "waste.scrap")));
    ok("oil filters = 2 (a count)", near(valueOf(cells, "waste.oil_filters_no"), 2));
    ok("paint drums 4 kg -> 0.004 MT", near(valueOf(cells, "waste.paint_drums"), 0.004, 1e-9));
  }

  console.log("\n--- Trimaya Feb-25 (F-17) ---");
  {
    const fields = f17Form();
    const res = await parseWorkbook(
      await load(`${DIR}/ESG Online data Trimaya -Feb-25.xlsx`),
      fields
    );
    ok("workbook parses", res.ok, res.error ?? "");
    const cells = res.sheet?.cells ?? [];
    ok("groundwater = 52 KL", near(valueOf(cells, "water.groundwater"), 52));
    ok("tanker = 1,877.92 KL", near(valueOf(cells, "water.tanker"), 1877.92));
    ok("grid electricity = 14,523 kWh", near(valueOf(cells, "elec.grid"), 14523));
    ok("DG diesel 900 Ltrs -> 0.9 kL", near(valueOf(cells, "fuel.diesel_dg"), 0.9));
    ok("vehicle diesel 3942 Ltrs -> 3.942 kL",
      near(valueOf(cells, "fuel.diesel_plant"), 3.942));
    ok("C&D = 7.5 MT", near(valueOf(cells, "waste.cnd"), 7.5));
    ok("'500 kg' on an MT row -> 0.5 MT",
      near(valueOf(cells, "waste.municipal"), 0.5, 1e-9),
      String(valueOf(cells, "waste.municipal")));
    ok("'Nil' is recorded as not-available, not zero",
      cells.some((c) => c.parameterKey === "waste.used_oil" && c.isNotAvailable));
  }

  console.log("\n--- Aurora: the FY24/FY25 electricity inversion ---");
  {
    const bytes = await load(`${DIR}/BA_ESG_Monthly_Aug_24.xlsx`);

    // The whole workbook must be refused: 17 monthly sheets, one upload.
    const whole = await parseWorkbook(bytes, commercialFy24Form());
    ok("a 17-sheet workbook is rejected outright", !whole.ok);
    ok("the rejection names the sheets found",
      (whole.error ?? "").includes("monthly returns") && whole.monthlySheetNames.length > 1,
      `${whole.monthlySheetNames.length} sheets`);

    // Sheet-level parsing, to pin both sides of the Feb-24 boundary.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);

    const apr23 = parseSheet(wb.getWorksheet("April 23")!, commercialFy24Form());
    ok("Apr-23 grid draw lands in elec.grid (NON-renewable)",
      near(valueOf(apr23.cells, "elec.grid"), 250000),
      String(valueOf(apr23.cells, "elec.grid")));
    ok("Apr-23 books NOTHING as green energy",
      valueOf(apr23.cells, "elec.green") === null);
    ok("Apr-23 renewables row is NA, not zero",
      apr23.cells.some((c) => c.parameterKey === "elec.renewable" && c.isNotAvailable));
    ok("Apr-23 tenant electricity captured as memo",
      near(valueOf(apr23.cells, "elec.tenant"), 184054.04151581126, 1e-6));

    const feb24 = parseSheet(wb.getWorksheet("Feb 24")!, commercialV1Form());
    ok("Feb-24 green energy lands in elec.green (RENEWABLE)",
      near(valueOf(feb24.cells, "elec.green"), 219960),
      String(valueOf(feb24.cells, "elec.green")));
    ok("Feb-24 books NOTHING as plain grid",
      valueOf(feb24.cells, "elec.grid") === null);
    ok("Feb-24 DG diesel 600.9 Ltrs -> 0.6009 kL",
      near(valueOf(feb24.cells, "fuel.diesel_dg"), 0.6009, 1e-9));

    // July-24 carries the .9992 decimal that identifies the renewable
    // deduction in the published template. It must survive the parse intact.
    const jul24 = parseSheet(wb.getWorksheet("July 24")!, commercialV1Form());
    ok("Jul-24 keeps the .9992 decimal exactly",
      near(valueOf(jul24.cells, "elec.green"), 293411.9992, 1e-9),
      String(valueOf(jul24.cells, "elec.green")));

    // The inversion, stated as one assertion: the SAME parameter must not be
    // filled by both forms, or ten months of grid draw become renewable.
    ok("no month is booked as both grid and green",
      [apr23, feb24, jul24].every(
        (s) => !(valueOf(s.cells, "elec.grid") !== null && valueOf(s.cells, "elec.green") !== null)
      ));
  }

  console.log("\n--- matcher safety ---");
  {
    const fy24 = commercialFy24Form();
    const idxFields = fy24.filter((x) => x.columnKind === "quantity");
    const index = {
      byExact: new Map(idxFields.map((x) => [x.label, x])),
      byNormalised: new Map(idxFields.map((x) => [normaliseLabel(x.label), x])),
    };
    // The FY25 label must NOT match anything on the FY24 form. If it did, the
    // importer could book green energy into the FY24 grid parameter.
    const m = matchField("Grid Electricity consmuption ( Green Energy)", index);
    ok("FY25 green-energy label does not match the FY24 grid row",
      m.field === null || m.field.parameterKey !== "elec.grid",
      m.field ? `matched ${m.field.parameterKey}` : "unmatched");
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\ntest-import failed:", e);
  process.exit(1);
});
