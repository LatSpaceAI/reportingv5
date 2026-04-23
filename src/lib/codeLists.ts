export const monitoringApproach = ["Combustion", "Process emissions", "Mass Balance"] as const;

export const pfcMethod = ["Slope method", "Overvoltage method"] as const;

export const pfcTechnology = [
  "Centre Worked Pre-Bake (CWPB)",
  "Side Worked Pre-Bake (SWPB)",
  "Vertical Stud Söderberg (VSS)",
  "Horizontal Stud Söderberg (HSS)",
] as const;

export const cemsGhg = ["CO2", "N2O"] as const;

export const electricitySource = [
  "D.4(a) — from grid",
  "D.4(b) — contractual bilateral",
  "D.4.1 — direct technical connection",
  "D.4.2 — own generation within installation",
  "D.4.3.1 — CHP captive",
  "D.4.3.2 — other captive",
] as const;

export const dataQualityLevel = [
  "Mostly measurements & analyses",
  "Mostly measurements & national standard factors",
  "Mostly measurements & sector-specific standard factors",
  "Mostly measurements & international standard factors",
  "Mostly default values provided by the European Commission",
] as const;

export const dataQualityJustification = [
  "Unreasonable costs for more accurate monitoring",
  "Data gaps",
  "Other",
] as const;

export const dataVerification = [
  "Third-party verification",
  "Internal audits",
  "Four eyes principle",
  "None",
] as const;

export const carbonPriceType = [
  "None",
  "National Emissions Trading System",
  "Regional Emissions Trading System",
  "Carbon Tax",
  "Carbon Levy",
  "Carbon Fee",
  "Combination",
  "Other",
] as const;

export const rebateType = [
  "None",
  "Free allocation",
  "Financial compensation",
  "Tax deduction",
  "Combination",
  "Other",
] as const;

export const measurementOrDefault = ["Measured", "Default values", "Unknown"] as const;

export const yesNo = ["Yes", "No"] as const;

export const massOrGas = ["t", "1000Nm3"] as const;

export const efUnit = ["tCO2/TJ", "tCO2/t", "tCO2/1000Nm3"] as const;

export const aggregatedGoods = [
  "Cement clinker",
  "Cement",
  "Aluminous cement",
  "Calcined clays",
  "Pig iron",
  "Crude steel",
  "Iron or steel products",
  "Alloys (FeMn, FeCr, FeNi)",
  "Sintered Ore",
  "Direct reduced iron (DRI)",
  "Unwrought aluminium",
  "Aluminium products",
  "Hydrogen",
  "Ammonia",
  "Nitric acid",
  "Urea",
  "Mixed fertilisers",
  "Electricity",
] as const;

export const productionRoutesByGood: Record<string, readonly string[]> = {
  "Unwrought aluminium": [
    "Primary (electrolytic) smelting",
    "Secondary melting (recycling)",
    "Other production routes",
    "Unknown production routes",
  ],
  "Crude steel": [
    "Basic Oxygen Furnace (BOF)",
    "Electric Arc Furnace (EAF)",
    "Other production routes",
    "Unknown production routes",
  ],
  "Pig iron": ["Blast Furnace (BF)", "Other production routes", "Unknown production routes"],
  Hydrogen: [
    "Steam methane reforming",
    "Electrolysis",
    "Other production routes",
    "Unknown production routes",
  ],
  Ammonia: ["Haber-Bosch from natural gas", "Other production routes", "Unknown production routes"],
  "Cement clinker": [
    "Ordinary Portland clinker",
    "Other production routes",
    "Unknown production routes",
  ],
};

export const defaultRoutes = ["All production routes"] as const;

export const countries = [
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "RU", name: "Russia" },
  { code: "TR", name: "Türkiye" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "US", name: "United States" },
  { code: "BR", name: "Brazil" },
  { code: "KR", name: "Republic of Korea" },
  { code: "JP", name: "Japan" },
  { code: "VN", name: "Vietnam" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "GB", name: "United Kingdom" },
  { code: "NO", name: "Norway" },
  { code: "CH", name: "Switzerland" },
  { code: "IS", name: "Iceland" },
  { code: "MZ", name: "Mozambique" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "QA", name: "Qatar" },
] as const;

export const currencies = [
  "EUR",
  "USD",
  "INR",
  "CNY",
  "GBP",
  "JPY",
  "KRW",
  "RUB",
  "AED",
  "BRL",
  "ZAR",
  "TRY",
] as const;

export const cnCodesAluminium = [
  { code: "7601 10 00", name: "Aluminium, not alloyed, unwrought" },
  { code: "7601 20 20", name: "Unwrought aluminium alloys, slabs/billets" },
  { code: "7601 20 80", name: "Unwrought aluminium alloys (excl. slabs/billets)" },
  { code: "7603 10 00", name: "Aluminium powders, non-lamellar" },
  { code: "7604 10 10", name: "Bars, rods & profiles, non-alloy aluminium" },
  { code: "7604 29 10", name: "Bars and rods of aluminium alloys" },
  { code: "7604 29 90", name: "Solid profiles of aluminium alloys" },
  { code: "7605 11 00", name: "Non-alloy aluminium wire, cross-section > 7 mm" },
  { code: "7605 19 00", name: "Non-alloy aluminium wire, ≤ 7 mm" },
  { code: "7606 11 93", name: "Non-alloy sheet, 3–6 mm" },
  { code: "7606 12 92", name: "Alloy sheet, 0.2 mm–<3 mm" },
  { code: "7606 12 93", name: "Alloy sheet, 3–<6 mm" },
  { code: "7607 11 90", name: "Aluminium foil, 0.021–0.2 mm" },
  { code: "7608 20 89", name: "Tubes and pipes of aluminium alloys" },
  { code: "7610 90 90", name: "Structures and parts, aluminium, n.e.s." },
] as const;

export type CodeList = readonly string[] | readonly { code: string; name: string }[];
