// Layout of the "BRSR - Procurement" monthly sheet (worksheet name
// "Proc,Supply Chain, MKt" — the template's own spelling, comma placement and
// capital K included), verified cell-by-cell against
// birla-estates/output/BRSR -  Procurement.xlsx and the template tab.
//
// UNLIKE HR, THE SAMPLE AND TEMPLATE DISAGREE ON ROW NUMBERS. The filler
// inserted material rows and renamed the "Material 1"/"Material 2"
// placeholders ("Concrete", "Steel", plus a stray note row), leaving the
// filled sheet three rows longer than the template by the bottom. templateRow
// below is always the TEMPLATE's row (the export write target); the parser
// finds the uploaded file's actual rows through the block anchors.
//
// List blocks: the template offers fewer placeholder rows than the client
// actually files (the recycled-material block has ONE placeholder row; the
// April sample files three materials). Extra slots are declared with
// templateRow null — they are ingested and chartable, but the export has no
// cell to put them in and reports them instead of inventing rows (inserting
// rows into the client's template corrupts its merged ranges).

import type { ReturnSheetLayout, SheetBlock, SheetCell } from "./layoutTypes";

const b = (
  id: string,
  anchor: string,
  templateAnchorRow: number,
  extra?: Partial<SheetBlock>
): SheetBlock => ({ id, anchor, templateAnchorRow, kind: "fixed", ...extra });

const c = (
  blockId: string,
  key: string,
  templateRow: number | null,
  col: string,
  rowLabel: string | null,
  label: string,
  kind: "number" | "text" = "number",
  unit: string | null = "count",
  slot?: number
): SheetCell => ({ key, blockId, templateRow, col, rowLabel, kind, label, unit, slot });

