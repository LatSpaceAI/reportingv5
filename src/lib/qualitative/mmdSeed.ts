import type { Block, Comment, Metric, QualitativeDoc, Requirement } from "./types";

// Stable IDs so the seed is deterministic across reloads. Anything created
// after seeding uses genId().
const now = new Date("2026-04-01T09:00:00.000Z").toISOString();

const blocks: Block[] = [
  { id: "b_title", kind: "heading", level: 1, text: "Monitoring Methodology Document — Installation Alpha" },
  { id: "b_intro_h", kind: "heading", level: 2, text: "1. Introduction" },
  {
    id: "b_intro_p",
    kind: "paragraph",
    text: "This Monitoring Methodology Document (MMD) sets out the system boundaries, data sources, and calculation methods used to determine embedded emissions for goods produced at Installation Alpha under the EU Carbon Border Adjustment Mechanism.",
  },
  {
    id: "b_inst_h",
    kind: "heading",
    level: 2,
    text: "2. Installation overview",
    sectionTag: "Installation overview",
  },
  {
    id: "b_inst_p",
    kind: "paragraph",
    text: "Installation Alpha is a single-site facility producing aggregated CBAM goods. The operator is responsible for monitoring, calculating, and reporting embedded emissions for each calendar quarter.",
  },
  {
    id: "b_inst_req",
    kind: "requirement-ref",
    requirementId: "MMD-INST-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },
  {
    id: "b_bound_h",
    kind: "heading",
    level: 2,
    text: "3. System boundary",
    sectionTag: "System boundary",
  },
  {
    id: "b_bound_p",
    kind: "paragraph",
    text: "The system boundary covers all production processes within the installation that contribute to embedded direct and indirect emissions of CBAM goods, including precursor materials.",
  },
  {
    id: "b_bound_req",
    kind: "requirement-ref",
    requirementId: "MMD-BND-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },
  {
    id: "b_data_h",
    kind: "heading",
    level: 2,
    text: "4. Data sources",
    sectionTag: "Data sources",
  },
  {
    id: "b_data_p",
    kind: "paragraph",
    text: "Activity data, fuel consumption, and electricity inputs are drawn from the sources listed below. Each source is recorded with its measurement frequency and data-quality tier.",
  },
  {
    id: "b_data_table",
    kind: "table",
    columns: ["Stream", "Source", "Frequency", "Tier"],
    rows: [
      ["Natural gas", "Utility meter — Site A", "Monthly", "Tier 3"],
      ["Electricity (grid)", "DISCOM invoice", "Monthly", "Tier 2"],
      ["Process input — limestone", "Weighbridge log", "Per batch", "Tier 3"],
    ],
  },
  {
    id: "b_method_h",
    kind: "heading",
    level: 2,
    text: "5. Calculation methodology",
    sectionTag: "Calculation methodology",
  },
  {
    id: "b_method_p",
    kind: "paragraph",
    text: "Embedded emissions are calculated using a calculation-based approach following Annex III of Regulation (EU) 2023/956. Emission factors are taken from the EU CBAM default values where direct measurement is not available.",
  },
  {
    id: "b_method_req",
    kind: "requirement-ref",
    requirementId: "MMD-MTH-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },
  {
    id: "b_qaqc_h",
    kind: "heading",
    level: 2,
    text: "6. QA / QC procedures",
    sectionTag: "QA / QC",
  },
  {
    id: "b_qaqc_p",
    kind: "paragraph",
    text: "Quality assurance and control procedures cover instrument calibration, data validation rules, and reconciliation against financial records on a quarterly basis.",
  },
  {
    id: "b_qaqc_req",
    kind: "requirement-ref",
    requirementId: "MMD-QAQC-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },
];

const requirements: Requirement[] = [
  {
    id: "MMD-INST-01",
    name: "Installation identity",
    description:
      "Legal name, UNLOCODE, geographic coordinates, and authorised representative for the installation covered by this MMD.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-BND-01",
    name: "System boundary description",
    description:
      "Describe all production processes included within the system boundary, including precursors and ancillary energy flows. Identify any flows excluded and justify the exclusion.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-DATA-01",
    name: "Activity data sources",
    description:
      "Tabulate each activity-data stream, the measurement instrument or invoice, the measurement frequency, and the assigned monitoring tier.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-MTH-01",
    name: "Calculation methodology",
    description:
      "Specify the calculation approach (calculation-based vs measurement-based), the formulae used, the source of emission factors, and any default values applied.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-QAQC-01",
    name: "QA / QC procedures",
    description:
      "Document the procedures for instrument calibration, data validation, and periodic reconciliation against financial and operational records.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-PRC-01",
    name: "Precursor accounting",
    description:
      "List all precursor materials, their suppliers, and how their embedded emissions are obtained (supplier MMD, default values, or direct measurement).",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
];

const metrics: Metric[] = [
  { id: "M-DIRECT-EMI", name: "Direct emissions", unit: "tCO2e", value: 1138.02, source: "GHG ledger", updatedAt: now },
  { id: "M-IND-EMI", name: "Indirect emissions", unit: "tCO2e", value: 452.84, source: "DISCOM invoices", updatedAt: now },
  { id: "M-PROD", name: "Production output", unit: "t", value: 12450, source: "Production log", updatedAt: now },
  { id: "M-FUEL-NG", name: "Natural gas consumption", unit: "MWh", value: 217.8, source: "Utility meter", updatedAt: now },
  { id: "M-ELEC", name: "Electricity consumption", unit: "MWh", value: 653.4, source: "DISCOM invoice", updatedAt: now },
];

const comments: Comment[] = [];

export function buildMmdSeed(frameworkId: string): QualitativeDoc {
  return {
    frameworkId,
    title: "Monitoring Methodology Document — Installation Alpha",
    blocks,
    requirements,
    metrics,
    comments,
    proposals: [],
    updatedAt: now,
  };
}
