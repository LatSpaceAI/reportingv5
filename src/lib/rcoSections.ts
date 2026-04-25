// RCO (Renewable Consumption Obligation) framework — DCs with CPP & Open Access.
//
// Structure mirrors the official MoP "RCO data Reporting Format for DCs who are
// OA consumers or captive users" workbook. The questionnaire combines Form A
// (target-year compliance) and Form D (assessment-year compliance window) into
// six sections (A–F). Computed fields replicate the Excel formulas so users
// see live values as they type raw inputs.

import type { ComputeContext, Section } from "./frameworkTypes";

// ----- Code lists derived from the workbook's hidden reference sheets -----

// "DC Sectors with Thresholds" sheet. Threshold (toe/year) shown in each label
// so users can confirm they are filing in the right sector.
export const dcSectors = [
  "Aluminum",
  "Automobile Assembly Unit",
  "Cement : Integrated Cement Unit",
  "Cement : Cement grinding Unit",
  "Ceramic",
  "Chlor_Alkali",
  "Chemical : Alkali Chemical (Soda Ash, Potassium Hydroxide)",
  "Chemical : Inorganic Chemicals",
  "Chemical : Organic Chemicals",
  "Chemical : Pesticides",
  "Chemical : Dyes and Pigments",
  "Chemical : Pharmaceuticals (Active Pharmaceutical Ingredient)",
  "Commercial Building or establishments : Hotel",
  "Commercial Building or establishments : Airports",
  "Copper",
  "Dairy",
  "Fertilizer",
  "Forging",
  "Foundry",
  "Glass",
  "Iron and Steel",
  "Pulp and Paper",
  "Petroleum Refinery",
  "Petrochemical units having gas crackers or naphtha crackers or both",
  "Petrochemical Manufacturing units : Fiber Intermediates",
  "Petrochemical Manufacturing units : Polymers",
  "Petrochemical Manufacturing units : Detergent intermediates",
  "Petrochemical Manufacturing units : Performance Plastics",
  "Petrochemical Manufacturing units : Other petrochemical products",
  "Petrochemical Manufacturing units : Synthetic rubbers",
  "Petrochemical Manufacturing units : Aromatics",
  "Port Trust",
  "Railway : All Zonal Railways (Traction)",
  "Railway : Workshops",
  "Railway : 8 Production factories of Railways (ICF, RCF, CLW, BLW, PLW, RW, MCF, RWP)",
  "Refractories",
  "Sugar",
  "Textiles",
  "Tyre manufacturer",
  "Zinc",
] as const;

// Type of obligation(s) the DC carries. From "Supporting Sheet" col N.
export const obligationTypes = [
  "Distribution licensee (DISCOM)",
  "Open Access (OA)",
  "Captive Power Plant (CPP)",
] as const;

// Compliance period — quarter or annual. From StateUTs sheet col F.
export const compliancePeriods = [
  "Q1 (01 April – 30 June)",
  "Q2 (01 July – 30 September)",
  "Q3 (01 October – 31 December)",
  "Q4 (01 January – 31 March)",
  "Annual",
] as const;

// Target FYs published in the MoP RCO trajectory (S.O. 4617(E), 20-Oct-2023).
export const targetYears = [
  "2024-25",
  "2025-26",
  "2026-27",
  "2027-28",
  "2028-29",
  "2029-30",
] as const;

