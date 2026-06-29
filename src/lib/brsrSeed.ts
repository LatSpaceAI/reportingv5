// Seed data for the BRSR report — extracted from the published
// Business Responsibility & Sustainability Report of **Sagar Cements Limited
// (FY 2023-24)** (Integrated Report 2023-24, BRSR Annexure I).
//
// Shape mirrors what the Questionnaire persists to localStorage: a map of
// questionId -> { values?, rows? }. `values` is for FieldsQuestion answers,
// `rows` for TableQuestion answers (each row keyed by column id). The
// Questionnaire merges this into blank state on first load (when no saved
// answers exist for the BRSR framework) — user edits then persist and win.
//
// Numbers are stored as JS numbers (commas / ₹ / % stripped). Amounts that the
// source reported in Lakhs are kept as printed (e.g. turnover 2,50,461 Lakhs ->
// 250461) — see the inline notes where the unit matters.
//
// This is illustrative seed/sample data, not a substitute for the entity's own
// filing. Cells the source left blank / "NIL" are seeded as 0 for numeric
// fields so the requirements tab reflects them as filled.

// A single answer's value map (field id / column id -> value). Mirrors
// RowValues in @/components/Fields but defined locally so this data module has
// no dependency on client-only component code.
type SeedValue = string | number | boolean | null | undefined;
type SeedRow = Record<string, SeedValue>;

export interface SeedAnswer {
  values?: SeedRow;
  rows?: SeedRow[];
}