const cells: SheetCell[] = [
  // -- Recycled/reused input material, % by value (template row 5 is the only
  //    placeholder; the sample files three named materials) -----------------
  c("recycled_pct", "proc.recycled_input_1_name", 5, "B", null, "Recycled/reused input material 1: name", "text", null, 1),
  c("recycled_pct", "proc.recycled_input_1_pct", 5, "C", null, "Recycled/reused input material 1: % of total material", "number", "fraction", 1),
  c("recycled_pct", "proc.recycled_input_2_name", null, "B", null, "Recycled/reused input material 2: name", "text", null, 2),
  c("recycled_pct", "proc.recycled_input_2_pct", null, "C", null, "Recycled/reused input material 2: % of total material", "number", "fraction", 2),
  c("recycled_pct", "proc.recycled_input_3_name", null, "B", null, "Recycled/reused input material 3: name", "text", null, 3),
  c("recycled_pct", "proc.recycled_input_3_pct", null, "C", null, "Recycled/reused input material 3: % of total material", "number", "fraction", 3),

  // -- Materials used (Disclosure 301-1): two placeholder rows per class ----
  c("mat_nonrenew", "proc.material_nonrenew_1_name", 10, "B", null, "Non-renewable material 1: name", "text", null, 1),
  c("mat_nonrenew", "proc.material_nonrenew_1_qty", 10, "D", null, "Non-renewable material 1: quantity", "number", "MT", 1),
  c("mat_nonrenew", "proc.material_nonrenew_2_name", 11, "B", null, "Non-renewable material 2: name", "text", null, 2),
  c("mat_nonrenew", "proc.material_nonrenew_2_qty", 11, "D", null, "Non-renewable material 2: quantity", "number", "MT", 2),
  c("mat_renew", "proc.material_renew_1_name", 13, "B", null, "Renewable material 1: name", "text", null, 1),
  c("mat_renew", "proc.material_renew_1_qty", 13, "D", null, "Renewable material 1: quantity", "number", "MT", 1),
  c("mat_renew", "proc.material_renew_2_name", 14, "B", null, "Renewable material 2: name", "text", null, 2),
  c("mat_renew", "proc.material_renew_2_qty", 14, "D", null, "Renewable material 2: quantity", "number", "MT", 2),

  // -- Recycled input materials (Disclosure 301-2); the % row is a template
  //    formula ---------------------------------------------------------------
  c("recycled_input", "proc.total_input_mt", 20, "D", "Total Input Material", "Total input material", "number", "MT"),
  c("recycled_input", "proc.recycled_input_mt", 21, "D", "Recycled Input material used", "Recycled input material used", "number", "MT"),

  // -- Reclaimed products and packaging; the % row is a template formula ----
  c("reclaimed", "proc.reclaimed_products", 26, "D", "Products and their packaging materials reclaimed", "Products and packaging reclaimed", "number", "MT"),
  c("reclaimed", "proc.reclaimed_products_sold", 27, "D", "Told Products and their packaging materials Sold", "Products and packaging sold", "number", "MT"),

  // -- MSME / domestic sourcing ---------------------------------------------
  c("sourcing", "proc.msme_share", 41, "C", "Directly sourced from MSMEs", "Input material sourced directly from MSMEs/small producers (share by value)", "number", "fraction"),
  c("sourcing", "proc.india_share", 42, "C", "Directly from within India", "Input material sourced directly from within India (share by value)", "number", "fraction"),

  // -- Proportion of spending on local suppliers (Disclosure 204-1); the %
  //    row is a template formula. The sample files prose ("171.49 Crore",
  //    "Data Not avaialble"), so these are text -------------------------------
  c("local_spend", "proc.budget_total_text", 47, "C", "Total Procurement Budget", "Total procurement budget", "text", null),
  c("local_spend", "proc.budget_local_text", 48, "C", "Procurement budget spent on local suppliers", "Procurement budget spent on local suppliers", "text", null),

  // -- Preferential procurement (answers live on the question rows) ---------
  c("preferential", "proc.pref_policy_text", 52, "C", "a. Does the entity have preferential procurement policy", "Preferential procurement policy in place", "text", null),
  c("preferential", "proc.pref_groups_text", 53, "C", "b. From which marginalized", "Marginalised/vulnerable groups procured from", "text", null),
  c("preferential", "proc.pref_share_text", 54, "C", "c. What percentage of total procurement", "Share of total procurement from marginalised/vulnerable groups", "text", null),

  // -- Consumer complaints mechanism ----------------------------------------
  c("grievance", "proc.consumer_grievance_text", 56, "C", "Describe the Mechanisms in place", "Mechanisms to receive and respond to consumer complaints", "text", null),

  // -- Turnover of products/services with ESG information ------------------
  c("turnover_info", "proc.turnover_env_pct", 60, "C", "Environmental and social parameters relevant", "Turnover share: environmental and social parameters disclosed", "number", "fraction"),
  c("turnover_info", "proc.turnover_safety_pct", 61, "C", "Safe and responsible usage", "Turnover share: safe and responsible usage disclosed", "number", "fraction"),
  c("turnover_info", "proc.turnover_recycling_pct", 62, "C", "Recycling and/or safe disposal", "Turnover share: recycling/safe disposal disclosed", "number", "fraction"),

  // -- Consumer education ----------------------------------------------------
  c("consumer_edu", "proc.consumer_education_text", 64, "C", "Steps taken to inform and educate", "Steps taken to inform and educate consumers", "text", null),

  // -- Value-chain awareness programmes (data row sits under the sub-header,
  //    unlabeled: resolved by offset from the anchor) ------------------------
  c("vcp_awareness", "proc.vcp_awareness_count", 70, "B", null, "Awareness programmes held for value-chain partners"),
  c("vcp_awareness", "proc.vcp_awareness_topics", 70, "C", null, "Topics/principles covered in value-chain awareness programmes", "text", null),
  c("vcp_awareness", "proc.vcp_awareness_coverage", 70, "D", null, "Value-chain partners covered by awareness programmes (share by value)", "number", "fraction"),

  // -- Assessment of value-chain partners: safety ---------------------------
  c("vcp_assess_safety", "proc.vcp_assess_safety", 75, "C", "Health and Safety Practices", "Value-chain partners assessed: health and safety practices", "number", "fraction"),
  c("vcp_assess_safety", "proc.vcp_assess_conditions", 76, "C", "Working Conditions", "Value-chain partners assessed: working conditions", "number", "fraction"),

  // -- Corrective actions (safety assessment) -------------------------------
  c("vcp_corrective_safety", "proc.vcp_corrective_safety_text", 78, "C", "Provide details of corrective actions taken to address significant risks", "Corrective actions from value-chain safety assessments", "text", null),

  // -- Assessment of value-chain partners: social/human rights --------------
  c("vcp_assess_social", "proc.vcp_assess_posh", 82, "C", "Sexual Harassment", "Value-chain partners assessed: sexual harassment", "number", "fraction"),
  c("vcp_assess_social", "proc.vcp_assess_discrimination", 83, "C", "Discrimination at workplace", "Value-chain partners assessed: discrimination at workplace", "number", "fraction"),
  c("vcp_assess_social", "proc.vcp_assess_child_labour", 84, "C", "Child Labour", "Value-chain partners assessed: child labour", "number", "fraction"),
  c("vcp_assess_social", "proc.vcp_assess_forced_labour", 85, "C", "Forced Labour/Involuntary Labour", "Value-chain partners assessed: forced/involuntary labour", "number", "fraction"),
  c("vcp_assess_social", "proc.vcp_assess_wages", 86, "C", "Wages", "Value-chain partners assessed: wages", "number", "fraction"),
  c("vcp_assess_social", "proc.vcp_assess_other", 87, "C", "Others- please specify", "Value-chain partners assessed: other", "number", "fraction"),

  // -- Corrective actions (social assessment) -------------------------------
  c("vcp_corrective_social", "proc.vcp_corrective_social_text", 89, "C", "Provide details of any corrective actions taken or underway", "Corrective actions from value-chain social assessments", "text", null),

  // -- Adverse environmental impact from the value chain --------------------
  c("value_chain_impact", "proc.value_chain_env_impact_text", 92, "C", "Disclose any significant adverse impact to the environment", "Significant adverse environmental impact from the value chain", "text", null),

  // -- Negative environmental impacts in the supply chain (308-2); the two
  //    percentage rows are template formulas --------------------------------
  c("env_impacts", "proc.suppliers_env_assessed", 95, "D", "Number of suppliers assesed for environmental impacts", "Suppliers assessed for environmental impacts"),
  c("env_impacts", "proc.suppliers_env_negative", 96, "D", "Number of suppliers identified as having significant", "Suppliers with significant negative environmental impacts"),
  c("env_impacts", "proc.suppliers_env_improved", 97, "D", "Number of suppliers having negative", "Suppliers with negative environmental impacts where improvements were agreed"),
  c("env_impacts", "proc.suppliers_env_terminated", 99, "D", "Number of suppliers terminated for having negative environmental impacts", "Suppliers terminated for negative environmental impacts"),

  // -- Child-labour risk (408-1) --------------------------------------------
  c("child_labour_risk", "proc.child_labour_risk_ops", 106, "C", "i. child labor", "Operations/suppliers at significant risk: child labour"),
  c("child_labour_risk", "proc.young_workers_risk_ops", 107, "C", "ii. young workers exposed to hazardous work", "Operations/suppliers at significant risk: young workers in hazardous work"),
  c("child_labour_detail", "proc.child_labour_risk_optype_text", 111, "C", "i. type of operation", "Operations/suppliers at child-labour risk: type of operation", "text", null),
  c("child_labour_detail", "proc.child_labour_risk_geo_text", 112, "C", "ii. countries or geographic areas", "Operations/suppliers at child-labour risk: geography", "text", null),
  c("child_labour_measures", "proc.child_labour_measures_text", 115, "C", "Measures taken by the organization in the reporting period", "Measures taken to abolish child labour", "text", null),

  // -- Negative social impacts in the supply chain (414-2); the two
  //    percentage rows are template formulas --------------------------------
  c("social_impacts", "proc.suppliers_social_assessed", 119, "D", "a. Number of suppliers assesed for social impacts", "Suppliers assessed for social impacts"),
  c("social_impacts", "proc.suppliers_social_negative", 120, "D", "b. Number of suppliers identified as having significant", "Suppliers with significant negative social impacts"),
  c("social_impacts", "proc.social_impacts_identified", 121, "D", "c. Significant actual and potential negative social impacts identified", "Significant negative social impacts identified in the supply chain"),
  c("social_impacts", "proc.suppliers_social_improved", 123, "D", "Suppliers identified as having significant actual and potential negative social impacts", "Suppliers with negative social impacts where improvements were agreed"),

  // -- Inputs sourced sustainably (data row sits under the sub-header row) --
  c("sustainable_inputs", "proc.inputs_total_wt", 128, "B", null, "Total inputs by weight", "number", "MT"),
  c("sustainable_inputs", "proc.inputs_sustainable_wt", 128, "C", null, "Inputs sourced sustainably by weight", "number", "MT"),
];