// State / UT — used to derive the state category (Normal / Hilly / NER) when
// the RCO trajectory %% is auto-populated. From "StateUTs" sheet.
export const stateUTs = [
  { name: "Andaman and Nicobar Island", category: "Normal" },
  { name: "Andhra Pradesh", category: "Normal" },
  { name: "Arunachal Pradesh", category: "NER" },
  { name: "Assam", category: "NER" },
  { name: "Bihar", category: "Normal" },
  { name: "Chandigarh", category: "Normal" },
  { name: "Chhattisgarh", category: "Normal" },
  { name: "Daman & Diu and Dadra & Nagar Haveli", category: "Normal" },
  { name: "Delhi", category: "Normal" },
  { name: "Goa", category: "Normal" },
  { name: "Gujarat", category: "Normal" },
  { name: "Haryana", category: "Normal" },
  { name: "Himachal Pradesh", category: "Hilly" },
  { name: "Jammu & Kashmir", category: "Hilly" },
  { name: "Jharkhand", category: "Normal" },
  { name: "Karnataka", category: "Normal" },
  { name: "Kerala", category: "Normal" },
  { name: "Ladakh", category: "Hilly" },
  { name: "Lakshadweep", category: "Normal" },
  { name: "Madhya Pradesh", category: "Normal" },
  { name: "Maharashtra", category: "Normal" },
  { name: "Manipur", category: "NER" },
  { name: "Meghalaya", category: "NER" },
  { name: "Mizoram", category: "NER" },
  { name: "Nagaland", category: "NER" },
  { name: "Odisha", category: "Normal" },
  { name: "Puducherry", category: "Normal" },
  { name: "Punjab", category: "Normal" },
  { name: "Rajasthan", category: "Normal" },
  { name: "Sikkim", category: "NER" },
  { name: "Tamil Nadu", category: "Normal" },
  { name: "Telangana", category: "Normal" },
  { name: "Tripura", category: "NER" },
  { name: "Uttar Pradesh", category: "Normal" },
  { name: "Uttarakhand", category: "Hilly" },
  { name: "West Bengal", category: "Normal" },
] as const;

export const stateOptions = stateUTs.map((s) => `${s.name} (${s.category})`);

// MoP RCO target %% (Total RE) by state-category × FY. Sourced from the
// "Targets" sheet H column. NER and Hilly share the same totals as Normal in
// the published trajectory (only DRE component differs).
export const rcoTargetByYear: Record<string, number> = {
  "2024-25": 0.2991,
  "2025-26": 0.3301,
  "2026-27": 0.3595,
  "2027-28": 0.3881,
  "2028-29": 0.4136,
  "2029-30": 0.4333,
};

// ----- Compute helpers (mirroring Excel formulas in FormA_CPP_OA) -----

const g = (ctx: ComputeContext, qid: string, fid: string) => ctx.num(ctx.get(qid, fid));

// AT = Own electricity generation, net of APC (B.1 row 12)
//    AT = (Anon-cogen) − (Acogen / 2) − A** − A!!! − APCTotal
//    where Anon-cogen = A − A** − A!!! + A!  (per row 17)
//    Inputs collected in B.1: aGen (A), whr (A**), wer (A!!!), aux (A!),
//    cogen (Acogen), apc (APCTotal)
const computeAT = (ctx: ComputeContext): number => {
  const aGen = g(ctx, "B.1", "aGen");
  const whr = g(ctx, "B.1", "whr");
  const wer = g(ctx, "B.1", "wer");
  const aux = g(ctx, "B.1", "aux");
  const cogen = g(ctx, "B.1", "cogen");
  const apc = g(ctx, "B.1", "apc");
  const anonCogen = aGen - whr - wer + aux;
  return anonCogen - cogen / 2 - whr - apc;
};

const computeAnonCogen = (ctx: ComputeContext): number => {
  const aGen = g(ctx, "B.1", "aGen");
  const whr = g(ctx, "B.1", "whr");
  const wer = g(ctx, "B.1", "wer");
  const aux = g(ctx, "B.1", "aux");
  return aGen - whr - wer + aux;
};

// CT = Open-access purchase + banking drawl
const computeCT = (ctx: ComputeContext): number =>
  g(ctx, "B.2", "oaFossil") + g(ctx, "B.2", "bankDrawl");

// FT = OA sales + banking storage
const computeFT = (ctx: ComputeContext): number =>
  g(ctx, "B.3", "oaSales") + g(ctx, "B.3", "bankStored");

// IT = Net fossil energy drawn from ESS = (I − J) × (1 − ITL)
const computeIT = (ctx: ComputeContext): number => {
  const i = g(ctx, "B.4", "essOut");
  const j = g(ctx, "B.4", "essIn");
  const itl = g(ctx, "B.4", "essLoss") / 100; // user enters %
  return (i - j) * (1 - itl);
};

// K = AT + CT − FT + Y' − (aluminium smelter / 2)
//    (Aluminium smelter exemption is only half-counted, per workbook formula
//     "E12 + E20 − E24 + E53 − E31/2".)
const computeK = (ctx: ComputeContext): number => {
  const at = computeAT(ctx);
  const ct = computeCT(ctx);
  const ft = computeFT(ctx);
  const yPrime = computeYPrime(ctx);
  const smelter = g(ctx, "B.5", "smelterMU");
  return at + ct - ft + yPrime - smelter / 2;
};