export const brsrSeed: Record<string, SeedAnswer> = {
  // ===================== SECTION A =====================
  "A.1": {
    values: {
      cin: "L26942TG1981PLC002887",
      name: "Sagar Cements Limited",
      yearOfIncorporation: 1981,
      registeredAddress: "Plot No.111, Road No.10 Jubilee Hills, Hyderabad-500 033",
      corporateAddress: "Plot No.111, Road No.10 Jubilee Hills, Hyderabad-500 033",
      email: "info@sagarcements.in",
      telephone: "040 - 23351571",
      website: "www.sagarcements.in",
      financialYear: "FY 2023-24",
      stockExchange: "BSE & NSE",
      paidUpCapital: 261415096,
      brsrContact:
        "Shri O. Anji Reddy, Chief Sustainability Officer, Sagar Cements Limited, Regd. Office: Plot No.111, Road No.10, Jubilee Hills, Hyderabad-500 033. Telangana. Tel.040 23351571. E-mail: anjireddy@sagarcements.in",
      reportingBoundary:
        "Consolidated (entity + subsidiaries forming part of consolidated financials)",
    },
  },
  "A.14": {
    rows: [
      {
        mainActivity: "Manufacture and Sale of Clinker & Cement",
        businessActivity: "Manufacture and Sale of Clinker & Cement",
        pctTurnover: 99,
      },
    ],
  },
  "A.15": {
    rows: [
      { productService: "Sale of Cement & Clinker", nicCode: "2394", pctTurnoverContributed: 99 },
      { productService: "Sale of Power", nicCode: "2710", pctTurnoverContributed: 1 },
    ],
  },
  "A.16": {
    rows: [
      { plants: 6, offices: 11, total: 17 },
      { plants: 0, offices: 0, total: 0 },
    ],
  },
  "A.17": {
    values: {
      nationalStates: 10,
      exportTurnoverPct: 0,
      customerTypes:
        "Dealers, Government departments, Institutional customers and retail customers/end users, Real Estate Developers; Infrastructure Companies; Institutional Buyers.",
    },
  },
  "A.18a": {
    rows: [
      { total: 1094, maleNo: 1077, malePct: 98.44, femaleNo: 17, femalePct: 1.55 },
      { total: 0, maleNo: 0, malePct: 0, femaleNo: 0, femalePct: 0 },
      { total: 95, maleNo: 95, malePct: 100, femaleNo: 0, femalePct: 0 },
      { total: 2202, maleNo: 2107, malePct: 95.68, femaleNo: 95, femalePct: 4.31 },
    ],
  },
  "A.18b": {
    rows: [
      { total: 0, maleNo: 0, malePct: 0, femaleNo: 0, femalePct: 0 },
      { total: 0, maleNo: 0, malePct: 0, femaleNo: 0, femalePct: 0 },
      { total: 0, maleNo: 0, malePct: 0, femaleNo: 0, femalePct: 0 },
      { total: 0, maleNo: 0, malePct: 0, femaleNo: 0, femalePct: 0 },
    ],
  },
  "A.19": {
    rows: [
      { total: 9, femaleNo: 3, femalePct: 33.33 },
      { total: 3, femaleNo: 0, femalePct: 0 },
    ],
  },
  "A.20": {
    rows: [
      {
        currMale: 1077, currFemale: 17, currTotal: 15.84,
        prevMale: 926, prevFemale: 10, prevTotal: 16.53,
        priorMale: 923, priorFemale: 8, priorTotal: 14.65,
      },
      {
        currMale: 95, currFemale: 0,
        prevMale: 104, prevFemale: 0,
        priorMale: 0, priorFemale: 0,
      },
    ],
  },
  "A.21": {
    rows: [
      { name: "Andhra Cements Limited", relationship: "Subsidiary", sharesHeldPct: 90, participatesInBR: "Yes" },
      { name: "Sagar Cements (M) Private Limited", relationship: "Subsidiary", sharesHeldPct: 65, participatesInBR: "Yes" },
    ],
  },
  // Turnover & net worth reported in ₹ Lakhs in the source (2,50,461 / 2,01,969 Lakhs).
  "A.22": {
    values: { csrApplicable: "Yes", turnover: 250461, netWorth: 201969 },
  },
  "A.23": {
    rows: [
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 189, currPending: 2, prevFiled: 185, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { mechanismInPlace: "Yes", currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
    ],
  },
  "A.24": {
    rows: [
      {
        issue: "Waste Management and Circular Economy",
        riskOrOpp: "Opportunity",
        rationale:
          "Waste management is a critical issue and moving towards a circular economy can be an alternative, it is important to continue innovating processes to materialise its vision of scaling up the recycling of its materials and maximising circularity including across the value chain.",
        approach:
          "Sagar Cements Limited (SGC) is committed to adhering to environmentally friendly and sustainable operations by practicing circular economy. Circular economy offers great opportunity to lower the use of limestone, fossil fuel and clinker in cement production and reduces the emission of GHG. The Company is investing heavily in using waste from operations to convert into energy and reduce the emissions.",
        financialImplications: "Positive",
      },
      {
        issue: "Health and Safety",
        riskOrOpp: "Risk",
        rationale:
          "Employee health and safety is a non-negotiable aspect to ensure that human capital is provided with a working environment that places utmost emphasis on their mental and physical well-being.",
        approach:
          "Safety and operational risk management framework continues to play a pivotal role. Company have devised ways to review and audit the facilities periodically through virtual and physical means.",
        financialImplications: "Negative",
      },
      {
        issue: "Governance and ethics",
        riskOrOpp: "Opportunity",
        rationale:
          "Strong ethics and transparent governance system acts as guiding pillar for business and supports growth and development",
        approach:
          "Increased transparency in disclosures and data and Strengthening relationship with Stakeholders",
        financialImplications: "Positive",
      },
      {
        issue: "Climate Change",
        riskOrOpp: "Risk",
        rationale:
          "With the increasing awareness around climate change, it is crucial for the company to address the challenges by taking conscious efforts to ensure that the Company continues to respond to the issue and develop a pathway to decarbonise its operations.",
        approach:
          "Addressing climate change through energy transition is a strategic focus of the company's business and continuity plans. Sagar Cements Limited aims to attain Net Carbon Zero target, going beyond compliance requirements and business imperatives.",
        financialImplications: "Negative",
      },
      {
        issue: "Water and Effluent Management",
        riskOrOpp: "Opportunity",
        rationale:
          "Water shortage and availability can hamper operations and business continuity. Because of stringent norms related to water discharge, water treatment cost is bound to increase manifold.",
        approach:
          "Company has undertaken initiatives and taken steps towards rain water harvesting and monitoring water usage on regular basis. Also efforts are made by the company to convert the waste heat to usable waste and also recycling and reuse of waste water.",
        financialImplications: "Negative",
      },
      {
        issue: "Global regulation on curbing Green House Gases Emission",
        riskOrOpp: "Risk",
        rationale:
          "Limestone is the main input for cement manufacturing and requires fossil fuel for burning the limestone. This process releases CO2 during calcination of limestone and combustion of fuel. This could contribute to global warming and impact business continuity and/or disruption.",
        approach:
          "To mitigate the risk, the Company has set voluntary targets to reduce emissions. The Company is taking initiatives such as energy transition to renewables, increasing the waste heat recovery systems, increase in green product portfolio and use of alternative fuels and raw materials. The Company is also exploring innovative technologies to reduce the emissions",
        financialImplications: "Negative",
      },
    ],
  },

  // ===================== SECTION B =====================
  "B.1": {
    rows: [
      { P1: "Y", P2: "Y", P3: "Y", P4: "Y", P5: "Y", P6: "Y", P7: "N", P8: "Y", P9: "Y" },
      { P1: "Y", P2: "Y", P3: "Y", P4: "Y", P5: "Y", P6: "Y", P7: "N", P8: "Y", P9: "Y" },
      {
        P1: "https://sagarcements.in/investors/policies",
        P2: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
        P3: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
        P4: "https://sagarcements.in/investors/policies",
        P5: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
        P6: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
        P7: "N",
        P8: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
        P9: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cements_Policies-1_10.5.2023.pdf",
      },
    ],
  },
  "B.2": {
    values: { P1: "Yes", P2: "Yes", P3: "Yes", P4: "Yes", P5: "Yes", P6: "Yes", P7: "Yes", P8: "Yes", P9: "Yes" },
  },
  "B.3": {
    values: { P1: "Yes", P2: "Yes", P3: "Yes", P4: "Yes", P5: "Yes", P6: "Yes", P7: "Yes", P8: "Yes", P9: "Yes" },
  },
  "B.4": {
    values: {
      P1: "Earned an ISO 14001:2015 and ISO 50001:2018 certification; Compliant to ISO 26000 standards; Blended cements from all plants certified as Green Pro in 2019; Committed to SBT to reduce emissions, aligned with the 1.5°C goal; Bayyavaram Plant received the GreenCo Platinum Certificate award by CII for best practices; Gudipadu and Mattampally Plants received GreenCo Gold Certificate award by CII for best practices; Certified for ISO 9001:2015 & ISO 45001:2018 management system standards; Mattampally and Bayyavaram unit Laboratories are accredited with NABL certifications",
    },
  },
  "B.5": { values: { P1: "NA" } },
  "B.6": { values: { P1: "NA" } },
  "B.7": {
    values: { statement: "Please refer to MD and JMD message on page no. 21 of the Integrated Report 2023-24." },
  },
  "B.8": {
    values: { name: "Shri S Sreekanth Reddy", designation: "Joint Managing Director" },
  },
  "B.9": {
    values: {
      committeeExists: "Yes",
      details: "Committee consists of Joint Managing Director as Chairman along with other functional heads",
    },
  },
  "B.10a": {
    rows: [
      { P1: "Committees of Board", P2: "Committees of Board", P3: "Committees of Board", P4: "Committees of Board", P5: "Committees of Board", P6: "Committees of Board", P7: "Committees of Board", P8: "Committees of Board", P9: "Committees of Board" },
      { P1: "Committees of Board", P2: "Committees of Board", P3: "Committees of Board", P4: "Committees of Board", P5: "Committees of Board", P6: "Committees of Board", P7: "Committees of Board", P8: "Committees of Board", P9: "Committees of Board" },
    ],
  },
  "B.10b": {
    rows: [
      { P1: "Annually", P2: "Annually", P3: "Annually", P4: "Annually", P5: "Annually", P6: "Annually", P7: "Annually", P8: "Annually", P9: "Annually" },
      { P1: "Annually", P2: "Annually", P3: "Annually", P4: "Annually", P5: "Annually", P6: "Annually", P7: "Annually", P8: "Annually", P9: "Annually" },
    ],
  },
  "B.11": {
    rows: [
      { P1: "No", P2: "No", P3: "No", P4: "No", P5: "No", P6: "No", P7: "No", P8: "No", P9: "No" },
      {},
    ],
  },

  // ===================== SECTION C — PRINCIPLE 1 =====================
  "C.P1.E1": {
    rows: [
      { totalPrograms: 0, topics: "Nil", pctCovered: 0 },
      { totalPrograms: 0, topics: "Nil", pctCovered: 0 },
      { totalPrograms: 637, topics: "Soft and Technical Skill Development and Safety", pctCovered: 100 },
      { totalPrograms: 69, topics: "Soft and Technical Skill Development and Safety", pctCovered: 73 },
    ],
  },
  "C.P1.E2_monetary": {
    rows: [
      { agency: "NIL", amount: 0, brief: "NA", appealed: "No" },
      { agency: "NIL", amount: 0, brief: "NA", appealed: "No" },
      { agency: "NIL", amount: 0, brief: "NA", appealed: "No" },
    ],
  },
  "C.P1.E2_nonmonetary": {
    rows: [
      { agency: "Nil", brief: "Nil" },
      { agency: "Nil", brief: "Nil" },
    ],
  },
  "C.P1.E3": { rows: [{ caseDetails: "NA", agency: "NA" }] },
  "C.P1.E4": {
    values: {
      policyExists: "Yes",
      brief:
        "SGC is committed to conducting business in an ethical and honest manner and is committed to formulating, implementing, and enforcing systems to prevent corruption at every level.",
      webLink: "https://sagarcements.in/wp-content/uploads/2020/08/Sagar-Cement_Policies-1.pdf",
    },
  },
  "C.P1.E5": {
    rows: [
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
    ],
  },
  "C.P1.E6": {
    rows: [
      { currNumber: 0, currRemarks: "Nil", prevNumber: 0, prevRemarks: "Nil" },
      { currNumber: 0, currRemarks: "Nil", prevNumber: 0, prevRemarks: "Nil" },
    ],
  },
  "C.P1.E7": { values: { details: "Not applicable" } },
  "C.P1.L1": { rows: [{ totalPrograms: 0, topics: "Nil", pctCovered: 0 }] },
  "C.P1.L2": { values: { processInPlace: "Yes" } },

  // ===================== PRINCIPLE 2 =====================
  "C.P2.E1": {
    rows: [
      { currentFY: 90, previousFY: 89, improvements: "NIL" },
      { currentFY: 0, previousFY: 0, improvements: "NIL" },
    ],
  },
  "C.P2.E2": { values: { hasProcedures: "Yes", pctSourced: 0 } },
  "C.P2.E3": {
    values: {
      plastics: "The Company aims to follow circular economy model in the manufacturing and end use stage of the product lifecycle.",
      eWaste: "The Company aims to follow circular economy model in the manufacturing and end use stage of the product lifecycle.",
      hazardous: "The Company aims to follow circular economy model in the manufacturing and end use stage of the product lifecycle.",
      other: "The Company aims to follow circular economy model in the manufacturing and end use stage of the product lifecycle.",
    },
  },
  "C.P2.E4": {
    values: {
      eprApplicable: "Yes",
      alignedWithEpr: "Yes",
      steps: "Yes, the waste collection plan is in line with the EPR plan submitted to Pollution Control Board.",
    },
  },
  "C.P2.L1": {
    rows: [
      { nicCode: "2394", name: "Cement and Clinker", pctTurnover: 7, boundary: "Mattampally Plant", externalAgency: "Yes", publicDomain: "Yes" },
    ],
  },
  "C.P2.L2": {
    rows: [
      { name: "As per LCA", risk: "https://sagarcements.in/wp-content/uploads/2023/06/Environmental-Monitoring-report-March-2024.pdf" },
    ],
  },
  "C.P2.L3": {
    rows: [{ inputMaterial: "Fly Ash, Belts, Tyres, Waste Oil", currentFY: 78, previousFY: 80 }],
  },
  "C.P2.L4": {
    rows: [
      { currReUsed: 0, currRecycled: 71.5, currDisposed: 0, prevReUsed: 0, prevRecycled: 21, prevDisposed: 0 },
      { currReUsed: 0, currRecycled: 0.723, currDisposed: 0, prevReUsed: 0, prevRecycled: 0.08, prevDisposed: 0 },
      { currReUsed: 40.8, currRecycled: 0, currDisposed: 0, prevReUsed: 23.8, prevRecycled: 0, prevDisposed: 0 },
      { currReUsed: 66687, currRecycled: 0, currDisposed: 0, prevReUsed: 58806, prevRecycled: 0, prevDisposed: 0 },
    ],
  },
  "C.P2.L5": { rows: [{ category: "Nil", pct: 0 }] },

  // ===================== PRINCIPLE 3 =====================
  "C.P3.E1a": {
    rows: [
      { total: 1077, health: 1077, accident: 1077, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 17, health: 17, accident: 17, maternity: 17, paternity: 0, dayCare: 0 },
      { total: 1097, health: 1097, accident: 1097, maternity: 17, paternity: 0, dayCare: 0 },
      { total: 0, health: 0, accident: 0, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 0, health: 0, accident: 0, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 0, health: 0, accident: 0, maternity: 0, paternity: 0, dayCare: 0 },
    ],
  },
  "C.P3.E1b": {
    rows: [
      { total: 95, health: 95, accident: 95, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 0, health: 0, accident: 0, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 95, health: 95, accident: 95, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 2107, health: 2107, accident: 2107, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 95, health: 95, accident: 95, maternity: 0, paternity: 0, dayCare: 0 },
      { total: 2202, health: 2202, accident: 2202, maternity: 0, paternity: 0, dayCare: 0 },
    ],
  },
  "C.P3.E2": {
    rows: [
      { currEmpPct: 100, currWorkerPct: 100, currDeposited: "Yes", prevEmpPct: 100, prevWorkerPct: 100, prevDeposited: "Yes" },
      { currEmpPct: 100, currWorkerPct: 100, currDeposited: "Yes", prevEmpPct: 100, prevWorkerPct: 100, prevDeposited: "Yes" },
      { currEmpPct: 100, currWorkerPct: 0.07, currDeposited: "Yes", prevEmpPct: 100, prevWorkerPct: 0.05, prevDeposited: "Yes" },
      { currEmpPct: 0, currWorkerPct: 0, currDeposited: "Not Applicable", prevEmpPct: 0, prevWorkerPct: 0, prevDeposited: "Not Applicable" },
    ],
  },
  "C.P3.E3": { values: { accessible: "Yes", steps: "Yes" } },
  "C.P3.E4": { values: { policyExists: "No" } },
  "C.P3.E5": {
    rows: [
      { empReturn: 0, empRetention: 0, workerReturn: 0, workerRetention: 0 },
      { empReturn: 0, empRetention: 0, workerReturn: 0, workerRetention: 0 },
      { empReturn: 0, empRetention: 0, workerReturn: 0, workerRetention: 0 },
    ],
  },
  "C.P3.E6": {
    rows: [
      { mechanismExists: "Yes", brief: "Yes. Through one to one interaction and conducting group meetings" },
      { mechanismExists: "Yes", brief: "Yes. Through one to one interaction and conducting group meetings" },
      { mechanismExists: "Yes", brief: "Yes. Through one to one interaction and conducting group meetings" },
      { mechanismExists: "Yes", brief: "Yes. Through one to one interaction and conducting group meetings" },
    ],
  },
  "C.P3.E7": {
    rows: [
      { currTotal: 1094, currMembers: 0, currPct: 0, prevTotal: 936, prevMembers: 0, prevPct: 0 },
      { currTotal: 95, currMembers: 86, currPct: 90.5, prevTotal: 107, prevMembers: 0, prevPct: 0 },
      { currTotal: 0, currMembers: 0, currPct: 0, prevTotal: 0, prevMembers: 0, prevPct: 0 },
    ],
  },
  "C.P3.E8": {
    rows: [
      { currTotal: 1077, currHealthSafety: 1235, currSkill: 1032, prevTotal: 926, prevHealthSafety: 626, prevSkill: 654 },
      { currTotal: 17, currHealthSafety: 3, currSkill: 1, prevTotal: 10, prevHealthSafety: 0, prevSkill: 10 },
      { currTotal: 1094, currHealthSafety: 1238, currSkill: 1033, prevTotal: 936, prevHealthSafety: 624, prevSkill: 664 },
      { currTotal: 95, currHealthSafety: 49, currSkill: 108, prevTotal: 104, prevHealthSafety: 104, prevSkill: 104 },
      { currTotal: 0, currHealthSafety: 0, currSkill: 0, prevTotal: 0, prevHealthSafety: 0, prevSkill: 0 },
      { currTotal: 95, currHealthSafety: 49, currSkill: 108, prevTotal: 104, prevHealthSafety: 104, prevSkill: 104 },
    ],
  },
  "C.P3.E9": {
    rows: [
      { currTotal: 1077, currCovered: 736, currPct: 68.33, prevTotal: 926, prevCovered: 845, prevPct: 91.25 },
      { currTotal: 17, currCovered: 8, currPct: 47.05, prevTotal: 10, prevCovered: 10, prevPct: 100 },
      { currTotal: 1094, currCovered: 744, currPct: 68.0, prevTotal: 936, prevCovered: 855, prevPct: 91.34 },
      { currTotal: 0, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 0, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 0, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
    ],
  },
  "C.P3.E10": {
    values: {
      ohsImplemented: "Yes",
      coverage: "Total work force covered.",
      hazardProcesses: "Regular safety drills are being conducted.",
      workerReporting: "Yes",
      medicalAccess: "Yes",
    },
  },
  "C.P3.E11": {
    rows: [
      { currentFY: 0, previousFY: 0 },
      { currentFY: 1, previousFY: 1.6 },
      { currentFY: 5, previousFY: 2 },
      { currentFY: 86, previousFY: 22 },
      { currentFY: 1, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 1, previousFY: 0 },
      { currentFY: 10, previousFY: 1 },
    ],
  },
  "C.P3.E12": {
    values: {
      measures:
        "Ensuring the safety and health of the workforce has been and will continue to be of paramount importance for Sagar Cements Limited. The workforce undergoes an induction before starting work so that they are familiarised with the work processes, safety rules and also the hazards and the related controls in their respective tasks. Company has established a robust process for hazard identification and risk assessment for tasks that may pose a risk, and puts in place control measures to mitigate the identified risks.",
    },
  },
  "C.P3.E13": {
    rows: [
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
    ],
  },
  "C.P3.E14": { rows: [{ pctAssessed: 0 }, { pctAssessed: 0 }] },
  "C.P3.E15": { values: { details: "Nil" } },
  "C.P3.L1": { values: { employees: "Yes", workers: "Yes" } },
  "C.P3.L2": { values: { measures: "Verification of records done at regular intervals for all value chain partners." } },
  "C.P3.L3": {
    rows: [
      { currTotal: 0, prevTotal: 0, currRehab: 0, prevRehab: 0 },
      { currTotal: 0, prevTotal: 0, currRehab: 0, prevRehab: 0 },
    ],
  },
  "C.P3.L4": { values: { provides: "No" } },
  "C.P3.L5": { rows: [{ pctAssessed: 0 }, { pctAssessed: 0 }] },
  "C.P3.L6": {
    values: {
      details:
        "Annual Health check-up is conducted for all the employees and workers and based on the outcome, necessary support is provided to address the same.",
    },
  },

  // ===================== PRINCIPLE 4 =====================
  "C.P4.E1": {
    values: {
      processes:
        "At Sagar Cements Limited, we believe that our responsibility goes beyond delivering quality products to our customers. We actively seek input and feedback from our stakeholders — employees, suppliers, customers, regulators, investors, and the communities we operate in — through various channels, allowing us to understand their perspectives and incorporate their valuable suggestions.",
    },
  },
  "C.P4.E2": {
    rows: [
      { group: "Employees", vulnerable: "Yes", channels: "Internal communication platforms, Meetings, Notice Board, E-mail", frequency: "Other (specify)", purpose: "Employee engagement is an on-going exercise conducted throughout the year." },
      { group: "Customers", vulnerable: "Yes", channels: "Website, E-mails, Pamphlets, Advertisement, Surveys and Grievance Redressal", frequency: "Other (specify)", purpose: "Product Review, Customer satisfaction, feedback, understanding client, business and industry challenges and grievances" },
      { group: "Investors and Shareholders", vulnerable: "No", channels: "General Meetings, Investor Meetings, Annual reports and website", frequency: "Annually", purpose: "To keep investors and shareholders updated about the organisation's performance and other corporate developments and understanding their expectations" },
      { group: "Suppliers and contractors", vulnerable: "No", channels: "Meetings, feedback and grievance systems", frequency: "Other (specify)", purpose: "Adaptation of procurement processes to environmental, economic and ethical requirements and adherence to the Supplier code of conduct, and long-term business relationships." },
      { group: "Government and Regulators", vulnerable: "No", channels: "Regulatory filings, Website, etc.", frequency: "Other (specify)", purpose: "Good governance practice; community engagement; regulatory compliance; environmental initiatives" },
      { group: "Community", vulnerable: "Yes", channels: "Website, Surveys and one on one meetings", frequency: "Other (specify)", purpose: "To understand community needs, implementation of CSR, etc." },
    ],
  },

  // ===================== PRINCIPLE 5 =====================
  "C.P5.E1": {
    rows: [
      { currTotal: 1094, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 0, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 1094, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 95, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 0, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
      { currTotal: 95, currCovered: 0, currPct: 0, prevTotal: 0, prevCovered: 0, prevPct: 0 },
    ],
  },
  "C.P5.E2": {
    rows: [
      { currTotal: 1077, currEqual: 0, currMore: 1077, prevTotal: 926, prevEqual: 0, prevMore: 104 },
      { currTotal: 17, currEqual: 0, currMore: 17, prevTotal: 10, prevEqual: 0, prevMore: 0 },
      { currTotal: 0, currEqual: 0, currMore: 0, prevTotal: 0, prevEqual: 0, prevMore: 0 },
      { currTotal: 0, currEqual: 0, currMore: 0, prevTotal: 0, prevEqual: 0, prevMore: 0 },
      { currTotal: 95, currEqual: 0, currMore: 95, prevTotal: 104, prevEqual: 0, prevMore: 104 },
      { currTotal: 0, currEqual: 0, currMore: 0, prevTotal: 0, prevEqual: 0, prevMore: 0 },
      { currTotal: 2107, currEqual: 1453, currMore: 654, prevTotal: 1773, prevEqual: 1064, prevMore: 710 },
      { currTotal: 95, currEqual: 95, currMore: 0, prevTotal: 93, prevEqual: 93, prevMore: 0 },
    ],
  },
  "C.P5.E3": {
    rows: [
      { maleNumber: 0, maleMedian: 0, femaleNumber: 0, femaleMedian: 0 },
      { maleNumber: 3, maleMedian: 81.97, femaleNumber: 0, femaleMedian: 0 },
      { maleNumber: 802, maleMedian: 5.63, femaleNumber: 13, femaleMedian: 6.06 },
      { maleNumber: 0, maleMedian: 0, femaleNumber: 0, femaleMedian: 0 },
    ],
  },
  "C.P5.E4": { values: { focalPointExists: "Yes" } },
  "C.P5.E5": { values: { mechanisms: "Workmen Grievance Redressal Committee addresses the complaints, if any, on case to case basis." } },
  "C.P5.E6": {
    rows: [
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
      { currFiled: 0, currPending: 0, prevFiled: 0, prevPending: 0 },
    ],
  },
  "C.P5.E7": { values: { mechanisms: "Workmen Grievance Redressal Committee addresses the complaints, if any, on case to case basis." } },
  "C.P5.E8": { values: { included: "Yes" } },
  "C.P5.E10": { values: { details: "NA" } },
  "C.P5.L3": { values: { accessible: "No" } },
  "C.P5.L5": { values: { details: "NA" } },

  // ===================== PRINCIPLE 6 =====================
  "C.P6.E1": {
    rows: [
      { currentFY: 1657.88, previousFY: 1220.73 },
      { currentFY: 13553.63, previousFY: 11023.46 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 15211.51, previousFY: 12381.74 },
      { currentFY: 0.61, previousFY: 0.56 },
      { currentFY: 726, previousFY: 726 },
    ],
  },
  "C.P6.E1_assurance": { values: { external: "Yes", agency: "TUV India Private Limited" } },
  "C.P6.E2": {
    values: {
      hasDCs: "Yes",
      targetsAchieved: "Yes",
      remedial:
        "Mattampally Plant: Target well below 0.0914 TOE/ton of product, Achieved 0.0909 TOE/ton of product. Gudipadu Plant: Target well below 0.1241 TOE/ton of product, Achieved 0.0903 TOE/ton of product. Bayyavaram comes under PAT scheme, Target not yet set by PAT scheme of GOI.",
    },
  },
  "C.P6.E3": {
    rows: [
      { currentFY: 630198, previousFY: 499775 },
      { currentFY: 243714, previousFY: 285105 },
      { currentFY: 25200, previousFY: 11489 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 899112, previousFY: 796369 },
      { currentFY: 899112, previousFY: 796369 },
      { currentFY: 35.9, previousFY: 35.72 },
    ],
  },
  "C.P6.E4": { values: { implemented: "Yes", details: "Yes, ZLD has been implemented over all the plants." } },
  "C.P6.E5": {
    rows: [
      { unit: "MT", currentFY: 2820, previousFY: 2496 },
      { unit: "MT", currentFY: 232, previousFY: 298 },
      { unit: "MT", currentFY: 198, previousFY: 212 },
      { unit: "MT", currentFY: 0, previousFY: 0 },
      { unit: "MT", currentFY: 0, previousFY: 0 },
      { unit: "MT", currentFY: 0, previousFY: 0 },
      { unit: "MT", currentFY: 0.29, previousFY: 0.25 },
    ],
  },
  "C.P6.E6": {
    rows: [
      { currentFY: 3671703, previousFY: 3099944 },
      { currentFY: 198660, previousFY: 119950 },
      { currentFY: 154.5, previousFY: 144.4 },
      { currentFY: 666, previousFY: 680 },
    ],
  },
  "C.P6.E7": {
    values: {
      hasProject: "Yes",
      details:
        "1. Installation of 6 MW solar power project in Gudipadu. 2. Installation 4 MW WHRS at Gudipadu. 3. Plastic Waste Feeding Setup in Pyro Redox Operational system in Jeerabad. 4. New AF feeding system commissioned to enhance our TSR %. 5. Initiated a pilot project for biomass cultivation as fuel for cement kiln in Mattampally. 6. Deployed two electric trucks (35 Tonnes Net load) into our operations at Bayyavaram unit. 7. Two E-loaders each are in operation at Mattampally and Dachepalli Units.",
    },
  },
  "C.P6.E8": {
    rows: [
      { currentFY: 71.48, previousFY: 21 },
      { currentFY: 0.723, previousFY: 0.08 },
      { currentFY: 0.067, previousFY: 0.03 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 1.68, previousFY: 2.35 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 40.8, previousFY: 23.8 },
      { currentFY: 66687, previousFY: 58806 },
      { currentFY: 66802, previousFY: 58853 },
      { currentFY: 66802, previousFY: 58853 },
      { currentFY: 4610.81, previousFY: 2246.29 },
      { currentFY: 9.24, previousFY: 5.21 },
      { currentFY: 71422, previousFY: 61104.5 },
      { currentFY: 8.07, previousFY: 7.26 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
    ],
  },
  "C.P6.E9": {
    values: {
      description:
        "1. Chemical effluents lubricants reused as alternative fuel. 2. Softener water reject being used as process water for cement process. 3. Power plant reject water neutralisation being used for gardening after blending with harvested water. 4. Power plant blow down water being used as make up water for cooling tower.",
    },
  },
  "C.P6.L1": {
    rows: [
      { currentFY: 189.3, previousFY: 194.24 },
      { currentFY: 70.08, previousFY: 56.49 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 259.38, previousFY: 250.73 },
      { currentFY: 1468.58, previousFY: 1164.04 },
      { currentFY: 13483.55, previousFY: 10966.97 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 14952.13, previousFY: 12131.01 },
    ],
  },
  // Water discharge by destination — the source reported nil/zero across all
  // destinations (ZLD entity), so each treatment-level row is seeded as 0.
  "C.P6.L2": {
    rows: [
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
      { currentFY: 0, previousFY: 0 },
    ],
  },
  "C.P6.L4": {
    rows: [
      { currentFY: 66572, previousFY: 96347 },
      { currentFY: 2.66, previousFY: 4.32 },
      { currentFY: 11.45, previousFY: 20 },
    ],
  },
  "C.P6.L6": {
    rows: [
      { initiative: "Installed six stage preheaters with LP cyclones and Inline calciners.", details: "NA", outcome: "Energy consumption decreases" },
      { initiative: "Deployment of 2 EV trucks in Bayyavaram and 4 EV loaders two each at Mattampally and ACL.", details: "NA", outcome: "Dependency on fossil fuels decreases." },
      { initiative: "Taken up pilot project in 37 acres to check the feasibility of utilising green grass as kiln fuel in Mattampally.", details: "NA", outcome: "Fuel emissions decreases" },
    ],
  },
  "C.P6.L7": { values: { details: "Risk register and mitigation plan." } },
  "C.P6.L9": { values: { pctAssessed: 0 } },

  // ===================== PRINCIPLE 7 =====================
  "C.P7.E1a": { values: { count: 5 } },
  "C.P7.E1b": {
    rows: [
      { name: "National Council of Cement and Building Materials (NCCBM)", reach: "National" },
      { name: "Confederation of Indian Industries (CII)", reach: "National" },
      { name: "Federation of Indian Chambers of Commerce and Industries (FICCI)", reach: "National" },
      { name: "South India Cement Manufacturers Association (SICMA)", reach: "State" },
      { name: "Global Cement and Concrete Association (GCCA)", reach: "International" },
    ],
  },

  // ===================== PRINCIPLE 8 =====================
  "C.P8.E3": { values: { mechanisms: "Nil" } },
  "C.P8.E4": {
    rows: [
      { currentFY: 6.4, previousFY: 17 },
      { currentFY: 34, previousFY: 30 },
    ],
  },
  "C.P8.L2": {
    rows: [
      { state: "Telangana, Andhra Pradesh, Madhya Pradesh, Orissa", district: "Suryapet, Nalgonda, Vishakapatnam, Ananthapur, Jajpur, Karondya", amountSpent: 290 },
    ],
  },
  "C.P8.L3": { values: { policyExists: "No", groups: "NA", pct: 0 } },
  "C.P8.L6": {
    rows: [
      { project: "Preventive health care, Safe drinking water, Training and education, Promotion of rural development and sports", beneficiaries: 107865, pctVulnerable: 100 },
    ],
  },

  // ===================== PRINCIPLE 9 =====================
  "C.P9.E1": {
    values: {
      mechanisms:
        "Complaints, if any, are being routed through local sales officers / e-mails and are addressed promptly to customers' satisfaction.",
    },
  },
  "C.P9.E2": { rows: [{ pctTurnover: 0 }, { pctTurnover: 0 }, { pctTurnover: 0 }] },
  "C.P9.E3": {
    rows: [
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
      { currReceived: 0, currPending: 0, currRemarks: "NA", prevReceived: 0, prevPending: 0, prevRemarks: "NA" },
    ],
  },
  "C.P9.E4": {
    rows: [
      { number: 0, reasons: "NA" },
      { number: 0, reasons: "NA" },
    ],
  },
  "C.P9.E5": { values: { policyExists: "No" } },
  "C.P9.E6": { values: { details: "NA" } },
  "C.P9.L1": { values: { channels: "www.sagarcements.in" } },
  "C.P9.L2": { values: { steps: "By conducting technical sessions and mason meets at regular intervals." } },
  "C.P9.L3": { values: { mechanisms: "Through emails and one to one meeting." } },
  "C.P9.L4": { values: { displayBeyondMandate: "No", survey: "No" } },
  "C.P9.L5": { values: { breachInstances: 0, breachImpact: "NIL", breachPiiPct: 0 } },
};
