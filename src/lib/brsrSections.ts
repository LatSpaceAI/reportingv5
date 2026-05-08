// BRSR (Business Responsibility & Sustainability Report) — SEBI Annexure I.
//
// Three-section format mandated by SEBI for the top listed entities:
//   Section A — General Disclosures (entity identity, operations, employees,
//               CSR, complaints, materiality)
//   Section B — Management & Process Disclosures (NGRBC policies & governance
//               for Principles 1–9)
//   Section C — Principle-wise Performance Disclosure (Essential + Leadership
//               indicators for each of the nine NGRBC principles)
//
// We surface each numbered disclosure in the format as a separate Question.
// Wide grids (gender × employee-class, FY-current × FY-previous, P1…P9 matrices)
// are modelled as TableQuestion so users get add/remove rows and a wide grid;
// single-shot disclosures use FieldsQuestion.

import type { Field, Section } from "./frameworkTypes";

// ---------- shared option lists ----------

const yesNo = ["Yes", "No"] as const;
const yesNoNa = ["Yes", "No", "Not Applicable"] as const;
const reportingBoundary = [
  "Standalone (entity only)",
  "Consolidated (entity + subsidiaries forming part of consolidated financials)",
] as const;
const riskOpp = ["Risk", "Opportunity"] as const;
const stockExchanges = [
  "BSE",
  "NSE",
  "BSE & NSE",
  "Other (specify in remarks)",
] as const;
const reviewFrequency = [
  "Annually",
  "Half-yearly",
  "Quarterly",
  "Other (specify)",
] as const;
const advocacyMethod = [
  "Direct engagement",
  "Through industry chambers / associations",
  "Public consultations",
  "Position papers / submissions",
  "Other",
] as const;

// "Permanent vs Other-than-permanent" rows reused across many P3 / P5 tables.
const permClasses = ["Permanent", "Other than Permanent"] as const;
const allEmpClasses = [
  "Permanent Employees",
  "Other than Permanent Employees",
  "Permanent Workers",
  "Other than Permanent Workers",
] as const;

// ----- field helpers (keep section literal short) -----

const t = (id: string, label: string, opts: Partial<Field> = {}): Field =>
  ({ id, label, kind: "text", ...opts } as Field);
const lt = (id: string, label: string, opts: Partial<Field> = {}): Field =>
  ({ id, label, kind: "longtext", ...opts } as Field);
const num = (id: string, label: string, opts: Partial<Field> = {}): Field =>
  ({ id, label, kind: "number", ...opts } as Field);
const yn = (id: string, label: string, opts: Partial<Field> = {}): Field =>
  ({ id, label, kind: "select", options: yesNo, ...opts } as Field);
const sel = (id: string, label: string, options: readonly string[], opts: Partial<Field> = {}): Field =>
  ({ id, label, kind: "select", options, ...opts } as Field);

// ============================================================
// SECTION A — GENERAL DISCLOSURES
// ============================================================

const sectionA_I_entity: Section = {
  id: "A.I",
  title: "A.I — Details of the Listed Entity",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.1",
      kind: "fields",
      label: "Entity identity & contact",
      description:
        "Items 1–13 of Section A.I. Captures CIN, registered & corporate addresses, contact channels, the financial year being reported, listing exchanges, paid-up capital, the BRSR contact person, and the reporting boundary (standalone vs consolidated).",
      fields: [
        t("cin", "1. Corporate Identity Number (CIN)", { required: true }),
        t("name", "2. Name of the Listed Entity", { required: true }),
        num("yearOfIncorporation", "3. Year of incorporation", { min: 1800, max: 2100, step: 1 }),
        lt("registeredAddress", "4. Registered office address"),
        lt("corporateAddress", "5. Corporate address"),
        { id: "email", kind: "email", label: "6. E-mail" },
        { id: "telephone", kind: "tel", label: "7. Telephone" },
        t("website", "8. Website"),
        t("financialYear", "9. Financial year for which reporting is being done", {
          help: "e.g. 2024-25",
          required: true,
        }),
        sel("stockExchange", "10. Name of the Stock Exchange(s) where shares are listed", stockExchanges),
        num("paidUpCapital", "11. Paid-up capital", { unit: "INR" }),
        lt(
          "brsrContact",
          "12. Name & contact details (telephone, email) of the person to be contacted on the BRSR report",
        ),
        sel("reportingBoundary", "13. Reporting boundary", reportingBoundary, { required: true }),
      ],
    },
  ],
};

const sectionA_II_products: Section = {
  id: "A.II",
  title: "A.II — Products / Services",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.14",
      kind: "table",
      label: "14. Details of business activities (accounting for 90% of turnover)",
      minRows: 1,
      columns: [
        t("mainActivity", "Description of Main Activity"),
        t("businessActivity", "Description of Business Activity"),
        num("pctTurnover", "% of Turnover of the entity", { min: 0, max: 100 }),
      ],
    },
    {
      id: "A.15",
      kind: "table",
      label: "15. Products / Services sold by the entity (accounting for 90% of turnover)",
      minRows: 1,
      columns: [
        t("productService", "Product / Service"),
        t("nicCode", "NIC Code"),
        num("pctTurnoverContributed", "% of total Turnover contributed", { min: 0, max: 100 }),
      ],
    },
  ],
};

const sectionA_III_operations: Section = {
  id: "A.III",
  title: "A.III — Operations",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.16",
      kind: "table",
      label: "16. Number of locations where plants and/or operations / offices are situated",
      description: "Two rows: National and International.",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "National" : "International"),
      columns: [
        num("plants", "Number of plants"),
        num("offices", "Number of offices"),
        num("total", "Total"),
      ],
    },
    {
      id: "A.17",
      kind: "fields",
      label: "17. Markets served by the entity",
      fields: [
        num("nationalStates", "a. National — No. of States covered"),
        num("internationalCountries", "a. International — No. of Countries covered"),
        num("exportTurnoverPct", "b. Contribution of exports as % of total turnover", { unit: "%", min: 0, max: 100 }),
        lt("customerTypes", "c. A brief on types of customers"),
      ],
    },
  ],
};

// 18a / 18b — gender-split employee & worker headcounts. Combined into one
// table with row labels keyed off "category" (Permanent / Other than permanent).
const sectionA_IV_employees: Section = {
  id: "A.IV",
  title: "A.IV — Employees",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.18a",
      kind: "table",
      label: "18a. Employees and workers (including differently abled)",
      description:
        "Headcount split by Permanent vs Other-than-Permanent and by gender. Provide all four blocks: Permanent Employees, Other-than-Permanent Employees, Permanent Workers, Other-than-Permanent Workers.",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => allEmpClasses[i],
      columns: [
        num("total", "Total (A)"),
        num("maleNo", "Male — No. (B)"),
        num("malePct", "Male — % (B/A)", { unit: "%" }),
        num("femaleNo", "Female — No. (C)"),
        num("femalePct", "Female — % (C/A)", { unit: "%" }),
      ],
    },
    {
      id: "A.18b",
      kind: "table",
      label: "18b. Differently abled employees and workers",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => allEmpClasses[i],
      columns: [
        num("total", "Total (A)"),
        num("maleNo", "Male — No. (B)"),
        num("malePct", "Male — % (B/A)", { unit: "%" }),
        num("femaleNo", "Female — No. (C)"),
        num("femalePct", "Female — % (C/A)", { unit: "%" }),
      ],
    },
    {
      id: "A.19",
      kind: "table",
      label: "19. Participation / Inclusion / Representation of women",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Board of Directors" : "Key Management Personnel"),
      columns: [
        num("total", "Total (A)"),
        num("femaleNo", "No. of Females (B)"),
        num("femalePct", "% of Females (B/A)", { unit: "%" }),
      ],
    },
    {
      id: "A.20",
      kind: "table",
      label: "20. Turnover rate for permanent employees and workers (last 3 FYs)",
      description:
        "Rows: Permanent Employees, Permanent Workers. Columns capture turnover rate by gender for the current FY, previous FY, and the FY prior.",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Permanent Employees" : "Permanent Workers"),
      columns: [
        num("currMale", "Current FY — Male", { unit: "%" }),
        num("currFemale", "Current FY — Female", { unit: "%" }),
        num("currTotal", "Current FY — Total", { unit: "%" }),
        num("prevMale", "Previous FY — Male", { unit: "%" }),
        num("prevFemale", "Previous FY — Female", { unit: "%" }),
        num("prevTotal", "Previous FY — Total", { unit: "%" }),
        num("priorMale", "FY Prior — Male", { unit: "%" }),
        num("priorFemale", "FY Prior — Female", { unit: "%" }),
        num("priorTotal", "FY Prior — Total", { unit: "%" }),
      ],
    },
  ],
};

