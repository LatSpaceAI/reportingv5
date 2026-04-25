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
        description: "One row per production process (P1–P10).",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `P${i + 1}`,
        columns: [
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          { id: "output", kind: "number", label: "Output", min: 0, unit: "t" },
          { id: "directEm", kind: "number", label: "Attributed direct emissions", min: 0, unit: "tCO₂e" },
          { id: "heatProduced", kind: "number", label: "Heat produced", min: 0, unit: "TJ" },
          { id: "heatConsumed", kind: "number", label: "Heat consumed", min: 0, unit: "TJ" },
          { id: "heatImported", kind: "number", label: "Heat imported", min: 0, unit: "TJ" },
          { id: "heatExported", kind: "number", label: "Heat exported", min: 0, unit: "TJ" },
          { id: "elecMWh", kind: "number", label: "Electricity consumption", min: 0, unit: "MWh" },
          { id: "elecSource", kind: "select", label: "Electricity source", options: electricitySource },
          { id: "elecEF", kind: "number", label: "Electricity EF", min: 0, unit: "tCO₂/MWh" },
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
        description: "One row per precursor (PP1–PP20).",
        minRows: 1,
        maxRows: 20,
        rowLabel: (i) => `PP${i + 1}`,
        columns: [
          { id: "good", kind: "selectGood", label: "Aggregated good", required: true },
          { id: "country", kind: "selectCountry", label: "Country of origin", required: true },
          { id: "mass", kind: "number", label: "Mass consumed", min: 0, unit: "t" },
          { id: "seeDirect", kind: "number", label: "SEE direct", min: 0, unit: "tCO₂e/t" },
          { id: "seeIndirect", kind: "number", label: "SEE indirect", min: 0, unit: "tCO₂e/t" },
          { id: "elecPerT", kind: "number", label: "Electricity consumption", min: 0, unit: "MWh/t" },
          { id: "elecSource", kind: "select", label: "Electricity source", options: electricitySource },
          { id: "elecEF", kind: "number", label: "Electricity EF", min: 0, unit: "tCO₂/MWh" },
          { id: "measurement", kind: "select", label: "Measured / default / unknown", options: measurementOrDefault },
          { id: "justification", kind: "select", label: "Justification for defaults", options: dataQualityJustification },
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
    id: "G",
    title: "G. Further guidance references",
    sheetRef: 'Sheet "G_FurtherGuidance"',
    questions: [
      {
        id: "G.1",
        kind: "fields",
        label: "Methodology notes & assumptions",
        description:
          "Free-text notes for any deviations from standard guidance, interpretive choices, or footnotes to flag to the reporting declarant.",
        fields: [{ id: "notes", kind: "longtext", label: "Notes" }],
      },
    ],
  },

  {
    id: "SP",
    title: "Summary — Products",
    sheetRef: "Sheet Summary_Products",
    questions: [
      {
        id: "SP.1",
        kind: "table",
        label: "Products by CN code",
        description: "One row per CN code exported.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `${i + 1}`,
        columns: [
          {
            id: "cnCode",
            kind: "select",
            label: "CN code",
            options: cnCodesAluminium.map((c) => `${c.code} — ${c.name}`),
          },
          { id: "productName", kind: "text", label: "Product name (commercial)" },
          { id: "process", kind: "text", label: "Production process ID" },
          { id: "seeDirect", kind: "number", label: "SEE direct", min: 0, unit: "tCO₂e/t" },
          { id: "seeIndirect", kind: "number", label: "SEE indirect", min: 0, unit: "tCO₂e/t" },
          { id: "seeTotal", kind: "number", label: "SEE total", min: 0, unit: "tCO₂e/t" },
          { id: "defaultsShare", kind: "number", label: "Share from defaults", min: 0, max: 100, unit: "%" },
          { id: "scrapPerT", kind: "number", label: "t scrap per t Al", min: 0 },
          { id: "nonAlPct", kind: "number", label: "% non-aluminium elements", min: 0, max: 100, unit: "%" },
          { id: "preScrapPct", kind: "number", label: "% pre-consumer scrap", min: 0, max: 100, unit: "%" },
        ],
      },
    ],
  },

  {
    id: "SC",
    title: "Summary — Communication to declarant",
    sheetRef: "Sheet Summary_Communication",
    questions: [
      {
        id: "SC.1",
        kind: "fields",
        label: "Installation snapshot",
        description:
          "Rendered in English for the EU importer. Most fields prefill from Sheet A when persistence is wired up.",
        fields: [
          { id: "installationName", kind: "text", label: "Installation name (English)" },
          { id: "country", kind: "selectCountry", label: "Country" },
          { id: "unlocode", kind: "text", label: "UNLOCODE" },
          { id: "reportingStart", kind: "date", label: "Reporting period start" },
          { id: "reportingEnd", kind: "date", label: "Reporting period end" },
        ],
      },
      {
        id: "SC.2",
        kind: "fields",
        label: "Emissions by methodology (tCO₂e)",
        fields: [
          { id: "calc", kind: "number", label: "Calculation-based (excl. PFC)", min: 0 },
          { id: "pfc", kind: "number", label: "Total PFC", min: 0 },
          { id: "measured", kind: "number", label: "Measurement-based", min: 0 },
          { id: "other", kind: "number", label: "Other", min: 0 },
        ],
      },
      {
        id: "SC.3",
        kind: "fields",
        label: "Carbon price & additional information",
        fields: [
          { id: "instrument", kind: "select", label: "Carbon price instrument", options: carbonPriceType },
          { id: "additional", kind: "longtext", label: "Any additional information" },
        ],
      },
    ],
  },
];

// Re-export utility consts that the UI will reference.
export { aggregatedGoods, countries, cnCodesAluminium, yesNo };
