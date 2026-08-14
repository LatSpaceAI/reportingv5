// Layout of the "BRSR - HR" monthly sheet (worksheet name "HR"), verified
// cell-by-cell against birla-estates/output/BRSR - HR - 15.04.xlsx and the
// template tab in src/lib/brsrExport/template/birla-estates-brsr-fy25-v1.xlsx.
// The two are row-identical (218 rows), so templateRow doubles as the sample
// row — but the parser still resolves rows by label so a future upload with
// inserted rows keeps parsing (the Procurement sample already drifted).
//
// WHAT IS DELIBERATELY NOT A CELL HERE
//
// Any cell the TEMPLATE computes with its own formula (the Total and
// Age-group-total rows, percentage rows such as C73/C217, the F-column
// parental-leave totals). The export must leave those formulas alive so the
// workbook keeps recalculating, and ingesting them would double-store what
// the sheet derives. "Previous FY" columns are also skipped: they are last
// year's constants, already printed in the template.

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
  unit: string | null = "count"
): SheetCell => ({ key, blockId, templateRow, col, rowLabel, kind, label, unit });

// The four workforce categories, in the row order every grid uses.
const CATS: Array<[string, string, string]> = [
  ["perm_emp", "Permanent Employees", "permanent employees"],
  ["oth_emp", "Other than Permanent Employees", "other than permanent employees"],
  ["perm_wkr", "Permanent Workers", "permanent workers"],
  ["oth_wkr", "Other Than Permanent Workers", "other than permanent workers"],
];

// Age × sex columns of the six-wide demographic grids.
const AGE_COLS: Array<[string, string, string]> = [
  ["C", "u30_m", "males below 30"],
  ["D", "u30_f", "females below 30"],
  ["E", "30_50_m", "males 30-50"],
  ["F", "30_50_f", "females 30-50"],
  ["G", "o50_m", "males above 50"],
  ["H", "o50_f", "females above 50"],
];

const cells: SheetCell[] = [];

// -- Headcount by gender (rows 4-7) -----------------------------------------
for (const [i, [slug, rowLabel, human]] of CATS.entries()) {
  cells.push(
    c("headcount", `hr.headcount_${slug}_m`, 4 + i, "C", rowLabel, `Male ${human}`),
    c("headcount", `hr.headcount_${slug}_f`, 4 + i, "D", rowLabel, `Female ${human}`)
  );
}

// -- Differently abled (rows 10-13) -----------------------------------------
for (const [i, [slug, rowLabel, human]] of CATS.entries()) {
  cells.push(
    c("pwd", `hr.pwd_${slug}_m`, 10 + i, "C", rowLabel, `Differently abled male ${human}`),
    c("pwd", `hr.pwd_${slug}_f`, 10 + i, "D", rowLabel, `Differently abled female ${human}`)
  );
}

// -- Headcount by age, end of FY (rows 17-20) and beginning of FY (26-29) ---
for (const [prefix, base, blockId, when] of [
  ["eoy", 17, "count_eoy", "at end of FY"],
  ["boy", 26, "count_boy", "at beginning of FY"],
] as Array<[string, number, string, string]>) {
  for (const [i, [slug, rowLabel, human]] of CATS.entries()) {
    for (const [col, age, ageHuman] of AGE_COLS) {
      cells.push(
        c(blockId, `hr.${prefix}_${slug}_${age}`, base + i, col, rowLabel, `${human} ${when}: ${ageHuman}`)
      );
    }
  }
}

// -- Separations (row 35 employees, row 40 workers) -------------------------
for (const [col, age, ageHuman] of AGE_COLS) {
  cells.push(
    c("sep_emp", `hr.sep_perm_emp_${age}`, 35, col, "Permanent Employees", `Permanent employees separated in FY: ${ageHuman}`),
    c("sep_wkr", `hr.sep_perm_wkr_${age}`, 40, col, "Permanent Workers", `Permanent workers separated in FY: ${ageHuman}`)
  );
}