const sectionA_V_holding: Section = {
  id: "A.V",
  title: "A.V — Holding, Subsidiary and Associate Companies (incl. JVs)",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.21",
      kind: "table",
      label: "21. Names of holding / subsidiary / associate companies / joint ventures",
      minRows: 1,
      columns: [
        t("name", "Name of the company / JV (A)"),
        sel("relationship", "Relationship", [
          "Holding",
          "Subsidiary",
          "Associate",
          "Joint Venture",
        ]),
        num("sharesHeldPct", "% of shares held by listed entity", { unit: "%", min: 0, max: 100 }),
        sel("participatesInBR", "Participates in BR initiatives of the listed entity?", yesNo),
      ],
    },
  ],
};

const sectionA_VI_csr: Section = {
  id: "A.VI",
  title: "A.VI — CSR Details",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.22",
      kind: "fields",
      label: "22. CSR applicability (Section 135, Companies Act 2013)",
      fields: [
        sel("csrApplicable", "(i) CSR applicable per s.135 of Companies Act, 2013", yesNo),
        num("turnover", "(ii) Turnover", { unit: "INR" }),
        num("netWorth", "(iii) Net worth", { unit: "INR" }),
      ],
    },
  ],
};

const stakeholderGroups = [
  "Communities",
  "Investors (other than shareholders)",
  "Shareholders",
  "Employees and workers",
  "Customers",
  "Value Chain Partners",
  "Other (please specify)",
] as const;

const sectionA_VII_transparency: Section = {
  id: "A.VII",
  title: "A.VII — Transparency and Disclosures Compliances",
  sheetRef: "Section A",
  questions: [
    {
      id: "A.23",
      kind: "table",
      label:
        "23. Complaints / Grievances on any of the NGRBC principles (P1–P9)",
      description:
        "One row per stakeholder group. For each group, indicate whether a grievance redressal mechanism is in place (and the policy URL if yes), and provide complaints filed / pending for the current and previous FY.",
      minRows: stakeholderGroups.length,
      maxRows: stakeholderGroups.length,
      rowLabel: (i) => stakeholderGroups[i],
      columns: [
        sel("mechanismInPlace", "Grievance redressal mechanism in place", yesNo),
        t("policyUrl", "Web-link for grievance redress policy (if Yes)"),
        num("currFiled", "Current FY — complaints filed during the year"),
        num("currPending", "Current FY — complaints pending at close of year"),
        t("currRemarks", "Current FY — Remarks"),
        num("prevFiled", "Previous FY — complaints filed during the year"),
        num("prevPending", "Previous FY — complaints pending at close of year"),
        t("prevRemarks", "Previous FY — Remarks"),
      ],
    },
    {
      id: "A.24",
      kind: "table",
      label: "24. Overview of the entity's material responsible business conduct issues",
      description:
        "Material ESG issues that present a risk or opportunity, with rationale, mitigation approach and financial implications.",
      minRows: 1,
      columns: [
        t("issue", "Material issue identified"),
        sel("riskOrOpp", "Risk or Opportunity (R/O)", riskOpp),
        lt("rationale", "Rationale for identifying the risk / opportunity"),
        lt("approach", "In case of risk, approach to adapt or mitigate"),
        lt("financialImplications", "Financial implications (positive or negative)"),
      ],
    },
  ],
};

// ============================================================
// SECTION B — MANAGEMENT AND PROCESS DISCLOSURES
// ============================================================
//
// All twelve disclosure questions are answered for each of the nine NGRBC
// principles. We model the principle axis as 9 fixed columns in a single-row
// table (minRows: maxRows: 1). For non-grid items (web links, signatures,
// review descriptions) we use FieldsQuestion.

const principles = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"] as const;

// helper to generate one column per principle (kind: select / number / text)
const perPrincipleCols = (
  kind: "select" | "text" | "boolean",
  options?: readonly string[],
): Field[] =>
  principles.map((p) => {
    if (kind === "select") {
      return { id: p, kind: "select", label: p, options: options ?? yesNo } as Field;
    }
    if (kind === "boolean") {
      return { id: p, kind: "boolean", label: p } as Field;
    }
    return { id: p, kind: "text", label: p } as Field;
  });

const sectionB: Section = {
  id: "B",
  title: "B — Management & Process Disclosures (NGRBC P1–P9)",
  sheetRef: "Section B",
  questions: [
    {
      id: "B.1",
      kind: "table",
      label:
        "1. Policy and management processes — coverage, board approval, web link",
      description:
        "Three sub-questions (a) policy covers each principle's core elements; (b) approved by Board; (c) web link of policies. Answer per principle.",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) =>
        ["a. Policy covers principle & core elements (Y/N)",
          "b. Has the policy been approved by the Board? (Y/N)",
          "c. Web link of the policies, if available"][i],
      columns: perPrincipleCols("text"),
    },
    {
      id: "B.2",
      kind: "fields",
      label: "2. Whether the entity has translated the policy into procedures (per principle)",
      fields: principles.map((p) => sel(p, p, yesNo)),
    },
    {
      id: "B.3",
      kind: "fields",
      label: "3. Do the enlisted policies extend to your value chain partners?",
      fields: principles.map((p) => sel(p, p, yesNo)),
    },
    {
      id: "B.4",
      kind: "fields",
      label:
        "4. Names of national / international codes / certifications / labels / standards adopted and mapped to each principle",
      description:
        "e.g. Forest Stewardship Council, Fairtrade, Rainforest Alliance, Trustea, SA 8000, OHSAS, ISO, BIS.",
      fields: principles.map((p) => lt(p, p)),
    },
    {
      id: "B.5",
      kind: "fields",
      label: "5. Specific commitments, goals and targets set by the entity, with timelines",
      fields: principles.map((p) => lt(p, p)),
    },
    {
      id: "B.6",
      kind: "fields",
      label:
        "6. Performance against the specific commitments, goals and targets — with reasons if not met",
      fields: principles.map((p) => lt(p, p)),
    },
    {
      id: "B.7",
      kind: "fields",
      label:
        "7. Statement by the director responsible for the BR report — ESG-related challenges, targets and achievements",
      fields: [
        lt("statement", "Director's BR statement (placement is flexible)"),
      ],
    },
    {
      id: "B.8",
      kind: "fields",
      label: "8. Highest authority responsible for implementation and oversight of BR policies",
      fields: [
        t("name", "Name"),
        t("designation", "Designation"),
        t("din", "DIN (if applicable)"),
        { id: "email", kind: "email", label: "E-mail" },
        { id: "telephone", kind: "tel", label: "Telephone" },
      ],
    },
    {
      id: "B.9",
      kind: "fields",
      label:
        "9. Specified Committee of the Board / Director responsible for decision-making on sustainability issues",
      fields: [
        sel("committeeExists", "Committee exists?", yesNo),
        lt("details", "If yes, provide details"),
      ],
    },
    {
      id: "B.10a",
      kind: "table",
      label:
        "10. Review of NGRBCs by the Company — Reviewer (Director / Committee of the Board / Other Committee)",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) =>
        i === 0
          ? "Performance against above policies and follow-up action"
          : "Compliance with statutory requirements and rectification of non-compliances",
      columns: perPrincipleCols("text"),
    },
    {
      id: "B.10b",
      kind: "table",
      label: "10. Review of NGRBCs by the Company — Frequency",
      description: "Annually / Half-yearly / Quarterly / Other (please specify).",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) =>
        i === 0
          ? "Performance against above policies and follow-up action"
          : "Compliance with statutory requirements and rectification of non-compliances",
      columns: perPrincipleCols("select", reviewFrequency),
    },
    {
      id: "B.11",
      kind: "table",
      label:
        "11. Independent assessment / evaluation of the working of policies by an external agency",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Conducted? (Y/N)" : "If yes, name of the agency"),
      columns: perPrincipleCols("text"),
    },
    {
      id: "B.12",
      kind: "table",
      label:
        "12. If answer to Q1 above is 'No' (not all principles are covered by a policy), reasons (per principle)",
      minRows: 5,
      maxRows: 5,
      rowLabel: (i) =>
        [
          "Entity does not consider the Principles material to its business",
          "Entity is not at a stage where it can formulate / implement policies on the principles",
          "Entity does not have financial / human / technical resources for the task",
          "Planned to be done in the next financial year",
          "Any other reason (please specify)",
        ][i],
      columns: perPrincipleCols("text"),
    },
  ],
};