// Etotal = A** + EDISCOM + K
const computeEtotal = (ctx: ComputeContext): number =>
  g(ctx, "B.1", "whr") + g(ctx, "B.2", "discomBuy") + computeK(ctx);

// T = RE own gen + ex-bus from RE-fuel + DiscomRE + Banking-drawl-RE
const computeT = (ctx: ComputeContext): number =>
  g(ctx, "C.1", "reGen") + g(ctx, "C.1", "reExBus") + g(ctx, "C.1", "discomRE") + g(ctx, "C.1", "reBankDrawl");

// I' = RE sales + RE banking storage
const computeIPrime = (ctx: ComputeContext): number =>
  g(ctx, "C.2", "reSales") + g(ctx, "C.2", "reBankStored");

// Q' = (R' − S') × (1 − QL)
const computeQPrime = (ctx: ComputeContext): number => {
  const r = g(ctx, "C.3", "reEssOut");
  const s = g(ctx, "C.3", "reEssIn");
  const qL = g(ctx, "C.3", "reEssLoss") / 100;
  return (r - s) * (1 - qL);
};

// Y' = T − I' + W' + X'   (Q' is intentionally excluded — matches Excel E36 −
// E44 + E51 + E52, which omits ESS net for renewables)
const computeYPrime = (ctx: ComputeContext): number =>
  computeT(ctx) - computeIPrime(ctx) + g(ctx, "C.4", "ghEnergy") + g(ctx, "C.4", "ammoniaEnergy");

// T' (target year RECs) = (U' + V') / 1000
const computeTargetRECs = (ctx: ComputeContext): number =>
  (g(ctx, "C.5", "recsPurchased") + g(ctx, "C.5", "recsRetained")) / 1000;

// Z' — RCO target %% looked up from year selected in A.1
const computeZPrime = (ctx: ComputeContext): number => {
  const fy = String(ctx.get("A.1", "targetYear") ?? "");
  return rcoTargetByYear[fy] ?? 0;
};

// A'' = K × Z'
const computeRCOTarget = (ctx: ComputeContext): number => computeK(ctx) * computeZPrime(ctx);

// D'' (target year) = Y' + T'
const computeComplianceTY = (ctx: ComputeContext): number =>
  computeYPrime(ctx) + computeTargetRECs(ctx);

// B'' (target year) = D'' / K
const computeCompliancePctTY = (ctx: ComputeContext): number => {
  const k = computeK(ctx);
  return k === 0 ? 0 : computeComplianceTY(ctx) / k;
};

// C'' (target year) = D'' − A''
const computeSurplusTY = (ctx: ComputeContext): number =>
  computeComplianceTY(ctx) - computeRCOTarget(ctx);

// E'' (target year) = B'' − Z'
const computeSurplusPctTY = (ctx: ComputeContext): number =>
  computeCompliancePctTY(ctx) - computeZPrime(ctx);

// Assessment-year transactions (FormD section C):
//   T' (assessment) = (U' + V') / 1000
const computeAssessmentRECs = (ctx: ComputeContext): number =>
  (g(ctx, "E.1", "recsPurchased") + g(ctx, "E.1", "recsRetained")) / 1000;
//   Buyouts (MU) = buyouts purchased / 1000
const computeBuyouts = (ctx: ComputeContext): number => g(ctx, "E.2", "buyoutsPurchased") / 1000;
const computeTotalCompliance = (ctx: ComputeContext): number =>
  computeAssessmentRECs(ctx) + computeBuyouts(ctx);

// Final compliance (FormD section D) re-uses target-year D'' and adds the
// assessment-year transactions on top: D''_final = (Y' + T') + RECs + Buyouts
const computeFinalCompliance = (ctx: ComputeContext): number =>
  computeComplianceTY(ctx) + computeTotalCompliance(ctx);
const computeFinalCompliancePct = (ctx: ComputeContext): number => {
  const k = computeK(ctx);
  return k === 0 ? 0 : computeFinalCompliance(ctx) / k;
};
const computeFinalSurplus = (ctx: ComputeContext): number =>
  computeFinalCompliance(ctx) - computeRCOTarget(ctx);