// -- Separations by region (rows 44-45) -------------------------------------
for (const [i, [slug, rowLabel, human]] of [CATS[0], CATS[2]].entries()) {
  const row = 44 + i;
  cells.push(
    c("sep_region", `hr.sep_region_${slug}_local`, row, "C", rowLabel, `Local separations: ${human}`),
    c("sep_region", `hr.sep_region_${slug}_nonlocal`, row, "D", rowLabel, `Non-local separations: ${human}`)
  );
}

// -- New hires (rows 50-51 employees, 57-58 workers) ------------------------
for (const [i, [slug, rowLabel, human]] of [CATS[0], CATS[1]].entries()) {
  for (const [col, age, ageHuman] of AGE_COLS) {
    cells.push(
      c("hires_emp", `hr.hires_${slug}_${age}`, 50 + i, col, rowLabel, `New hires, ${human}: ${ageHuman}`)
    );
  }
}
for (const [i, [slug, rowLabel, human]] of [CATS[2], CATS[3]].entries()) {
  for (const [col, age, ageHuman] of AGE_COLS) {
    cells.push(
      c("hires_wkr", `hr.hires_${slug}_${age}`, 57 + i, col, rowLabel, `New hires, ${human}: ${ageHuman}`)
    );
  }
}

// -- New hires by region (rows 63-64) ---------------------------------------
for (const [i, [slug, rowLabel, human]] of [CATS[0], CATS[2]].entries()) {
  const row = 63 + i;
  cells.push(
    c("hires_region", `hr.hires_region_${slug}_local`, row, "C", rowLabel, `Local new hires: ${human}`),
    c("hires_region", `hr.hires_region_${slug}_nonlocal`, row, "D", rowLabel, `Non-local new hires: ${human}`)
  );
}

// -- Senior management local hiring (rows 71-72; % row 73 is a formula) -----
cells.push(
  c("senior_mgmt", "hr.senior_mgmt_m", 71, "C", "Total number of senior management employees", "Senior management: male"),
  c("senior_mgmt", "hr.senior_mgmt_f", 71, "D", "Total number of senior management employees", "Senior management: female"),
  c("senior_mgmt", "hr.senior_mgmt_local_m", 72, "C", "Number of Senior management at significant locations", "Senior management hired locally: male"),
  c("senior_mgmt", "hr.senior_mgmt_local_f", 72, "D", "Number of Senior management at significant locations", "Senior management hired locally: female")
);

// -- NGRBC training coverage (rows 77-78) -----------------------------------
cells.push(
  c("ngrbc", "hr.ngrbc_emp_programmes", 77, "C", "For Employees", "NGRBC awareness programmes held for employees"),
  c("ngrbc", "hr.ngrbc_emp_topics", 77, "D", "For Employees", "NGRBC topics/principles covered (employees)", "text", null),
  c("ngrbc", "hr.ngrbc_emp_covered", 77, "E", "For Employees", "Employees covered by NGRBC awareness programmes"),
  c("ngrbc", "hr.ngrbc_wkr_programmes", 78, "C", "For Workers", "NGRBC awareness programmes held for workers"),
  c("ngrbc", "hr.ngrbc_wkr_topics", 78, "D", "For Workers", "NGRBC topics/principles covered (workers)", "text", null),
  c("ngrbc", "hr.ngrbc_wkr_covered", 78, "E", "For Workers", "Workers covered by NGRBC awareness programmes")
);

// -- Skill-upgradation training (rows 85-86 employees, 89-90 workers) -------
// Totals at 87/91 are template formulas. The duplicate Male/Female labels
// resolve by the parser's forward cursor.
cells.push(
  c("training_skill", "hr.trained_skill_perm_emp_m", 85, "C", "Male", "Permanent male employees trained on skill upgradation"),
  c("training_skill", "hr.trained_skill_perm_emp_f", 86, "C", "Female", "Permanent female employees trained on skill upgradation"),
  c("training_skill", "hr.trained_skill_perm_wkr_m", 89, "C", "Male", "Permanent male workers trained on skill upgradation"),
  c("training_skill", "hr.trained_skill_perm_wkr_f", 90, "C", "Female", "Permanent female workers trained on skill upgradation")
);