// ============================================================
// SECTION C — PRINCIPLE-WISE PERFORMANCE DISCLOSURE
// ============================================================
//
// Each principle has Essential Indicators (mandatory) and Leadership Indicators
// (voluntary). We pack each principle into a single Section so users navigate
// principle-by-principle.

// ---------- helper builders ----------

const fyTwoColRows = (rowLabels: string[], extraCols: Field[] = []): { rowLabel?: (i: number) => string; minRows: number; maxRows: number; columns: Field[] } => ({
  rowLabel: (i) => rowLabels[i],
  minRows: rowLabels.length,
  maxRows: rowLabels.length,
  columns: [
    num("currentFY", "Current FY"),
    num("previousFY", "Previous FY"),
    ...extraCols,
  ],
});

// -------- PRINCIPLE 1 — Integrity, Ethics, Transparency --------

const sectionC_P1: Section = {
  id: "C.P1",
  title: "C — Principle 1: Integrity, Ethical, Transparent & Accountable",
  sheetRef: "Principle 1",
  questions: [
    {
      id: "C.P1.E1",
      kind: "table",
      label:
        "Essential 1. % coverage by training and awareness programmes on the Principles during the FY",
      ...fyTwoColRows(
        ["Board of Directors", "Key Managerial Personnel", "Employees other than BoD and KMPs", "Workers"],
        [],
      ),
      columns: [
        num("totalPrograms", "Total programmes held"),
        lt("topics", "Topics / principles covered & impact"),
        num("pctCovered", "% of persons in respective category covered", { unit: "%" }),
      ],
    },
    {
      id: "C.P1.E2_monetary",
      kind: "table",
      label:
        "Essential 2 (Monetary). Fines / penalties / settlement / compounding fees paid in the FY",
      description: "By entity or by directors / KMPs to regulators / law enforcement / judicial institutions.",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) => ["Penalty / Fine", "Settlement", "Compounding fee"][i],
      columns: [
        sel("ngrbcPrinciple", "NGRBC Principle", principles),
        t("agency", "Name of the regulatory / enforcement agency / judicial institution"),
        num("amount", "Amount (INR)"),
        lt("brief", "Brief of the case"),
        sel("appealed", "Has an appeal been preferred?", yesNo),
      ],
    },
    {
      id: "C.P1.E2_nonmonetary",
      kind: "table",
      label: "Essential 2 (Non-Monetary). Imprisonment / Punishment in the FY",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => ["Imprisonment", "Punishment"][i],
      columns: [
        sel("ngrbcPrinciple", "NGRBC Principle", principles),
        t("agency", "Regulatory / enforcement agency / judicial institution"),
        lt("brief", "Brief of the case"),
        sel("appealed", "Has an appeal been preferred?", yesNo),
      ],
    },
    {
      id: "C.P1.E3",
      kind: "table",
      label:
        "Essential 3. Of the instances disclosed in Q2 above, details of the appeal / revision preferred",
      minRows: 1,
      columns: [
        lt("caseDetails", "Case Details"),
        t("agency", "Name of the regulatory / enforcement agency / judicial institution"),
      ],
    },
    {
      id: "C.P1.E4",
      kind: "fields",
      label: "Essential 4. Anti-corruption or anti-bribery policy",
      fields: [
        sel("policyExists", "Does the entity have an anti-corruption / anti-bribery policy?", yesNo),
        lt("brief", "If yes, brief details"),
        t("webLink", "Web-link to the policy (if available)"),
      ],
    },
    {
      id: "C.P1.E5",
      kind: "table",
      label:
        "Essential 5. Disciplinary action by law enforcement for bribery / corruption charges",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => ["Directors", "KMPs", "Employees", "Workers"][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P1.E6",
      kind: "table",
      label: "Essential 6. Complaints with regard to conflict of interest",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) =>
        i === 0
          ? "Complaints received re. Conflict of Interest of the Directors"
          : "Complaints received re. Conflict of Interest of the KMPs",
      columns: [
        num("currNumber", "Current FY — Number"),
        t("currRemarks", "Current FY — Remarks"),
        num("prevNumber", "Previous FY — Number"),
        t("prevRemarks", "Previous FY — Remarks"),
      ],
    },
    {
      id: "C.P1.E7",
      kind: "fields",
      label:
        "Essential 7. Corrective action on issues related to fines / penalties / action taken by regulators on cases of corruption and conflicts of interest",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P1.L1",
      kind: "table",
      label:
        "Leadership 1. Awareness programmes conducted for value chain partners on any of the Principles during the FY",
      minRows: 1,
      columns: [
        num("totalPrograms", "Total awareness programmes held"),
        lt("topics", "Topics / principles covered under the training"),
        num("pctCovered", "% of value chain partners covered (by value of business done)", { unit: "%" }),
      ],
    },
    {
      id: "C.P1.L2",
      kind: "fields",
      label:
        "Leadership 2. Processes to avoid / manage conflicts of interest involving members of the Board",
      fields: [
        sel("processInPlace", "Does the entity have such processes?", yesNo),
        lt("details", "If yes, provide details"),
      ],
    },
  ],
};

// -------- PRINCIPLE 2 — Sustainable & Safe goods/services --------

const sectionC_P2: Section = {
  id: "C.P2",
  title: "C — Principle 2: Sustainable and Safe Goods / Services",
  sheetRef: "Principle 2",
  questions: [
    {
      id: "C.P2.E1",
      kind: "table",
      label:
        "Essential 1. % of R&D and capex investments in technologies improving environmental / social impacts of products & processes",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => ["R&D", "Capex"][i],
      columns: [
        num("currentFY", "Current FY", { unit: "%" }),
        num("previousFY", "Previous FY", { unit: "%" }),
        lt("improvements", "Details of improvements in environmental and social impacts"),
      ],
    },
    {
      id: "C.P2.E2",
      kind: "fields",
      label: "Essential 2. Sustainable sourcing",
      fields: [
        sel("hasProcedures", "(a) Does the entity have procedures in place for sustainable sourcing?", yesNo),
        num("pctSourced", "(b) If yes, % of inputs sourced sustainably", { unit: "%", min: 0, max: 100 }),
      ],
    },
    {
      id: "C.P2.E3",
      kind: "fields",
      label:
        "Essential 3. Processes to safely reclaim products at end of life",
      description:
        "Describe processes for (a) Plastics (incl. packaging) (b) E-waste (c) Hazardous waste (d) other waste.",
      fields: [
        lt("plastics", "(a) Plastics (incl. packaging)"),
        lt("eWaste", "(b) E-waste"),
        lt("hazardous", "(c) Hazardous waste"),
        lt("other", "(d) Other waste"),
      ],
    },
    {
      id: "C.P2.E4",
      kind: "fields",
      label: "Essential 4. Extended Producer Responsibility (EPR)",
      fields: [
        sel("eprApplicable", "Is EPR applicable to the entity's activities?", yesNo),
        sel("alignedWithEpr", "If yes, is the waste collection plan in line with the EPR plan submitted to PCBs?", yesNoNa),
        lt("steps", "If not, provide steps taken to address the same"),
      ],
    },
    {
      id: "C.P2.L1",
      kind: "table",
      label: "Leadership 1. Life Cycle Perspective / Assessment (LCA) for products / services",
      minRows: 1,
      columns: [
        t("nicCode", "NIC Code"),
        t("name", "Name of Product / Service"),
        num("pctTurnover", "% of total turnover contributed", { unit: "%" }),
        t("boundary", "Boundary for which LCA was conducted"),
        sel("externalAgency", "Conducted by independent external agency?", yesNo),
        sel("publicDomain", "Results communicated in public domain?", yesNo),
        t("webLink", "Web-link (if yes)"),
      ],
    },
    {
      id: "C.P2.L2",
      kind: "table",
      label:
        "Leadership 2. Significant social / environmental concerns or risks from production or disposal — actions taken",
      minRows: 1,
      columns: [
        t("name", "Name of Product / Service"),
        lt("risk", "Description of the risk / concern"),
        lt("action", "Action Taken"),
      ],
    },
    {
      id: "C.P2.L3",
      kind: "table",
      label:
        "Leadership 3. % of recycled or reused input material to total material (by value)",
      minRows: 1,
      columns: [
        t("inputMaterial", "Indicate input material"),
        num("currentFY", "Current FY — Recycled or re-used %", { unit: "%" }),
        num("previousFY", "Previous FY — Recycled or re-used %", { unit: "%" }),
      ],
    },
    {
      id: "C.P2.L4",
      kind: "table",
      label:
        "Leadership 4. Products / packaging reclaimed at end of life — Re-used / Recycled / Safely disposed (in MT)",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => ["Plastics (incl. packaging)", "E-waste", "Hazardous waste", "Other waste"][i],
      columns: [
        num("currReUsed", "Current FY — Re-Used"),
        num("currRecycled", "Current FY — Recycled"),
        num("currDisposed", "Current FY — Safely Disposed"),
        num("prevReUsed", "Previous FY — Re-Used"),
        num("prevRecycled", "Previous FY — Recycled"),
        num("prevDisposed", "Previous FY — Safely Disposed"),
      ],
    },
    {
      id: "C.P2.L5",
      kind: "table",
      label:
        "Leadership 5. Reclaimed products & packaging materials as % of products sold (per category)",
      minRows: 1,
      columns: [
        t("category", "Product category"),
        num("pct", "% of total products sold in the category", { unit: "%" }),
      ],
    },
  ],
};

