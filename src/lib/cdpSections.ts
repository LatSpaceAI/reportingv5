// CDP 2026 Climate, Water, Forests, Plastics & Biodiversity questionnaire.
//
// CDP's official 2026 questionnaire is a 174-page modular form with several
// hundred questions, dense conditional logic ("only appears if you answered
// X in 2.2"), per-sector overlays, and very large enum lists (Risk1…Risk100,
// 240+ countries, 150+ tools/methods). The current Questionnaire engine has
// no notion of conditional visibility or master/detail repeating sub-records,
// so we model a *pragmatic skeleton* here:
//
//   • All major modules (1, 2, 3, 4, 5, 6, 7, 13) are represented with their
//     numbered questions surfaced as Section.questions entries.
//   • Conditional sub-questions are flattened — the user always sees them
//     and is expected to leave them blank when not applicable.
//   • Repeating compound tables (lists of risks, lists of targets, list of
//     scenarios, …) become TableQuestion rows so users add entries by hand.
//   • Giant enum lists become longtext fields with a hint, or selects with a
//     curated subset of options. "Other, please specify" is everywhere in
//     the real form; leaving them as text matches that intent.
//
// The aim is faithful coverage at the question level, not pixel-fidelity at
// the option level. Filers fill the document, hit Export, and edit the DOCX
// to their final BRSR-style narrative.

import type { Field, Section } from "./frameworkTypes";

// ---------- shared option lists (curated subsets of CDP's full enums) ----------

const yesNo = ["Yes", "No"] as const;
const yesNoNa = ["Yes", "No", "Not applicable"] as const;
const planYes2y = [
  "Yes",
  "No, but we plan to do so within the next two years",
  "No, and we do not plan to do so within the next two years",
] as const;
const valueChainStages = [
  "Direct operations",
  "Upstream value chain",
  "Downstream value chain",
  "End-of-life management",
] as const;
const supplierTiers = ["Tier 1", "Tier 2", "Tier 3", "Tier 4+"] as const;
const fullPartial = ["Full", "Partial"] as const;
const qualQuant = ["Qualitative only", "Quantitative only", "Qualitative and quantitative"] as const;
const assessmentFrequency = [
  "More than once a year",
  "Annually",
  "Every two years",
  "Every three years or more",
  "As important matters arise",
  "Not defined",
] as const;
const timeHorizons = ["Short-term", "Medium-term", "Long-term"] as const;
const locationSpecificity = [
  "Site-specific",
  "Local",
  "Sub-national",
  "National",
  "Not location specific",
] as const;
const orgTypes = [
  "Publicly traded organization",
  "Privately owned organization",
  "State owned organization",
  "Partially privately owned and partially state owned organization",
] as const;
const environmentalIssues = [
  "Climate change",
  "Water security",
  "Forests",
  "Biodiversity",
  "Plastics",
  "Oceans",
] as const;
const riskTypes = [
  "Acute physical",
  "Chronic physical",
  "Policy",
  "Liability",
  "Market",
  "Reputation",
  "Technology",
] as const;
const opportunityTypes = [
  "Resource efficiency",
  "Energy source",
  "Products and services",
  "Markets",
  "Resilience",
  "Other",
] as const;
const ghgScopes = ["Scope 1", "Scope 2", "Scope 3"] as const;
const scope2Approach = ["Location-based", "Market-based", "Both"] as const;
const verificationLevels = [
  "Reasonable assurance",
  "Limited assurance",
  "No third-party verification or assurance",
] as const;
const ghgs = ["CO2", "CH4", "N2O", "HFCs", "PFCs", "SF6", "NF3", "Other (specify)"] as const;
const gwpReferences = [
  "IPCC AR6 (100-year)",
  "IPCC AR5 (100-year)",
  "IPCC AR4 (100-year)",
  "IPCC AR6 (20-year)",
  "Other (specify)",
] as const;
const targetStatus = [
  "New",
  "Underway",
  "Achieved",
  "Achieved and maintained",
  "Expired",
  "Discontinued",
  "Replaced",
  "Revised",
] as const;
const targetType = [
  "Absolute",
  "Intensity",
  "Net-zero",
  "Methane",
  "Renewable energy / low-carbon",
  "Other",
] as const;
const initiativeStages = [
  "Under investigation",
  "To be implemented",
  "Implementation commenced",
  "Implemented",
  "Not to be implemented",
] as const;

// ---------- field helpers ----------

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
const date = (id: string, label: string): Field => ({ id, label, kind: "date" } as Field);

// ============================================================
// MODULE 1 — INTRODUCTION
// ============================================================

const m1: Section = {
  id: "M1",
  title: "Module 1 — Introduction",
  sheetRef: "Module 1",
  questions: [
    {
      id: "1.1",
      kind: "fields",
      label: "1.1 In which language are you submitting your response?",
      fields: [
        sel(
          "language",
          "Language",
          ["English", "Latin American Spanish", "Brazilian Portuguese", "Japanese", "Chinese", "Other (specify)"],
          { required: true },
        ),
      ],
    },
    {
      id: "1.2",
      kind: "fields",
      label: "1.2 Select the currency used for all financial information disclosed throughout your response.",
      fields: [
        t("currency", "Currency (ISO 4217 code, e.g. USD, EUR, INR, JPY)", { required: true }),
      ],
    },
    {
      id: "1.3",
      kind: "fields",
      label: "1.3 Provide an overview and introduction to your organization.",
      fields: [
        sel("orgType", "Organization type", orgTypes),
        lt("description", "Description of organization"),
      ],
    },
    {
      id: "1.4",
      kind: "fields",
      label:
        "1.4 State the end date of the year for which you are reporting data. For emissions data, indicate whether you will be providing data for past reporting years.",
      fields: [
        date("endDate", "End date of reporting year"),
        sel("alignedFY", "Alignment with financial reporting period", yesNo),
        sel("pastEmissions", "Are you providing emissions data for past reporting years?", yesNo),
        num("scope1PastYears", "Number of past years of Scope 1 data provided"),
        num("scope2PastYears", "Number of past years of Scope 2 data provided"),
        num("scope3PastYears", "Number of past years of Scope 3 data provided"),
      ],
    },
    {
      id: "1.4.1",
      kind: "fields",
      label: "1.4.1 What is your organization's annual revenue for the reporting period?",
      fields: [num("revenue", "Annual revenue (in selected currency)")],
    },
    {
      id: "1.5",
      kind: "fields",
      label: "1.5 Provide details on your reporting boundary.",
      fields: [
        sel(
          "sameAsFinancial",
          "Is your reporting boundary the same as that used in your financial statements?",
          ["Yes", "No", "Not applicable — we do not publicly disclose financial statements"],
        ),
        lt("differs", "How does your reporting boundary differ to that used in your financial statement?"),
      ],
    },
    {
      id: "1.6",
      kind: "fields",
      label:
        "1.6 Does your organization have an ISIN code or another unique identifier (e.g., Ticker, CUSIP, etc.)?",
      fields: [
        sel(
          "identifierType",
          "Type of identifier",
          [
            "ISIN code — bond",
            "ISIN code — equity",
            "CUSIP number",
            "Ticker symbol",
            "SEDOL code",
            "LEI number",
            "D-U-N-S number",
            "Other unique identifier",
          ],
        ),
        sel("usesIdentifier", "Does your organization use this unique identifier?", yesNo),
        t("identifier", "Provide your unique identifier"),
      ],
    },
    {
      id: "1.7",
      kind: "fields",
      label: "1.7 Select the countries/areas in which you operate.",
      fields: [lt("countries", "Comma-separated list of ISO country names")],
    },
    {
      id: "1.12",
      kind: "fields",
      label:
        "1.12 Which part of the concrete value chain does your organization operate in? (Cement-sector overlay)",
      fields: [
        lt(
          "concreteStages",
          "Select all that apply: Limestone quarrying, Clinker production, Portland cement manufacturing, Blended cement, Belite cements, Alternative low-CO2 cementitious materials production, Aggregates production, Concrete production, Concrete pavement / asphalt / tarmac, Lime production",
        ),
      ],
    },
    {
      id: "1.24",
      kind: "fields",
      label: "1.24 Has your organization mapped its value chain?",
      fields: [
        sel("mapped", "Value chain mapped", planYes2y),
        lt("stagesCovered", "Value chain stages covered (upstream / downstream)"),
        sel("highestTierMapped", "Highest supplier tier mapped", supplierTiers),
        sel("highestTierKnown", "Highest supplier tier known but not mapped", [
          ...supplierTiers,
          "All supplier tiers known have been mapped",
        ]),
        lt("processDescription", "Description of mapping process and coverage"),
        lt("primaryReason", "Primary reason for not mapping (if applicable)"),
        lt("explanation", "Explain why your organization has not mapped its upstream value chain"),
      ],
    },
  ],
};