const blocks: SheetBlock[] = [
  b("recycled_pct", "Percentage of recycled or reused input material", 2, {
    kind: "list",
    listStartAfter: "Example- Process solid waste",
    endAnchor: "Disclosure 301-1",
    slots: 3,
  }),
  b("mat_nonrenew", "Non-renewable Used", 9, {
    kind: "list",
    endAnchor: "Renewable materials used",
    slots: 2,
  }),
  b("mat_renew", "Renewable materials used", 12, {
    kind: "list",
    endAnchor: "Disclosure 301-2",
    slots: 2,
  }),
  b("recycled_input", "Disclosure 301-2 Recycled input materials used", 16),
  b("reclaimed", "Reclaimed products and their packaging materials", 25),
  b("eol_reclaim", "Of the products and packaging reclaimed", 30),
  b("sourcing", "Percentage of input material (inputs to total inputs by value)", 39),
  b("local_spend", "Disclosure 204-1 Proportion of spending on local suppliers", 44),
  b("preferential", "a. Does the entity have preferential procurement policy", 52),
  b("grievance", "Describe the Mechanisms in place", 56),
  b("turnover_info", "Turnover of products and/ services", 58),
  b("consumer_edu", "Steps taken to inform and educate", 64),
  b("vcp_awareness", "Total number of awareness programmes held", 69),
  b("vcp_assess_safety", "Details on assessment of value chain partners", 73),
  b("vcp_corrective_safety", "Provide details of corrective actions taken to address significant risks", 78),
  b("vcp_assess_social", "Details on assessment of value chain partners", 80),
  b("vcp_corrective_social", "Provide details of any corrective actions taken or underway", 89),
  b("value_chain_impact", "Disclose any significant adverse impact to the environment", 92),
  b("env_impacts", "308-2 Negative environmental impacts", 94),
  b("child_labour_risk", "Operations and suppliers considered to have significant risk for incidents of:", 105),
  b("child_labour_detail", "Operations and suppliers considered to have significant risk for incidents of child labor", 110),
  b("child_labour_measures", "Measures taken by the organization in the reporting period", 115),
  b("social_impacts", "Disclosure 414-2", 117),
  b("sustainable_inputs", "Inputs sourced sustainably", 126),
];

// End-of-life reclaim grid (current-FY columns only; the previous-FY columns
// are last year's constants, already printed in the template).
const EOL_ROWS: Array<[number, string, string]> = [
  [33, "plastics", "Plastics(including packaging)"],
  [34, "ewaste", "E-waste"],
  [35, "hazardous", "Hazardous Waste"],
  [36, "other", "Other Waste"],
];
const EOL_COLS: Array<[string, string, string]> = [
  ["C", "reused", "re-used"],
  ["D", "recycled", "recycled"],
  ["E", "disposed", "safely disposed"],
];
for (const [row, slug, rowLabel] of EOL_ROWS) {
  for (const [col, fate, human] of EOL_COLS) {
    cells.push(
      c("eol_reclaim", `proc.eol_${slug}_${fate}`, row, col, rowLabel, `End-of-life ${rowLabel}: ${human}`, "number", "MT")
    );
  }
}

export const PROC_LAYOUT: ReturnSheetLayout = {
  sheetName: "Proc,Supply Chain, MKt",
  domain: "PROCUREMENT",
  title: "BRSR - Procurement",
  blocks,
  cells,
};