// -------- PRINCIPLE 3 — Employee well-being --------

const sectionC_P3: Section = {
  id: "C.P3",
  title: "C — Principle 3: Employee & Worker Well-being",
  sheetRef: "Principle 3",
  questions: [
    {
      id: "C.P3.E1a",
      kind: "table",
      label: "Essential 1a. % of employees covered by health / accident / maternity / paternity / day-care benefits",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Permanent — Male",
          "Permanent — Female",
          "Permanent — Total",
          "Other than Permanent — Male",
          "Other than Permanent — Female",
          "Other than Permanent — Total",
        ][i],
      columns: [
        num("total", "Total (A)"),
        num("health", "Health insurance — Number"),
        num("accident", "Accident insurance — Number"),
        num("maternity", "Maternity benefits — Number"),
        num("paternity", "Paternity benefits — Number"),
        num("dayCare", "Day-care facilities — Number"),
      ],
    },
    {
      id: "C.P3.E1b",
      kind: "table",
      label: "Essential 1b. % of workers covered by health / accident / maternity / paternity / day-care benefits",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Permanent — Male",
          "Permanent — Female",
          "Permanent — Total",
          "Other than Permanent — Male",
          "Other than Permanent — Female",
          "Other than Permanent — Total",
        ][i],
      columns: [
        num("total", "Total (A)"),
        num("health", "Health insurance — Number"),
        num("accident", "Accident insurance — Number"),
        num("maternity", "Maternity benefits — Number"),
        num("paternity", "Paternity benefits — Number"),
        num("dayCare", "Day-care facilities — Number"),
      ],
    },
    {
      id: "C.P3.E2",
      kind: "table",
      label: "Essential 2. Retirement benefits — current FY and previous FY",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => ["PF", "Gratuity", "ESI", "Others — please specify"][i],
      columns: [
        num("currEmpPct", "Current FY — Employees covered (%)", { unit: "%" }),
        num("currWorkerPct", "Current FY — Workers covered (%)", { unit: "%" }),
        sel("currDeposited", "Current FY — Deducted & deposited with authority", yesNoNa),
        num("prevEmpPct", "Previous FY — Employees covered (%)", { unit: "%" }),
        num("prevWorkerPct", "Previous FY — Workers covered (%)", { unit: "%" }),
        sel("prevDeposited", "Previous FY — Deducted & deposited with authority", yesNoNa),
      ],
    },
    {
      id: "C.P3.E3",
      kind: "fields",
      label:
        "Essential 3. Accessibility of workplaces (Rights of Persons with Disabilities Act, 2016)",
      fields: [
        sel("accessible", "Are premises / offices accessible to differently abled employees and workers?", yesNo),
        lt("steps", "If not, steps being taken"),
      ],
    },
    {
      id: "C.P3.E4",
      kind: "fields",
      label: "Essential 4. Equal opportunity policy (RPwD Act, 2016)",
      fields: [
        sel("policyExists", "Does the entity have an equal opportunity policy?", yesNo),
        t("webLink", "If so, web-link to the policy"),
      ],
    },
    {
      id: "C.P3.E5",
      kind: "table",
      label: "Essential 5. Return-to-work and retention rates of employees & workers who took parental leave",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) => ["Male", "Female", "Total"][i],
      columns: [
        num("empReturn", "Permanent employees — Return to work rate", { unit: "%" }),
        num("empRetention", "Permanent employees — Retention rate", { unit: "%" }),
        num("workerReturn", "Permanent workers — Return to work rate", { unit: "%" }),
        num("workerRetention", "Permanent workers — Retention rate", { unit: "%" }),
      ],
    },
    {
      id: "C.P3.E6",
      kind: "table",
      label: "Essential 6. Grievance redress mechanism for employees and workers",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => allEmpClasses[i],
      columns: [
        sel("mechanismExists", "Mechanism in place?", yesNo),
        lt("brief", "If yes, give details of the mechanism in brief"),
      ],
    },
    {
      id: "C.P3.E7",
      kind: "table",
      label: "Essential 7. Membership of employees and workers in associations / unions",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) =>
        ["Total Permanent Employees (Male / Female / Total)", "Total Permanent Workers (Male / Female / Total)", "Other (specify in remarks)"][i],
      columns: [
        num("currTotal", "Current FY — Total in respective category (A)"),
        num("currMembers", "Current FY — In association / union (B)"),
        num("currPct", "Current FY — % (B/A)", { unit: "%" }),
        num("prevTotal", "Previous FY — Total in respective category (C)"),
        num("prevMembers", "Previous FY — In association / union (D)"),
        num("prevPct", "Previous FY — % (D/C)", { unit: "%" }),
      ],
    },
    {
      id: "C.P3.E8",
      kind: "table",
      label: "Essential 8. Training given to employees and workers",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Employees — Male",
          "Employees — Female",
          "Employees — Total",
          "Workers — Male",
          "Workers — Female",
          "Workers — Total",
        ][i],
      columns: [
        num("currTotal", "Current FY — Total (A)"),
        num("currHealthSafety", "Current FY — On Health & safety measures — No."),
        num("currSkill", "Current FY — On Skill upgradation — No."),
        num("prevTotal", "Previous FY — Total (D)"),
        num("prevHealthSafety", "Previous FY — On Health & safety — No."),
        num("prevSkill", "Previous FY — On Skill upgradation — No."),
      ],
    },
    {
      id: "C.P3.E9",
      kind: "table",
      label: "Essential 9. Performance and career development reviews",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Employees — Male",
          "Employees — Female",
          "Employees — Total",
          "Workers — Male",
          "Workers — Female",
          "Workers — Total",
        ][i],
      columns: [
        num("currTotal", "Current FY — Total (A)"),
        num("currCovered", "Current FY — No. (B)"),
        num("currPct", "Current FY — % (B/A)", { unit: "%" }),
        num("prevTotal", "Previous FY — Total (C)"),
        num("prevCovered", "Previous FY — No. (D)"),
        num("prevPct", "Previous FY — % (D/C)", { unit: "%" }),
      ],
    },
    {
      id: "C.P3.E10",
      kind: "fields",
      label: "Essential 10. Health and safety management system",
      fields: [
        sel("ohsImplemented", "(a) OHS management system implemented?", yesNo),
        lt("coverage", "(a) If yes, coverage"),
        lt("hazardProcesses", "(b) Processes used to identify work-related hazards (routine and non-routine)"),
        sel("workerReporting", "(c) Processes for workers to report hazards / remove themselves from risks", yesNo),
        sel("medicalAccess", "(d) Access to non-occupational medical & healthcare services?", yesNo),
      ],
    },
    {
      id: "C.P3.E11",
      kind: "table",
      label: "Essential 11. Safety related incidents",
      minRows: 8,
      maxRows: 8,
      rowLabel: (i) =>
        [
          "LTIFR (per million person-hours worked) — Employees",
          "LTIFR — Workers",
          "Total recordable work-related injuries — Employees",
          "Total recordable work-related injuries — Workers",
          "No. of fatalities — Employees",
          "No. of fatalities — Workers",
          "High consequence work-related injury / ill-health (excl. fatalities) — Employees",
          "High consequence work-related injury / ill-health (excl. fatalities) — Workers",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P3.E12",
      kind: "fields",
      label: "Essential 12. Measures taken to ensure a safe and healthy workplace",
      fields: [lt("measures", "Describe the measures")],
    },
    {
      id: "C.P3.E13",
      kind: "table",
      label: "Essential 13. Complaints by employees and workers",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Working Conditions" : "Health & Safety"),
      columns: [
        num("currFiled", "Current FY — Filed during the year"),
        num("currPending", "Current FY — Pending at end of year"),
        t("currRemarks", "Current FY — Remarks"),
        num("prevFiled", "Previous FY — Filed during the year"),
        num("prevPending", "Previous FY — Pending at end of year"),
        t("prevRemarks", "Previous FY — Remarks"),
      ],
    },
    {
      id: "C.P3.E14",
      kind: "table",
      label:
        "Essential 14. Assessments of plants and offices for the year",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Health and safety practices" : "Working Conditions"),
      columns: [num("pctAssessed", "% of plants & offices assessed", { unit: "%" })],
    },
    {
      id: "C.P3.E15",
      kind: "fields",
      label:
        "Essential 15. Corrective actions on safety incidents and on risks from H&S / working condition assessments",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P3.L1",
      kind: "fields",
      label:
        "Leadership 1. Life insurance / compensatory package in case of death",
      fields: [
        sel("employees", "(A) Employees", yesNo),
        sel("workers", "(B) Workers", yesNo),
      ],
    },
    {
      id: "C.P3.L2",
      kind: "fields",
      label:
        "Leadership 2. Measures to ensure statutory dues are deducted and deposited by value chain partners",
      fields: [lt("measures", "Provide measures")],
    },
    {
      id: "C.P3.L3",
      kind: "table",
      label:
        "Leadership 3. Employees / workers with high-consequence injury / ill-health / fatalities — rehabilitation status",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Employees" : "Workers"),
      columns: [
        num("currTotal", "Current FY — Total no. affected"),
        num("prevTotal", "Previous FY — Total no. affected"),
        num("currRehab", "Current FY — Rehabilitated / placed in suitable employment"),
        num("prevRehab", "Previous FY — Rehabilitated / placed in suitable employment"),
      ],
    },
    {
      id: "C.P3.L4",
      kind: "fields",
      label:
        "Leadership 4. Transition assistance programmes facilitating continued employability after retirement / termination",
      fields: [
        sel("provides", "Does the entity provide transition assistance programmes?", yesNo),
        lt("details", "If yes, provide details"),
      ],
    },
    {
      id: "C.P3.L5",
      kind: "table",
      label: "Leadership 5. Assessment of value chain partners",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Health and safety practices" : "Working Conditions"),
      columns: [num("pctAssessed", "% of VC partners assessed (by value of business)", { unit: "%" })],
    },
    {
      id: "C.P3.L6",
      kind: "fields",
      label:
        "Leadership 6. Corrective actions for risks identified in VC-partner H&S / working condition assessments",
      fields: [lt("details", "Provide details")],
    },
  ],
};