// -- Human-rights training (rows 97-98 employees, 101-102 workers) ----------
cells.push(
  c("training_rights", "hr.trained_rights_emp_perm", 97, "C", "Permanent", "Permanent employees trained on human rights"),
  c("training_rights", "hr.trained_rights_emp_oth", 98, "C", "Other than Permanent", "Other-than-permanent employees trained on human rights"),
  c("training_rights", "hr.trained_rights_wkr_perm", 101, "C", "Permanent", "Permanent workers trained on human rights"),
  c("training_rights", "hr.trained_rights_wkr_oth", 102, "C", "Other than Permanent", "Other-than-permanent workers trained on human rights")
);

// -- Well-being coverage (rows 106-116) -------------------------------------
const WELLBEING_ROWS: Array<[number, string, string, string]> = [
  [106, "perm_emp_m", "Permanent Employees - Males", "permanent male employees"],
  [107, "perm_emp_f", "Permanent Employees - Females", "permanent female employees"],
  [109, "oth_emp_m", "Other than Permanent Employees - Males", "other-than-permanent male employees"],
  [110, "oth_emp_f", "Other than Permanent Employees - Females", "other-than-permanent female employees"],
  [112, "perm_wkr_m", "Permanent Workers - Males", "permanent male workers"],
  [113, "perm_wkr_f", "Permanent Workers - Females", "permanent female workers"],
  [115, "oth_wkr_m", "Other than Permanent Workers - Males", "other-than-permanent male workers"],
  [116, "oth_wkr_f", "Other than Permanent Workers - Females", "other-than-permanent female workers"],
];
const WELLBEING_COLS: Array<[string, string, string]> = [
  ["C", "health", "health insurance"],
  ["D", "accident", "accident insurance"],
  ["E", "parental", "maternity/paternity benefits"],
  ["F", "daycare", "daycare facilities"],
];
for (const [row, slug, rowLabel, human] of WELLBEING_ROWS) {
  for (const [col, benefit, benefitHuman] of WELLBEING_COLS) {
    cells.push(
      c("wellbeing", `hr.wellbeing_${slug}_${benefit}`, row, col, rowLabel, `${human[0].toUpperCase()}${human.slice(1)} covered by ${benefitHuman}`)
    );
  }
}

// -- Parental leave (rows 121-126 employees, 133-138 workers) ---------------
// F-column totals and the rate rows are template formulas.
// Full row labels for the parental-leave tables, employees vs workers.
const TEMPLATE_MATLEAVE_LABELS = {
  emp: [
    "Employees that were Entitled to maternity/paternity leave",
    "Employees that availed maternity/paternity leave",
    "Employees that Returned to work after maternity/paternity leave ended",
    "Number of employees due to return to work after maternity/paternity leave",
    "Employed with organisation for 12 months after maternity/paternity leave",
    "Total number of employees returning from maternity/paternity leave in the prior reporting",
  ],
  wkr: [
    "Workers that were Entitled to Maternity/paternity leave",
    "Workers that availed Maternity/paternity leave",
    "Workers that Returned to work after Maternity/paternity leave ended",
    "Number of Workers due to return to work after Maternity/paternity leave",
    "Employed with organisation for 12 months after Maternity/paternity leave",
    "Total number of workers returning from Maternity/paternity leave in the prior reporting",
  ],
};
const MATLEAVE_ROWS: Array<[string, string]> = [
  ["entitled", "entitled to parental leave"],
  ["availed", "who availed parental leave"],
  ["returned", "who returned to work after parental leave"],
  ["due_return", "due to return after parental leave"],
  ["retained_12m", "still employed 12 months after parental leave"],
  ["returned_prior", "who returned from parental leave in the prior period"],
];
for (const [group, base, noun] of [
  ["emp", 121, "Employees"],
  ["wkr", 133, "Workers"],
] as Array<[string, number, string]>) {
  MATLEAVE_ROWS.forEach(([slug, human], i) => {
    const row = base + i;
    const rowLabel = TEMPLATE_MATLEAVE_LABELS[group as "emp" | "wkr"][i];
    cells.push(
      c("matleave_" + group, `hr.matleave_${group}_${slug}_m`, row, "D", rowLabel, `Male ${noun.toLowerCase()} ${human}`),
      c("matleave_" + group, `hr.matleave_${group}_${slug}_f`, row, "E", rowLabel, `Female ${noun.toLowerCase()} ${human}`)
    );
  });
}