// ============================================================
// MODULE 2 — IDENTIFICATION, ASSESSMENT & MANAGEMENT OF
// DEPENDENCIES, IMPACTS, RISKS & OPPORTUNITIES
// ============================================================

const m2: Section = {
  id: "M2",
  title: "Module 2 — Identification, Assessment & Management of Dependencies, Impacts, Risks & Opportunities",
  sheetRef: "Module 2",
  questions: [
    {
      id: "2.1",
      kind: "table",
      label:
        "2.1 How does your organization define short-, medium-, and long-term time horizons in relation to environmental dependencies, impacts, risks, and opportunities?",
      minRows: 3,
      maxRows: 3,
      rowLabel: (i) => timeHorizons[i],
      columns: [
        num("from", "From (years)"),
        num("to", "To (years)"),
        sel("openEnded", "Is the long-term time horizon open ended?", yesNo),
        lt("linkage", "How this time horizon is linked to strategic and/or financial planning"),
      ],
    },
    {
      id: "2.2",
      kind: "fields",
      label:
        "2.2 Does your organization have a process for identifying, assessing, and managing environmental dependencies and/or impacts?",
      fields: [
        sel("processInPlace", "Process in place", planYes2y),
        sel(
          "evaluated",
          "Dependencies and/or impacts evaluated",
          ["Dependencies only", "Impacts only", "Both dependencies and impacts"],
        ),
        lt("primaryReasonNot", "Primary reason for not evaluating (if applicable)"),
        lt("explanation", "Explain why you do not evaluate and any plans to do so"),
      ],
    },
    {
      id: "2.2.1",
      kind: "fields",
      label:
        "2.2.1 Does your organization have a process for identifying, assessing, and managing environmental risks and/or opportunities?",
      fields: [
        sel("processInPlace", "Process in place", planYes2y),
        sel("evaluated", "Risks and/or opportunities evaluated", ["Risks only", "Opportunities only", "Both risks and opportunities"]),
        sel("informedByDeps", "Is this process informed by the dependencies/impacts process?", yesNo),
        lt("primaryReasonNot", "Primary reason for not evaluating (if applicable)"),
        lt("explanation", "Explain why you do not evaluate"),
      ],
    },
    {
      id: "2.2.2",
      kind: "table",
      label:
        "2.2.2 Provide details of your organization's process for identifying, assessing, and managing environmental dependencies, impacts, risks, and/or opportunities.",
      description:
        "One row per environmental issue (climate change, water, forests, biodiversity, plastics, …).",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        lt("dirCovered", "Dependencies / Impacts / Risks / Opportunities covered"),
        lt("vcStages", "Value chain stages covered"),
        sel("coverage", "Coverage", fullPartial),
        lt("supplierTiers", "Supplier tiers covered (Tier 1–4+)"),
        sel("assessmentType", "Type of assessment", qualQuant),
        sel("frequency", "Frequency of assessment", assessmentFrequency),
        lt("timeHorizons", "Time horizons covered"),
        lt("integration", "Integration of risk management process"),
        sel("locationSpecificity", "Location-specificity used", locationSpecificity),
        lt("toolsAndMethods", "Tools and methods used (free text — e.g. WRI Aqueduct, ENCORE, IBAT, ISO 14001, COSO ERM, IPCC scenarios, scenario analysis, internal company methods)"),
        lt("riskCriteria", "Risk types and criteria considered"),
        lt("stakeholders", "Partners and stakeholders considered"),
        sel("changedSinceLastYr", "Has this process changed since the previous reporting year?", yesNo),
        lt("further", "Further details of process"),
      ],
    },
    {
      id: "2.2.7",
      kind: "fields",
      label:
        "2.2.7 Are the interconnections between environmental dependencies, impacts, risks and/or opportunities assessed?",
      fields: [
        sel("assessed", "Interconnections assessed", yesNo),
        lt("description", "Description of how interconnections are assessed"),
        lt("primaryReasonNot", "Primary reason for not assessing"),
        lt("explanation", "Explain why you do not assess"),
      ],
    },
    {
      id: "2.4",
      kind: "table",
      label: "2.4 How does your organization define substantive effects on your organization?",
      minRows: 1,
      columns: [
        sel("effectType", "Effect type", ["Risks", "Opportunities", "Both"]),
        sel("definitionType", "Type of definition", qualQuant),
        lt(
          "indicator",
          "Indicator used to define substantive effect (Asset value, Capital allocation, Capex, Credit risk, Customer complaints, Direct operating costs, EBITDA, Employee turnover, Indirect operating costs, Liabilities, Market share, Production capacity, Revenue, Share price, Shareholder value, Stranded assets, Strategic customers, Other)",
        ),
        sel("changeDirection", "Change to indicator", ["Absolute decrease", "Absolute increase", "% decrease", "% increase"]),
        sel("pctChangeBucket", "% change to indicator", [
          "Less than 1%",
          "1-10",
          "11-20",
          "21-30",
          "31-40",
          "41-50",
          "51-60",
          "61-70",
          "71-80",
          "81-90",
          "91-99",
          "100%",
        ]),
        num("absoluteFigure", "Absolute increase / decrease figure"),
        lt(
          "metricsConsidered",
          "Metrics considered (Frequency / Time horizon / Likelihood / Other)",
        ),
        lt("application", "Application of definition"),
      ],
    },
  ],
};

// ============================================================
// MODULE 3 — DISCLOSURE OF RISKS AND OPPORTUNITIES
// ============================================================