// -------- PRINCIPLE 4 — Stakeholders --------

const sectionC_P4: Section = {
  id: "C.P4",
  title: "C — Principle 4: Respect & Responsiveness to Stakeholders",
  sheetRef: "Principle 4",
  questions: [
    {
      id: "C.P4.E1",
      kind: "fields",
      label: "Essential 1. Processes for identifying key stakeholder groups",
      fields: [lt("processes", "Describe processes")],
    },
    {
      id: "C.P4.E2",
      kind: "table",
      label:
        "Essential 2. Stakeholder groups identified as key, and frequency of engagement",
      minRows: 1,
      columns: [
        t("group", "Stakeholder Group"),
        sel("vulnerable", "Identified as Vulnerable & Marginalized?", yesNo),
        lt("channels", "Channels of communication (Email, SMS, Newspaper, Pamphlets, Advertisement, Community Meetings, Notice Board, Website, Other)"),
        sel("frequency", "Frequency of engagement", reviewFrequency),
        lt("purpose", "Purpose and scope of engagement (key topics & concerns raised)"),
      ],
    },
    {
      id: "C.P4.L1",
      kind: "fields",
      label:
        "Leadership 1. Processes for consultation between stakeholders and the Board on economic, environmental, and social topics",
      fields: [lt("processes", "Describe processes (incl. how feedback is provided to the Board if delegated)")],
    },
    {
      id: "C.P4.L2",
      kind: "fields",
      label:
        "Leadership 2. Stakeholder consultation used to support identification & management of environmental and social topics",
      fields: [
        sel("used", "Is stakeholder consultation used for this purpose?", yesNo),
        lt("instances", "If yes, instances of how inputs were incorporated into policies and activities"),
      ],
    },
    {
      id: "C.P4.L3",
      kind: "fields",
      label:
        "Leadership 3. Engagement with, and actions taken for, vulnerable / marginalized stakeholder groups",
      fields: [lt("details", "Provide details")],
    },
  ],
};

// -------- PRINCIPLE 5 — Human Rights --------

const hrComplaintCategories = [
  "Sexual Harassment",
  "Discrimination at workplace",
  "Child Labour",
  "Forced Labour / Involuntary Labour",
  "Wages",
  "Other human rights related issues",
] as const;

const hrAssessmentCategories = [
  "Child labour",
  "Forced/involuntary labour",
  "Sexual harassment",
  "Discrimination at workplace",
  "Wages",
  "Others — please specify",
] as const;

