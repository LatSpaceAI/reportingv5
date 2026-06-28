// Logbook demo data — ported from hindalco's MSW seed + cement-parameters util.
// Self-contained: the original pulled these from a mock API and a 23KB JSON of
// cement/aluminium parameters; here the resolved values are baked in (deterministic,
// no Math.random) so plato-v1 needs no backend. Only the plant-manager's site
// (site-1) entries are included, matching hindalco's /plant/logbook view.

export type EntryCategory =
  | "Production"
  | "Energy"
  | "Fuel"
  | "RawMaterial"
  | "Emissions"
  | "Other";

export type EntryStatus =
  | "Draft"
  | "Submitted"
  | "UnderReview"
  | "Approved"
  | "Rejected";

export interface LogbookEntry {
  id: string;
  siteId: string;
  siteName: string;
  entryDate: string;
  period: string;
  category: EntryCategory;
  submittedBy: string;
  submittedAt: string;
  status: EntryStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  anomalyCount?: number;
  notes?: string;
}

export interface Parameter {
  name: string;
  unit: string;
  value: number;
  tag?: string;
}

export const logbookEntries: LogbookEntry[] = [
  {
    "id": "logbook-1",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-09-30",
    "period": "Sep 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-05T09:30:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-05T14:20:00Z",
    "anomalyCount": 1,
    "notes": "Regular monthly production data. All meters calibrated."
  },
  {
    "id": "logbook-2",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-08-31",
    "period": "Aug 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-05T10:15:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-05T14:25:00Z",
    "anomalyCount": 1,
    "notes": "August production data verified."
  },
  {
    "id": "logbook-3",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-07-31",
    "period": "Jul 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-05T11:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-05T15:30:00Z",
    "notes": "July production within target parameters."
  },
  {
    "id": "logbook-4",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-06-30",
    "period": "Jun 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-05T09:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-05T14:00:00Z",
    "notes": "June production data."
  },
  {
    "id": "logbook-5",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-05-31",
    "period": "May 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-04T09:30:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-04T16:00:00Z",
    "notes": "May production on track."
  },
  {
    "id": "logbook-6",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-04-30",
    "period": "Apr 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-04T10:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-04T15:30:00Z",
    "notes": "April production data verified."
  },
  {
    "id": "logbook-7",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-03-31",
    "period": "Mar 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-04T11:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-04T16:30:00Z",
    "notes": "Q4 FY24-25 closing production data."
  },
  {
    "id": "logbook-8",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-02-28",
    "period": "Feb 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-03T09:30:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-03T14:00:00Z",
    "notes": "February production data."
  },
  {
    "id": "logbook-9",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-01-31",
    "period": "Jan 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-03T10:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-03T15:00:00Z",
    "notes": "January production data verified."
  },
  {
    "id": "logbook-10",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2024-12-31",
    "period": "Dec 2024",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-02T09:30:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-02T14:30:00Z",
    "notes": "December production - year end data."
  },
  {
    "id": "logbook-11",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2024-11-30",
    "period": "Nov 2024",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-02T10:00:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-02T15:00:00Z",
    "notes": "November production data."
  },
  {
    "id": "logbook-12",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-10-31",
    "period": "Oct 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-06T09:30:00Z",
    "status": "Submitted",
    "anomalyCount": 0,
    "notes": "October 2025 production data awaiting review."
  },
  {
    "id": "logbook-13",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2025-11-30",
    "period": "Nov 2025",
    "category": "Production",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-07T09:00:00Z",
    "status": "Submitted",
    "anomalyCount": 0,
    "notes": "November 2025 production data submitted for approval."
  },
  {
    "id": "logbook-14",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2024-10-31",
    "period": "Oct 2024",
    "category": "Energy",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-01T10:15:00Z",
    "status": "Rejected",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-01T14:25:00Z",
    "rejectionReason": "Energy consumption figures don't match production output. Please verify meter readings.",
    "anomalyCount": 2,
    "notes": "WHRS plant operating at optimal capacity. Solar generation above average."
  },
  {
    "id": "logbook-15",
    "siteId": "site-1",
    "siteName": "Hindalco Renukoot Unit",
    "entryDate": "2024-10-31",
    "period": "Oct 2024",
    "category": "Fuel",
    "submittedBy": "plant_mgr",
    "submittedAt": "2026-01-01T11:30:00Z",
    "status": "Approved",
    "reviewedBy": "plant_mgr",
    "reviewedAt": "2026-01-01T16:00:00Z",
    "anomalyCount": 0,
    "notes": "Monthly fuel consumption data. Coal quality improved from new supplier."
  }
];