const m3: Section = {
  id: "M3",
  title: "Module 3 — Disclosure of Risks and Opportunities",
  sheetRef: "Module 3",
  questions: [
    {
      id: "3.1",
      kind: "table",
      label:
        "3.1 Have you identified any environmental risks which have had a substantive effect on your organization in the reporting year, or are anticipated to have a substantive effect in the future?",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        sel(
          "risksIdentified",
          "Environmental risks identified",
          [
            "Yes, both in direct operations and upstream/downstream value chain",
            "Yes, only within our direct operations",
            "Yes, only in our upstream/downstream value chain",
            "No",
          ],
        ),
        lt("primaryReason", "Primary reason no risks identified (if applicable)"),
        lt("explanation", "Please explain"),
      ],
    },
    {
      id: "3.1.1",
      kind: "table",
      label:
        "3.1.1 Provide details of the environmental risks identified which have had (or are anticipated to have) a substantive effect on your organization.",
      description:
        "One row per identified risk. The real questionnaire allows up to 100 rows; add as many as you need.",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        t("riskId", "Risk identifier (e.g. Risk 1)"),
        sel("riskType", "Risk type", riskTypes),
        lt("driver", "Primary environmental risk driver"),
        sel("vcStage", "Value chain stage where risk occurs", valueChainStages),
        lt("countries", "Country/area where risk occurs"),
        lt("description", "Description of risk and its impact on the organization"),
        sel("timeHorizon", "Time horizon", timeHorizons),
        sel("likelihood", "Likelihood", [
          "Virtually certain",
          "Very likely",
          "Likely",
          "More likely than not",
          "About as likely as not",
          "Unlikely",
          "Very unlikely",
          "Exceptionally unlikely",
          "Unknown",
        ]),
        sel("magnitude", "Magnitude of impact", ["High", "Medium-high", "Medium", "Medium-low", "Low"]),
        num("financialFigure", "Anticipated financial effect figure"),
        lt("financialEffect", "Description of anticipated financial effect"),
        lt("response", "Cost of response and description of response"),
      ],
    },
    {
      id: "3.1.2",
      kind: "fields",
      label:
        "3.1.2 Provide the amount and proportion of your financial metrics from the reporting year that are vulnerable to physical and transition risks.",
      fields: [
        num("totalAssetsVulnerable", "Total assets vulnerable to physical risk"),
        num("totalAssetsVulnerablePctPhysical", "% of total assets vulnerable to physical risk", { unit: "%" }),
        num("totalAssetsVulnerablePctTransition", "% of total assets vulnerable to transition risk", { unit: "%" }),
        lt("methodology", "Methodology used"),
      ],
    },
    {
      id: "3.5",
      kind: "fields",
      label:
        "3.5 Are any of your operations or activities regulated by a carbon pricing system (i.e. ETS, Cap & Trade, Carbon Tax)?",
      fields: [
        sel("regulated", "Are you regulated?", [
          "Yes, by an Emissions Trading Scheme (ETS)",
          "Yes, by a carbon tax",
          "Yes, by both an ETS and a carbon tax",
          "No, but we anticipate being regulated within the next two years",
          "No, and we do not anticipate being regulated within the next two years",
        ]),
      ],
    },
    {
      id: "3.5.2",
      kind: "table",
      label: "3.5.2 Provide details of each Emissions Trading Scheme (ETS) your organization is regulated by.",
      minRows: 1,
      columns: [
        t("etsName", "Name of ETS"),
        t("country", "Country / region"),
        num("emissionsCovered", "% of emissions covered by ETS", { unit: "%" }),
        num("allowancesAllocated", "Allowances allocated (tCO2e)"),
        num("allowancesPurchased", "Allowances purchased (tCO2e)"),
        num("verifiedEmissions", "Verified emissions in the ETS (tCO2e)"),
        num("creditsSurrendered", "Credits surrendered (if any)"),
        lt("comments", "Details and comments"),
      ],
    },
    {
      id: "3.5.3",
      kind: "table",
      label: "3.5.3 Complete the following table for each of the tax systems you are regulated by.",
      minRows: 1,
      columns: [
        t("taxName", "Name of carbon tax"),
        t("country", "Country / region"),
        num("emissionsCovered", "% of emissions covered by tax", { unit: "%" }),
        num("totalCost", "Total cost of carbon tax paid (in selected currency)"),
        lt("comments", "Comments"),
      ],
    },
    {
      id: "3.5.4",
      kind: "fields",
      label:
        "3.5.4 What is your strategy for complying with the systems you are regulated by or anticipate being regulated by?",
      fields: [lt("strategy", "Compliance strategy")],
    },
    {
      id: "3.6",
      kind: "table",
      label:
        "3.6 Have you identified any environmental opportunities which have had (or are anticipated to have) a substantive effect on your organization?",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        sel(
          "oppsIdentified",
          "Environmental opportunities identified",
          [
            "Yes, both in direct operations and upstream/downstream value chain",
            "Yes, only within our direct operations",
            "Yes, only in our upstream/downstream value chain",
            "No",
          ],
        ),
        lt("primaryReason", "Primary reason no opportunities identified"),
        lt("explanation", "Please explain"),
      ],
    },
    {
      id: "3.6.1",
      kind: "table",
      label:
        "3.6.1 Provide details of the environmental opportunities identified which have had (or are anticipated to have) a substantive effect on your organization.",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        t("oppId", "Opportunity identifier (e.g. Opp 1)"),
        sel("oppType", "Opportunity type", opportunityTypes),
        lt("driver", "Primary environmental opportunity driver"),
        sel("vcStage", "Value chain stage", valueChainStages),
        lt("countries", "Country/area where opportunity occurs"),
        lt("description", "Description of opportunity and its impact"),
        sel("timeHorizon", "Time horizon", timeHorizons),
        sel("likelihood", "Likelihood", [
          "Virtually certain",
          "Very likely",
          "Likely",
          "More likely than not",
          "About as likely as not",
          "Unlikely",
          "Very unlikely",
          "Exceptionally unlikely",
          "Unknown",
        ]),
        sel("magnitude", "Magnitude of impact", ["High", "Medium-high", "Medium", "Medium-low", "Low"]),
        num("financialFigure", "Anticipated financial effect figure"),
        lt("financialEffect", "Description of anticipated financial effect"),
        lt("strategy", "Strategy to realize the opportunity"),
      ],
    },
    {
      id: "3.6.2",
      kind: "fields",
      label:
        "3.6.2 Provide the amount and proportion of your financial metrics in the reporting year that are aligned with environmental opportunities.",
      fields: [
        num("amount", "Amount aligned with environmental opportunities"),
        num("pctOfTotal", "Proportion of total financial metric (%)", { unit: "%" }),
        lt("methodology", "Methodology used"),
      ],
    },
  ],
};

// ============================================================
// MODULE 4 — GOVERNANCE
// ============================================================

const m4: Section = {
  id: "M4",
  title: "Module 4 — Governance",
  sheetRef: "Module 4",
  questions: [
    {
      id: "4.1",
      kind: "fields",
      label: "4.1 Does your organization have a board of directors or an equivalent governing body?",
      fields: [sel("boardExists", "Board exists?", yesNo)],
    },
    {
      id: "4.1.1",
      kind: "fields",
      label: "4.1.1 Is there board-level oversight of environmental issues within your organization?",
      fields: [
        sel("boardOversight", "Board-level oversight", yesNo),
        lt("explanation", "If no, please explain"),
      ],
    },
    {
      id: "4.1.2",
      kind: "table",
      label:
        "4.1.2 Identify the positions of the individuals or committees on the board with environmental issue oversight.",
      description: "Do not include any names — positions only.",
      minRows: 1,
      columns: [
        t("position", "Position / committee"),
        lt("environmentalIssues", "Environmental issues overseen"),
        lt("frequency", "Frequency briefed on environmental issues"),
        lt("processes", "Processes used to inform position holders"),
        lt("scope", "Scope of board-level oversight"),
      ],
    },
    {
      id: "4.3",
      kind: "fields",
      label: "4.3 Is there management-level responsibility for environmental issues within your organization?",
      fields: [
        sel("mgmtResponsibility", "Management-level responsibility?", yesNo),
        lt("explanation", "If no, please explain"),
      ],
    },
    {
      id: "4.3.1",
      kind: "table",
      label:
        "4.3.1 Provide the highest senior management-level positions or committees with responsibility for environmental issues.",
      minRows: 1,
      columns: [
        t("position", "Position / committee"),
        lt("environmentalIssues", "Environmental issues for which the position is responsible"),
        lt("reportingLine", "Reporting line"),
        lt("responsibilities", "Specific responsibilities"),
        lt("frequency", "Frequency of reporting to the board"),
      ],
    },
    {
      id: "4.4",
      kind: "fields",
      label: "4.4 Does your organization have management-level competency on environmental issues?",
      fields: [
        sel("competency", "Management-level competency in place?", yesNo),
        lt("description", "Description of competency"),
      ],
    },
    {
      id: "4.5",
      kind: "fields",
      label:
        "4.5 Do you provide monetary incentives for the management of environmental issues, including the attainment of targets?",
      fields: [sel("incentives", "Monetary incentives provided?", yesNo)],
    },
    {
      id: "4.5.1",
      kind: "table",
      label: "4.5.1 Provide further details on the monetary incentives provided.",
      minRows: 1,
      columns: [
        t("position", "Entitled position"),
        sel("incentiveType", "Type of incentive", ["Monetary reward", "Non-monetary reward", "Both"]),
        lt("activities", "Activities incentivized"),
        lt("performanceIndicator", "Performance indicator"),
        lt("description", "Further description"),
      ],
    },
    {
      id: "4.6",
      kind: "fields",
      label: "4.6 Does your organization have an environmental policy that addresses environmental issues?",
      fields: [sel("policyExists", "Environmental policy exists?", yesNo)],
    },
    {
      id: "4.6.1",
      kind: "table",
      label: "4.6.1 Provide details of your environmental policies.",
      minRows: 1,
      columns: [
        t("policyName", "Policy name"),
        lt("environmentalIssues", "Environmental issues covered"),
        lt("scope", "Scope of policy"),
        sel("publiclyAvailable", "Publicly available?", yesNo),
        t("webLink", "Web link"),
        lt("alignment", "Alignment with international principles / frameworks"),
      ],
    },
    {
      id: "4.10",
      kind: "table",
      label:
        "4.10 Are you a signatory or member of any environmental collaborative frameworks or initiatives?",
      minRows: 1,
      columns: [
        t("frameworkName", "Name of framework / initiative"),
        sel("type", "Type", ["Industry collaboration", "Multi-stakeholder initiative", "Voluntary commitment", "Other"]),
        lt("description", "Description of involvement"),
      ],
    },
    {
      id: "4.11",
      kind: "fields",
      label:
        "4.11 In the reporting year, did your organization engage in activities that could directly or indirectly influence policy, law, or regulation that may impact the environment?",
      fields: [sel("engaged", "Engaged in such activities?", yesNo)],
    },
    {
      id: "4.11.1",
      kind: "table",
      label:
        "4.11.1 On what policies, laws, or regulations have you engaged with policy makers in the reporting year?",
      minRows: 1,
      columns: [
        t("policy", "Policy / law / regulation"),
        sel("issue", "Environmental issue", environmentalIssues),
        lt("position", "Position taken"),
        lt("activity", "Description of engagement activities"),
        lt("alignment", "Alignment with overall climate strategy"),
      ],
    },
    {
      id: "4.11.2",
      kind: "table",
      label: "4.11.2 Provide details of your indirect engagement on policy, law, or regulation.",
      minRows: 1,
      columns: [
        t("organization", "Trade association / industry body"),
        sel("alignment", "Alignment with the entity's position", [
          "Consistent",
          "Mixed",
          "Inconsistent",
          "Unknown",
        ]),
        lt("description", "Description of position and engagement"),
        lt("influence", "Steps to influence the organization's position"),
      ],
    },
    {
      id: "4.12",
      kind: "fields",
      label:
        "4.12 Have you published information about your organization's response to environmental issues for this reporting year?",
      fields: [sel("published", "Published?", yesNo)],
    },
    {
      id: "4.12.1",
      kind: "table",
      label: "4.12.1 Provide details on the information published.",
      minRows: 1,
      columns: [
        sel("publication", "Publication", [
          "In annual / integrated report",
          "In sustainability report",
          "In voluntary communications",
          "In mainstream financial filings",
          "Other",
        ]),
        lt("status", "Status"),
        lt("attachLink", "Attach the document or provide a web link"),
        lt("page", "Page / section reference"),
        lt("contentElements", "Content elements covered"),
      ],
    },
  ],
};

