// First-run seed for the CBAM questionnaire (/report/cbam).
//
// Mirrors the structure of the EU's worked example workbook
// "6 CBAM SEE V2.1_Example Aluminium_final.xlsx" but populated with
// Hindalco-Renukoot operating numbers drawn from the MMD draft.
//
// Loaded by Questionnaire.tsx when localStorage[CBAM_ANSWERS_KEY] is absent.

import type { Answers, SavedAnswer } from "./storage";

const NOW = "2026-04-01T09:00:00.000Z";

function fields(values: Record<string, unknown>): SavedAnswer {
  return { values, rows: [], status: "in-progress", updatedAt: NOW };
}

function table(rows: Record<string, unknown>[]): SavedAnswer {
  return { values: {}, rows, status: "in-progress", updatedAt: NOW };
}

export const cbamSeed: Answers = {
  // ── A. Installation Data ───────────────────────────────────────────────
  "A.1": fields({
    start: "2025-04-01",
    end: "2026-03-31",
  }),
  "A.2": fields({
    nameLocal: "Hindalco Industries Limited — Renukoot Aluminium Complex",
    nameEn: "Hindalco Renukoot Aluminium Complex",
    street: "P.O. Renukoot, Tehsil Dudhi",
    economicActivity: "Aluminium production (NACE 24.42 equivalent)",
    postcode: "231217",
    poBox: "",
    city: "Sonbhadra",
    country: "India",
    unlocode: "INRNK",
    lat: 24.2167,
    lng: 83.0333,
    repName: "Head, Carbon & Sustainability — Renukoot",
    repEmail: "carbon.renukoot@adityabirla.com",
    repTel: "+91 5446 252 252",
  }),
  "A.3": fields({
    verifierCompany: "TÜV India Pvt. Ltd.",
    verifierStreet: "801, Raheja Plaza, LBS Marg",
    verifierCity: "Mumbai",
    verifierPostcode: "400086",
    verifierCountry: "India",
    verifierRepName: "Lead Verifier — Climate & Carbon",
    verifierRepEmail: "verifier.cbam@tuv-india.example",
    verifierRepTel: "+91 22 6647 7000",
    accreditationMS: "India",
    accreditationBody: "National Accreditation Board for Certification Bodies (NABCB)",
    accreditationRegNo: "NABCB-GHG-VV-008",
  }),
  "A.4": table([
    { good: "Unwrought aluminium", route1: "Primary (electrolytic) smelting", route2: null, pfcRelevant: "Yes" },
    { good: "Aluminium products", route1: "All production routes", route2: null, pfcRelevant: "No" },
  ]),
  "A.5": table([
    { good: "Unwrought aluminium", country: "India", route: "Primary (electrolytic) smelting" },
  ]),

  // ── B. Emissions ───────────────────────────────────────────────────────
  "B.1": table([
    {
      name: "Pre-baked carbon anodes (net consumption)",
      method: "Process emissions",
      ad: 143640,
      adUnit: "t",
      ncv: null,
      ef: 3.664,
      efUnit: "tCO2/t",
      cContent: 100,
      oxF: 100,
      convF: 100,
      biomass: 0,
    },
    {
      name: "Soda ash (Na₂CO₃) — GTC scrubbing",
      method: "Process emissions",
      ad: 1800,
      adUnit: "t",
      ncv: null,
      ef: 0.4149,
      efUnit: "tCO2/t",
      cContent: null,
      oxF: 100,
      convF: 100,
      biomass: 0,
    },
    {
      name: "Natural gas — cast-house holding furnaces",
      method: "Combustion",
      ad: 15000,
      adUnit: "1000Nm3",
      ncv: 0.0357,
      ef: 56.1,
      efUnit: "tCO2/TJ",
      cContent: null,
      oxF: 100,
      convF: 100,
      biomass: 0,
    },
    {
      name: "HSD — pot pre-heat / start-up",
      method: "Combustion",
      ad: 320,
      adUnit: "t",
      ncv: 43,
      ef: 74.1,
      efUnit: "tCO2/TJ",
      cContent: null,
      oxF: 100,
      convF: 100,
      biomass: 0,
    },
    {
      name: "Natural gas — rolling mill homogenising furnaces",
      method: "Combustion",
      ad: 6500,
      adUnit: "1000Nm3",
      ncv: 0.0357,
      ef: 56.1,
      efUnit: "tCO2/TJ",
      cContent: null,
      oxF: 100,
      convF: 100,
      biomass: 0,
    },
  ]),
  "B.2": table([
    {
      method: "Slope method",
      tech: "Centre Worked Pre-Bake (CWPB)",
      tAl: 342000,
      aeFreq: 0.1,
      aeDur: 1.2,
      overvoltage: null,
      slopeCF4: 0.143,
      slopeC2F6: null,
    },
  ]),
  "B.3": table([
    { name: null, ghg: null, conc: null, flow: null, hours: null },
  ]),

  // ── C. Installation-level emissions & energy ────────────────────────────
  "C.1": fields({
    cbamDirect: 1148.5,
    electricity: 28140,
    nonCbam: 0,
    rest: 0,
  }),
  "C.2": fields({
    co2: 557087,
    biomass: 0,
    n2o: 0,
    pfc: 52038,
    direct: 609125,
    indirect: 2218000,
  }),
  "C.3": fields({
    quality: "Mostly measurements & international standard factors",
    justification: null,
    verification: "Internal audits",
  }),

  // ── D. Production processes ────────────────────────────────────────────
  "D.1": table([
    {
      good: "Unwrought aluminium",
      output: 342000,
      directEm: 609125,
      heatProduced: 0,
      heatConsumed: 0,
      heatImported: 0,
      heatExported: 0,
      elecMWh: 5050000,
      elecSource: "D.4.1 — direct technical connection",
      elecEF: 0.94,
    },
    {
      good: "Aluminium products",
      output: 285000,
      directEm: 14600,
      heatProduced: 0,
      heatConsumed: 0,
      heatImported: 0,
      heatExported: 0,
      elecMWh: 168000,
      elecSource: "D.4.1 — direct technical connection",
      elecEF: 0.94,
    },
  ]),

  // ── E. Purchased precursors (none for PP1; PP2 uses internal Al only) ──
  "E.1": table([
    {
      good: "Unwrought aluminium",
      country: "India",
      mass: 285000,
      seeDirect: 1.78,
      seeIndirect: 13.88,
      elecPerT: 14.77,
      elecSource: "D.4.1 — direct technical connection",
      elecEF: 0.94,
      measurement: "Measured",
      justification: null,
    },
  ]),

  // ── F. Tools (CHP & carbon price) ──────────────────────────────────────
  "F.1": fields({
    hasCHP: "Yes",
    fuelIn: 4200,
    heatOut: 1850,
    elecOut: 540000,
    allocationHeat: 35,
  }),
  "F.2": fields({
    priceType: "None",
    rebateType: "None",
    currency: "EUR",
    pricePerTon: 0,
    amountDue: 0,
    notes:
      "PAT (ESCerts) and coal cess are not currently recognised by the EU as a CBAM carbon price; reported as zero pending guidance. CCTS price will be reported once the aluminium sector is brought into scope and a market price emerges.",
  }),

  // ── G. Notes ──────────────────────────────────────────────────────────
  "G.1": fields({
    notes:
      "Reporting period adopted is the Indian fiscal year (1 April – 31 March), aligned with Hindalco's statutory accounts and the BEE PAT cycle. Renusagar 742 MW captive plant is treated as 'directly technically connected' under §6.7.3 (auto-producer EF). PFC monitoring uses Method A (Slope) with the IAI default SEF for CWPB; an installation-specific SEF measurement campaign is planned per IAI best-practice every 3 years. Anode plant emissions are excluded from PP1 boundary (anodes are raw materials per IR Annex II §3.17). Off-site Hindalco refineries (Muri / Belagavi / Utkal) supply alumina treated as a zero-emissions raw material.",
  }),

  // ── SP. Summary — Products by CN code ─────────────────────────────────
  "SP.1": table([
    {
      cnCode: "7601 10 00 — Aluminium, not alloyed, unwrought",
      productName: "Unwrought primary aluminium ingots / sows",
      process: "P1",
      seeDirect: 1.78,
      seeIndirect: 13.88,
      seeTotal: 15.66,
      defaultsShare: 0,
      scrapPerT: 0,
      nonAlPct: 0,
      preScrapPct: 100,
    },
    {
      cnCode: "7604 29 10 — Bars and rods of aluminium alloys",
      productName: "Extruded bars & rods",
      process: "P2",
      seeDirect: 1.83,
      seeIndirect: 14.43,
      seeTotal: 16.26,
      defaultsShare: 0,
      scrapPerT: 0.05,
      nonAlPct: 1.5,
      preScrapPct: 100,
    },
    {
      cnCode: "7605 11 00 — Non-alloy aluminium wire, cross-section > 7 mm",
      productName: "EC-grade wire-rod",
      process: "P2",
      seeDirect: 1.81,
      seeIndirect: 14.21,
      seeTotal: 16.02,
      defaultsShare: 0,
      scrapPerT: 0.03,
      nonAlPct: 0.2,
      preScrapPct: 100,
    },
    {
      cnCode: "7606 12 93 — Alloy sheet, 3–<6 mm",
      productName: "Rolled alloy sheet",
      process: "P2",
      seeDirect: 1.85,
      seeIndirect: 14.55,
      seeTotal: 16.40,
      defaultsShare: 0,
      scrapPerT: 0.07,
      nonAlPct: 2.1,
      preScrapPct: 100,
    },
  ]),

  // ── SC. Summary — Communication to declarant ─────────────────────────
  "SC.1": fields({
    installationName: "Hindalco Renukoot Aluminium Complex",
    country: "India",
    unlocode: "INRNK",
    reportingStart: "2025-04-01",
    reportingEnd: "2026-03-31",
  }),
  "SC.2": fields({
    calc: 557087,
    pfc: 52038,
    measured: 0,
    other: 0,
  }),
  "SC.3": fields({
    instrument: "None",
    additional:
      "Installation operates under India's PAT scheme and pays coal cess on coal consumed at Renusagar / Cogen, neither of which is currently recognised as a CBAM carbon price.",
  }),
};
