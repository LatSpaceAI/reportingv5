// AUTO-GENERATED from Form-Sb of Cement-PPC-Proforma-BEE.xlsx by
// scripts/gen-ccts-sections.mjs. Each field id (e.g. "I31") is the cell on
// the Form-Sb sheet that the answer should write to on export. Computed cells
// are intentionally absent — formulas live in the template, Excel recomputes
// them on open.

import type { Section } from "./frameworkTypes";

export const sections: Section[] = [
  {
    "id": "sec_I_9",
    "title": "I. Boundary Coverage for GHG emissions",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_I_9_default",
        "label": "I. Boundary Coverage for GHG emissions",
        "kind": "fields",
        "fields": [
          {
            "id": "I10",
            "label": "(a) Mining & Raw Material Transportation (Quarring, Mining)",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I11",
            "label": "(b) Fuel and Additives Preparatioin",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I12",
            "label": "(c) Crusher and raw material preparation",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I13",
            "label": "(d) Raw Mill and Raw Meal Blending",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I14",
            "label": "(e) Pyro- Processing (Kiln Feed , PreCalciner and preheater, Kiln, Cooler, Clinker Yard and Blending) Kiln Return Dust and Kiln Clinker Dust Handling",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I15",
            "label": "(f) Cement Mill and Cement blending",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I16",
            "label": "(g) Packing",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I17",
            "label": "(h) Internal Transportation (Process and Material)",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I18",
            "label": "(i) On Site Power generation",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I19",
            "label": "(j) Admin Buildings",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "sec_II_20",
    "title": "II. Emission Source Coverage",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_II_20_default",
        "label": "II. Emission Source Coverage",
        "kind": "fields",
        "fields": [
          {
            "id": "I21",
            "label": "(a) Solid Fuel combustion emissions -Process",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I22",
            "label": "(b) Solid Fuel Combustion emissions -Power Generation",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I23",
            "label": "(c) Liquid Fuel Combustion - Process",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I24",
            "label": "(d) Liquid Fuel Combustion - Power Generation",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I25",
            "label": "(e) Gaseous Fuel Combustion - Power Generation",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I26",
            "label": "(f) Gaseous Fuel Combustion - Process",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I27",
            "label": "(g) Process Emissions Calcination",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I28",
            "label": "(h) Material Handling fuel consumption",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          },
          {
            "id": "I29",
            "label": "(i) Purchased Electricity",
            "kind": "select",
            "options": [
              "Yes",
              "No",
              "Not Applicable"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "sec_A_30",
    "title": "A. Production and capacity utilization details",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_A_30_default",
        "label": "A. Production and capacity utilization details",
        "kind": "fields",
        "fields": [
          {
            "id": "I31",
            "label": "A1 Production Capacity (Clinker)",
            "unit": "Tonne",
            "help": "Basis: Annual Installed Capacity · Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I32",
            "label": "A2 Production Capacity (Cement)",
            "unit": "Tonne",
            "help": "Basis: Annual Installed Capacity · Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I33",
            "label": "A3 Total Clinker Production",
            "unit": "Tonne",
            "help": "Source: SAP T CODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I35",
            "label": "A5 Opening Clinker Stock [by 31st of March of the respective year, at 1200 MN]",
            "unit": "Tonne",
            "help": "Source: sap t code:mb5b",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I36",
            "label": "A6 Closing Clinker Stock [by 31st of March of the respective year, at 1200 MN]",
            "unit": "Tonne",
            "help": "Source: sap t code: mb5b",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I37",
            "label": "A7 Opening Cement Stock [by 31st of March of the respective year, at 1200 MN]",
            "unit": "Tonne",
            "help": "Source: sap t code: zrpp_umis_dpru",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I38",
            "label": "A8 Closing Cement Stock [by 31st of March of the respective year, at 1200 MN]",
            "unit": "Tonne",
            "help": "Source: sap t code: zrpp_umis_dpru",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_A11_41",
        "label": "A11 — Type of Cement Produced [ Please mention the name of  the additives used in  the Remarks column in the respective production section]",
        "kind": "fields",
        "fields": [
          {
            "id": "I42",
            "label": "A11.1 Ordinary Portland Cement (OPC) Production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE) (OPC43+OPC53)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I43",
            "label": "(i) Quantity of Gypsum used in OPC production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I44",
            "label": "(ii) Quantity of Limestone Used as Additive in OPC Production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I45",
            "label": "(iii) Quantity of Clay used as additives in OPC production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I46",
            "label": "(iv) Quantity of any other Additive (Silica fume, Rice husk ash, Metakaolin used in OPC Production) [Provide details of the specific additives in Remarks column]",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I47",
            "label": "(v) Quantity of any other Additive Used in OPC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I48",
            "label": "A11.2 Portland Pozzolana Cement (PPC) Production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I49",
            "label": "(i) Quantity of Gypsum used in PPC production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I50",
            "label": "(ii) Quantity of Fly Ash used in PPC Production",
            "unit": "Tonne",
            "help": "Source: COOISPI (SAP T CODE)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I51",
            "label": "(iii) Quantity of Calcined clay in PPC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I52",
            "label": "(iv) Quantity of any other Additive Used in PPC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I53",
            "label": "A11.3 Portland Slag Cement (PSC) Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I54",
            "label": "(i) Quantity of Gypsum used in PSC production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I55",
            "label": "(ii) Quantity of Slag used in PSC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I56",
            "label": "(iii) Quantity of any other Additive Used in PSC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I57",
            "label": "A11.4 Composite Cement (CC) Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I58",
            "label": "(i) Quantity of Gypsum used in CC production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I59",
            "label": "(ii) Quantity of Slag used in CC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I60",
            "label": "(iii) Quantity of Fly Ash used in CC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I61",
            "label": "(iv) Quantity of Clay in CC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I62",
            "label": "(v) Quantity of any other Additive Used in CC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I63",
            "label": "A11.5 White Cement (WC) Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I64",
            "label": "(i) Quantity of Gypsum used in WC production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I65",
            "label": "(ii) Quantity of Limestone used as Additive in WC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I66",
            "label": "(iii) Quantity of Dolomite used as Additive in WC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I67",
            "label": "(iv) Quantity of Marble used as Additive in WC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I68",
            "label": "(v) Quantity of Clay in WC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I69",
            "label": "(vi) Quantity of any other Additive Used in WC Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I70",
            "label": "A11.6 Other Cement Production, PPC",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I71",
            "label": "(i) Quantity of Gypsum used in Other cement production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I72",
            "label": "(ii) Quantity of Additive 1 Used in Other cement Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I73",
            "label": "(iii) Quantity of Additive 2 Used in Other cement Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I74",
            "label": "(iv) Quantity of Additive 3 Used in Other cement Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I75",
            "label": "A11.7 Ground Granulated Blast-furnace Slag Cement (GGBS) Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I76",
            "label": "(i) Quantity of GGBS Sold",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I77",
            "label": "(ii) Quantity of GGBS used Internally for cement production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I78",
            "label": "(iii) Quantity of GGBS (Grinding) directly used for construction",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_A12_79",
        "label": "A12 — Clinker Import/Export (For Integrated Plant only) Not to be filled by Grinding Plant",
        "kind": "fields",
        "fields": [
          {
            "id": "I80",
            "label": "(i) Clinker Exported",
            "unit": "Tonne",
            "help": "Source: TM1 cognos web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I81",
            "label": "(ii) Clinker Imported",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_A20_90",
        "label": "A20 — Clinker Factors",
        "kind": "fields",
        "fields": [
          {
            "id": "I98",
            "label": "(viii) Raw Material Net Factor (Raw Meal to Clinker)",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_A21_100",
        "label": "A21 — Process data for emission",
        "kind": "fields",
        "fields": [
          {
            "id": "I101",
            "label": "(i) Fraction of Lime in Clinker (CaO)",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I102",
            "label": "(ii) Fraction of MgO content in Clinker",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I103",
            "label": "(iii) Total raw material consumed (non-carbonate source in raw material consumed) [Dry Weight]",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I104",
            "label": "(iv) CaO content (non-carbonate source in raw material consumed) [Dry Weight]",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I105",
            "label": "(v) MgO content (non-carbonate source in raw material consumed) [Dry Weight]",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I106",
            "label": "(vi) Ca/Mg-silicate source Raw material consumed [Dry Weight]",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I107",
            "label": "(vii) Ca content of Ca-Silicate raw materials [Dry Weight]",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I108",
            "label": "(viii) Mg content of Mg-Silicate raw materials [Dry Weight]",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I109",
            "label": "(ix) Bypass dust leaving the system",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I110",
            "label": "(x) CKD leaving the system",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I111",
            "label": "(xi) CKD calcination rate (default value 0% for dry kiln and 100% for other kiln types)",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I112",
            "label": "(xii) Organic Carbon content of raw meal (default value 0.2%)",
            "unit": "Fraction",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_A22_113",
        "label": "A22 — Carbonate used in process or Boiler (FBC/FGD/Any)",
        "kind": "fields",
        "fields": [
          {
            "id": "I114",
            "label": "(i) CaCO3",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I115",
            "label": "(ii) Na2CO3",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I116",
            "label": "(iiii) BaCO3",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I117",
            "label": "(iv) Li2CO3",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I118",
            "label": "(v) K2CO3",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_B_120",
    "title": "B. Kiln Start/Stop",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_(i)_121",
        "label": "(i) — Kiln 1 Start/Stop",
        "kind": "fields",
        "fields": [
          {
            "id": "I122",
            "label": "(i)a Kiln-1 Production",
            "unit": "Tonne",
            "help": "Source: SAP t code: ZQM_24AF_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I123",
            "label": "(i)b Kiln-1 Operating Thermal SEC (Including Alternate Fuel)-NCV Basis",
            "unit": "kcal/kg clinker",
            "help": "Source: SAP t code: ZQM_24AF_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I124",
            "label": "(i)c Kiln-1 Operating Electrical SEC",
            "unit": "kWh/t clinker",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I125",
            "label": "(i)d Kiln-1 Running Hours",
            "unit": "Hours",
            "help": "Source: SAP t code: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I126",
            "label": "(i)e Kiln-1 Hot to Hot start (Internal & External)",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP (<48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I127",
            "label": "(i)f Kiln-1 Hot to Cold stop due to external factor",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I128",
            "label": "(i)g Kiln-1 Hot to Cold stop due to external factor",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I129",
            "label": "(i)h Kiln-1 Hot to Cold stop due to external factor (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "help": "Source: Electrical feeder reading",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I130",
            "label": "(i)i Kiln-1 Cold to Hot start due to external factors",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I131",
            "label": "(i)j Kiln-1 Cold to Hot start due to external factors",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I132",
            "label": "(i)k Kiln-1 Cold to Hot start due to external factors (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "help": "Source: Electrical feeder reading",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I133",
            "label": "(i)l Kiln-1 Cold to Hot start due to internal factors",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I134",
            "label": "(i)m Raw Mill-1 Production",
            "unit": "Tonne",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N (Line-1)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I135",
            "label": "(i)n Raw Mill-1 Operating Electrical SEC (Main Motor)",
            "unit": "kWh/t material",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N (Line-1)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_(ii)_136",
        "label": "(ii) — Kiln 2 Start/Stop",
        "kind": "fields",
        "fields": [
          {
            "id": "I137",
            "label": "(ii)a Kiln-2 Production",
            "unit": "Tonne",
            "help": "Source: SAP t code: ZQM_24AF_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I138",
            "label": "(ii)b Kiln-2 Operating Thermal SEC (Including Alternate Fuel)-NCV Basis",
            "unit": "kcal/kg clinker",
            "help": "Source: SAP t code: ZQM_24AF_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I139",
            "label": "(ii)c Kiln-2 Operating Electrical SEC",
            "unit": "kWh/t clinker",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I140",
            "label": "(ii)d Kiln-2 Running Hours",
            "unit": "Hours",
            "help": "Source: SAP t code: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I141",
            "label": "(ii)e Kiln-2 Hot to Hot start (Internal & External)",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP (<48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I142",
            "label": "(ii)f Kiln-2 Hot to Cold stop due to external factor",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I143",
            "label": "(ii)g Kiln-2 Hot to Cold stop due to external factor",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I144",
            "label": "(ii)h Kiln-2 Hot to Cold stop due to external factor (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "help": "Source: Electrical feeder reading",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I145",
            "label": "(ii)i Kiln-2 Cold to Hot start due to external factors",
            "unit": "Hours",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I146",
            "label": "(ii)j Kiln-2 Cold to Hot start due to external factors",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I147",
            "label": "(ii)k Kiln-2 Cold to Hot start due to external factors (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "help": "Source: Electrical feeder reading",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I148",
            "label": "(ii)l Kiln-2 Cold to Hot start due to internal factors",
            "unit": "Nos",
            "help": "Source: SAP t code: ZRPP_STSP (>48 hrs)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I149",
            "label": "(ii)m Raw Mill-2 Production",
            "unit": "Tonne",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N (Line-1)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I150",
            "label": "(ii)n Raw Mill-2 Operating Electrical SEC (Main Motor)",
            "unit": "kWh/t material",
            "help": "Source: SAP T CODE:  ZRPP_DPWRU_N (Line-1)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_(iii)_151",
        "label": "(iii) — Kiln 3 Start/Stop",
        "kind": "fields",
        "fields": [
          {
            "id": "I152",
            "label": "(iii)a Kiln-3 Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I153",
            "label": "(iii)b Kiln-3 Operating Thermal SEC (Including Alternate Fuel)-NCV Basis",
            "unit": "kcal/kg clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I154",
            "label": "(iii)c Kiln-3 Operating Electrical SEC",
            "unit": "kWh/t clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I155",
            "label": "(iii)d Kiln-3 Running Hours",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I156",
            "label": "(iii)e Kiln-3 Hot to Hot start (Internal & External)",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I157",
            "label": "(iii)f Kiln-3 Hot to Cold stop due to external factor",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I158",
            "label": "(iii)g Kiln-3 Hot to Cold stop due to external factor",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I159",
            "label": "(iii)h Kiln-3 Hot to Cold stop due to external factor (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I160",
            "label": "(iii)i Kiln-3 Cold to Hot start due to external factors",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I161",
            "label": "(iii)j Kiln-3 Cold to Hot start due to external factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I162",
            "label": "(iii)k Kiln-3 Cold to Hot start due to external factors (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I163",
            "label": "(iii)l Kiln-3 Cold to Hot start due to internal factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I164",
            "label": "(iii)m Raw Mill-3 Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I165",
            "label": "(iii)n Raw Mill-3 Operating Electrical SEC (Main Motor)",
            "unit": "kWh/t material",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_(iv)_166",
        "label": "(iv) — Kiln 4 Start/Stop",
        "kind": "fields",
        "fields": [
          {
            "id": "I167",
            "label": "(iv)a Kiln-4 Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I168",
            "label": "(iv)b Kiln-4 Operating Thermal SEC (Including Alternate Fuel)-NCV Basis",
            "unit": "kcal/kg clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I169",
            "label": "(iv)c Kiln-4 Operating Electrical SEC",
            "unit": "kWh/t clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I170",
            "label": "(iv)d Kiln-4 Running Hours",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I171",
            "label": "(iv)e Kiln-4 Hot to Hot start (Internal & External)",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I172",
            "label": "(iv)f Kiln-4 Hot to Cold stop due to external factor",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I173",
            "label": "(iv)g Kiln-4 Hot to Cold stop due to external factor",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I174",
            "label": "(iv)h Kiln-4 Hot to Cold stop due to external factor (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I175",
            "label": "(iv)i Kiln-4 Cold to Hot start due to external factors",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I176",
            "label": "(iv)j Kiln-4 Cold to Hot start due to external factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I177",
            "label": "(iv)k Kiln-4 Cold to Hot start due to external factors (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I178",
            "label": "(iv)l Kiln-4 Cold to Hot start due to internal factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I179",
            "label": "(iv)m Raw Mill-4 Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I180",
            "label": "(iv)n Raw Mill-4 Operating Electrical SEC (Main Motor)",
            "unit": "kWh/t material",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_(v)_181",
        "label": "(v) — Kiln 5 Start/Stop",
        "kind": "fields",
        "fields": [
          {
            "id": "I182",
            "label": "(v)a Kiln-5 production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I183",
            "label": "(v)b Kiln-5 Operating Thermal SEC (Including Alternate Fuel)-NCV Basis",
            "unit": "kcal/kg clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I184",
            "label": "(v)c Kiln-5 Operating Electrical SEC",
            "unit": "kWh/t clinker",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I185",
            "label": "(v)d Kiln-5 Running Hours",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I186",
            "label": "(v)e Kiln-5 Hot to Hot start (Internal & External)",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I187",
            "label": "(v)f Kiln-5 Hot to Cold stop due to external factor",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I188",
            "label": "(v)g Kiln-5 Hot to Cold stop due to external factor",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I189",
            "label": "(v)h Kiln-5 Hot to Cold stop due to external factor (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I190",
            "label": "(v)i Kiln-5 Cold to Hot start due to external factors",
            "unit": "Hours",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I191",
            "label": "(v)j Kiln-5 Cold to Hot start due to external factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I192",
            "label": "(v)k Kiln-5 Cold to Hot start due to external factors (Electrical Energy Consumption)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I193",
            "label": "(v)l Kiln-5 Cold to Hot start due to internal factors",
            "unit": "Nos",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I194",
            "label": "(v)m Raw Mill-5 Production",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I195",
            "label": "(v)n Raw Mill-5 Operating Electrical SEC (Main Motor)",
            "unit": "kWh/t material",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I196",
            "label": "Note: For Additional Kiln data, Obligated Entity (OE) /Designated Consumer (DC) needs to submit the information in a separate excel sheet as per the above format",
            "kind": "text"
          }
        ]
      }
    ]
  },
  {
    "id": "sec_C_197",
    "title": "C. Electricity Consumption",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_C.1_198",
        "label": "C.1 — Electricity through Grid / Renewables/Other (Including colony and others)",
        "kind": "fields",
        "fields": [
          {
            "id": "I199",
            "label": "(i) Purchased Electricity from grid (DISCOM)(Other than Renewables PPA)",
            "unit": "Lakh kWh",
            "help": "Source: Electricity Bill",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I200",
            "label": "(ii) Renewable Electricity On-Shore Wind and Solar (Through Wheeling)",
            "unit": "Lakh kWh",
            "help": "Source: Electricity Bill",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I201",
            "label": "(iii) Renewable Electricity Hydro (Through Wheeling)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I202",
            "label": "(iv) Renewable Electricity Municipal Solid Waste (MSW) and nonfossil fuel-based cogeneration (Through Wheeling)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I203",
            "label": "(v) Renewable Electricity Biomass and Biofuel based (Through Wheeling)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I204",
            "label": "(vi) Renewable Electricity through dedicated line",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I205",
            "label": "(vii) Electricity from CPP located outside from plant boundary (Through Wheeling)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I206",
            "label": "(viii) Emission Factor for Grid Purchased Electricity (DISCOM)[CEA]",
            "unit": "t CO2/MWh",
            "help": "Basis: Average",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I207",
            "label": "(ix) Emission factor for CPP located outside plant boundary (Through Wheeling)[CEA]",
            "unit": "t CO2/MWh",
            "help": "Basis: Average",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I208",
            "label": "(x) Renewable Purchase Obligation of Sector (RPO) (Non Fossil) notified by MoP SO 4617 ( E)",
            "unit": "%",
            "help": "Source: 0rder from Ministry of Power , Govt Of India",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I209",
            "label": "(xi) Renewable Purchase obligation of plant (RPO) (Solar & Non-Solar)",
            "unit": "%",
            "help": "Source: 0rder from Ministry of Power , Govt Of India",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I210",
            "label": "(xii) Renewable Purchase obligation of plant (RPO) (Solar & Non-Solar)",
            "unit": "Lakh kWh",
            "help": "Source: 0rder from Ministry of Power , Govt Of India",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I211",
            "label": "(xiii) Renewable Purchase obligation of plant (RPO) (Solar & Non-Solar)",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I212",
            "label": "(xiv) Renewable Energy generator as approved by MNRE",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I213",
            "label": "(xv) Quantum of Renewable Energy Certificates (REC) obtained as a Renewal Energy Generator (Solar & Non-Solar)",
            "unit": "MWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I214",
            "label": "(xvi) Quantum of Energy sold under preferential tariff",
            "unit": "MWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I215",
            "label": "(xvii) Plant Connected Load",
            "unit": "kW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I216",
            "label": "(xviii) Contract Demand with utility",
            "unit": "kVA ",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I217",
            "label": "(xix) Notified Specific Energy Consumption/GEI (GHG Emission Intensity)",
            "unit": "TOE/Tonnes (t CO2/t)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I218",
            "label": "(xx) Target Specific Energy Consumption/GEI (GHG Emission Intensity)",
            "unit": "TOE/Tonnes (t CO2/t)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I219",
            "label": "(xxi) Saving Target in TOE/ton of product as per PAT scheme Notification /CCTS Notification",
            "unit": "TOE/Tonnes",
            "help": "Basis: C.1.1.(xii)-C.1.1.(xiii)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I220",
            "label": "(xxii) Equivalent Major Product Output in tonnes as per PAT scheme Notification",
            "unit": "Tonnes",
            "help": "Basis: (saving Target)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I228",
            "label": "Note: As per REC Regulation 2022, technology multiplier assigned to RE projects which are commissioned after 05.12.2022",
            "kind": "text"
          }
        ]
      },
      {
        "id": "q_C.2.1_230",
        "label": "C.2.1 — Through Diesel Generator (DG) sets",
        "kind": "fields",
        "fields": [
          {
            "id": "I231",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I232",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I233",
            "label": "(iii) Annual Gross Unit Generation",
            "unit": "Lakh kWh",
            "help": "Source: IBM COGNOS TM1 web 2.06",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I234",
            "label": "(iv) Designed Gross Heat Rate",
            "unit": "kcal/kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I235",
            "label": "(v) Auxilliary Power Consumption (APC)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I236",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.1_239",
        "label": "C.2.2.1 — STG 1",
        "kind": "fields",
        "fields": [
          {
            "id": "I240",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I241",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "help": "Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I242",
            "label": "(iii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I243",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I244",
            "label": "(v) Design Gross Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I245",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I246",
            "label": "(vii) Total Plant Availlable Hours per year",
            "unit": "Hrs",
            "help": "Source: = 365 DAYS *24 HRS = 8760 HRS",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I247",
            "label": "(viii) Plant Unavailability hrs due to Planned shutdown, Break down due to internal & external factor",
            "unit": "Hrs",
            "help": "Source: Attached proof in the name of ''TG wise RHS & STOPPAGE HRS'' in the folder",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I248",
            "label": "(ix) Plant low load hrs due to Internal Factors/ Breakdown in Plant",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I249",
            "label": "(x) Plant low load hrs due to External Factors like Fuel Unavailability/ Market demand/External Condition",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.2_255",
        "label": "C.2.2.2 — STG2",
        "kind": "fields",
        "fields": [
          {
            "id": "I256",
            "label": "(i) Grid Connected",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I257",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "help": "Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I258",
            "label": "(iii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I259",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I260",
            "label": "(v) Design Gross Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I261",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I262",
            "label": "(vii) Total Plant Availlable Hours per year",
            "unit": "Hrs",
            "help": "Source: = 365 DAYS *24 HRS = 8760 HRS",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I263",
            "label": "(viii) Plant Unavailability hrs due to Planned shutdown, Break down due to internal & external factor",
            "unit": "Hrs",
            "help": "Source: Attached proof in the name of ''TG wise RHS & STOPPAGE HRS'' in the folder",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I264",
            "label": "(ix) Plant low load hrs due to Internal Factors/ Breakdown in Plant",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I265",
            "label": "(x) Plant low load hrs due to External Factors like Fuel Unavailability/ Market demand/External Condition",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.3_271",
        "label": "C.2.2.3 — STG3",
        "kind": "fields",
        "fields": [
          {
            "id": "I272",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I273",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "help": "Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I274",
            "label": "(iii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I275",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I276",
            "label": "(v) Design Gross Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I277",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I278",
            "label": "(vii) Total Plant Availlable Hours per year",
            "unit": "Hrs",
            "help": "Source: = 365 DAYS *24 HRS = 8760 HRS",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I279",
            "label": "(viii) Plant Unavailability hrs due to Planned shutdown, Break down due to internal & external factor",
            "unit": "Hrs",
            "help": "Source: Attached proof in the name of ''TG wise RHS & STOPPAGE HRS'' in the folder",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I280",
            "label": "(ix) Plant low load hrs due to Internal Factors/ Breakdown in Plant",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I281",
            "label": "(x) Plant low load hrs due to External Factors like Fuel Unavailability/ Market demand/External Condition",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.4_287",
        "label": "C.2.2.4 — STG4",
        "kind": "fields",
        "fields": [
          {
            "id": "I288",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I289",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "help": "Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I290",
            "label": "(iii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I291",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I292",
            "label": "(v) Design Gross Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I293",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "help": "Source: SAP TCODE: COOISPI",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I294",
            "label": "(vii) Total Plant Availlable Hours per year",
            "unit": "Hrs",
            "help": "Source: = 365 DAYS *24 HRS = 8760 HRS",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I295",
            "label": "(viii) Plant Unavailability hrs due to Planned shutdown, Break down due to internal & external factor",
            "unit": "Hrs",
            "help": "Source: Attached proof in the name of ''TG wise RHS & STOPPAGE HRS'' in the folder",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I296",
            "label": "(ix) Plant low load hrs due to Internal Factors/ Breakdown in Plant",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I297",
            "label": "(x) Plant low load hrs due to External Factors like Fuel Unavailability/ Market demand/External Condition",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.5_303",
        "label": "C.2.2.5 — STG5",
        "kind": "fields",
        "fields": [
          {
            "id": "I304",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I305",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I306",
            "label": "(iii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I307",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I308",
            "label": "(v) Design Gross Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I309",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I310",
            "label": "(vii) Total Plant Availlable Hours per year",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I311",
            "label": "(viii) Plant Unavailability hrs due to Planned shutdown, Break down due to internal & external factor",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I312",
            "label": "(ix) Plant low load hrs due to Internal Factors/ Breakdown in Plant",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I313",
            "label": "(x) Plant low load hrs due to External Factors like Fuel Unavailability/ Market demand/External Condition",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.2.6_319",
        "label": "C.2.2.6 — STGs",
        "kind": "fields",
        "fields": [
          {
            "id": "I320",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          }
        ]
      },
      {
        "id": "q_C.2.3_334",
        "label": "C.2.3 — Through Gas Turbine (GT)",
        "kind": "fields",
        "fields": [
          {
            "id": "I335",
            "label": "(i) Installed Capacity",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I336",
            "label": "(ii) Annual Gross Unit generation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I337",
            "label": "(iii) Auxiliary Power Consumption",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I338",
            "label": "(iv) Design Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I339",
            "label": "(v) Plant Load Factor (PLF)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I340",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.4_342",
        "label": "C.2.4 — Through Waste Heat Recovery",
        "kind": "fields",
        "fields": [
          {
            "id": "I343",
            "label": "(i) WHR Installed Capacity",
            "unit": "MW",
            "help": "Source: Consent to operate by APPCB",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I344",
            "label": "(ii) Gross Annual Generation",
            "unit": "Lakh kWh",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I345",
            "label": "(iii) WHR Running Hours",
            "unit": "Hrs",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I346",
            "label": "(iv) Auxiliary Power Consumption",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I347",
            "label": "(v) Design Heat Rate",
            "unit": "kcal/ kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I348",
            "label": "(vi) Plant Load Factor (PLF)",
            "unit": "%",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C.2.5_350",
        "label": "C.2.5 — Electricity through dedicated Line from Captive Power Plant (CPP)",
        "kind": "fields",
        "fields": [
          {
            "id": "I351",
            "label": "(i) Power Wheeled through a dedicated line",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I352",
            "label": "(ii) Electricity through dedicated Line from Captive Power Plant (CPP)",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I353",
            "label": "(iii) Gross Heat Rate of wheeled Electricity from dedicated line",
            "unit": "kcal/kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I354",
            "label": "(iv) Net Heat Rate of wheeled Electricity from dedicated line",
            "unit": "kcal/kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I355",
            "label": "(v) Emission factor for CPP located outside plant boundary",
            "unit": "t CO2/MWh",
            "help": "Basis: Average",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C2.6.1_359",
        "label": "C2.6.1 — Through Renewable Sources (Solar)",
        "kind": "fields",
        "fields": [
          {
            "id": "I360",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I361",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I362",
            "label": "(iii) Annual gross generation",
            "unit": "Lakh kWh",
            "help": "Source: EB Bill",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I363",
            "label": "(iv) Plant Load Factor (PLF)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I364",
            "label": "(v) Auxiliary Power Consumption",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I365",
            "label": "(vi) Running Hours",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_C2.6.2_366",
        "label": "C2.6.2 — Through Renewable Sources (Wind)",
        "kind": "fields",
        "fields": [
          {
            "id": "I367",
            "label": "(i) Grid Connected",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I368",
            "label": "(ii) Installed Capacity",
            "unit": "MW",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I369",
            "label": "(iii) Annual generation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I370",
            "label": "(iv) Plant Load Factor (PLF)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I371",
            "label": "(v) Auxiliary Power Consumption",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I372",
            "label": "(vi) Average Wind Speed",
            "unit": "Hrs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I380",
            "label": "C.4 Electricity Exported to Grid/others",
            "unit": "Lakh kWh",
            "help": "Source: SAP T CODE ZRPP_CPWR",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I381",
            "label": "C.5 Electricity Supplied to Colony/others",
            "unit": "Lakh kWh",
            "help": "Source: Colony consumption from EB bill",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_D_391",
    "title": "D. Solid Fuel Consumption",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_D.1_392",
        "label": "D.1 — Coal (Indian)",
        "kind": "fields",
        "fields": [
          {
            "id": "I393",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I394",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I395",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I396",
            "label": "(iv) Average Net Calorific Value (Power generation)",
            "unit": "kcal/ kg",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I397",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I398",
            "label": "(vi) Quantity purchased Power",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I399",
            "label": "(vii) Quantity purchased - Kiln",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I400",
            "label": "(viii) Average Surface Moisture in Fuel - Power",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I401",
            "label": "(ix) Average Surface Moisture in Fuel -Kiln",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I402",
            "label": "(x) % Total Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I403",
            "label": "(xi) % Total Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I404",
            "label": "(xii) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I405",
            "label": "(xiii) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I406",
            "label": "(xiv) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I407",
            "label": "(xv) Quantity used for process (Pyro) (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.2_416",
        "label": "D.2 — Petcoke",
        "kind": "fields",
        "fields": [
          {
            "id": "I417",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I418",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I419",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I421",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I422",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I423",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I424",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I425",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I426",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I427",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I428",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I429",
            "label": "(xiii) Quantity used for process (Pyro) (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.3_438",
        "label": "D.3 — Coal(Imported)",
        "kind": "fields",
        "fields": [
          {
            "id": "I439",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I440",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I441",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I442",
            "label": "(iv) Average Net Calorific Value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I443",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I444",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I445",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I446",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I447",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I448",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I449",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I450",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I451",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.4_460",
        "label": "D.4 — Coal(lignite)",
        "kind": "fields",
        "fields": [
          {
            "id": "I461",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I462",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I463",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I466",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I467",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I468",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I469",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I470",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I471",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I472",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I473",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.5_482",
        "label": "D.5 — Solid Fuel - Carbon Black/Peat/Dolachar/Other Solid fuel",
        "kind": "fields",
        "fields": [
          {
            "id": "I483",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I484",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I485",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I487",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I488",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I489",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis) · Source: ZRPP_DVTEJ-  & Taken Wt.Avg (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I490",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I491",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I492",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I493",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I494",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I495",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.6_504",
        "label": "D.6 — Coal 1: Type of Coal (Select from Cell)",
        "description": "Other Bituminous Coal",
        "kind": "fields",
        "fields": [
          {
            "id": "I505",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I506",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I507",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I509",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I510",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I511",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I512",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I513",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I514",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I515",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I516",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I517",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.7_526",
        "label": "D.7 — Coal 2: Type of Coal (Select from Cell)",
        "description": "Other Bituminous Coal",
        "kind": "fields",
        "fields": [
          {
            "id": "I527",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I528",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I529",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I531",
            "label": "(v) Average Net Calorific Value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I532",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I533",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I534",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I535",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I536",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I537",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I538",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I539",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.8_548",
        "label": "D.8 — Coal 3: Type of Coal (Select from Cell)",
        "description": "Other Bituminous Coal",
        "kind": "fields",
        "fields": [
          {
            "id": "I549",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I550",
            "label": "(ii) Average Gross calorific value (Power generation)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I551",
            "label": "(iii) Average Gross calorific value (Kiln)",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (Air Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I554",
            "label": "(vi) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I555",
            "label": "(vii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Received Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I556",
            "label": "(viii) % Carbon - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I557",
            "label": "(ix) % Carbon - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I558",
            "label": "(x) % Oxidation Factor - (Power generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I559",
            "label": "(xi) % Oxidation Factor - (Kiln)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I560",
            "label": "(xii) Quantity used for power generation (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I561",
            "label": "(xiii) Quantity used for process (Surface Moisture Free)",
            "unit": "Tonne",
            "help": "Basis: Pyro-processing",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.9_570",
        "label": "D.9 — Unburnt fuel Generation From CPP( AFBC/CFBC Boiler)",
        "kind": "fields",
        "fields": [
          {
            "id": "I571",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I572",
            "label": "(ii) Average Gross calorific value Process",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Dried Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I574",
            "label": "(iv) % carbon (fossil)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I575",
            "label": "(v) % Oxidation factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I576",
            "label": "(vi) Quantity purchased & used in process (Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I577",
            "label": "(vii) Quantity generated from power plant & used in process(Surface Moisture Free)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.10_583",
        "label": "D.10 — Bio mass or Other purchased Renewable solid fuels (pl. specify) baggase, rice husk, etc.",
        "description": "Thermal Energy Input used for process through Biomass not to be taken into account",
        "kind": "fields",
        "fields": [
          {
            "id": "I584",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I585",
            "label": "(ii) Average Gross calorific value (Power Generation) as fired",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I586",
            "label": "(iii) Average Gross calorific value (Process) as fired",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As fired Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I587",
            "label": "(iv) Average Net calorific value (Power Generation)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I588",
            "label": "(v) Average Net calorific value (Process)",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I589",
            "label": "(vi) % Carbon (Power Generation) (Non-Fossil)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I590",
            "label": "(vii) % Carbon (Process) (Non-Fossil)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I591",
            "label": "(viii) % Oxidation factor (Power Generation)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I592",
            "label": "(ix) % Oxidation factor (Process)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I593",
            "label": "(x) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I594",
            "label": "(xi) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Fired Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I595",
            "label": "(xii) Quantity used power generation",
            "unit": "Tonne",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I596",
            "label": "(xiii) Quantity used for process heating (Pyro)",
            "unit": "Tonne",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_D.11_608",
        "label": "D.11 — Solid Waste (pl. specify) rubber tyres chips, Municipal Solid waste etc.",
        "description": "Thermal Energy Input used for process through solid waste, not to be taken into account",
        "kind": "fields",
        "fields": [
          {
            "id": "I609",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I610",
            "label": "(ii) Average Gross calorific value as fired",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I611",
            "label": "(iii) Average Net Calorific value",
            "unit": "kcal/ kg",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I612",
            "label": "(iv) % Carbon (Non-Fossil)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I613",
            "label": "(v) % Carbon (Fossil)",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I614",
            "label": "(vi) % Oxidation factor",
            "unit": "%",
            "kind": "text"
          },
          {
            "id": "I615",
            "label": "(vii) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I616",
            "label": "(viii) Average Moisture in Fuel",
            "unit": "%",
            "help": "Basis: Annual(As Fired Basis) · Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I617",
            "label": "(ix) Quantity used power generation",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I618",
            "label": "(x) Quantity used for process heating",
            "unit": "Tonne",
            "help": "Source: ZRPP_DVTEJ- (SAP)",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_E_640",
    "title": "E. Liquid Fuel Consumption",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_E.1_641",
        "label": "E.1 — Furnace Oil",
        "kind": "fields",
        "fields": [
          {
            "id": "I642",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I643",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I645",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I646",
            "label": "(v) Quantity purchased",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I647",
            "label": "(vi) Average Density",
            "unit": "kg/ltr",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I649",
            "label": "(viii) Quantity used for power generation (DG Set)",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I650",
            "label": "(ix) Quantity used for power generation (CPP)",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I651",
            "label": "(x) Quantity used for process heating",
            "unit": "kilo Litre",
            "help": "Basis: (including Pyro-processing and cement mill Hot Air Generator)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_E.2_660",
        "label": "E.2 — Low Sulphur Heavy Stock (LSHS)",
        "kind": "fields",
        "fields": [
          {
            "id": "I661",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I662",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I664",
            "label": "(iv) Oxidation factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I665",
            "label": "(v) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I667",
            "label": "(vii) Quantity used for power generation (DG Set)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I668",
            "label": "(viii) Quantity used for power generation (CPP)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I669",
            "label": "(ix) Quantity used for process heating",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_E.3_678",
        "label": "E.3 — High Sulphur Heavy Stock (HSHS)/Pyrolysis Oil/Petro Polymer Oil",
        "kind": "fields",
        "fields": [
          {
            "id": "I679",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I680",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I682",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I683",
            "label": "(v) Quantity purchased",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I685",
            "label": "(vii) Quantity used for power generation (DG Set)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I686",
            "label": "(viii) Quantity used for power generation (CPP)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_E.4_696",
        "label": "E.4 — High Speed Diesel (HSD)",
        "kind": "fields",
        "fields": [
          {
            "id": "I697",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I698",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis) · Source: from oil company HPCL data",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I700",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I701",
            "label": "(v) Quantity purchased",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I702",
            "label": "(vi) Average Density",
            "unit": "kg/ltr",
            "help": "Source: Density as per MOP notification no S.O.394(E)12.03.2007",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I704",
            "label": "(viii) Quantity used for power generation (DG Set)",
            "unit": "kilo Litre",
            "help": "Source: SAP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I705",
            "label": "(ix) Quantity used for power generation (CPP)",
            "unit": "kilo Litre",
            "help": "Source: SAP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I706",
            "label": "(x) Quantity used for Internal material handling / Transportation (Raw material handling , Loco, etc)",
            "unit": "kilo Litre",
            "help": "Source: SAP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I707",
            "label": "(xi) Quantity used for process heating",
            "unit": "kilo Litre",
            "help": "Source: SAP",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_E.5_718",
        "label": "E.5 — Light Diesel Oil (LDO)",
        "kind": "fields",
        "fields": [
          {
            "id": "I719",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I720",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I722",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I723",
            "label": "(iv) Quantity purchased",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I724",
            "label": "(v) Average Density",
            "unit": "kg/ltr",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I726",
            "label": "(vii) Quantity used for power generation (DG Set)",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I727",
            "label": "(viii) Quantity used for power generation (CPP)",
            "unit": "kilo Litre",
            "help": "Source: SAP T CODE MB51 - (DIESELLIGHTKL)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I728",
            "label": "(ix) Quantity used for Internal Transportation, if any",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I729",
            "label": "(x) Quantity used for process heating",
            "unit": "kilo Litre",
            "help": "Source: SAP T CODE MB51 - (DIESELLIGHTKL)",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_E.6_740",
        "label": "E.6 — Liquid Waste \n(Pl. specify the type of Liquid Waste )",
        "kind": "fields",
        "fields": [
          {
            "id": "I741",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I742",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/ kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I744",
            "label": "(iv) Oxidation factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I745",
            "label": "(v) Quantity purchased",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I746",
            "label": "(vi) Average Density",
            "unit": "kg/ltr",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I747",
            "label": "(vii) % carbon (Fossil)",
            "unit": "%",
            "help": "Basis: Average",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I748",
            "label": "(viii) % carbon (Non- Fossil)",
            "unit": "%",
            "help": "Basis: Average",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I751",
            "label": "(xi) Quantity used for power generation (DG Set)",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I752",
            "label": "(xii) Quantity used for power generation (CPP)",
            "unit": "kilo Litre",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I753",
            "label": "(xiii) Quantity used for process",
            "unit": "kilo Litre",
            "help": "Source: SAP",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_F_775",
    "title": "F. Gaseous Fuel",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_F.1_776",
        "label": "F.1 — Natural Gas (CNG/NG/PNG/LNG)",
        "kind": "fields",
        "fields": [
          {
            "id": "I777",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/SCM",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I778",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/SCM",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I780",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I782",
            "label": "(vi) Quantity purchased",
            "unit": "Million SCM",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I783",
            "label": "(vii) Quantity used for power generation",
            "unit": "Million SCM",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I784",
            "label": "(viii) Quantity used for Internal transportation, if any",
            "unit": "Million SCM",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I785",
            "label": "(ix) Quantity used for process heating",
            "unit": "Million SCM",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_F.2_794",
        "label": "F.2 — Liquefied Petroleum Gas (LPG)",
        "kind": "fields",
        "fields": [
          {
            "id": "I795",
            "label": "(i) Landed Cost of fuel (Last purchase)",
            "unit": "Rs/Tonne",
            "help": "Basis: Basic Cost+Taxes+Freight",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I796",
            "label": "(ii) Gross calorific value",
            "unit": "kcal/kg",
            "help": "Basis: Annual (As Fired Basis)",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I798",
            "label": "(iv) Oxidation Factor",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I799",
            "label": "(iv) Quantity purchased",
            "unit": "Million kg",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I801",
            "label": "(vi) Quantity used for power generation",
            "unit": "Million kg",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I802",
            "label": "(vii) Quantity used for process heating",
            "unit": "Million kg",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_I_828",
    "title": "I. Performance Indicators",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_I_828_default",
        "label": "I. Performance Indicators",
        "kind": "fields",
        "fields": [
          {
            "id": "I830",
            "label": "I.2 Electrical SEC (up to Clinkerization)",
            "unit": "kWh/Tonne Clinker",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I832",
            "label": "I.4 Electrical SEC (Crusher)",
            "unit": "kWh/Tonne limetsone",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I833",
            "label": "I.5 Electrical SEC (Raw Mill)",
            "unit": "kWh/Tonne Raw meal",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I834",
            "label": "I.6 Electrical SEC (Clinkerisation)",
            "unit": "kWh/Tonne Clinker",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I835",
            "label": "I.7 Electrical SEC (Coal Mill)",
            "unit": "kWh/Tonne Coal",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I836",
            "label": "I.8 Electrical SEC (Packing Plant)",
            "unit": "kWh/Tonne Cement",
            "help": "Source: IBM Cognos TM1 Web",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I837",
            "label": "I.9 Electrical SEC (GGBS)",
            "unit": "kWh/Tonne GGBS",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I838",
            "label": "I.10 Thermal SEC (GGBS)",
            "unit": "kcal/kg GGBS",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_J_839",
    "title": "J. Raw Material Quality",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_J_839_default",
        "label": "J. Raw Material Quality",
        "kind": "fields",
        "fields": [
          {
            "id": "I840",
            "label": "J.1 Lime Stone Bond Index",
            "unit": "kWh/short Ton",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I841",
            "label": "J.2 Burnability",
            "unit": "Factor",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I842",
            "label": "J.3 CaO",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I843",
            "label": "J.4 MgO",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I844",
            "label": "J.5 Organic Matter",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I845",
            "label": "J.6 FeO",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I846",
            "label": "J.7 Fe2O3",
            "unit": "%",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_K_847",
    "title": "K. Coal Quality in CPP (As Fired Basis)",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_K_847_default",
        "label": "K. Coal Quality in CPP (As Fired Basis)",
        "kind": "fields",
        "fields": [
          {
            "id": "I848",
            "label": "K.1 Ash",
            "unit": "%",
            "help": "Source: ZRPP_DVTEJ - TPP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I849",
            "label": "K.2 Moisture",
            "unit": "%",
            "help": "Source: ZRPP_DVTEJ - TPP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I850",
            "label": "K.3 Hydrogen",
            "unit": "%",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I851",
            "label": "K.4 GCV",
            "unit": "kcal/kg",
            "help": "Source: ZRPP_DVTEJ - TPP",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I852",
            "label": "K.5 % Carbon in Ash (ash generated from CPP)",
            "unit": "%",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_L_853",
    "title": "L. Miscelleneous Data $",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_L.1_854",
        "label": "L.1 — Additional Equipment installation after baseline year due to Environmental Concern",
        "kind": "fields",
        "fields": [
          {
            "id": "I855",
            "label": "(i) Additional Electrical Energy Consumed",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I856",
            "label": "(ii) Additional Thermal Energy Consumed",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_L.2_858",
        "label": "L.2 — Biomass/ Alternate Fuel availability (as per Sr. No D.9/D.10/E.6)",
        "kind": "fields",
        "fields": [
          {
            "id": "I859",
            "label": "(i) Biomass replacement with Fossil fuel due to Biomass un-availability (used in the process)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I860",
            "label": "(ii) Alternate Solid Fuel replacement with Fossil fuel due to Alternate Solid Fuel un-availability (used in the process)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I861",
            "label": "(iii) Alternate Liquid Fuel replacement with Fossil fuel due to Alternate Liquid Fuel un-availability (used in the process)",
            "unit": "Tonne",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_L.3_862",
        "label": "L.3 — Project Activities (Construction Phase)",
        "kind": "fields",
        "fields": [
          {
            "id": "I863",
            "label": "(i) Electrical Energy Consumed due to commissioning of Equipment",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I864",
            "label": "(ii) Thermal Energy Consumed due to commissioning of Equipment",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          }
        ]
      },
      {
        "id": "q_L.4_865",
        "label": "L.4 — New Line/Unit Commissioning",
        "kind": "fields",
        "fields": [
          {
            "id": "I866",
            "label": "(i) Electrical Energy Consumed due to commissioning of New process Line/Unit till it attains 70% of Capacity Utilisation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I867",
            "label": "(ii) Thermal Energy Consumed due to commissioning of New Process Line/Unit till it attains 70% of Capacity Utilisation",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I868",
            "label": "(iii) Clinker Production till new line attains 70% of Capacity utilisatiion",
            "unit": "Tonns",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I869",
            "label": "(iv) Date of Commissioning (70% Capacity Utilisation)",
            "help": "Basis: Date",
            "kind": "date"
          },
          {
            "id": "I870",
            "label": "(v) Electrical Energy Consumed from external source due to commissioning of New Line/Unit till it attains 70% of Capacity Utilisation in Power generation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I871",
            "label": "(vi) Thermal Energy Consumed due to commissioning of New Line/Unit till it attains 70% of Capacity Utilisation in Power generation",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I872",
            "label": "(vii) Net Electricity Generation till new Line/Unit attains 70% Capacity Utilisation",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I873",
            "label": "(viii) Date of Commissioning (70% Capacity Utilisation) Power Generation",
            "help": "Basis: Date",
            "kind": "date"
          }
        ]
      },
      {
        "id": "q_L.5_874",
        "label": "L.5 — Unforeseen Circumstances",
        "kind": "fields",
        "fields": [
          {
            "id": "I875",
            "label": "(i) Electrical Energy to be Normalised",
            "unit": "Lakh kWh",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I876",
            "label": "(ii) Thermal Energy to be Normalised",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_M_880",
    "title": "M. Documentation for Normalisation",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_M_880_default",
        "label": "M. Documentation for Normalisation",
        "kind": "fields",
        "fields": [
          {
            "id": "I881",
            "label": "(i) Capacity Utilization-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I882",
            "label": "(ii) Fuel Quality in CPP-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I883",
            "label": "(iii) Petcoke Utilization in Kiln-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I884",
            "label": "(iv) CPP PLF- Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I885",
            "label": "(v) Power Mix-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I886",
            "label": "(vi) Product Mix-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I887",
            "label": "(viii) Others Factors-Document Available for Normalisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          },
          {
            "id": "I888",
            "label": "(ix) Bond Index-Document Available for Normailisation",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "sec_N_890",
    "title": "N. Energy Saving and Investment",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_sec_N_890_default",
        "label": "N. Energy Saving and Investment",
        "kind": "fields",
        "fields": [
          {
            "id": "I891",
            "label": "(i) Investment made for achieving target",
            "unit": "Million Rs",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I892",
            "label": "(ii) Thermal Energy Saving during the year",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I893",
            "label": "a Solid Fuel",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I894",
            "label": "a.1 Coal",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I895",
            "label": "a.2 Lignite",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I896",
            "label": "a.3 Petro Coke",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I897",
            "label": "a.4 Biomass/Waste",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I898",
            "label": "b Liquid Fuel (FO/HSD/LDO/LSHS/HSHS)",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I899",
            "label": "c Gaseous Fuel",
            "unit": "Million kcal",
            "kind": "number",
            "min": 0
          },
          {
            "id": "I900",
            "label": "(iii) Electrical energy Saving during the year",
            "unit": "Lakh kWH",
            "kind": "number",
            "min": 0
          }
        ]
      }
    ]
  },
  {
    "id": "sec_P_904",
    "title": "P. Process GHG Emissions Estimate",
    "sheetRef": "Form-Sb",
    "questions": [
      {
        "id": "q_P.1_907",
        "label": "P.1 — Process CO2 Emission Estimate",
        "kind": "fields",
        "fields": [
          {
            "id": "I909",
            "label": "2.a Method for Process CO2 emissions calculation (Type 1)",
            "help": "Basis: Type 1- Emission Factor (CSI)",
            "kind": "text"
          },
          {
            "id": "I910",
            "label": "2.b Method for Process CO2 emissions calculation (Type 2)",
            "help": "Basis: Type 2-Unit Specific method",
            "kind": "text"
          },
          {
            "id": "I911",
            "label": "Select method for Process CO2 emissions calculation",
            "unit": "-",
            "help": "Basis: -",
            "kind": "select",
            "options": [
              "Yes",
              "No"
            ]
          }
        ]
      }
    ]
  }
];