const computeFinalSurplusPct = (ctx: ComputeContext): number =>
  computeFinalCompliancePct(ctx) - computeZPrime(ctx);

// % display — convert decimal to percentage
const asPct = (fn: (ctx: ComputeContext) => number) => (ctx: ComputeContext) => fn(ctx) * 100;

// ----- Sections -----

export const sections: Section[] = [
  {
    id: "A",
    title: "A. Basic Information",
    sheetRef: 'FormA_CPP_OA — Section A',
    questions: [
      {
        id: "A.1",
        kind: "fields",
        label: "Designated Consumer & Reporting Period",
        description:
          "Identity of the obligated DC and the financial year / quarter for which this RCO compliance return is being filed.",
        fields: [
          { id: "dcName", kind: "text", label: "Name of Designated Consumer", required: true },
          {
            id: "sector",
            kind: "select",
            label: "Energy-intensive sector",
            options: dcSectors,
            required: true,
          },
          { id: "regNo", kind: "text", label: "Registration No. of the DC", required: true },
          { id: "stateUT", kind: "select", label: "State / UT (drives target % category)", options: stateOptions },
          {
            id: "obligationType",
            kind: "select",
            label: "Type of obligation(s)",
            options: obligationTypes,
            required: true,
            help: "DCs may carry multiple obligations; pick the predominant one for this filing.",
          },
          {
            id: "targetYear",
            kind: "select",
            label: "Target Year (FY)",
            options: targetYears,
            required: true,
            help: "Selecting the FY auto-populates the RCO % from the MoP trajectory.",
          },
          {
            id: "compliancePeriod",
            kind: "select",
            label: "Compliance Period",
            options: compliancePeriods,
            required: true,
          },
        ],
      },
    ],
  },

  {
    id: "B",
    title: "B. Gross Total Energy Consumption (Fossil + Non-fossil)",
    sheetRef: 'FormA_CPP_OA — Section B',
    questions: [
      {
        id: "B.1",
        kind: "fields",
        label: "Own electricity generation (CPP) — net of APC",
        description:
          "Break down the captive power plant's net generation. WHR (waste-heat recovery) and WER (waste-energy recovery) are reported separately because they are exempt from RCO. Auxiliary firing of fossil fuels in WHRBs is added back via the A! input. All figures are in Million Units (MU).",
        fields: [
          { id: "aGen", kind: "number", label: "Total fossil-based generation (A)", min: 0, unit: "MU", help: "All fossil-based electricity generated in the CPP, including from WHR." },
          { id: "whr", kind: "number", label: "Fossil from WHR (A**)", min: 0, unit: "MU", help: "Non-RE energy from waste-heat recovery — exempted from RCO." },
          { id: "wer", kind: "number", label: "Fossil from WER (A!!!)", min: 0, unit: "MU", help: "Waste-energy-recovery generation from industrial processes." },
          { id: "aux", kind: "number", label: "Auxiliary firing in WHR/WER (A!)", min: 0, unit: "MU", help: "Ex-bus electricity from auxiliary firing of fossil fuels in WHRBs." },
          {
            id: "anonCogen",
            kind: "computed",
            label: "Balance fossil generation other than WHR/WER (Anon-cogen)",
            unit: "MU",
            formula: "Anon-cogen = A − A** − A!!! + A!",
            compute: computeAnonCogen,
          },
          { id: "cogen", kind: "number", label: "Co-generation component of balance fossil (Acogen)", min: 0, unit: "MU" },
          { id: "apc", kind: "number", label: "APC apportioned (APCTotal)", min: 0, unit: "MU", help: "Auxiliary power consumption apportioned per workbook footnote (3)." },
          {
            id: "AT",
            kind: "computed",
            label: "Sub-total AT",
            unit: "MU",
            formula: "AT = Anon-cogen − Acogen/2 − A** − APCTotal",
            compute: computeAT,
          },
        ],
      },
      {
        id: "B.2",
        kind: "fields",
        label: "Open-access purchases & banking drawl",
        description:
          "Fossil-based electricity bought through PPA / bilateral / power exchanges, plus any banking drawl during the period. Discom purchases are reported separately and are not part of CT.",
        fields: [
          { id: "oaFossil", kind: "number", label: "Fossil energy via PPA / Bilateral / Exchange (C)", min: 0, unit: "MU" },
          { id: "bankDrawl", kind: "number", label: "Banking drawl of electricity (D)", min: 0, unit: "MU" },
          {
            id: "CT",
            kind: "computed",
            label: "Sub-total CT",
            unit: "MU",
            formula: "CT = C + D",
            compute: computeCT,
          },
          { id: "discomBuy", kind: "number", label: "Electricity purchased from Discom (EDISCOM)", min: 0, unit: "MU", help: "Excluded from RCO calculation — reported for the energy balance only." },
        ],
      },
      {
        id: "B.3",
        kind: "fields",
        label: "Electricity sales & banking storage",
        fields: [
          { id: "oaSales", kind: "number", label: "Fossil-based electricity sales (F)", min: 0, unit: "MU" },
          { id: "bankStored", kind: "number", label: "Banking storage of electricity (G)", min: 0, unit: "MU" },
          {
            id: "FT",
            kind: "computed",
            label: "Sub-total FT",
            unit: "MU",
            formula: "FT = F + G",
            compute: computeFT,
          },
        ],
      },
      {
        id: "B.4",
        kind: "fields",
        label: "Net fossil energy drawn from energy-storage system (ESS)",
        description: "Storage interactions are netted with ESS losses applied per Operational Procedures.",
        fields: [
          { id: "essOut", kind: "number", label: "Total energy drawn from ESS (I)", min: 0, unit: "MU" },
          { id: "essIn", kind: "number", label: "Total fossil + nuclear energy stored (J)", min: 0, unit: "MU" },
          { id: "essLoss", kind: "number", label: "Storage losses (ITL)", min: 0, max: 100, unit: "%" },
          {
            id: "IT",
            kind: "computed",
            label: "Sub-total IT",
            unit: "MU",
            formula: "IT = (I − J) × (1 − ITL)",
            compute: computeIT,
          },
        ],
      },
      {
        id: "B.5",
        kind: "fields",
        label: "Aluminium smelter & gross consumption",
        description:
          "Smelter consumption is half-credited towards the RCO base K (per workbook formula E32 = E12 + E20 − E24 + E53 − E31/2).",
        fields: [
          { id: "smelterMU", kind: "number", label: "Electricity consumption at Aluminium Smelter", min: 0, unit: "MU", help: "Only applicable to aluminium-sector DCs." },
          {
            id: "K",
            kind: "computed",
            label: "Gross total electricity consumption on which RCO applies (K)",
            unit: "MU",
            formula: "K = AT + CT − FT + Y' − (smelter / 2)",
            compute: computeK,
          },
          {
            id: "Etotal",
            kind: "computed",
            label: "Gross total energy consumption (Etotal)",
            unit: "MU",
            formula: "Etotal = A** + EDISCOM + K",
            compute: computeEtotal,
          },
        ],
      },
    ],
  },

  {
    id: "C",
    title: "C. Renewable Electricity Consumption",
    sheetRef: 'FormA_CPP_OA — Section C',
    questions: [
      {
        id: "C.1",
        kind: "fields",
        label: "RE own generation, purchase & banking drawl",
        description:
          "Definitions of eligible RE sources (Wind, Hydro, DRE, Others) follow MoP S.O. 4617(E) dtd 20-Oct-2023.",
        fields: [
          { id: "reGen", kind: "number", label: "All-RE generation & purchase except Discom RE (U)", min: 0, unit: "MU" },
          { id: "dreMetered", kind: "number", label: "DRE metered (X)", min: 0, unit: "MU" },
          { id: "dreUnmetered", kind: "number", label: "DRE unmetered (Y)", min: 0, unit: "MU" },
          { id: "reExBus", kind: "number", label: "Ex-bus from RE-fuel combustion / co-firing (Er(ex-bus))", min: 0, unit: "MU" },
          { id: "discomRE", kind: "number", label: "RE purchase from Discom (Green OA)", min: 0, unit: "MU", help: "Counted only when requisitioned at price premium under Green OA Rules." },
          { id: "reBankDrawl", kind: "number", label: "Banking drawl of RE (B')", min: 0, unit: "MU" },
          {
            id: "T",
            kind: "computed",
            label: "Sub-total T",
            unit: "MU",
            formula: "T = U + Er(ex-bus) + DiscomRE + B'",
            compute: computeT,
          },
        ],
      },
      {
        id: "C.2",
        kind: "fields",
        label: "RE sales & banking storage",
        fields: [
          { id: "reSales", kind: "number", label: "Sale of all RE (J')", min: 0, unit: "MU" },
          { id: "reBankStored", kind: "number", label: "Banking storage of RE (L')", min: 0, unit: "MU" },
          {
            id: "IPrime",
            kind: "computed",
            label: "Sub-total I'",
            unit: "MU",
            formula: "I' = J' + L'",
            compute: computeIPrime,
          },
        ],
      },
      {
        id: "C.3",
        kind: "fields",
        label: "Net RE drawn from ESS",
        fields: [
          { id: "reEssOut", kind: "number", label: "Total energy drawn from ESS (R')", min: 0, unit: "MU" },
          { id: "reEssIn", kind: "number", label: "Total RE stored into ESS (S')", min: 0, unit: "MU" },
          { id: "reEssLoss", kind: "number", label: "Storage losses (QL)", min: 0, max: 100, unit: "%" },
          {
            id: "QPrime",
            kind: "computed",
            label: "Sub-total Q'",
            unit: "MU",
            formula: "Q' = (R' − S') × (1 − QL)",
            compute: computeQPrime,
          },
        ],
      },
      {
        id: "C.4",
        kind: "fields",
        label: "Green Hydrogen & Green Ammonia (energy equivalent)",
        description:
          "Per Green Energy Open Access Rules. Report metered consumption where available, else evaluate per the prescribed methodology.",
        fields: [
          { id: "ghEnergy", kind: "number", label: "Energy equivalent of GH2 consumed (W')", min: 0, unit: "MU" },
          { id: "ammoniaEnergy", kind: "number", label: "Energy equivalent of Green Ammonia consumed (X')", min: 0, unit: "MU" },
          {
            id: "YPrime",
            kind: "computed",
            label: "Gross non-fossil electricity consumption (Y')",
            unit: "MU",
            formula: "Y' = T − I' + W' + X'",
            compute: computeYPrime,
          },
        ],
      },
      {
        id: "C.5",
        kind: "fields",
        label: "RECs (Target-year compliance period only)",
        description:
          "Make an entry here only for RECs purchased or self-retained during the target-year compliance period. RECs/buyouts purchased during the assessment-year compliance window go in Section E.",
        fields: [
          { id: "recsPurchased", kind: "number", label: "Number of RECs purchased (U')", min: 0, unit: "Certificates" },
          { id: "recsRetained", kind: "number", label: "Number of RECs self-retained (V')", min: 0, unit: "Certificates" },
          {
            id: "TPrime",
            kind: "computed",
            label: "Target-year RECs (T')",
            unit: "MU",
            formula: "T' = (U' + V') / 1000",
            compute: computeTargetRECs,
          },
        ],
      },
    ],
  },

  {
    id: "D",
    title: "D. RCO Compliance Summary — Target Year",
    sheetRef: 'FormA_CPP_OA — Section D',
    questions: [
      {
        id: "D.1",
        kind: "fields",
        label: "Target-year RCO compliance",
        description:
          "All values are derived from Sections B and C and from the MoP RCO trajectory (auto-populated when the Target Year is selected in A.1).",
        fields: [
          {
            id: "ZPrime",
            kind: "computed",
            label: "RCO % notified by MoP (Z')",
            unit: "%",
            formula: "Z' = INDEX(Targets, FY)",
            compute: asPct(computeZPrime),
          },
          {
            id: "ADoublePrime",
            kind: "computed",
            label: "RCO Target (A'')",
            unit: "MU",
            formula: "A'' = K × Z'",
            compute: computeRCOTarget,
          },
          {
            id: "DDoublePrime",
            kind: "computed",
            label: "Compliance (D'')",
            unit: "MU",
            formula: "D'' = Y' + T'",
            compute: computeComplianceTY,
          },
          {
            id: "BDoublePrime",
            kind: "computed",
            label: "Compliance % (B'')",
            unit: "%",
            formula: "B'' = D'' / K",
            compute: asPct(computeCompliancePctTY),
          },
          {
            id: "CDoublePrime",
            kind: "computed",
            label: "Surplus / Deficit (C'')",
            unit: "MU",
            formula: "C'' = D'' − A''",
            compute: computeSurplusTY,
            help: "Positive = surplus, negative = deficit.",
          },
          {
            id: "EDoublePrime",
            kind: "computed",
            label: "Surplus / Deficit % (E'')",
            unit: "%",
            formula: "E'' = B'' − Z'",
            compute: asPct(computeSurplusPctTY),
          },
        ],
      },
    ],
  },

  {
    id: "E",
    title: "E. Compliance Transactions — Assessment-Year Window",
    sheetRef: 'FormD_CPP_OA — Section C',
    questions: [
      {
        id: "E.1",
        kind: "fields",
        label: "RECs purchased / self-retained during the assessment-year window",
        description:
          "Make an entry here only for RECs transacted during the assessment-year compliance window (i.e. after the target-year period closes but within the regulatory true-up window).",
        fields: [
          { id: "recsPurchased", kind: "number", label: "Number of RECs purchased (U')", min: 0, unit: "Certificates" },
          { id: "recsRetained", kind: "number", label: "Number of RECs self-retained (V')", min: 0, unit: "Certificates" },
          {
            id: "TPrime",
            kind: "computed",
            label: "Assessment-year RECs (T')",
            unit: "MU",
            formula: "T' = (U' + V') / 1000",
            compute: computeAssessmentRECs,
          },
        ],
      },
      {
        id: "E.2",
        kind: "fields",
        label: "Buyouts during the assessment-year window",
        fields: [
          { id: "buyoutsPurchased", kind: "number", label: "Number of buyout certificates purchased", min: 0, unit: "Certificates" },
          {
            id: "buyoutsMU",
            kind: "computed",
            label: "Buyouts (MU)",
            unit: "MU",
            formula: "Buyouts = certs / 1000",
            compute: computeBuyouts,
          },
          {
            id: "totalCompliance",
            kind: "computed",
            label: "Total compliance via RECs + Buyouts",
            unit: "MU",
            formula: "= Assessment RECs + Buyouts",
            compute: computeTotalCompliance,
          },
        ],
      },
    ],
  },

  {
    id: "F",
    title: "F. Final RCO Compliance — Assessment-Year Window",
    sheetRef: 'FormD_CPP_OA — Section D',
    questions: [
      {
        id: "F.1",
        kind: "fields",
        label: "Final compliance after assessment-year transactions",
        description:
          "Recomputes target-year compliance with the RECs and buyouts purchased during the assessment-year window added in.",
        fields: [
          {
            id: "ZPrime",
            kind: "computed",
            label: "RCO % notified by MoP (Z')",
            unit: "%",
            formula: "Z' = INDEX(Targets, FY)",
            compute: asPct(computeZPrime),
          },
          {
            id: "ADoublePrime",
            kind: "computed",
            label: "RCO Target (A'')",
            unit: "MU",
            formula: "A'' = K × Z'",
            compute: computeRCOTarget,
          },
          {
            id: "DDoublePrime",
            kind: "computed",
            label: "Final Compliance (D''_final)",
            unit: "MU",
            formula: "D''_final = Y' + T' + Assessment RECs + Buyouts",
            compute: computeFinalCompliance,
          },
          {
            id: "BDoublePrime",
            kind: "computed",
            label: "Final Compliance % (B''_final)",
            unit: "%",
            formula: "B''_final = D''_final / K",
            compute: asPct(computeFinalCompliancePct),
          },
          {
            id: "CDoublePrime",
            kind: "computed",
            label: "Final Surplus / Deficit (C''_final)",
            unit: "MU",
            formula: "C''_final = D''_final − A''",
            compute: computeFinalSurplus,
          },
          {
            id: "EDoublePrime",
            kind: "computed",
            label: "Final Surplus / Deficit % (E''_final)",
            unit: "%",
            formula: "E''_final = B''_final − Z'",
            compute: asPct(computeFinalSurplusPct),
          },
        ],
      },
    ],
  },
];
