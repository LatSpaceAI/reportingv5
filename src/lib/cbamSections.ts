import {
  aggregatedGoods,
  carbonPriceType,
  cemsGhg,
  cnCodesAluminium,
  countries,
  currencies,
  dataQualityJustification,
  dataQualityLevel,
  dataVerification,
  efUnit,
  electricitySource,
  massOrGas,
  measurementOrDefault,
  monitoringApproach,
  pfcMethod,
  pfcTechnology,
  productionRoutesByGood,
  rebateType,
  yesNo,
} from "./codeLists";

export type {
  FieldKind,
  BaseField,
  Field,
  QuestionKind,
  FieldsQuestion,
  TableQuestion,
  Question,
  Section,
  ComputeContext,
} from "./frameworkTypes";

import type { Section } from "./frameworkTypes";

const goodToRoutes = { ...productionRoutesByGood };

export const sections: Section[] = [
  {
    id: "A",
    title: "A. Installation Data",
    sheetRef: 'Sheet "A_InstData"',
    questions: [
      {
        id: "A.1",
        kind: "fields",
        label: "Reporting period",
        description:
          "Start and end date of the reporting period to which all data in this template refers.",
        fields: [
          { id: "start", kind: "date", label: "Start date", required: true },
          { id: "end", kind: "date", label: "End date", required: true },
        ],
      },
      {
        id: "A.2",
        kind: "fields",
        label: "About the installation",
        description: "Installation identity and contact details.",
        fields: [
          { id: "nameLocal", kind: "text", label: "Installation name (local)" },
          { id: "nameEn", kind: "text", label: "Installation name (English)", required: true },
          { id: "street", kind: "text", label: "Street, number", required: true },
          { id: "economicActivity", kind: "text", label: "Economic activity" },
          { id: "postcode", kind: "text", label: "Post code" },
          { id: "poBox", kind: "text", label: "P.O. Box" },
          { id: "city", kind: "text", label: "City", required: true },
          { id: "country", kind: "selectCountry", label: "Country", required: true },
          { id: "unlocode", kind: "text", label: "UNLOCODE", required: true, help: "5-letter UN/LOCODE, e.g. INBOM." },
          { id: "lat", kind: "number", label: "Latitude (main emission source)", min: -90, max: 90, step: 0.0001 },
          { id: "lng", kind: "number", label: "Longitude (main emission source)", min: -180, max: 180, step: 0.0001 },
          { id: "repName", kind: "text", label: "Authorised representative — name" },
          { id: "repEmail", kind: "email", label: "Authorised representative — email" },
          { id: "repTel", kind: "tel", label: "Authorised representative — phone" },
        ],
      },
      {
        id: "A.3",
        kind: "fields",
        label: "Verifier of the report",
        description: "Optional during the transitional period.",
        fields: [
          { id: "verifierCompany", kind: "text", label: "Company name" },
          { id: "verifierStreet", kind: "text", label: "Street, number" },
          { id: "verifierCity", kind: "text", label: "City" },
          { id: "verifierPostcode", kind: "text", label: "Postcode / ZIP" },
          { id: "verifierCountry", kind: "selectCountry", label: "Country" },
          { id: "verifierRepName", kind: "text", label: "Authorised rep — name" },
          { id: "verifierRepEmail", kind: "email", label: "Authorised rep — email" },
          { id: "verifierRepTel", kind: "tel", label: "Authorised rep — phone" },
          { id: "accreditationMS", kind: "selectCountry", label: "Accreditation Member State" },
          { id: "accreditationBody", kind: "text", label: "National accreditation body" },
          { id: "accreditationRegNo", kind: "text", label: "Registration number" },
        ],
      },
      {
        id: "A.4",
        kind: "table",
        label: "Aggregated goods categories & production routes",
        description:
          "List every aggregated CBAM good produced in the installation. For routes, options depend on the selected good.",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `G${i + 1}`,
        columns: [
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          {
            id: "route1",
            kind: "selectDependent",
            label: "Route 1",
            dependsOn: "good",
            map: goodToRoutes,
            fallback: ["All production routes"],
          },
          {
            id: "route2",
            kind: "selectDependent",
            label: "Route 2",
            dependsOn: "good",
            map: goodToRoutes,
            fallback: ["All production routes"],
          },
          { id: "pfcRelevant", kind: "boolean", label: "PFC relevant?" },
        ],
      },
      {
        id: "A.5",
        kind: "table",
        label: "Purchased precursors",
        description: "Precursors produced outside the installation and consumed inside it.",
        minRows: 1,
        maxRows: 20,
        rowLabel: (i) => `PP${i + 1}`,
        columns: [
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          { id: "country", kind: "selectCountry", label: "Country of origin", required: true },
          {
            id: "route",
            kind: "selectDependent",
            label: "Production route",
            dependsOn: "good",
            map: goodToRoutes,
            fallback: ["All production routes", "Unknown"],
          },
          { id: "supplier", kind: "text", label: "Supplier name", help: "Free-text label used in the EU template's purchased-precursor section (e.g. \"Hindalco Industries Limited (Hirakud)\")." },
        ],
      },
    ],
  },

  {
    id: "B",
    title: "B. Emissions at source-stream level",
    sheetRef: 'Sheet "B_EmInst"',
    questions: [
      {
        id: "B.1",
        kind: "table",
        label: "Calculation-based source streams (excluding PFC)",
        description:
          "Every fuel or process material that results in CO₂ emissions. Unit conventions follow the original template.",
        minRows: 1,
        maxRows: 75,
        rowLabel: (i) => `${i + 1}`,
        columns: [
          { id: "name", kind: "text", label: "Source stream name", required: true },
          { id: "method", kind: "select", label: "Method", options: monitoringApproach, required: true },
          { id: "ad", kind: "number", label: "Activity data", min: 0 },
          { id: "adUnit", kind: "select", label: "AD unit", options: massOrGas },
          { id: "ncv", kind: "number", label: "NCV", min: 0, unit: "GJ/t" },
          { id: "ef", kind: "number", label: "Emission factor", min: 0 },
          { id: "efUnit", kind: "select", label: "EF unit", options: efUnit },
          { id: "cContent", kind: "number", label: "Carbon content", min: 0, max: 100, unit: "%" },
          { id: "oxF", kind: "number", label: "Oxidation factor", min: 0, max: 100, unit: "%" },
          { id: "convF", kind: "number", label: "Conversion factor", min: 0, max: 100, unit: "%" },
          { id: "biomass", kind: "number", label: "Biomass content", min: 0, max: 100, unit: "%" },
        ],
      },
      {
        id: "B.2",
        kind: "table",
        label: "PFC (perfluorocarbon) emissions",
        description: "Only relevant for primary aluminium smelters.",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `${i + 1}`,
        columns: [
          { id: "method", kind: "select", label: "Method", options: pfcMethod, required: true },
          { id: "tech", kind: "select", label: "Technology", options: pfcTechnology, required: true },
          { id: "tAl", kind: "number", label: "Aluminium produced", min: 0, unit: "t" },
          { id: "aeFreq", kind: "number", label: "AE frequency", min: 0, unit: "/cell-day" },
          { id: "aeDur", kind: "number", label: "AE duration", min: 0, unit: "min" },
          { id: "overvoltage", kind: "number", label: "Overvoltage", min: 0, unit: "mV" },
          { id: "slopeCF4", kind: "number", label: "Slope CF₄", min: 0 },
          { id: "slopeC2F6", kind: "number", label: "Slope C₂F₆", min: 0 },
        ],
      },
      {
        id: "B.3",
        kind: "table",
        label: "Measurement-based emission sources",
        description: "Continuous Emission Monitoring System (CEMS) sources.",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `${i + 1}`,
        columns: [
          { id: "name", kind: "text", label: "Source name", required: true },
          { id: "ghg", kind: "select", label: "GHG", options: cemsGhg, required: true },
          { id: "conc", kind: "number", label: "Concentration", min: 0, unit: "g/Nm³" },
          { id: "flow", kind: "number", label: "Flow rate", min: 0, unit: "1000 Nm³/h" },
          { id: "hours", kind: "number", label: "Operating hours", min: 0, unit: "h/period" },
        ],
      },
    ],
  },

  {
    id: "C",
    title: "C. Installation-level emissions & energy",
    sheetRef: 'Sheet "C_Emissions&Energy"',
    questions: [
      {
        id: "C.1",
        kind: "fields",
        label: "Fuel balance (TJ)",
        description: "Split total fuel input across the four use types.",
        fields: [
          { id: "cbamDirect", kind: "number", label: "Direct fuel for CBAM processes", min: 0, unit: "TJ" },
          { id: "electricity", kind: "number", label: "Fuel for electricity production", min: 0, unit: "TJ" },
          { id: "nonCbam", kind: "number", label: "Direct fuel for non-CBAM goods", min: 0, unit: "TJ" },
          { id: "rest", kind: "number", label: "Rest", min: 0, unit: "TJ" },
        ],
      },
      {
        id: "C.2",
        kind: "fields",
        label: "GHG balance (tCO₂e)",
        description:
          "Manual override values; indirect emissions must always be entered manually.",
        fields: [
          { id: "co2", kind: "number", label: "Total CO₂ emissions", min: 0, unit: "tCO₂e" },
          { id: "biomass", kind: "number", label: "Biomass emissions", min: 0, unit: "tCO₂e" },
          { id: "n2o", kind: "number", label: "Total N₂O emissions", min: 0, unit: "tCO₂e" },
          { id: "pfc", kind: "number", label: "Total PFC emissions", min: 0, unit: "tCO₂e" },
          { id: "direct", kind: "number", label: "Total direct emissions", min: 0, unit: "tCO₂e" },
          { id: "indirect", kind: "number", label: "Total indirect emissions", min: 0, unit: "tCO₂e", required: true },
        ],
      },
      {
        id: "C.3",
        kind: "fields",
        label: "Data quality & quality assurance",
        fields: [
          { id: "quality", kind: "select", label: "Predominant approach", options: dataQualityLevel, required: true },
          { id: "justification", kind: "select", label: "Justification for defaults", options: dataQualityJustification },
          { id: "verification", kind: "select", label: "Quality assurance approach", options: dataVerification },
        ],
      },
    ],
  },

  {
    id: "D",
    title: "D. Per-process production & attributed emissions",
    sheetRef: 'Sheet "D_Processes"',
    questions: [
      {
        id: "D.1",
        kind: "table",
        label: "Production processes",
        description:
          "One row per production process (P1–P10). Mirrors every input cell of the EU template's D_Processes sheet: production by route, internal/external consumption splits, attributed emissions, heat & waste-gas balances, and electricity in/out.",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `P${i + 1}`,
        columns: [
          // ── Identity ─────────────────────────────────────────────────
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          // ── Production amounts by route (D_Processes L16-L19 / L81-L84
          //    / L146-L149 in each block, summed at L24 / L89 / L154) ──
          { id: "prodPrimary",   kind: "number", label: "Production — route 1 (Primary / All)", min: 0, unit: "t" },
          { id: "prodSecondary", kind: "number", label: "Production — route 2 (Secondary)",     min: 0, unit: "t" },
          { id: "prodOther",     kind: "number", label: "Production — route 3 (Other)",         min: 0, unit: "t" },
          { id: "prodUnknown",   kind: "number", label: "Production — route 4 (Unknown)",       min: 0, unit: "t" },
          { id: "output",        kind: "number", label: "Total production within installation", min: 0, unit: "t" },
          // ── Production details (L27 / L92 / L157) ───────────────────
          { id: "toMarket",      kind: "number", label: "Produced for the market",              min: 0, unit: "t" },
          // ── Internal consumption to other processes (L32-L40,
          //    L97-L105, L162-L170 — first row is consumption by P1, etc.) ─
          { id: "consumedP1",    kind: "number", label: "Consumed by P1 (Unwrought)",           min: 0, unit: "t" },
          { id: "consumedP2",    kind: "number", label: "Consumed by P2 (FRP)",                 min: 0, unit: "t" },
          { id: "consumedP3",    kind: "number", label: "Consumed by P3 (Extrusion)",           min: 0, unit: "t" },
          { id: "nonCbam",       kind: "number", label: "Consumed for non-CBAM goods",          min: 0, unit: "t" },
          // ── Applicable elements (K50/L50 — booleans for whether
          //    measurable heat / waste gases are relevant) ──────────────
          { id: "hasHeat",       kind: "boolean", label: "Measurable heat applicable?" },
          { id: "hasWasteGas",   kind: "boolean", label: "Waste gases applicable?" },
          // ── Attributed emissions ─────────────────────────────────────
          { id: "directEm",      kind: "number", label: "Directly attributable emissions (DirEm*)", min: 0, unit: "tCO₂e" },
          { id: "indirectEm",    kind: "number", label: "Attributed indirect emissions",         min: 0, unit: "tCO₂e" },
          // ── Measurable heat balance (only if hasHeat=true) ──────────
          { id: "heatImported",  kind: "number", label: "Heat imported",  min: 0, unit: "TJ" },
          { id: "heatExported",  kind: "number", label: "Heat exported",  min: 0, unit: "TJ" },
          { id: "heatEF",        kind: "number", label: "Heat EF",        min: 0, unit: "tCO₂/TJ" },
          // ── Waste gas balance (only if hasWasteGas=true) ───────────
          { id: "wasteGasImported", kind: "number", label: "Waste gas imported", min: 0, unit: "TJ" },
          { id: "wasteGasExported", kind: "number", label: "Waste gas exported", min: 0, unit: "TJ" },
          { id: "wasteGasEF",       kind: "number", label: "Waste gas EF",       min: 0, unit: "tCO₂/TJ" },
          // ── Indirect-emission electricity ────────────────────────────
          { id: "elecMWh",       kind: "number", label: "Electricity consumption", min: 0, unit: "MWh" },
          { id: "elecEF",        kind: "number", label: "Electricity EF",          min: 0, unit: "tCO₂/MWh" },
          { id: "elecSource",    kind: "select", label: "Electricity source",      options: electricitySource },
          // ── Electricity exported from the process ───────────────────
          { id: "elecExportedMWh", kind: "number", label: "Electricity exported",                min: 0, unit: "MWh" },
          { id: "elecExportedEF",  kind: "number", label: "Exported electricity EF",             min: 0, unit: "tCO₂/MWh" },
        ],
      },
    ],
  },

  {
    id: "E",
    title: "E. Purchased precursors — embedded emissions",
    sheetRef: 'Sheet "E_PurchPrec"',
    questions: [
      {
        id: "E.1",
        kind: "table",
        label: "Purchased precursors SEE",
        description:
          "One row per precursor (PP1–PP20). Mirrors every input cell of the EU template's E_PurchPrec sheet: purchase volumes by production route, consumption splits by process, and the SEE-direct / specific-electricity / electricity-EF block with their measurement provenance.",
        minRows: 1,
        maxRows: 20,
        rowLabel: (i) => `PP${i + 1}`,
        columns: [
          // ── Identity ─────────────────────────────────────────────────
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          { id: "country", kind: "selectCountry", label: "Country of origin", required: true },
          { id: "supplier", kind: "text", label: "Supplier name", help: "Free-text label used in the EU template's purchased-precursor section (e.g. \"Hindalco Industries Limited (Hirakud)\")." },
          // ── Total purchased by production route (E_PurchPrec
          //    L17/L18/L19/L20 in each block, summed at L25) ────────
          { id: "purchPrimary",   kind: "number", label: "Purchased — route 1 (Primary / All)", min: 0, unit: "t" },
          { id: "purchSecondary", kind: "number", label: "Purchased — route 2 (Secondary)",     min: 0, unit: "t" },
          { id: "purchOther",     kind: "number", label: "Purchased — route 3 (Other)",         min: 0, unit: "t" },
          { id: "purchUnknown",   kind: "number", label: "Purchased — route 4 (Unknown)",       min: 0, unit: "t" },
          { id: "mass",           kind: "number", label: "Total purchase (denominator)",        min: 0, unit: "t" },
          // ── Consumption by process within installation (L28-L37) ──
          { id: "toUnwrought",    kind: "number", label: "Consumed by Unwrought",  min: 0, unit: "t" },
          { id: "toFRP",          kind: "number", label: "Consumed by FRP",        min: 0, unit: "t" },
          { id: "toExtrusion",    kind: "number", label: "Consumed by Extrusion",  min: 0, unit: "t" },
          { id: "consumedOther",  kind: "number", label: "Consumed for non-CBAM / sold", min: 0, unit: "t" },
          // ── SEE-direct, specific electricity, electricity EF
          //    (L49/L50/L51) with their per-row source/method (M49/M50/M51) ─
          { id: "seeDirect",        kind: "number", label: "SEE direct",                min: 0, unit: "tCO₂e/t" },
          { id: "seeDirectSource",  kind: "select", label: "SEE-direct source",         options: measurementOrDefault },
          { id: "elecPerT",         kind: "number", label: "Specific electricity",      min: 0, unit: "MWh/t" },
          { id: "elecPerTSource",   kind: "select", label: "Specific-electricity source", options: measurementOrDefault },
          { id: "elecEF",           kind: "number", label: "Electricity EF",            min: 0, unit: "tCO₂/MWh" },
          { id: "elecSource",       kind: "select", label: "Electricity source",        options: electricitySource },
          // ── Derived (L52 = elec × EF; readOnly in export, displayed) ──
          { id: "seeIndirect",      kind: "number", label: "SEE indirect (derived)",    min: 0, unit: "tCO₂e/t" },
          // ── Defaults justification (only when source = "Default values") ─
          { id: "justification",    kind: "select", label: "Justification for defaults", options: dataQualityJustification },
        ],
      },
    ],
  },

  {
    id: "F",
    title: "F. Tools (CHP & carbon price)",
    sheetRef: 'Sheet "F_Tools"',
    questions: [
      {
        id: "F.1",
        kind: "fields",
        label: "Cogeneration (CHP) allocation",
        description: "Complete only if the installation operates a CHP plant.",
        fields: [
          { id: "hasCHP", kind: "boolean", label: "CHP plant present?" },
          { id: "fuelIn", kind: "number", label: "Fuel input", min: 0, unit: "TJ" },
          { id: "heatOut", kind: "number", label: "Heat output", min: 0, unit: "TJ" },
          { id: "elecOut", kind: "number", label: "Electricity output", min: 0, unit: "MWh" },
          { id: "allocationHeat", kind: "number", label: "Allocation to heat", min: 0, max: 100, unit: "%" },
        ],
      },
      {
        id: "F.2",
        kind: "fields",
        label: "Carbon price due",
        description: "Applicable carbon-pricing instrument and amount due per tonne of CBAM good.",
        fields: [
          { id: "priceType", kind: "select", label: "Carbon price instrument", options: carbonPriceType },
          { id: "rebateType", kind: "select", label: "Rebate mechanism", options: rebateType },
          { id: "currency", kind: "select", label: "Currency", options: currencies },
          { id: "pricePerTon", kind: "number", label: "Carbon price", min: 0, unit: "per tCO₂e" },
          { id: "amountDue", kind: "number", label: "Amount due per tonne of CBAM good", min: 0 },
          { id: "notes", kind: "longtext", label: "Additional information" },
        ],
      },
    ],
  },

  {
    id: "summary",
    title: "Summary of products",
    sheetRef: 'Sheet "Summary_Products"',
    questions: [
      {
        id: "summary.1",
        kind: "table",
        label: "Products summary",
        description:
          "One row per CN-code-level product. Most columns are derived in the EU template from sheets A–F; surfaced here for review and so they round-trip through the seed.",
        minRows: 1,
        maxRows: 50,
        rowLabel: (i) => `${i + 1}`,
        columns: [
          { id: "process",       kind: "text",   label: "Production process", required: true },
          { id: "good",          kind: "text",   label: "Aggregated good / precursor" },
          { id: "cnCode",        kind: "text",   label: "CN Code", help: "8-digit CN code, e.g. 76011010." },
          { id: "cnName",        kind: "text",   label: "CN Name" },
          { id: "productName",   kind: "text",   label: "Product name", help: "Name used for communication with the reporting declarant (e.g. on invoices)." },
          { id: "seeDirect",     kind: "number", label: "SEE (direct)", min: 0, unit: "tCO₂e/t" },
          { id: "seeIndirect",   kind: "number", label: "SEE (indirect)", min: 0, unit: "tCO₂e/t" },
          { id: "seeTotal",      kind: "number", label: "SEE (total)", min: 0, unit: "tCO₂e/t" },
          { id: "defaultShare",  kind: "number", label: "Share of emissions by default value", min: 0, max: 100, unit: "%" },
          { id: "elecEFSource",  kind: "text",   label: "Source for electricity EF" },
          { id: "embeddedElec",  kind: "number", label: "Embedded electricity", min: 0, unit: "MWh/t" },
        ],
      },
    ],
  },

];

// Re-export utility consts that the UI will reference.
export { aggregatedGoods, countries, cnCodesAluminium, yesNo };