// ============================================================
// MODULE 5 — BUSINESS STRATEGY
// ============================================================

const m5: Section = {
  id: "M5",
  title: "Module 5 — Business Strategy",
  sheetRef: "Module 5",
  questions: [
    {
      id: "5.1",
      kind: "fields",
      label: "5.1 Does your organization use scenario analysis to identify environmental outcomes?",
      fields: [sel("usesScenarios", "Scenario analysis used?", yesNo)],
    },
    {
      id: "5.1.1",
      kind: "table",
      label: "5.1.1 Provide details of the scenarios used in your organization's scenario analysis.",
      minRows: 1,
      columns: [
        sel("issue", "Environmental issue", environmentalIssues),
        t("scenarioName", "Scenario name (e.g. IEA NZE 2050, IPCC SSP2-4.5, RCP 8.5)"),
        sel("scenarioType", "Scenario type", ["Transition", "Physical", "Both"]),
        sel("temperature", "Temperature alignment", ["1.5°C", "Well below 2°C", "2°C", "3°C", "4°C", "Other"]),
        lt("description", "Description and rationale"),
      ],
    },
    {
      id: "5.1.2",
      kind: "fields",
      label: "5.1.2 Provide details of the outcomes of your organization's scenario analysis.",
      fields: [lt("outcomes", "Outcomes")],
    },
    {
      id: "5.2",
      kind: "fields",
      label: "5.2 Does your organization's strategy include a climate transition plan?",
      fields: [
        sel("plan", "Climate transition plan in place?", [
          "Yes, we have a climate transition plan that aligns with a 1.5°C world",
          "Yes, we have a climate transition plan but it does not align with a 1.5°C world",
          "No, but we plan to develop one in the next two years",
          "No, and we do not plan to develop one in the next two years",
        ]),
        lt("publiclyAvailable", "Is the plan publicly available? Provide a web link if yes"),
        lt("description", "Description of the plan and its key elements"),
      ],
    },
    {
      id: "5.3",
      kind: "fields",
      label:
        "5.3 Have environmental risks and opportunities affected your strategy and/or financial planning?",
      fields: [
        sel(
          "affected",
          "Affected your strategy and/or financial planning?",
          ["Yes, both strategy and financial planning", "Yes, strategy only", "Yes, financial planning only", "No"],
        ),
      ],
    },
    {
      id: "5.3.1",
      kind: "fields",
      label: "5.3.1 Describe where and how environmental risks and opportunities have affected your strategy.",
      fields: [
        lt("productsServices", "Products and services"),
        lt("supplyChain", "Supply chain and/or value chain"),
        lt("rd", "Investment in R&D"),
        lt("operations", "Operations"),
        lt("acquisitions", "Acquisitions, mergers and divestitures"),
        lt("other", "Other"),
      ],
    },
    {
      id: "5.3.2",
      kind: "fields",
      label:
        "5.3.2 Describe where and how environmental risks and opportunities have affected your financial planning.",
      fields: [
        lt("revenues", "Revenues"),
        lt("opex", "Operating costs"),
        lt("capex", "Capital expenditures / capital allocation"),
        lt("acquisitionsDivestments", "Acquisitions and divestments"),
        lt("accessToCapital", "Access to capital"),
        lt("assets", "Assets"),
        lt("liabilities", "Liabilities"),
        lt("other", "Other"),
      ],
    },
    {
      id: "5.4",
      kind: "fields",
      label:
        "5.4 In your organization's financial accounting, do you identify spending/revenue that is aligned with your environmental objectives?",
      fields: [sel("identified", "Aligned spending/revenue identified?", yesNo)],
    },
    {
      id: "5.4.1",
      kind: "fields",
      label:
        "5.4.1 Quantify the amount and percentage share of your spending/revenue that is aligned with your environmental objectives.",
      fields: [
        num("alignedSpend", "Aligned spending (in selected currency)"),
        num("alignedSpendPct", "% of total spending", { unit: "%" }),
        num("alignedRevenue", "Aligned revenue (in selected currency)"),
        num("alignedRevenuePct", "% of total revenue", { unit: "%" }),
      ],
    },
    {
      id: "5.4.2",
      kind: "fields",
      label:
        "5.4.2 Quantify the percentage share of your spending/revenue that was associated with eligible activities aligned to a taxonomy.",
      fields: [
        t("taxonomy", "Taxonomy applied (e.g. EU Taxonomy)"),
        num("eligibleSpendPct", "% of eligible spending", { unit: "%" }),
        num("alignedSpendPct", "% of aligned spending", { unit: "%" }),
        num("eligibleRevenuePct", "% of eligible revenue", { unit: "%" }),
        num("alignedRevenuePct", "% of aligned revenue", { unit: "%" }),
      ],
    },
    {
      id: "5.4.3",
      kind: "fields",
      label: "5.4.3 Provide any additional contextual and/or verification/assurance information.",
      fields: [lt("details", "Additional contextual / assurance information")],
    },
    {
      id: "5.5",
      kind: "fields",
      label:
        "5.5 Does your organization invest in research and development (R&D) of low-carbon products or services?",
      fields: [sel("invests", "Invests in low-carbon R&D?", yesNo)],
    },
    {
      id: "5.5.1",
      kind: "table",
      label: "5.5.1 Provide details of your organization's investments in low-carbon R&D.",
      minRows: 1,
      columns: [
        t("technologyArea", "Technology area"),
        sel("stage", "Stage of development", ["Research", "Pilot", "Demonstration", "Deployment"]),
        num("investment", "Investment in the reporting year (selected currency)"),
        num("totalRdPct", "% of total R&D investment", { unit: "%" }),
        lt("description", "Description"),
      ],
    },
    {
      id: "5.10",
      kind: "fields",
      label: "5.10 Does your organization use an internal price on environmental externalities?",
      fields: [
        sel("usesInternalPrice", "Internal price used?", [
          "Yes",
          "No, but we plan to within two years",
          "No, and we do not plan to within two years",
        ]),
      ],
    },
    {
      id: "5.10.1",
      kind: "table",
      label: "5.10.1 Provide details of your organization's internal price on carbon.",
      minRows: 1,
      columns: [
        sel("type", "Type of internal carbon pricing", ["Shadow price", "Internal carbon fee", "Implicit price", "Other"]),
        sel("scopesCovered", "Scopes covered", ["Scope 1", "Scope 2", "Scope 3", "All"]),
        num("priceLow", "Price (low) per metric ton CO2e"),
        num("priceHigh", "Price (high) per metric ton CO2e"),
        t("currency", "Currency"),
        lt("application", "How the internal price is applied"),
      ],
    },
    {
      id: "5.11",
      kind: "fields",
      label: "5.11 Do you engage with your value chain on environmental issues?",
      fields: [
        sel("engagesUpstream", "Engages with upstream value chain?", yesNo),
        sel("engagesDownstream", "Engages with downstream value chain?", yesNo),
      ],
    },
    {
      id: "5.11.1",
      kind: "fields",
      label:
        "5.11.1 Does your organization assess and classify suppliers according to their dependencies and/or impacts on the environment?",
      fields: [sel("classifies", "Classifies suppliers?", yesNo), lt("description", "Describe the methodology")],
    },
    {
      id: "5.11.2",
      kind: "fields",
      label: "5.11.2 Does your organization prioritize which suppliers to engage with on environmental issues?",
      fields: [sel("prioritizes", "Prioritizes?", yesNo), lt("criteria", "Prioritization criteria")],
    },
    {
      id: "5.11.5",
      kind: "fields",
      label:
        "5.11.5 Do your suppliers have to meet environmental requirements as part of your organization's procurement process?",
      fields: [sel("required", "Environmental requirements?", yesNo)],
    },
    {
      id: "5.11.6",
      kind: "table",
      label: "5.11.6 Provide details of the environmental requirements that suppliers have to meet.",
      minRows: 1,
      columns: [
        t("requirement", "Environmental requirement"),
        sel("issue", "Environmental issue", environmentalIssues),
        num("pctSuppliers", "% of suppliers required to meet", { unit: "%" }),
        sel("verified", "How is compliance verified", [
          "Self-assessment",
          "Third-party audit",
          "On-site audit",
          "Document review",
          "Other",
        ]),
        lt("consequences", "Consequences for non-compliance"),
      ],
    },
    {
      id: "5.11.7",
      kind: "fields",
      label: "5.11.7 Provide further details of your organization's supplier engagement on environmental issues.",
      fields: [
        lt("description", "Description of engagement (climate, water, forests, biodiversity, plastics)"),
        num("pctEngaged", "% of suppliers engaged (by spend or count)", { unit: "%" }),
        lt("incentives", "Incentives or recognition provided"),
      ],
    },
    {
      id: "5.11.9",
      kind: "fields",
      label:
        "5.11.9 Provide details of any environmental engagement activity with other stakeholders in the value chain (customers, investors, communities, …).",
      fields: [lt("description", "Describe engagement activities and outcomes")],
    },
  ],
};