// -- Spend on well-being (row 144) ------------------------------------------
cells.push(
  c("wellbeing_spend", "hr.wellbeing_spend_text", 144, "C", "Cost incurred on well-being measures", "Spend on well-being measures (Cr. INR)", "text", null)
);

// -- Retirement benefits (rows 149-152) -------------------------------------
const RETIREMENT_ROWS: Array<[number, string, string]> = [
  [149, "pf", "PF"],
  [150, "gratuity", "Gratuity"],
  [151, "esi", "ESI"],
  [152, "other", "Others"],
];
for (const [row, slug, rowLabel] of RETIREMENT_ROWS) {
  cells.push(
    c("retirement", `hr.retirement_${slug}_emp`, row, "C", rowLabel, `Employees covered by ${rowLabel}`),
    c("retirement", `hr.retirement_${slug}_wkr`, row, "D", rowLabel, `Workers covered by ${rowLabel}`),
    c("retirement", `hr.retirement_${slug}_deposited`, row, "E", rowLabel, `${rowLabel}: deducted and deposited with the authority`)
  );
}

// -- Performance and career development reviews (rows 159-165) --------------
// C161 (employee total) is a formula; C165 (worker total) is a plain cell in
// the template, so it is treated as an input like everything else.
cells.push(
  c("perf_review", "hr.perf_review_emp_m", 159, "C", "Male", "Male employees receiving performance reviews"),
  c("perf_review", "hr.perf_review_emp_f", 160, "C", "Female", "Female employees receiving performance reviews"),
  c("perf_review", "hr.perf_review_wkr_m", 163, "C", "Male", "Male workers receiving performance reviews"),
  c("perf_review", "hr.perf_review_wkr_f", 164, "C", "Female", "Female workers receiving performance reviews"),
  c("perf_review", "hr.perf_review_wkr_total", 165, "C", "Total", "Total workers receiving performance reviews")
);

// -- Complaints (rows 170-175) ----------------------------------------------
const COMPLAINT_ROWS: Array<[number, string, string, string]> = [
  [170, "posh", "Sexual Harassment", "sexual harassment (POSH)"],
  [171, "discrimination", "Discrimination at workplace", "discrimination at workplace"],
  [172, "child_labour", "Child Labour", "child labour"],
  [173, "forced_labour", "Forced Labour/Involuntary Labour", "forced/involuntary labour"],
  [174, "wages", "Wages", "wages"],
  [175, "other", "Other Human Rights related issues", "other human-rights issues"],
];
for (const [row, slug, rowLabel, human] of COMPLAINT_ROWS) {
  cells.push(
    c("complaints", `hr.complaints_${slug}_filed`, row, "C", rowLabel, `Complaints filed during the year: ${human}`),
    c("complaints", `hr.complaints_${slug}_pending`, row, "D", rowLabel, `Complaints pending at year end: ${human}`),
    c("complaints", `hr.complaints_${slug}_remarks`, row, "E", rowLabel, `Remarks on complaints: ${human}`, "text", null)
  );
}

// -- Incidents of discrimination (rows 179-182) -----------------------------
const DISCRIMINATION_ROWS: Array<[number, string, string, string]> = [
  [179, "reviewed", "i.Incident reviewed by the organization", "incidents reviewed"],
  [180, "remediation_wip", "ii. Remediation plans being implemented", "remediation plans being implemented"],
  [181, "remediation_done", "iii.Remediation plans that have been implemented", "remediation plans implemented and reviewed"],
  [182, "closed", "iv. Incident no longer subject to action", "incidents no longer subject to action"],
];
for (const [row, slug, rowLabel, human] of DISCRIMINATION_ROWS) {
  cells.push(
    c("discrimination", `hr.discrimination_${slug}_status`, row, "C", rowLabel, `Discrimination: ${human} (status)`),
    c("discrimination", `hr.discrimination_${slug}_action`, row, "D", rowLabel, `Discrimination: ${human} (actions taken)`)
  );
}