const sectionC_P5: Section = {
  id: "C.P5",
  title: "C — Principle 5: Human Rights",
  sheetRef: "Principle 5",
  questions: [
    {
      id: "C.P5.E1",
      kind: "table",
      label: "Essential 1. Employees and workers trained on human rights issues and policy",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Employees — Permanent",
          "Employees — Other than permanent",
          "Total Employees",
          "Workers — Permanent",
          "Workers — Other than permanent",
          "Total Workers",
        ][i],
      columns: [
        num("currTotal", "Current FY — Total (A)"),
        num("currCovered", "Current FY — Covered (B)"),
        num("currPct", "Current FY — % (B/A)", { unit: "%" }),
        num("prevTotal", "Previous FY — Total (C)"),
        num("prevCovered", "Previous FY — Covered (D)"),
        num("prevPct", "Previous FY — % (D/C)", { unit: "%" }),
      ],
    },
    {
      id: "C.P5.E2",
      kind: "table",
      label: "Essential 2. Minimum wages paid to employees and workers",
      minRows: 8,
      maxRows: 8,
      rowLabel: (i) =>
        [
          "Permanent Employees — Male",
          "Permanent Employees — Female",
          "Other than Permanent Employees — Male",
          "Other than Permanent Employees — Female",
          "Permanent Workers — Male",
          "Permanent Workers — Female",
          "Other than Permanent Workers — Male",
          "Other than Permanent Workers — Female",
        ][i],
      columns: [
        num("currTotal", "Current FY — Total (A)"),
        num("currEqual", "Current FY — Equal to minimum wage — No."),
        num("currMore", "Current FY — More than minimum wage — No."),
        num("prevTotal", "Previous FY — Total"),
        num("prevEqual", "Previous FY — Equal to minimum wage — No."),
        num("prevMore", "Previous FY — More than minimum wage — No."),
      ],
    },
    {
      id: "C.P5.E3",
      kind: "table",
      label: "Essential 3. Remuneration / salary / wages — median",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) =>
        ["Board of Directors (BoD)", "Key Managerial Personnel", "Employees other than BoD and KMP", "Workers"][i],
      columns: [
        num("maleNumber", "Male — Number"),
        num("maleMedian", "Male — Median remuneration / salary / wages"),
        num("femaleNumber", "Female — Number"),
        num("femaleMedian", "Female — Median remuneration / salary / wages"),
      ],
    },
    {
      id: "C.P5.E4",
      kind: "fields",
      label:
        "Essential 4. Focal point (individual / committee) responsible for addressing human rights impacts",
      fields: [
        sel("focalPointExists", "Focal point in place?", yesNo),
        lt("details", "If yes, provide details"),
      ],
    },
    {
      id: "C.P5.E5",
      kind: "fields",
      label: "Essential 5. Internal mechanisms to redress human-rights-related grievances",
      fields: [lt("mechanisms", "Describe the mechanisms")],
    },
    {
      id: "C.P5.E6",
      kind: "table",
      label: "Essential 6. Complaints by employees and workers",
      minRows: hrComplaintCategories.length,
      maxRows: hrComplaintCategories.length,
      rowLabel: (i) => hrComplaintCategories[i],
      columns: [
        num("currFiled", "Current FY — Filed during the year"),
        num("currPending", "Current FY — Pending at end of year"),
        t("currRemarks", "Current FY — Remarks"),
        num("prevFiled", "Previous FY — Filed during the year"),
        num("prevPending", "Previous FY — Pending at end of year"),
        t("prevRemarks", "Previous FY — Remarks"),
      ],
    },
    {
      id: "C.P5.E7",
      kind: "fields",
      label:
        "Essential 7. Mechanisms to prevent adverse consequences to complainants (discrimination & harassment)",
      fields: [lt("mechanisms", "Describe the mechanisms")],
    },
    {
      id: "C.P5.E8",
      kind: "fields",
      label:
        "Essential 8. Do human rights requirements form part of business agreements and contracts?",
      fields: [sel("included", "Yes / No", yesNo)],
    },
    {
      id: "C.P5.E9",
      kind: "table",
      label: "Essential 9. Assessments for the year",
      minRows: hrAssessmentCategories.length,
      maxRows: hrAssessmentCategories.length,
      rowLabel: (i) => hrAssessmentCategories[i],
      columns: [num("pctAssessed", "% of plants & offices assessed (by entity / statutory authorities / third parties)", { unit: "%" })],
    },
    {
      id: "C.P5.E10",
      kind: "fields",
      label:
        "Essential 10. Corrective actions on significant risks / concerns from the assessments at Q9",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P5.L1",
      kind: "fields",
      label:
        "Leadership 1. Business processes modified / introduced as a result of addressing human rights grievances / complaints",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P5.L2",
      kind: "fields",
      label: "Leadership 2. Scope and coverage of any human rights due-diligence conducted",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P5.L3",
      kind: "fields",
      label:
        "Leadership 3. Are premises / offices accessible to differently abled visitors (RPwD Act, 2016)?",
      fields: [sel("accessible", "Yes / No", yesNo)],
    },
    {
      id: "C.P5.L4",
      kind: "table",
      label: "Leadership 4. Assessment of value chain partners",
      minRows: hrAssessmentCategories.length,
      maxRows: hrAssessmentCategories.length,
      rowLabel: (i) => hrAssessmentCategories[i],
      columns: [num("pctAssessed", "% of VC partners assessed (by value of business)", { unit: "%" })],
    },
    {
      id: "C.P5.L5",
      kind: "fields",
      label:
        "Leadership 5. Corrective actions on significant risks / concerns from VC-partner assessments at Q4",
      fields: [lt("details", "Provide details")],
    },
  ],
};

// -------- PRINCIPLE 6 — Environment --------