// ============================================================
// MODULE 6 — ENVIRONMENTAL DATA CONSOLIDATION
// ============================================================

const m6: Section = {
  id: "M6",
  title: "Module 6 — Environmental Data Consolidation",
  sheetRef: "Module 6",
  questions: [
    {
      id: "6.1",
      kind: "fields",
      label:
        "6.1 Provide details on your chosen consolidation approach for the calculation of environmental data.",
      fields: [
        sel(
          "approach",
          "Consolidation approach",
          [
            "Operational control",
            "Financial control",
            "Equity share",
            "Other (please specify)",
          ],
        ),
        lt("description", "Description of consolidation approach"),
      ],
    },
  ],
};

// ============================================================
// MODULE 7 — ENVIRONMENTAL PERFORMANCE (CLIMATE)
// ============================================================

const m7: Section = {
  id: "M7",
  title: "Module 7 — Environmental Performance (Climate Change)",
  sheetRef: "Module 7",
  questions: [
    {
      id: "7.1",
      kind: "fields",
      label: "7.1 Is this your first year of reporting emissions data to CDP?",
      fields: [sel("firstYear", "First year reporting?", yesNo)],
    },
    {
      id: "7.1.1",
      kind: "fields",
      label:
        "7.1.1 Has your organization undergone any structural changes in the reporting year, or are any planned in the upcoming reporting year?",
      fields: [
        sel("changes", "Structural changes?", yesNo),
        lt("description", "Description of structural changes (acquisitions, divestments, mergers)"),
      ],
    },
    {
      id: "7.1.2",
      kind: "fields",
      label:
        "7.1.2 Has your emissions accounting methodology, boundary, and/or reporting year definition changed in the reporting year?",
      fields: [sel("changed", "Methodology / boundary / year changed?", yesNo), lt("description", "Description")],
    },
    {
      id: "7.1.3",
      kind: "fields",
      label:
        "7.1.3 Have your organization's base year emissions and past years' emissions been recalculated as a result?",
      fields: [
        sel("recalculated", "Recalculated?", yesNo),
        lt("description", "Description of recalculations"),
        sel("threshold", "Trigger for recalculation", [
          "Significance threshold breached",
          "Acquisition / divestment",
          "Methodology change",
          "Discovery of error",
          "Other",
        ]),
      ],
    },
    {
      id: "7.2",
      kind: "fields",
      label:
        "7.2 Select the name of the standard, protocol, or methodology you have used to collect activity data and calculate emissions.",
      fields: [
        lt(
          "standards",
          "Standards / protocols (e.g. GHG Protocol Corporate Standard, ISO 14064-1, IPCC Guidelines, sector-specific protocols, …)",
        ),
      ],
    },
    {
      id: "7.3",
      kind: "fields",
      label: "7.3 Describe your organization's approach to reporting Scope 2 emissions.",
      fields: [
        sel("approach", "Scope 2 approach", scope2Approach),
        lt("description", "Describe approach and justification"),
      ],
    },
    {
      id: "7.4",
      kind: "fields",
      label:
        "7.4 Are there any sources (e.g. facilities, specific GHGs, activities, geographies) of Scope 1, 2, or 3 emissions that are within your selected reporting boundary which are not included in your disclosure?",
      fields: [sel("excluded", "Sources excluded?", yesNo)],
    },
    {
      id: "7.4.1",
      kind: "table",
      label: "7.4.1 Provide details of the sources of Scope 1, Scope 2, or Scope 3 emissions which are not included.",
      minRows: 1,
      columns: [
        sel("scope", "Scope", ghgScopes),
        t("source", "Source description"),
        lt("reason", "Reason for exclusion"),
        lt("estimatedImpact", "Estimated impact on total emissions"),
      ],
    },
    {
      id: "7.5",
      kind: "fields",
      label: "7.5 Provide your base year and base year emissions.",
      fields: [
        date("baseYearStart", "Base year start"),
        date("baseYearEnd", "Base year end"),
        num("scope1BaseEmissions", "Scope 1 base year emissions (tCO2e)"),
        num("scope2BaseLocation", "Scope 2 (location-based) base year emissions (tCO2e)"),
        num("scope2BaseMarket", "Scope 2 (market-based) base year emissions (tCO2e)"),
        num("scope3BaseEmissions", "Scope 3 base year emissions (tCO2e)"),
        lt("methodology", "Methodology used"),
      ],
    },
    {
      id: "7.6",
      kind: "fields",
      label: "7.6 What were your organization's gross global Scope 1 emissions in metric tons CO2e?",
      fields: [
        num("scope1", "Gross global Scope 1 emissions (tCO2e)", { required: true }),
        lt("comments", "Comments"),
      ],
    },
    {
      id: "7.7",
      kind: "fields",
      label: "7.7 What were your organization's gross global Scope 2 emissions in metric tons CO2e?",
      fields: [
        num("scope2Location", "Scope 2 (location-based) (tCO2e)"),
        num("scope2Market", "Scope 2 (market-based) (tCO2e)"),
        lt("comments", "Comments"),
      ],
    },
    {
      id: "7.8",
      kind: "table",
      label: "7.8 Account for your organization's gross global Scope 3 emissions, disclosing and explaining each category.",
      minRows: 15,
      maxRows: 15,
      rowLabel: (i) =>
        [
          "1. Purchased goods and services",
          "2. Capital goods",
          "3. Fuel- and energy-related activities",
          "4. Upstream transportation and distribution",
          "5. Waste generated in operations",
          "6. Business travel",
          "7. Employee commuting",
          "8. Upstream leased assets",
          "9. Downstream transportation and distribution",
          "10. Processing of sold products",
          "11. Use of sold products",
          "12. End-of-life treatment of sold products",
          "13. Downstream leased assets",
          "14. Franchises",
          "15. Investments",
        ][i],
      columns: [
        sel("evaluationStatus", "Evaluation status", [
          "Relevant, calculated",
          "Relevant, not yet calculated",
          "Not relevant, calculated",
          "Not relevant, explanation provided",
          "Not evaluated",
        ]),
        num("emissions", "Emissions (tCO2e)"),
        lt("explanation", "Explanation / methodology / data sources"),
        num("pctVerified", "% emissions calculated using primary data", { unit: "%" }),
      ],
    },
    {
      id: "7.8.1",
      kind: "fields",
      label: "7.8.1 Disclose or restate your Scope 3 emissions data for previous years.",
      fields: [lt("details", "Past Scope 3 emissions data and any restatements")],
    },
    {
      id: "7.9",
      kind: "fields",
      label: "7.9 Indicate the verification/assurance status that applies to your reported emissions.",
      fields: [
        sel("scope1Verification", "Scope 1 verification status", verificationLevels),
        sel("scope2Verification", "Scope 2 verification status", verificationLevels),
        sel("scope3Verification", "Scope 3 verification status", verificationLevels),
      ],
    },
    {
      id: "7.9.1",
      kind: "fields",
      label: "7.9.1 Provide further details of the verification/assurance undertaken for your Scope 1 emissions.",
      fields: [
        t("verifier", "Name of verifier / assurer"),
        t("standard", "Standard used (e.g. ISAE 3410, ISO 14064-3)"),
        sel("scope", "Scope of verification", ["All emissions", "Subset of emissions"]),
        t("attachLink", "Attach the verification statement (web link)"),
      ],
    },
    {
      id: "7.9.2",
      kind: "fields",
      label: "7.9.2 Provide further details of the verification/assurance undertaken for your Scope 2 emissions.",
      fields: [
        t("verifier", "Name of verifier / assurer"),
        t("standard", "Standard used"),
        sel("scope", "Scope of verification", ["All emissions", "Subset of emissions"]),
        t("attachLink", "Attach the verification statement (web link)"),
      ],
    },
    {
      id: "7.9.3",
      kind: "fields",
      label: "7.9.3 Provide further details of the verification/assurance undertaken for your Scope 3 emissions.",
      fields: [
        t("verifier", "Name of verifier / assurer"),
        t("standard", "Standard used"),
        sel("scope", "Scope of verification", ["All emissions", "Subset of emissions"]),
        t("attachLink", "Attach the verification statement (web link)"),
      ],
    },
    {
      id: "7.10",
      kind: "fields",
      label:
        "7.10 How do your gross global emissions (Scope 1 and 2 combined) for the reporting year compare to those of the previous reporting year?",
      fields: [
        sel("comparison", "Year-on-year comparison", [
          "Increased",
          "Decreased",
          "Remained the same overall",
          "This is our first year of reporting, so we cannot compare to last year",
          "We don't have any emissions data",
        ]),
      ],
    },
    {
      id: "7.10.1",
      kind: "table",
      label:
        "7.10.1 Identify the reasons for any change in your gross global emissions (Scope 1 + 2 combined).",
      minRows: 1,
      columns: [
        sel("reason", "Reason", [
          "Change in renewable energy consumption",
          "Other emissions reduction activities",
          "Divestment",
          "Acquisitions",
          "Mergers",
          "Change in output",
          "Change in methodology",
          "Change in boundary",
          "Change in physical operating conditions",
          "Unidentified",
          "Other",
        ]),
        num("changeAbsolute", "Change in emissions (tCO2e)"),
        sel("direction", "Direction of change", ["Increased", "Decreased", "No change"]),
        num("changePct", "Emissions value (%)", { unit: "%" }),
        lt("calculation", "Please explain calculation"),
      ],
    },
    {
      id: "7.10.2",
      kind: "fields",
      label:
        "7.10.2 Are your emissions performance calculations in 7.10 and 7.10.1 based on a location-based or market-based Scope 2 figure?",
      fields: [sel("basis", "Calculation basis", ["Location-based", "Market-based", "Don't know"])],
    },
    {
      id: "7.12",
      kind: "fields",
      label:
        "7.12 Does your organization have significant land sector activities in its operations or value chain?",
      fields: [sel("hasLandSector", "Significant land sector activities?", yesNo)],
    },
    {
      id: "7.12.1",
      kind: "fields",
      label:
        "7.12.1 Which of the following land sector accounting subcategories are relevant to your organization?",
      fields: [
        lt(
          "subcategories",
          "Relevant subcategories (Land use change, Land management, Biogenic CO2, …)",
        ),
      ],
    },
    {
      id: "7.12.2",
      kind: "fields",
      label:
        "7.12.2 Provide the emissions from biogenic carbon relevant to your organization in metric tons CO2e.",
      fields: [
        num("biogenicScope1", "Biogenic Scope 1 emissions (tCO2e)"),
        num("biogenicScope3", "Biogenic Scope 3 emissions (tCO2e)"),
        lt("methodology", "Methodology"),
      ],
    },
    {
      id: "7.13",
      kind: "fields",
      label:
        "7.13 Does your organization choose to account for and report technological CO2 removals or captured emissions?",
      fields: [sel("hasRemovals", "Reports CO2 removals?", yesNo)],
    },
    {
      id: "7.13.1",
      kind: "fields",
      label: "7.13.1 Which of the following removals accounting subcategories are relevant to your organization?",
      fields: [lt("subcategories", "Relevant subcategories (e.g. DAC, BECCS, mineralisation)")],
    },
    {
      id: "7.15",
      kind: "fields",
      label: "7.15 Does your organization break down its Scope 1 and/or Scope 2 emissions by greenhouse gas type?",
      fields: [
        sel("breaksDown", "Breaks down emissions by GHG?", [
          "Yes, both Scope 1 and Scope 2 emissions",
          "Yes, Scope 1 emissions only",
          "Yes, Scope 2 emissions only",
          "No",
        ]),
      ],
    },
    {
      id: "7.15.1",
      kind: "table",
      label:
        "7.15.1 Break down your total gross global Scope 1 and Scope 2 emissions by greenhouse gas type and provide the GWP source.",
      minRows: ghgs.length,
      maxRows: ghgs.length,
      rowLabel: (i) => ghgs[i],
      columns: [
        num("scope1Gas", "Scope 1 (mass of selected gas)"),
        num("scope1CO2e", "Scope 1 (tCO2e)"),
        num("scope2LocGas", "Scope 2 location-based (mass of gas)"),
        num("scope2LocCO2e", "Scope 2 location-based (tCO2e)"),
        num("scope2MktGas", "Scope 2 market-based (mass of gas)"),
        num("scope2MktCO2e", "Scope 2 market-based (tCO2e)"),
        sel("gwpReference", "GWP reference", gwpReferences),
      ],
    },
    {
      id: "7.16",
      kind: "table",
      label: "7.16 Break down your total gross global Scope 1 and 2 emissions by country/area.",
      minRows: 1,
      columns: [
        t("country", "Country / area"),
        num("scope1", "Scope 1 (tCO2e)"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.17",
      kind: "fields",
      label: "7.17 Indicate which gross global Scope 1 emissions breakdowns you are able to provide.",
      fields: [
        lt(
          "breakdowns",
          "Indicate breakdowns offered (Business division / Business facility / Business activity / GHG type / Country)",
        ),
      ],
    },
    {
      id: "7.17.1",
      kind: "table",
      label: "7.17.1 Break down your total gross global Scope 1 emissions by business division.",
      minRows: 1,
      columns: [t("division", "Business division"), num("emissions", "Scope 1 emissions (tCO2e)")],
    },
    {
      id: "7.17.2",
      kind: "table",
      label: "7.17.2 Break down your total gross global Scope 1 emissions by business facility.",
      minRows: 1,
      columns: [
        t("facility", "Facility name"),
        t("country", "Country"),
        num("latitude", "Latitude"),
        num("longitude", "Longitude"),
        num("emissions", "Scope 1 emissions (tCO2e)"),
      ],
    },
    {
      id: "7.17.3",
      kind: "table",
      label: "7.17.3 Break down your total gross global Scope 1 emissions by business activity.",
      minRows: 1,
      columns: [t("activity", "Business activity"), num("emissions", "Scope 1 emissions (tCO2e)")],
    },
    {
      id: "7.19",
      kind: "table",
      label:
        "7.19 Break down your organization's total gross global Scope 1 emissions by sector production activity (sector-specific).",
      minRows: 1,
      columns: [
        t("activity", "Sector production activity (e.g. Clinker, Cement)"),
        num("production", "Production volume"),
        t("unit", "Unit"),
        num("emissions", "Scope 1 emissions (tCO2e)"),
      ],
    },
    {
      id: "7.20",
      kind: "fields",
      label: "7.20 Indicate which gross global Scope 2 emissions breakdowns you are able to provide.",
      fields: [
        lt(
          "breakdowns",
          "Indicate breakdowns offered (Business division / Business facility / Business activity / Country)",
        ),
      ],
    },
    {
      id: "7.20.1",
      kind: "table",
      label: "7.20.1 Break down your total gross global Scope 2 emissions by business division.",
      minRows: 1,
      columns: [
        t("division", "Business division"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.20.2",
      kind: "table",
      label: "7.20.2 Break down your total gross global Scope 2 emissions by business facility.",
      minRows: 1,
      columns: [
        t("facility", "Facility name"),
        t("country", "Country"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.20.3",
      kind: "table",
      label: "7.20.3 Break down your total gross global Scope 2 emissions by business activity.",
      minRows: 1,
      columns: [
        t("activity", "Business activity"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.21",
      kind: "table",
      label:
        "7.21 Break down your organization's total gross global Scope 2 emissions by sector production activity (sector-specific).",
      minRows: 1,
      columns: [
        t("activity", "Sector production activity"),
        num("production", "Production volume"),
        t("unit", "Unit"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.23",
      kind: "fields",
      label:
        "7.23 Is your organization able to break down your emissions data for any of the subsidiaries included in your CDP response?",
      fields: [sel("ableToBreakdown", "Subsidiary breakdown available?", yesNo)],
    },
    {
      id: "7.23.1",
      kind: "table",
      label: "7.23.1 Break down your gross Scope 1 and Scope 2 emissions by subsidiary.",
      minRows: 1,
      columns: [
        t("subsidiary", "Subsidiary name"),
        t("country", "Country"),
        num("scope1", "Scope 1 (tCO2e)"),
        num("scope2Location", "Scope 2 location-based (tCO2e)"),
        num("scope2Market", "Scope 2 market-based (tCO2e)"),
      ],
    },
    {
      id: "7.29",
      kind: "fields",
      label:
        "7.29 What percentage of your total operational spend in the reporting year was on energy?",
      fields: [num("pctEnergySpend", "% of operational spend on energy", { unit: "%", min: 0, max: 100 })],
    },
    {
      id: "7.30",
      kind: "fields",
      label: "7.30 Select which energy-related activities your organization has undertaken.",
      fields: [
        lt(
          "activities",
          "Energy activities (Consumption of fuel, electricity, heat, steam, cooling; Generation of energy; Sale of energy; Purchases of low-carbon energy; …)",
        ),
      ],
    },
    {
      id: "7.30.1",
      kind: "table",
      label: "7.30.1 Report your organization's energy consumption totals (excluding feedstocks) in MWh.",
      minRows: 6,
      maxRows: 6,
      rowLabel: (i) =>
        [
          "Consumption of fuel (excluding feedstock)",
          "Consumption of purchased / acquired electricity",
          "Consumption of purchased / acquired heat",
          "Consumption of purchased / acquired steam",
          "Consumption of purchased / acquired cooling",
          "Total energy consumption",
        ][i],
      columns: [
        num("renewable", "Renewable (MWh)"),
        num("nonRenewable", "Non-renewable (MWh)"),
        num("total", "Total (MWh)"),
      ],
    },
    {
      id: "7.30.2",
      kind: "table",
      label: "7.30.2 Report your organization's energy consumption for cement production (sector-specific).",
      minRows: 1,
      columns: [
        t("plant", "Plant / facility"),
        num("clinkerProduction", "Clinker production (tonnes)"),
        num("specificEnergy", "Specific energy consumption (GJ/t clinker)"),
        num("totalEnergy", "Total thermal energy (MWh)"),
      ],
    },
    {
      id: "7.30.6",
      kind: "fields",
      label: "7.30.6 Select the applications of your organization's consumption of fuel.",
      fields: [
        lt(
          "applications",
          "Applications (Stationary combustion, Mobile combustion, Cogeneration / co-firing, Process emissions feedstock, Other)",
        ),
      ],
    },
    {
      id: "7.30.7",
      kind: "table",
      label: "7.30.7 State how much fuel in MWh your organization has consumed (excluding feedstocks) by fuel type.",
      minRows: 1,
      columns: [
        t("fuelType", "Fuel type (e.g. Coal, Natural gas, Biomass, Diesel, Petcoke, …)"),
        sel("category", "Renewable / non-renewable", ["Renewable", "Non-renewable"]),
        num("consumption", "Consumption (MWh)"),
        num("emissionFactor", "Emission factor (kgCO2e/MWh)"),
        t("efSource", "Emission factor source"),
      ],
    },
    {
      id: "7.30.8",
      kind: "table",
      label: "7.30.8 State how much fuel in MWh your organization has consumed (excluding feedstocks) by fuel function.",
      minRows: 1,
      columns: [
        sel("function", "Function", [
          "Stationary combustion",
          "Mobile combustion",
          "Process emissions",
          "Cogeneration",
          "Other",
        ]),
        num("consumption", "Consumption (MWh)"),
      ],
    },
    {
      id: "7.30.9",
      kind: "table",
      label:
        "7.30.9 Provide details on the electricity, heat, steam, and cooling your organization has generated.",
      minRows: 4,
      maxRows: 4,
      rowLabel: (i) => ["Electricity", "Heat", "Steam", "Cooling"][i],
      columns: [
        num("totalGross", "Total gross generation (MWh)"),
        num("renewable", "Generated from renewable sources (MWh)"),
        num("consumedOnSite", "Consumed by reporting organization (MWh)"),
        num("consumedRenewable", "Consumed from renewables (MWh)"),
      ],
    },
    {
      id: "7.30.10",
      kind: "table",
      label: "7.30.10 Provide details on the electricity and heat your organization has generated and consumed.",
      minRows: 1,
      columns: [
        sel("type", "Energy carrier", ["Electricity", "Heat"]),
        sel("source", "Source", [
          "Solar",
          "Wind",
          "Hydropower",
          "Geothermal",
          "Biomass / biogas",
          "Nuclear",
          "Coal",
          "Natural gas",
          "Oil",
          "Other",
        ]),
        num("generated", "Total generated (MWh)"),
        num("consumed", "Total consumed (MWh)"),
        num("emissions", "Emissions (tCO2e)"),
      ],
    },
    {
      id: "7.30.14",
      kind: "table",
      label:
        "7.30.14 Provide a breakdown by country/area of your electricity / heat / steam / cooling consumption.",
      minRows: 1,
      columns: [
        t("country", "Country / area"),
        num("electricity", "Electricity consumption (MWh)"),
        num("heat", "Heat consumption (MWh)"),
        num("steam", "Steam consumption (MWh)"),
        num("cooling", "Cooling consumption (MWh)"),
        num("renewablePct", "% of which is renewable", { unit: "%" }),
      ],
    },
    {
      id: "7.30.15",
      kind: "table",
      label:
        "7.30.15 Provide details on the electricity purchases that were accounted for at a zero or near-zero emission factor.",
      minRows: 1,
      columns: [
        t("country", "Country / area"),
        sel("instrument", "Sourcing instrument", [
          "Power Purchase Agreement (PPA)",
          "Energy attribute certificate (e.g. REC, GO, I-REC)",
          "Green tariff from supplier",
          "On-site generation",
          "Other",
        ]),
        num("amount", "Amount (MWh)"),
        sel("technology", "Technology", ["Solar", "Wind", "Hydro", "Geothermal", "Biomass", "Nuclear", "Other"]),
        t("vintage", "Vintage / year"),
      ],
    },
    {
      id: "7.30.17",
      kind: "table",
      label:
        "7.30.17 Provide details of your organization's low-carbon heat, steam, and cooling purchases in the reporting year.",
      minRows: 1,
      columns: [
        sel("type", "Type", ["Heat", "Steam", "Cooling"]),
        t("country", "Country / area"),
        num("amount", "Amount (MWh)"),
        sel("source", "Source", ["Renewable", "Waste heat recovery", "Nuclear", "Other low-carbon"]),
      ],
    },
    {
      id: "7.45",
      kind: "fields",
      label:
        "7.45 Describe your gross global combined Scope 1 and 2 emissions for the reporting year in metric tons CO2e per unit currency total revenue (intensity).",
      fields: [
        num("intensity", "Emissions intensity (tCO2e per unit revenue)"),
        t("revenueUnit", "Revenue unit (e.g. USD million)"),
        sel("scope2Basis", "Scope 2 basis", ["Location-based", "Market-based"]),
      ],
    },
    {
      id: "7.47",
      kind: "table",
      label:
        "7.47 State your organization's Scope 1 and Scope 2 emissions intensities related to cement production (sector-specific).",
      minRows: 1,
      columns: [
        t("metricName", "Intensity metric"),
        num("value", "Value"),
        t("unit", "Unit (e.g. kgCO2e/t cement, kgCO2e/t clinker)"),
        sel("scope", "Scope", ["Scope 1", "Scope 2", "Scope 1+2"]),
      ],
    },
    {
      id: "7.52",
      kind: "table",
      label: "7.52 Provide any additional climate-related metrics relevant to your business.",
      minRows: 1,
      columns: [
        t("metric", "Metric name"),
        num("value", "Value"),
        t("unit", "Unit"),
        lt("description", "Description / methodology"),
      ],
    },
    {
      id: "7.53",
      kind: "fields",
      label: "7.53 Did you have an emissions target that was active in the reporting year?",
      fields: [sel("hasTarget", "Active emissions target?", yesNo)],
    },
    {
      id: "7.53.1",
      kind: "table",
      label: "7.53.1 Provide details of your absolute emissions targets and progress made against them.",
      minRows: 1,
      columns: [
        t("targetRef", "Target reference (e.g. Abs1, SBTi-near-term)"),
        sel("scopes", "Scopes covered", ["Scope 1", "Scope 2", "Scope 1+2", "Scope 3", "Scope 1+2+3", "Other"]),
        num("baseYear", "Base year"),
        num("baseEmissions", "Base year emissions (tCO2e)"),
        num("targetYear", "Target year"),
        num("targetReductionPct", "Target reduction (%)", { unit: "%" }),
        num("emissionsAtReportingYear", "Emissions in reporting year (tCO2e)"),
        num("pctAchieved", "% of target achieved", { unit: "%" }),
        sel("targetStatus", "Target status", targetStatus),
        sel("isSbti", "SBTi-validated?", yesNo),
        lt("description", "Description"),
      ],
    },
    {
      id: "7.53.2",
      kind: "table",
      label: "7.53.2 Provide details of your emissions intensity targets and progress made against them.",
      minRows: 1,
      columns: [
        t("targetRef", "Target reference (e.g. Int1)"),
        sel("scopes", "Scopes covered", ["Scope 1", "Scope 2", "Scope 1+2", "Scope 3", "Scope 1+2+3"]),
        t("intensityMetric", "Intensity metric"),
        num("baseYear", "Base year"),
        num("baseIntensity", "Base year intensity"),
        num("targetYear", "Target year"),
        num("targetReductionPct", "Target reduction (%)", { unit: "%" }),
        num("intensityAtReportingYear", "Intensity in reporting year"),
        num("pctAchieved", "% of target achieved", { unit: "%" }),
        sel("targetStatus", "Target status", targetStatus),
        lt("description", "Description"),
      ],
    },
    {
      id: "7.53.3",
      kind: "fields",
      label:
        "7.53.3 Explain why you did not have an emissions target, and forecast how your emissions will change.",
      fields: [lt("explanation", "Explanation and forecast")],
    },
    {
      id: "7.54",
      kind: "fields",
      label: "7.54 Did you have any other climate-related targets that were active in the reporting year?",
      fields: [sel("hasOtherTargets", "Other climate-related targets?", yesNo)],
    },
    {
      id: "7.54.1",
      kind: "table",
      label:
        "7.54.1 Provide details of your targets to increase or maintain low-carbon energy consumption or production.",
      minRows: 1,
      columns: [
        t("targetRef", "Target reference (e.g. LCE1, RE100)"),
        sel("type", "Type", [
          "Renewable electricity consumption",
          "Renewable electricity production",
          "Energy efficiency",
          "Other low-carbon",
        ]),
        num("baseYear", "Base year"),
        num("targetYear", "Target year"),
        num("targetPct", "Target (%)", { unit: "%" }),
        num("currentPct", "% achieved at reporting year", { unit: "%" }),
        sel("targetStatus", "Target status", targetStatus),
        lt("description", "Description"),
      ],
    },
    {
      id: "7.54.2",
      kind: "table",
      label: "7.54.2 Provide details of any other climate-related targets, including methane reduction targets.",
      minRows: 1,
      columns: [
        t("targetRef", "Target reference (e.g. Oth1)"),
        sel("type", "Target type", targetType),
        num("baseYear", "Base year"),
        num("targetYear", "Target year"),
        lt("metric", "Metric"),
        num("targetValue", "Target value"),
        sel("targetStatus", "Target status", targetStatus),
        lt("description", "Description"),
      ],
    },
    {
      id: "7.54.3",
      kind: "table",
      label: "7.54.3 Provide details of your net-zero target(s).",
      minRows: 1,
      columns: [
        t("targetRef", "Target reference"),
        num("targetYear", "Net-zero year"),
        sel("scopes", "Scopes covered", ["Scope 1+2", "Scope 1+2+3"]),
        sel("isSbti", "SBTi-validated?", yesNo),
        lt("description", "Description (incl. residual emissions strategy and removals plan)"),
      ],
    },
    {
      id: "7.55",
      kind: "fields",
      label:
        "7.55 Did you have emissions reduction initiatives that were active within the reporting year?",
      fields: [sel("hasInitiatives", "Emissions reduction initiatives?", yesNo)],
    },
    {
      id: "7.55.1",
      kind: "table",
      label:
        "7.55.1 Identify the total number of initiatives at each stage of development, and the implementation phase achievements.",
      minRows: initiativeStages.length,
      maxRows: initiativeStages.length,
      rowLabel: (i) => initiativeStages[i],
      columns: [
        num("number", "Number of initiatives"),
        num("estimatedReduction", "Estimated annual CO2e reduction (tCO2e)"),
      ],
    },
    {
      id: "7.55.3",
      kind: "fields",
      label: "7.55.3 What methods do you use to drive investment in emissions reduction activities?",
      fields: [
        lt(
          "methods",
          "Investment drivers (Internal carbon price, Dedicated budget, Compliance with regulatory requirements, Marginal abatement cost curve, …)",
        ),
      ],
    },
    {
      id: "7.74.1",
      kind: "table",
      label: "7.74.1 Provide details of your products and/or services that you classify as low-carbon.",
      minRows: 1,
      columns: [
        t("product", "Product / service"),
        num("revenuePct", "% of revenue from this product", { unit: "%" }),
        lt("description", "Description and methodology used to classify as low-carbon"),
        lt("taxonomy", "Taxonomy or standard used"),
      ],
    },
    {
      id: "7.79",
      kind: "fields",
      label:
        "7.79 Has your organization retired any project-based carbon credits within the reporting year?",
      fields: [sel("retired", "Carbon credits retired?", yesNo)],
    },
    {
      id: "7.79.1",
      kind: "table",
      label: "7.79.1 Provide details of the project-based carbon credits retired by your organization.",
      minRows: 1,
      columns: [
        t("projectName", "Project name"),
        sel("projectType", "Project type", [
          "Renewable energy",
          "Forestry / land use",
          "Energy efficiency",
          "Methane / fugitive",
          "Direct air capture",
          "Other",
        ]),
        t("projectIdentifier", "Project identifier"),
        sel("standard", "Standard", ["Verra (VCS)", "Gold Standard", "CDM", "ACR", "CAR", "Other"]),
        num("vintage", "Vintage"),
        num("creditsRetired", "Credits retired (tCO2e)"),
        num("price", "Price per credit"),
        t("country", "Country / area"),
      ],
    },
  ],
};

// ============================================================
// MODULE 13 — FURTHER INFORMATION & SIGN-OFF
// ============================================================

const m13: Section = {
  id: "M13",
  title: "Module 13 — Further Information & Sign-off",
  sheetRef: "Module 13",
  questions: [
    {
      id: "13.1",
      kind: "fields",
      label:
        "13.1 Indicate if any environmental information included in your CDP response (not already covered in 7.9) is verified or assured by a third party.",
      fields: [
        sel("verified", "Other information verified / assured?", yesNo),
        lt("explanation", "Explain why or details of verification"),
      ],
    },
    {
      id: "13.1.1",
      kind: "table",
      label:
        "13.1.1 Which data points within your CDP response are verified and/or assured by a third party?",
      minRows: 1,
      columns: [
        t("dataPoint", "Data point / question reference"),
        t("verifier", "Name of verifier"),
        sel("level", "Level of assurance", verificationLevels),
        t("standard", "Standard used"),
        t("attachLink", "Attachment / web link"),
      ],
    },
    {
      id: "13.2",
      kind: "fields",
      label:
        "13.2 Use this field to provide any additional information or context that you feel is relevant to your organization's response.",
      fields: [lt("additionalInfo", "Additional information")],
    },
    {
      id: "13.3",
      kind: "fields",
      label: "13.3 Provide the following information for the person that has signed off (approved) your CDP response.",
      fields: [
        t("jobTitle", "Job title"),
        sel("jobCategory", "Corresponding job category", [
          "Board chair",
          "Board / Executive board",
          "Director on board",
          "Chief Executive Officer (CEO)",
          "Chief Financial Officer (CFO)",
          "Chief Operating Officer (COO)",
          "Chief Procurement Officer (CPO)",
          "Chief Risk Officer (CRO)",
          "Chief Sustainability Officer (CSO)",
          "Other C-Suite Officer",
          "President",
          "General Counsel",
          "Business unit manager",
          "Energy manager",
          "Environmental, health and safety manager",
          "Environment / Sustainability manager",
          "Facilities manager",
          "Process operation manager",
          "Procurement manager",
          "Public affairs manager",
          "Risk manager",
          "Other (specify)",
        ]),
      ],
    },
  ],
};

// ============================================================
// AGGREGATE
// ============================================================

export const sections: Section[] = [m1, m2, m3, m4, m5, m6, m7, m13];
