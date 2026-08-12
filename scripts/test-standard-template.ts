#!/usr/bin/env node
// Round-trips the standard input template: generate → fill → parse.
//
// No database. The layout and parse modules are pure, so the whole contract can
// be exercised offline — which is the point of splitting them out. Runs in
// esg:check.
//
// The load-bearing assertions are the ones that pin the THREE STATES apart
// (a reported zero, an explicit NA, and a row nobody filled in) and the ones
// that prove the parser locates columns by header text rather than by index.
//
// Figures deliberately mirror scripts/test-import.ts:246-249, so the two parse
// paths are asserted to agree rather than each being independently plausible.
//
// Usage: node scripts/test-standard-template.mjs

import ExcelJS from "exceljs";

import { generateTemplate } from "../src/lib/standardTemplate/generateTemplate";
import { parseStandardTemplate } from "../src/lib/standardTemplate/parseTemplate";
import type { TemplateParameter } from "../src/lib/standardTemplate/templateLayout";
import {
  EXCLUDED_KEYS,
  HEADERS,
  META_CELLS,
  META_SHEET,
  SOURCE_LABEL_SEP,
  TEMPLATE_VERSION,
  buildSections,
  splitSourceLabel,
} from "../src/lib/standardTemplate/templateLayout";

const checks: { label: string; ok: boolean; detail: string }[] = [];
const t = (label: string, ok: unknown, detail: unknown = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

async function main() {
  // --- a parameter set standing in for esg.input_parameter --------------------
  const PARAMS: TemplateParameter[] = [
    { key: "water.municipal", section: "Water", label: "Municipal supply", unit: "KL", isMemo: false, sortOrder: 110, notes: null },
    { key: "water.groundwater", section: "Water", label: "Ground water (onsite / colony)", unit: "KL", isMemo: false, sortOrder: 120, notes: null },
    { key: "water.tanker", section: "Water", label: "Tanker water (offsite)", unit: "KL", isMemo: false, sortOrder: 130, notes: null },
    { key: "water.stp_inlet", section: "Water", label: "STP inlet", unit: "KL", isMemo: true, sortOrder: 190, notes: null },
    { key: "elec.grid", section: "Electricity", label: "Grid electricity consumption", unit: "kWh", isMemo: false, sortOrder: 310, notes: null },
    { key: "elec.tenant", section: "Electricity", label: "Tenant electricity", unit: "kWh", isMemo: true, sortOrder: 350, notes: null },
    { key: "fuel.diesel_dg", section: "Fuel", label: "DG set - diesel", unit: "kL", isMemo: false, sortOrder: 410, notes: null },
    { key: "waste.plastic", section: "Waste", label: "Plastic waste", unit: "MT", isMemo: false, sortOrder: 510, notes: null },
    { key: "waste.used_oil", section: "Waste", label: "Used oil", unit: "L", isMemo: false, sortOrder: 520, notes: null },
    { key: "waste.biomedical", section: "Waste", label: "Bio-medical waste", unit: "MT", isMemo: false, sortOrder: 530, notes: null },
  { key: "waste.scrap", section: "Waste", label: "Scrap - metal", unit: "MT", isMemo: false, sortOrder: 535, notes: null },
    { key: "waste.cnd", section: "Waste", label: "Construction and demolition waste", unit: "MT", isMemo: false, sortOrder: 540, notes: null },
    { key: "waste.cnd_reused", section: "Waste", label: "C&D reused on site", unit: "MT", isMemo: false, sortOrder: 545, notes: null },
    { key: "refrig.r410a", section: "Refrigerants", label: "R410A top-up", unit: "kg", isMemo: false, sortOrder: 610, notes: null },
    // Must NOT appear: half-yearly monitoring and a central-team-only correction.
    { key: "air.nox", section: "Air emissions", label: "NOx", unit: "kg", isMemo: false, sortOrder: 710, notes: null },
    { key: "elec.renewable_adjustment", section: "Electricity", label: "Renewable adjustment", unit: "kWh", isMemo: false, sortOrder: 340, notes: null },
  ];

  const BASE = {
    parameters: PARAMS,
    site: { code: "TRIMAYA", name: "Birla Trimaya" },
    fiscalYear: "2025-26",
    period: { monthNo: 6, monthLabel: "September" },
    siteOptions: [
      { code: "TRIMAYA", name: "Birla Trimaya" },
      { code: "AURORA", name: "Birla Aurora" },
    ],
    monthOptions: [
      { monthNo: 6, monthLabel: "September" },
      { monthNo: 7, monthLabel: "October" },
    ],
    generatedAt: "2026-08-12T00:00:00.000Z",
  };

  // ===========================================================================
  // LAYOUT
  // ===========================================================================
  const sections = buildSections(PARAMS);
  const laidOutKeys = sections.flatMap((s) => s.parameters.map((p) => p.key));

  t("excluded parameters never reach the sheet", !laidOutKeys.some((k) => EXCLUDED_KEYS.has(k)),
    `${PARAMS.length - laidOutKeys.length} excluded`);
  t("air.nox is excluded (half-yearly monitoring, not a monthly form)",
    !laidOutKeys.includes("air.nox"));
  t("elec.renewable_adjustment is excluded (central team only)",
    !laidOutKeys.includes("elec.renewable_adjustment"));
  t("memo parameters ARE included", laidOutKeys.includes("water.stp_inlet") && laidOutKeys.includes("elec.tenant"),
    "stp_inlet + tenant present");
  t("sections come out in display order",
    sections.map((s) => s.name).join(",") === "Water,Electricity,Fuel,Waste,Refrigerants",
    sections.map((s) => s.name).join(","));
  t("rows are ordered by sort_order within a section",
    sections[0].parameters.map((p) => p.key).join(",") ===
      "water.municipal,water.groundwater,water.tanker,water.stp_inlet");
  t("Refrigerants is collapsed", sections.find((s) => s.name === "Refrigerants")?.collapsed === true);

  // A 58th parameter appears with no code change.
  const grown = buildSections([
    ...PARAMS,
    { key: "water.rainwater", section: "Water", label: "Rainwater harvested", unit: "KL", isMemo: false, sortOrder: 140, notes: null },
  ]);
  t("a newly seeded parameter appears with no code change",
    grown.find((s) => s.name === "Water")?.parameters.some((p) => p.key === "water.rainwater"));

  // ===========================================================================
  // GENERATE
  // ===========================================================================
  const blank = await generateTemplate(BASE);
  t("generator produces a non-trivial workbook", blank.length > 5000, `${blank.length} bytes`);

  const gen = new ExcelJS.Workbook();
  await gen.xlsx.load(blank as unknown as ArrayBuffer);

  t("has an Instructions sheet", Boolean(gen.getWorksheet("Instructions")));
  t("has a Return sheet", Boolean(gen.getWorksheet("Return")));
  t("meta sheet is veryHidden so it survives tidying",
    gen.getWorksheet(META_SHEET)?.state === "veryHidden", gen.getWorksheet(META_SHEET)?.state);
  t("version is stamped", gen.getWorksheet(META_SHEET)?.getCell(META_CELLS.version).value === TEMPLATE_VERSION);

  const ret = gen.getWorksheet("Return")!;
  t("the key column is hidden", ret.getColumn(2).hidden === true);
  t("the header row is frozen", (ret.views?.[0] as { state?: string })?.state === "frozen", `ySplit ${(ret.views?.[0] as { ySplit?: number })?.ySplit}`);
  t("collapsed section rows carry outline level 1",
    (() => {
      for (let r = 1; r <= ret.rowCount; r++) {
        if (String(ret.getCell(r, 2).value ?? "") === "refrig.r410a") return ret.getRow(r).outlineLevel === 1;
      }
      return false;
    })());
  t("memo rows are marked in the unit column",
    (() => {
      for (let r = 1; r <= ret.rowCount; r++) {
        if (String(ret.getCell(r, 2).value ?? "") === "elec.tenant") {
          return /\(memo\)/i.test(String(ret.getCell(r, 4).value ?? ""));
        }
      }
      return false;
    })());

  // ===========================================================================
  // ROUND TRIP — fill it in the way a site team would
  // ===========================================================================
  /** Finds a row by its hidden key and writes value / NA / remarks. */
  function fill(
    ws: ExcelJS.Worksheet,
    key: string,
    opts: { value?: number | string; na?: boolean; remarks?: string } = {}
  ) {
    const { value, na, remarks } = opts;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (String(ws.getCell(r, 2).value ?? "").trim() === key) {
        if (value !== undefined) ws.getCell(r, 3).value = value;
        if (na) ws.getCell(r, 5).value = "NA";
        if (remarks) ws.getCell(r, 6).value = remarks;
        return true;
      }
    }
    throw new Error(`fill: key ${key} not found`);
  }

  const filledWb = new ExcelJS.Workbook();
  await filledWb.xlsx.load(blank as unknown as ArrayBuffer);
  const fws = filledWb.getWorksheet("Return")!;

  fill(fws, "water.groundwater", { value: 1396 });        // same as test-import.ts
  fill(fws, "water.tanker", { value: 428.63 });           // same as test-import.ts
  fill(fws, "elec.grid", { value: 23935.5 });             // same as test-import.ts
  fill(fws, "fuel.diesel_dg", { value: 0.18 });           // already kL, no factor
  fill(fws, "waste.plastic", { value: 0 });               // a REPORTED ZERO
  fill(fws, "waste.used_oil", { na: true });              // explicit NA
  // "58 kg" on an MT row is the conversion the manual screen is built around,
  // so it must work here identically. Deliberately NOT kg on a KL row: mass to
  // volume needs a density, which is exactly why four waste lines in this model
  // cannot be computed (BIRLA_ESTATES.md open item 3).
  fill(fws, "waste.scrap", { value: "58 kg", remarks: "typed with a unit" });
  fill(fws, "water.municipal", { value: 1200 });
  fill(fws, "waste.cnd", { value: 7.5 });
  fill(fws, "waste.cnd_reused", { value: 3 });
  // waste.biomedical deliberately left untouched.

  const filled = Buffer.from(await filledWb.xlsx.writeBuffer());
  const parsed = await parseStandardTemplate(filled);

  t("a filled template parses", parsed.ok, parsed.error ?? "");

  const byKey = new Map((parsed.rows ?? []).map((r) => [r.key, r]));

  t("groundwater round-trips", byKey.get("water.groundwater")?.value === 1396, byKey.get("water.groundwater")?.value);
  t("tanker round-trips", byKey.get("water.tanker")?.value === 428.63, byKey.get("water.tanker")?.value);
  t("grid electricity round-trips", byKey.get("elec.grid")?.value === 23935.5, byKey.get("elec.grid")?.value);
  t("a kL figure is NOT rescaled", byKey.get("fuel.diesel_dg")?.value === 0.18, byKey.get("fuel.diesel_dg")?.value);

  // --- the three states, pinned apart ---------------------------------------
  const zeroRow = byKey.get("waste.plastic");
  t("a REPORTED ZERO survives as 0, not as absent",
    zeroRow !== undefined && zeroRow.value === 0 && zeroRow.isNotAvailable === false,
    `value=${zeroRow?.value} na=${zeroRow?.isNotAvailable}`);
  t("an explicit NA is flagged with a null value",
    byKey.get("waste.used_oil")?.isNotAvailable === true && byKey.get("waste.used_oil")?.value === null,
    `na=${byKey.get("waste.used_oil")?.isNotAvailable} value=${byKey.get("waste.used_oil")?.value}`);
  t("an UNTOUCHED row is absent entirely — not zero, not NA",
    !byKey.has("waste.biomedical"), "waste.biomedical absent");
  t("blank rows are counted, not written", (parsed.blankCount ?? 0) > 0, `${parsed.blankCount} blank`);

  // --- unit handling and audit trail ---------------------------------------
  t("'58 kg' on an MT row is converted, with the working shown",
    byKey.get("waste.scrap")?.value === 0.058 && Boolean(byKey.get("waste.scrap")?.parseNote),
    `${byKey.get("waste.scrap")?.value} — ${byKey.get("waste.scrap")?.parseNote}`);
  t("the detected unit is reported alongside the conversion",
    byKey.get("waste.scrap")?.detectedUnit === "kg", byKey.get("waste.scrap")?.detectedUnit);
  t("each row records its own cell for the audit trail",
    /^C\d+$/.test(byKey.get("elec.grid")?.cell ?? ""), byKey.get("elec.grid")?.cell);
  t("remarks are carried through", byKey.get("waste.scrap")?.remarks === "typed with a unit");

  // --- generated/recovery pairs stay distinct ------------------------------
  t("waste.cnd and waste.cnd_reused land in SEPARATE parameters",
    byKey.get("waste.cnd")?.value === 7.5 && byKey.get("waste.cnd_reused")?.value === 3,
    `cnd=${byKey.get("waste.cnd")?.value} reused=${byKey.get("waste.cnd_reused")?.value}`);

  // --- header block --------------------------------------------------------
  t("the site code is recovered from the stamp", parsed.header?.siteCode === "TRIMAYA", parsed.header?.siteCode);
  t("the fiscal year is recovered", parsed.header?.fiscalYear === "2025-26", parsed.header?.fiscalYear);
  t("the month is recovered", parsed.header?.monthNo === 6, parsed.header?.monthNo);

  // ===========================================================================
  // THE source_label CONTRACT
  //
  // The preview route writes `key — Canonical label` into import_batch_row and
  // the commit route splits it back. Both go through splitSourceLabel, and this
  // pins the one case that would silently truncate: a label containing its own
  // em dash, which the seed does have ("BEPL-occupied floor — inside the ...").
  // ===========================================================================
  {
    const round = (key: string, label: string | null) =>
      splitSourceLabel(`${key}${label ? `${SOURCE_LABEL_SEP}${label}` : ""}`);

    t("a plain key round-trips", round("elec.grid", null).key === "elec.grid");
    const simple = round("water.tanker", "Tanker water (offsite)");
    t("key and label separate cleanly",
      simple.key === "water.tanker" && simple.label === "Tanker water (offsite)",
      `${simple.key} / ${simple.label}`);
    const dashed = round("elec.own_floor_1", "Level 8 — BEPL-occupied floor");
    t("a label containing an em dash is NOT truncated",
      dashed.key === "elec.own_floor_1" && dashed.label === "Level 8 — BEPL-occupied floor",
      `${dashed.key} / ${dashed.label}`);
  }

  // ===========================================================================
  // THE PARSE CONTRACT — no fixed indices
  // ===========================================================================
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(filled as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Return")!;
    ws.spliceRows(1, 0, ["a banner someone pasted in"], ["and another"]);
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("survives rows inserted ABOVE the header",
      out.ok && out.rows?.find((r) => r.key === "elec.grid")?.value === 23935.5,
      out.error ?? `${out.rows?.length} rows`);
  }
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(filled as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Return")!;
    // A column inserted before the key column shifts every index by one.
    ws.spliceColumns(1, 0, []);
    ws.getColumn(1).values = [];
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("survives a column inserted before the key column",
      out.ok && out.rows?.find((r) => r.key === "elec.grid")?.value === 23935.5,
      out.error ?? `${out.rows?.length} rows`);
  }

  // ===========================================================================
  // REJECTIONS
  // ===========================================================================
  {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1").getCell("A1").value = "not our template";
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("a foreign workbook is rejected", !out.ok);
    t("the rejection points at the site's-own-form path",
      /site's-own-form|own monthly form/i.test(out.error ?? ""), out.error?.slice(0, 60));
  }
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(blank as unknown as ArrayBuffer);
    wb.getWorksheet(META_SHEET)!.getCell(META_CELLS.version).value = "0.9.0";
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("an OLD template version is rejected", !out.ok, out.versionFound);
    t("the rejection names both versions",
      (out.error ?? "").includes("0.9.0") && (out.error ?? "").includes(TEMPLATE_VERSION));
  }
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(blank as unknown as ArrayBuffer);
    wb.getWorksheet(META_SHEET)!.getCell(META_CELLS.version).value = "9.9.9";
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("a NEWER template version is rejected as needing an app update",
      !out.ok && /app needs updating/i.test(out.error ?? ""), out.error?.slice(0, 50));
  }
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(blank as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Return")!;
    for (let r = 1; r <= ws.rowCount; r++) {
      const c = ws.getCell(r, 2);
      if (String(c.value ?? "") === HEADERS.key) c.value = "Something else";
    }
    const out = await parseStandardTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
    t("a template whose key column header was renamed is rejected, not guessed at",
      !out.ok && /Parameter key/i.test(out.error ?? ""), out.error?.slice(0, 50));
  }

  // --- report ---------------------------------------------------------------
  const width = Math.max(...checks.map((c) => c.label.length)) + 2;
  console.log("\nstandard input template — generate / parse round trip\n");
  for (const c of checks) {
    console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(width)} ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed\n`);
  process.exit(failed ? 1 : 0);

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});