const sectionC_P6: Section = {
  id: "C.P6",
  title: "C — Principle 6: Environment",
  sheetRef: "Principle 6",
  questions: [
    {
      id: "C.P6.E1",
      kind: "table",
      label: "Essential 1. Total energy consumption (in Joules or multiples) and energy intensity",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Total electricity consumption (A)",
          "Total fuel consumption (B)",
          "Energy consumption through other sources (C)",
          "Total energy consumption (A+B+C)",
          "Energy intensity per rupee of turnover",
          "Energy intensity (optional) — relevant metric selected by the entity",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.E1_assurance",
      kind: "fields",
      label: "Essential 1 — External assurance",
      fields: [
        sel("external", "Independent assessment / evaluation / assurance carried out by external agency?", yesNo),
        t("agency", "If yes, name of the external agency"),
      ],
    },
    {
      id: "C.P6.E2",
      kind: "fields",
      label:
        "Essential 2. Sites / facilities identified as Designated Consumers (DCs) under the PAT scheme",
      fields: [
        sel("hasDCs", "Does the entity have any DC sites under PAT?", yesNo),
        sel("targetsAchieved", "If yes, have PAT targets been achieved?", yesNoNa),
        lt("remedial", "In case targets have not been achieved, provide remedial action taken"),
      ],
    },
    {
      id: "C.P6.E3",
      kind: "table",
      label: "Essential 3. Water — withdrawal, consumption, intensity",
      minRows: 8,
      maxRows: 8,
      rowLabel: (i) =>
        [
          "Water withdrawal — (i) Surface water (kL)",
          "Water withdrawal — (ii) Groundwater (kL)",
          "Water withdrawal — (iii) Third-party water (kL)",
          "Water withdrawal — (iv) Seawater / desalinated water (kL)",
          "Water withdrawal — (v) Others (kL)",
          "Total volume of water withdrawal (kL) (i+ii+iii+iv+v)",
          "Total volume of water consumption (kL)",
          "Water intensity per rupee of turnover (Water consumed / turnover)",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.E4",
      kind: "fields",
      label: "Essential 4. Mechanism for Zero Liquid Discharge",
      fields: [
        sel("implemented", "Implemented?", yesNo),
        lt("details", "If yes, details of coverage and implementation"),
      ],
    },
    {
      id: "C.P6.E5",
      kind: "table",
      label: "Essential 5. Air emissions (other than GHG emissions)",
      minRows: 7,
      maxRows: 7,
      rowLabel: (i) =>
        [
          "NOx",
          "SOx",
          "Particulate matter (PM)",
          "Persistent organic pollutants (POP)",
          "Volatile organic compounds (VOC)",
          "Hazardous air pollutants (HAP)",
          "Others — please specify",
        ][i],
      columns: [
        t("unit", "Unit"),
        num("currentFY", "Current FY"),
        num("previousFY", "Previous FY"),
      ],
    },
    {
      id: "C.P6.E6",
      kind: "table",
      label:
        "Essential 6. Greenhouse gas emissions (Scope 1 & Scope 2) and intensity",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) =>
        [
          "Total Scope 1 emissions (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3 if available) — Metric tonnes CO2e",
          "Total Scope 2 emissions — Metric tonnes CO2e",
          "Total Scope 1 + Scope 2 emissions per rupee of turnover",
          "Total Scope 1 + Scope 2 emission intensity (optional)",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.E7",
      kind: "fields",
      label: "Essential 7. Project(s) related to reducing GHG emissions",
      fields: [
        sel("hasProject", "Does the entity have any project to reduce GHG emissions?", yesNo),
        lt("details", "If yes, provide details"),
      ],
    },
    {
      id: "C.P6.E8",
      kind: "table",
      label: "Essential 8. Waste management — generation, recovery, disposal (in MT)",
      minRows: 16,
      maxRows: 16,
      rowLabel: (i) =>
        [
          "Plastic waste (A)",
          "E-waste (B)",
          "Bio-medical waste (C)",
          "Construction & demolition waste (D)",
          "Battery waste (E)",
          "Radioactive waste (F)",
          "Other Hazardous waste (G)",
          "Other Non-hazardous waste (H)",
          "Total (A+B+C+D+E+F+G+H)",
          "Recovered — (i) Recycled",
          "Recovered — (ii) Re-used",
          "Recovered — (iii) Other recovery operations",
          "Recovered — Total",
          "Disposed — (i) Incineration",
          "Disposed — (ii) Landfilling",
          "Disposed — (iii) Other disposal operations",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.E9",
      kind: "fields",
      label:
        "Essential 9. Waste management practices and strategy to reduce hazardous / toxic chemicals",
      fields: [lt("description", "Briefly describe practices & strategy")],
    },
    {
      id: "C.P6.E10",
      kind: "table",
      label:
        "Essential 10. Operations / offices in / around ecologically sensitive areas (national parks, wildlife sanctuaries, biosphere reserves, wetlands, biodiversity hotspots, forests, coastal regulation zones, etc.)",
      minRows: 1,
      columns: [
        t("location", "Location of operations / offices"),
        t("operationType", "Type of operations"),
        sel("compliance", "Whether conditions of environmental approval / clearance are being complied with?", yesNo),
        lt("reasons", "If no, reasons and corrective action taken"),
      ],
    },
    {
      id: "C.P6.E11",
      kind: "table",
      label:
        "Essential 11. Environmental impact assessments (EIAs) of projects undertaken in the current FY",
      minRows: 1,
      columns: [
        t("project", "Name and brief details of project"),
        t("eiaNo", "EIA Notification No."),
        { id: "date", kind: "date", label: "Date" } as Field,
        sel("externalAgency", "Conducted by independent external agency?", yesNo),
        sel("publicDomain", "Results communicated in public domain?", yesNo),
        t("webLink", "Relevant Web link"),
      ],
    },
    {
      id: "C.P6.E12",
      kind: "table",
      label:
        "Essential 12. Compliance with applicable environmental law / regulations / guidelines (Water Act, Air Act, EPA, etc.)",
      description:
        "If non-compliances exist, list each below; if fully compliant, leave the table empty.",
      minRows: 1,
      columns: [
        t("law", "Law / regulation / guideline not complied with"),
        lt("nonCompliance", "Details of non-compliance"),
        lt("penalties", "Fines / penalties / action by regulatory agencies (PCBs / courts)"),
        lt("corrective", "Corrective action taken, if any"),
      ],
    },
    {
      id: "C.P6.L1",
      kind: "table",
      label:
        "Leadership 1. Energy consumption from renewable & non-renewable sources",
      minRows: 8,
      maxRows: 8,
      rowLabel: (i) =>
        [
          "Renewable — Total electricity consumption (A)",
          "Renewable — Total fuel consumption (B)",
          "Renewable — Energy through other sources (C)",
          "Total energy consumed from renewable sources (A+B+C)",
          "Non-Renewable — Total electricity consumption (D)",
          "Non-Renewable — Total fuel consumption (E)",
          "Non-Renewable — Energy through other sources (F)",
          "Total energy consumed from non-renewable sources (D+E+F)",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.L2",
      kind: "table",
      label: "Leadership 2. Water discharge by destination and level of treatment (in kL)",
      minRows: 11,
      maxRows: 11,
      rowLabel: (i) =>
        [
          "(i) To Surface water — No treatment",
          "(i) To Surface water — With treatment (specify level)",
          "(ii) To Groundwater — No treatment",
          "(ii) To Groundwater — With treatment (specify level)",
          "(iii) To Seawater — No treatment",
          "(iii) To Seawater — With treatment (specify level)",
          "(iv) Sent to third-parties — No treatment",
          "(iv) Sent to third-parties — With treatment (specify level)",
          "(v) Others — No treatment",
          "(v) Others — With treatment (specify level)",
          "Total water discharged (kL)",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.L3",
      kind: "table",
      label:
        "Leadership 3. Water withdrawal, consumption and discharge in areas of water stress (one row per facility)",
      minRows: 1,
      columns: [
        t("areaName", "Name of the area"),
        t("operationType", "Nature of operations"),
        num("withdrawalCurr", "Withdrawal — Current FY (kL)"),
        num("withdrawalPrev", "Withdrawal — Previous FY (kL)"),
        num("consumptionCurr", "Consumption — Current FY (kL)"),
        num("consumptionPrev", "Consumption — Previous FY (kL)"),
        num("dischargeCurr", "Discharge — Current FY (kL)"),
        num("dischargePrev", "Discharge — Previous FY (kL)"),
      ],
    },
    {
      id: "C.P6.L4",
      kind: "table",
      label: "Leadership 4. Total Scope 3 emissions and intensity",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) =>
        [
          "Total Scope 3 emissions (Metric tonnes CO2e)",
          "Total Scope 3 emissions per rupee of turnover",
          "Total Scope 3 emission intensity (optional)",
        ][i],
      columns: [num("currentFY", "Current FY"), num("previousFY", "Previous FY")],
    },
    {
      id: "C.P6.L5",
      kind: "fields",
      label:
        "Leadership 5. Significant direct & indirect impact on biodiversity in ecologically sensitive areas (with prevention & remediation activities)",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P6.L6",
      kind: "table",
      label:
        "Leadership 6. Initiatives / innovative technology to improve resource efficiency or reduce impact",
      minRows: 1,
      columns: [
        t("initiative", "Initiative undertaken"),
        lt("details", "Details (web-link, if any)"),
        lt("outcome", "Outcome of the initiative"),
      ],
    },
    {
      id: "C.P6.L7",
      kind: "fields",
      label: "Leadership 7. Business continuity and disaster management plan",
      fields: [lt("details", "Give details in 100 words / web link")],
    },
    {
      id: "C.P6.L8",
      kind: "fields",
      label:
        "Leadership 8. Significant adverse environmental impact arising from the value chain — mitigation / adaptation",
      fields: [lt("details", "Disclose impact and measures taken")],
    },
    {
      id: "C.P6.L9",
      kind: "fields",
      label:
        "Leadership 9. % of value chain partners (by value of business) assessed for environmental impacts",
      fields: [num("pctAssessed", "%", { unit: "%", min: 0, max: 100 })],
    },
  ],
};

// -------- PRINCIPLE 7 — Public & regulatory policy --------

const sectionC_P7: Section = {
  id: "C.P7",
  title: "C — Principle 7: Public & Regulatory Policy",
  sheetRef: "Principle 7",
  questions: [
    {
      id: "C.P7.E1a",
      kind: "fields",
      label: "Essential 1a. Number of affiliations with trade and industry chambers / associations",
      fields: [num("count", "Number of affiliations")],
    },
    {
      id: "C.P7.E1b",
      kind: "table",
      label:
        "Essential 1b. Top 10 trade and industry chambers / associations the entity is a member of",
      minRows: 1,
      maxRows: 10,
      columns: [
        t("name", "Name of the trade and industry chamber / association"),
        sel("reach", "Reach (State / National)", ["State", "National", "International"]),
      ],
    },
    {
      id: "C.P7.E2",
      kind: "table",
      label:
        "Essential 2. Corrective action on issues related to anti-competitive conduct (based on adverse orders from regulatory authorities)",
      minRows: 1,
      columns: [
        t("authority", "Name of authority"),
        lt("brief", "Brief of the case"),
        lt("corrective", "Corrective action taken"),
      ],
    },
    {
      id: "C.P7.L1",
      kind: "table",
      label: "Leadership 1. Public policy positions advocated by the entity",
      minRows: 1,
      columns: [
        t("policy", "Public policy advocated"),
        sel("method", "Method resorted for such advocacy", advocacyMethod),
        sel("publicDomain", "Whether information available in public domain?", yesNo),
        sel("frequency", "Frequency of Review by Board", reviewFrequency),
        t("webLink", "Web Link, if available"),
      ],
    },
  ],
};

// -------- PRINCIPLE 8 — Inclusive growth --------

const sectionC_P8: Section = {
  id: "C.P8",
  title: "C — Principle 8: Inclusive Growth & Equitable Development",
  sheetRef: "Principle 8",
  questions: [
    {
      id: "C.P8.E1",
      kind: "table",
      label:
        "Essential 1. Social Impact Assessments (SIAs) of projects undertaken in the current FY",
      minRows: 1,
      columns: [
        t("project", "Name and brief details of project"),
        t("siaNo", "SIA Notification No."),
        { id: "date", kind: "date", label: "Date of notification" } as Field,
        sel("externalAgency", "Conducted by independent external agency?", yesNo),
        sel("publicDomain", "Results communicated in public domain?", yesNo),
        t("webLink", "Relevant Web link"),
      ],
    },
    {
      id: "C.P8.E2",
      kind: "table",
      label: "Essential 2. Ongoing Rehabilitation and Resettlement (R&R) projects",
      minRows: 1,
      columns: [
        t("project", "Name of Project for which R&R is ongoing"),
        t("state", "State"),
        t("district", "District"),
        num("pafs", "No. of Project Affected Families (PAFs)"),
        num("pctCovered", "% of PAFs covered by R&R", { unit: "%" }),
        num("amountPaid", "Amounts paid to PAFs in the FY (INR)"),
      ],
    },
    {
      id: "C.P8.E3",
      kind: "fields",
      label: "Essential 3. Mechanisms to receive and redress grievances of the community",
      fields: [lt("mechanisms", "Describe the mechanisms")],
    },
    {
      id: "C.P8.E4",
      kind: "table",
      label:
        "Essential 4. Percentage of input material (by value) sourced from suppliers",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) =>
        i === 0
          ? "Directly sourced from MSMEs / small producers"
          : "Sourced directly from within the district and neighbouring districts",
      columns: [
        num("currentFY", "Current FY", { unit: "%" }),
        num("previousFY", "Previous FY", { unit: "%" }),
      ],
    },
    {
      id: "C.P8.L1",
      kind: "table",
      label:
        "Leadership 1. Actions taken to mitigate negative social impacts identified in SIAs (Q1 above)",
      minRows: 1,
      columns: [
        lt("impact", "Details of negative social impact identified"),
        lt("action", "Corrective action taken"),
      ],
    },
    {
      id: "C.P8.L2",
      kind: "table",
      label:
        "Leadership 2. CSR projects in designated aspirational districts (as identified by government bodies)",
      minRows: 1,
      columns: [
        t("state", "State"),
        t("district", "Aspirational District"),
        num("amountSpent", "Amount spent (INR)"),
      ],
    },
    {
      id: "C.P8.L3",
      kind: "fields",
      label:
        "Leadership 3. Preferential procurement policy for marginalized / vulnerable groups",
      fields: [
        sel("policyExists", "(a) Policy in place?", yesNo),
        lt("groups", "(b) From which marginalized / vulnerable groups do you procure?"),
        num("pct", "(c) % of total procurement (by value) it constitutes", { unit: "%" }),
      ],
    },
    {
      id: "C.P8.L4",
      kind: "table",
      label:
        "Leadership 4. Benefits derived and shared from intellectual properties owned/acquired based on traditional knowledge",
      minRows: 1,
      columns: [
        t("ip", "Intellectual Property based on traditional knowledge"),
        sel("ownedAcquired", "Owned / Acquired", ["Owned", "Acquired"]),
        sel("benefitShared", "Benefit shared", yesNo),
        lt("basis", "Basis of calculating benefit share"),
      ],
    },
    {
      id: "C.P8.L5",
      kind: "table",
      label:
        "Leadership 5. Corrective actions on adverse orders in IP disputes involving traditional knowledge",
      minRows: 1,
      columns: [
        t("authority", "Name of authority"),
        lt("brief", "Brief of the case"),
        lt("corrective", "Corrective action taken"),
      ],
    },
    {
      id: "C.P8.L6",
      kind: "table",
      label: "Leadership 6. Beneficiaries of CSR projects",
      minRows: 1,
      columns: [
        t("project", "CSR Project"),
        num("beneficiaries", "No. of persons benefitted from CSR Projects"),
        num("pctVulnerable", "% of beneficiaries from vulnerable & marginalized groups", { unit: "%" }),
      ],
    },
  ],
};

// -------- PRINCIPLE 9 — Consumers --------

const consumerComplaintCategories = [
  "Data privacy",
  "Advertising",
  "Cyber-security",
  "Delivery of essential services",
  "Restrictive Trade Practices",
  "Unfair Trade Practices",
  "Other",
] as const;

const sectionC_P9: Section = {
  id: "C.P9",
  title: "C — Principle 9: Consumers",
  sheetRef: "Principle 9",
  questions: [
    {
      id: "C.P9.E1",
      kind: "fields",
      label:
        "Essential 1. Mechanisms to receive and respond to consumer complaints and feedback",
      fields: [lt("mechanisms", "Describe the mechanisms")],
    },
    {
      id: "C.P9.E2",
      kind: "table",
      label:
        "Essential 2. Turnover of products / services that carry information about environmental & social parameters, safe usage, and recycling / safe disposal",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) =>
        ["Environmental and social parameters relevant to the product", "Safe and responsible usage", "Recycling and/or safe disposal"][i],
      columns: [num("pctTurnover", "As % of total turnover", { unit: "%" })],
    },
    {
      id: "C.P9.E3",
      kind: "table",
      label: "Essential 3. Consumer complaints",
      minRows: consumerComplaintCategories.length,
      maxRows: consumerComplaintCategories.length,
      rowLabel: (i) => consumerComplaintCategories[i],
      columns: [
        num("currReceived", "Current FY — Received during the year"),
        num("currPending", "Current FY — Pending at end of year"),
        t("currRemarks", "Current FY — Remarks"),
        num("prevReceived", "Previous FY — Received during the year"),
        num("prevPending", "Previous FY — Pending at end of year"),
        t("prevRemarks", "Previous FY — Remarks"),
      ],
    },
    {
      id: "C.P9.E4",
      kind: "table",
      label: "Essential 4. Product recalls on account of safety issues",
      minRows: 2,
      maxRows: 2,
      rowLabel: (i) => (i === 0 ? "Voluntary recalls" : "Forced recalls"),
      columns: [num("number", "Number"), lt("reasons", "Reasons for recall")],
    },
    {
      id: "C.P9.E5",
      kind: "fields",
      label: "Essential 5. Cyber security and data privacy framework / policy",
      fields: [
        sel("policyExists", "Does the entity have such a framework / policy?", yesNo),
        t("webLink", "If available, web-link of the policy"),
      ],
    },
    {
      id: "C.P9.E6",
      kind: "fields",
      label:
        "Essential 6. Corrective actions on issues relating to advertising, delivery of essential services, cyber security, data privacy, recurrence of recalls, regulatory penalties on product/service safety",
      fields: [lt("details", "Provide details")],
    },
    {
      id: "C.P9.L1",
      kind: "fields",
      label:
        "Leadership 1. Channels / platforms where information on products and services can be accessed",
      fields: [lt("channels", "List channels (web link if available)")],
    },
    {
      id: "C.P9.L2",
      kind: "fields",
      label:
        "Leadership 2. Steps taken to inform and educate consumers about safe and responsible usage of products / services",
      fields: [lt("steps", "Describe steps")],
    },
    {
      id: "C.P9.L3",
      kind: "fields",
      label:
        "Leadership 3. Mechanisms to inform consumers of any risk of disruption / discontinuation of essential services",
      fields: [lt("mechanisms", "Describe mechanisms")],
    },
    {
      id: "C.P9.L4",
      kind: "fields",
      label:
        "Leadership 4. Product information disclosure beyond local-law mandates & consumer satisfaction surveys",
      fields: [
        sel("displayBeyondMandate", "Does the entity display product information over and above what is mandated?", ["Yes", "No", "Not Applicable"]),
        lt("brief", "If yes, provide details in brief"),
        sel("survey", "Did the entity carry out a consumer satisfaction survey?", yesNo),
      ],
    },
    {
      id: "C.P9.L5",
      kind: "fields",
      label: "Leadership 5. Data breaches",
      fields: [
        num("breachInstances", "(a) Number of instances of data breaches"),
        lt("breachImpact", "(a) Impact"),
        num("breachPiiPct", "(b) % of data breaches involving PII of customers", { unit: "%", min: 0, max: 100 }),
      ],
    },
  ],
};

// ============================================================
// AGGREGATE
// ============================================================

export const sections: Section[] = [
  sectionA_I_entity,
  sectionA_II_products,
  sectionA_III_operations,
  sectionA_IV_employees,
  sectionA_V_holding,
  sectionA_VI_csr,
  sectionA_VII_transparency,
  sectionB,
  sectionC_P1,
  sectionC_P2,
  sectionC_P3,
  sectionC_P4,
  sectionC_P5,
  sectionC_P6,
  sectionC_P7,
  sectionC_P8,
  sectionC_P9,
];