// -- Minimum wages (rows 190-201) -------------------------------------------
// Eight Male/Female rows across four category groups; the forward cursor
// resolves the duplicated labels in declared order.
const MINWAGE_ROWS: Array<[number, string, string]> = [
  [190, "perm_emp_m", "permanent male employees"],
  [191, "perm_emp_f", "permanent female employees"],
  [193, "oth_emp_m", "other-than-permanent male employees"],
  [194, "oth_emp_f", "other-than-permanent female employees"],
  [197, "perm_wkr_m", "permanent male workers"],
  [198, "perm_wkr_f", "permanent female workers"],
  [200, "oth_wkr_m", "other-than-permanent male workers"],
  [201, "oth_wkr_f", "other-than-permanent female workers"],
];
for (const [row, slug, human] of MINWAGE_ROWS) {
  const rowLabel = slug.endsWith("_m") ? "Male" : "Female";
  cells.push(
    c("minwage", `hr.minwage_${slug}_equal`, row, "C", rowLabel, `Paid equal to minimum wage: ${human}`),
    c("minwage", `hr.minwage_${slug}_above`, row, "D", rowLabel, `Paid above minimum wage: ${human}`)
  );
}

// -- Wages by location (rows 207-210) ---------------------------------------
const WAGE_LOCATION_ROWS: Array<[number, string, string]> = [
  [207, "rural", "Rural"],
  [208, "semiurban", "Semi-urban"],
  [209, "urban", "urban"],
  [210, "metro", "Metropolitan"],
];
for (const [row, slug, rowLabel] of WAGE_LOCATION_ROWS) {
  cells.push(
    c("wages_location", `hr.wages_${slug}_paid`, row, "C", rowLabel, `Wages paid: ${rowLabel} locations`, "number", "INR"),
    c("wages_location", `hr.wages_${slug}_total`, row, "D", rowLabel, `Total wage cost: ${rowLabel} locations`, "number", "INR")
  );
}

// -- Security personnel (rows 215-218; % row 217 is a formula) --------------
cells.push(
  c("security", "hr.security_total", 215, "C", "Total number of security personnel", "Security personnel in the organisation"),
  c("security", "hr.security_trained", 216, "C", "Security personnel who have received formal training", "Security personnel formally trained on human rights"),
  c("security", "hr.security_thirdparty_text", 218, "C", "b. Whether training requirements also apply", "Whether training requirements extend to third-party security", "text", null)
);

const blocks: SheetBlock[] = [
  b("headcount", "Number of Employees and Workers", 3),
  b("pwd", "Differently Abled Employees and Workers", 9),
  b("count_eoy", "Employee Count (as on end of FY", 15),
  b("count_boy", "Employee Count (as on beginning of FY", 24),
  b("sep_emp", "Employees Separated in", 33),
  b("sep_wkr", "Workers Separated in", 38),
  b("sep_region", "Separations By Region", 43),
  b("hires_emp", "New Employee Hires", 48),
  b("hires_wkr", "New Workers Hires", 55),
  b("hires_region", "New Hires By Region", 62),
  b("senior_mgmt", "Disclosure 202-2 Proportion of senior management", 68),
  b("ngrbc", "Coverage off training and awareness programmes", 75),
  b("training_skill", "Details of training given to employees and workers", 80),
  b("training_rights", "Employees and workers who have been provided training on human rights", 93),
  b("wellbeing", "a. Details of measures for the well-being", 105),
  b("matleave_emp", "Details regarding Maternity/Paternity Leaves - Permanent Employees", 118),
  b("matleave_wkr", "Details regarding Maternity/Paternity Leaves - Permanent Workers", 130),
  b("wellbeing_spend", "c. Spending on measures towards well-being", 142),
  b("retirement", "Details of retirement benefits", 146),
  b("perf_review", "Details of performance and career development reviews", 155),
  b("complaints", "Number of Complaints on the following", 167),
  b("discrimination", "Incidents of discrimination and corrective actions taken", 177),
  b("minwage", "Details of minimum wages paid", 185),
  b("wages_location", "Disclose wages paid to persons employed", 204),
  b("security", "Disclosure 410-1", 213),
];

export const HR_LAYOUT: ReturnSheetLayout = {
  sheetName: "HR",
  domain: "HR",
  title: "BRSR - HR",
  blocks,
  cells,
};