// The full 106-parameter set shown when a row is expanded. hindalco renders all
// parameters regardless of category, so this single list backs every row.
const allParameters: Parameter[] = [
  {
    "name": "Production Capacity (Clinker)",
    "unit": "Tonne/year",
    "value": 6500000
  },
  {
    "name": "Production Capacity (Cement)",
    "unit": "Tonne/year",
    "value": 9000000
  },
  {
    "name": "Total Clinker Production (Input)",
    "unit": "Tonne",
    "value": 5453250
  },
  {
    "name": "Opening Clinker Stock",
    "unit": "Tonne",
    "value": 155806.311
  },
  {
    "name": "Closing Clinker Stock",
    "unit": "Tonne",
    "value": 163194.191
  },
  {
    "name": "Opening Cement Stock",
    "unit": "Tonne",
    "value": 61461.31
  },
  {
    "name": "Closing Cement Stock",
    "unit": "Tonne",
    "value": 37189.02
  },
  {
    "name": "Cement Production",
    "unit": "Tonne",
    "value": 2375778.79
  },
  {
    "name": "Quantity of Gypsum Used",
    "unit": "Tonne",
    "value": 42896.05
  },
  {
    "name": "Quantity of Fly Ash Used",
    "unit": "Tonne",
    "value": 130401.14
  },
  {
    "name": "Quantity of Slag Used",
    "unit": "Tonne",
    "value": 39115
  },
  {
    "name": "Quantity of Limestone Used",
    "unit": "Tonne",
    "value": 118789.45
  },
  {
    "name": "Quantity of Clay Used",
    "unit": "Tonne",
    "value": 1337614.71
  },
  {
    "name": "Other Additives Used",
    "unit": "Tonne",
    "value": 75.25
  },
  {
    "name": "Fraction of Lime in Clinker (CaO)",
    "unit": "Fraction",
    "value": 0.641
  },
  {
    "name": "Fraction of MgO in Clinker",
    "unit": "Fraction",
    "value": 0.01
  },
  {
    "name": "Raw Material Net Factor (Raw Meal to Clinker)",
    "unit": "Factor",
    "value": 1.55
  },
  {
    "name": "Organic Carbon Content of Raw Meal (Input)",
    "unit": "Fraction",
    "value": 0.002
  },
  {
    "name": "Non-carbonate Raw Material Consumed (Input)",
    "unit": "Tonne",
    "value": 0
  },
  {
    "name": "CaO Content (Non-carbonate Source)",
    "unit": "Fraction",
    "value": 0
  },
  {
    "name": "MgO Content (Non-carbonate Source)",
    "unit": "Fraction",
    "value": 0
  },
  {
    "name": "Ca/Mg-Silicate Source Raw Material Consumed",
    "unit": "Tonne",
    "value": 0
  },
  {
    "name": "Ca Content of Ca-Silicate Raw Materials",
    "unit": "Fraction",
    "value": 0
  },
  {
    "name": "Mg Content of Mg-Silicate Raw Materials",
    "unit": "Fraction",
    "value": 0
  },
  {
    "name": "Bypass Dust Leaving System (Input)",
    "unit": "Tonne",
    "value": 0
  },
  {
    "name": "CKD Leaving System (Input)",
    "unit": "Tonne",
    "value": 0
  },
  {
    "name": "CKD Calcination Rate (Input)",
    "unit": "Fraction",
    "value": 0
  },
  {
    "name": "CaCO3 Used in Process/FBC Boiler",
    "unit": "Tonne",
    "value": 6198
  },
  {
    "name": "Dolomite Used in Process/FBC Boiler",
    "unit": "Tonne",
    "value": 10149
  },
  {
    "name": "Clinker Exported",
    "unit": "Tonne",
    "value": 7387.88
  },
  {
    "name": "Clinker Imported",
    "unit": "Tonne",
    "value": 7987
  },
  {
    "name": "Kiln - Clinker Production",
    "unit": "Tonne",
    "value": 2242986
  },
  {
    "name": "Kiln - Running Hours",
    "unit": "Hours",
    "value": 7877.75
  },
  {
    "name": "Kiln - Raw Mill Production",
    "unit": "Tonne",
    "value": 3511308
  },
  {
    "name": "Solid Fuel - Landed Cost (Last Purchase)",
    "unit": "Rs/Tonne",
    "value": 7269
  },
  {
    "name": "Solid Fuel - Average GCV - Power Generation",
    "unit": "kcal/kg",
    "value": 3839.229
  },
  {
    "name": "Solid Fuel - Average GCV - Kiln",
    "unit": "kcal/kg",
    "value": 4036.54
  },
  {
    "name": "Solid Fuel - Average GCV - Process",
    "unit": "kcal/kg",
    "value": 4753
  },
  {
    "name": "Solid Fuel - Average NCV - Power Generation",
    "unit": "kcal/kg",
    "value": 3553.455
  },
  {
    "name": "Solid Fuel - Average NCV - Kiln",
    "unit": "kcal/kg",
    "value": 3751
  },
  {
    "name": "Solid Fuel - Average NCV - Process",
    "unit": "kcal/kg",
    "value": 3408.16
  },
  {
    "name": "Solid Fuel - Average Surface Moisture in Fuel - Power Generation",
    "unit": "%",
    "value": 6.13
  },
  {
    "name": "Solid Fuel - Average Surface Moisture in Fuel - Kiln",
    "unit": "%",
    "value": 7.02
  },
  {
    "name": "Solid Fuel - % Total Carbon - Power Generation",
    "unit": "%",
    "value": 30.683
  },
  {
    "name": "Solid Fuel - % Total Carbon - Kiln",
    "unit": "%",
    "value": 25.633
  },
  {
    "name": "Solid Fuel - % Oxidation Factor - Power Generation",
    "unit": "%",
    "value": 100
  },
  {
    "name": "Solid Fuel - % Oxidation Factor - Kiln",
    "unit": "%",
    "value": 100
  },
  {
    "name": "Solid Fuel - Average Moisture in Fuel",
    "unit": "%",
    "value": 29.92
  },
  {
    "name": "Solid Fuel - Quantity Purchased",
    "unit": "Tonne",
    "value": 69868.425
  },
  {
    "name": "Solid Fuel - Quantity Purchased - Power Generation",
    "unit": "Tonne",
    "value": 69868.425
  },
  {
    "name": "Solid Fuel - Quantity Purchased - Kiln",
    "unit": "Tonne",
    "value": 143098.44
  },
  {
    "name": "Solid Fuel - Quantity Used for power generation (Surface Moisture Free)",
    "unit": "Tonne",
    "value": 119132.4
  },
  {
    "name": "Solid Fuel - Quantity Used for process (Surface Moisture Free)",
    "unit": "Tonne",
    "value": 7877.29
  },
  {
    "name": "Liquid Fuel - Landed Cost (Last Purchase)",
    "unit": "Rs/kL",
    "value": 5759
  },
  {
    "name": "Liquid Fuel - GCV",
    "unit": "kcal/kg",
    "value": 11840
  },
  {
    "name": "Liquid Fuel - Density",
    "unit": "kg/litre",
    "value": 0.826
  },
  {
    "name": "Liquid Fuel - Oxidation Factor",
    "unit": "%",
    "value": 100
  },
  {
    "name": "Liquid Fuel - Qty Used - DG Set",
    "unit": "kilo Litre",
    "value": 0.825
  },
  {
    "name": "Liquid Fuel - Qty Used - CPP",
    "unit": "kilo Litre",
    "value": 62.75
  },
  {
    "name": "Liquid Fuel - Qty Used - Internal Transport",
    "unit": "kilo Litre",
    "value": 566.916
  },
  {
    "name": "Liquid Fuel - Qty Used - Process/Kiln",
    "unit": "kilo Litre",
    "value": 434.02
  },
  {
    "name": "Purchased Electricity from Grid",
    "unit": "Lakh kWh",
    "value": 1778.063
  },
  {
    "name": "RE - Wind & Solar (Wheeling)",
    "unit": "Lakh kWh",
    "value": 20
  },
  {
    "name": "RE - Hydro (Wheeling)",
    "unit": "Lakh kWh",
    "value": 1490
  },
  {
    "name": "RE - Biomass (Wheeling)",
    "unit": "Lakh kWh",
    "value": 3263
  },
  {
    "name": "Electricity from CPP Outside Boundary",
    "unit": "Lakh kWh",
    "value": 24368
  },
  {
    "name": "Emission Factor for Grid (DISCOM)",
    "unit": "tCO2/MWh",
    "value": 0.727
  },
  {
    "name": "Emission Factor for CPP Outside",
    "unit": "tCO2/MWh",
    "value": 1.19
  },
  {
    "name": "Plant Connected Load",
    "unit": "kW",
    "value": 158000
  },
  {
    "name": "Contract Demand with Utility",
    "unit": "kVA",
    "value": 25000
  },
  {
    "name": "DG Set - Installed Capacity",
    "unit": "MW",
    "value": 23.74
  },
  {
    "name": "DG Set - Gross Generation",
    "unit": "Lakh kWh",
    "value": 59851
  },
  {
    "name": "DG Set - Design Heat Rate",
    "unit": "kcal/kWh",
    "value": 1843
  },
  {
    "name": "DG Set - Auxiliary Power Consumption",
    "unit": "%",
    "value": 8104
  },
  {
    "name": "DG Set - Running Hours",
    "unit": "Hours",
    "value": 6342
  },
  {
    "name": "STG - Grid Connected",
    "unit": "Yes/No",
    "value": 4618
  },
  {
    "name": "STG - Installed Capacity",
    "unit": "MW",
    "value": 25
  },
  {
    "name": "STG - Annual Gross Unit Generation",
    "unit": "Lakh kWh",
    "value": 703.07
  },
  {
    "name": "STG - Auxiliary Power Consumption",
    "unit": "%",
    "value": 8.65
  },
  {
    "name": "STG - Design Gross Heat Rate",
    "unit": "kcal/kWh",
    "value": 2435
  },
  {
    "name": "STG - Total Plant Available Hours per year",
    "unit": "Hours",
    "value": 8760
  },
  {
    "name": "STG - Plant Unavailablity hrs due to Planned Shutdown, Break down due to internal & external factor",
    "unit": "Hours",
    "value": 8760
  },
  {
    "name": "STG - Running Hours",
    "unit": "Hours",
    "value": 3567.36
  },
  {
    "name": "WHR - Installed Capacity",
    "unit": "MW",
    "value": 20
  },
  {
    "name": "WHR - Gross Generation",
    "unit": "Lakh kWh",
    "value": 1111.53
  },
  {
    "name": "WHR - Running Hours",
    "unit": "Hours",
    "value": 7666.56
  },
  {
    "name": "WHR - Auxiliary Power Consumption",
    "unit": "%",
    "value": 5.47
  },
  {
    "name": "WHR - Plant Load Factor",
    "unit": "%",
    "value": 85.98
  },
  {
    "name": "Solar - Grid Connected",
    "unit": "Yes/No",
    "value": 19.75
  },
  {
    "name": "Solar - Installed Capacity",
    "unit": "MW",
    "value": 230.5
  },
  {
    "name": "Solar - Annual Generation",
    "unit": "Lakh kWh",
    "value": 22816
  },
  {
    "name": "Wind - Grid Connected",
    "unit": "Yes/No",
    "value": 2045
  },
  {
    "name": "Wind - Installed Capacity",
    "unit": "MW",
    "value": 54.973
  },
  {
    "name": "Wind - Annual Generation",
    "unit": "Lakh kWh",
    "value": 52491
  },
  {
    "name": "Electricity Exported to Grid",
    "unit": "Lakh kWh",
    "value": 2.626
  },
  {
    "name": "Electricity Supplied to Colony",
    "unit": "Lakh kWh",
    "value": 33.843
  },
  {
    "name": "Kiln - Operating Thermal SEC (NCV)",
    "unit": "kcal/kg clinker",
    "value": 730.99
  },
  {
    "name": "Kiln - Operating Electrical SEC (Clinkerization)",
    "unit": "kWh/t clinker",
    "value": 26.544
  },
  {
    "name": "Kiln - Raw Mill Operating Electrical SEC (Main Motor)",
    "unit": "kWh/t material",
    "value": 20.204
  },
  {
    "name": "Electrical SEC (upto Clinkerization)",
    "unit": "kWh/Tonne Clinker",
    "value": 68.35
  },
  {
    "name": "Electrical SEC (Cement Grinding)",
    "unit": "kWh/Tonne Cement",
    "value": 31.68
  },
  {
    "name": "Electrical SEC (Crusher)",
    "unit": "kWh/Tonne limestone",
    "value": 1.1
  },
  {
    "name": "Electrical SEC (Raw Mill) (Input)",
    "unit": "kWh/Tonne Raw meal",
    "value": 0
  },
  {
    "name": "Electrical SEC (Clinkerization)(Input)",
    "unit": "kWh/Tonne Clinker",
    "value": 0
  },
  {
    "name": "Electrical SEC (Coal Mill)",
    "unit": "kWh/Tonne Coal",
    "value": 39.54
  },
  {
    "name": "Electrical SEC (Packing Plant)",
    "unit": "kWh/Tonne Cement",
    "value": 1.27
  }
];

export function getParametersForCategory(_category: string): Parameter[] {
  return allParameters;
}

const categoryNames: Record<string, string> = {
  Production: "Production Data",
  Fuel: "Fuel Data",
  Energy: "Energy Data",
  RawMaterial: "Raw Material Data",
  Emissions: "Emission Data",
  Other: "Other Data",
};

export function getSectionDisplayName(category: string): string {
  return categoryNames[category] ?? "Data";
}

export function formatNumber(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  }
  return value.toFixed(2);
}
