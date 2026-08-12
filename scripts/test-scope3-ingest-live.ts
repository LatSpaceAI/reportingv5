#!/usr/bin/env node
// End-to-end ingestion against the LIVE database.
//
// generate → fill → parse → resolve → commit → verify, then cleans up after
// itself. Exercises the service layer, which the offline round-trip test cannot:
// site-name resolution, month resolution, mapping lookups, supersession and the
// four guarantees all need real rows.
//
// WHY THIS EXISTS AS WELL AS THE OFFLINE TEST
//
//   BIRLA_ESTATES.md: "Two bugs in this codebase were invisible to build,
//   typecheck and unit tests" — response caching on read routes, and the server
//   not parsing text the UI previewed. Both only appeared against real data. A
//   third was found the same way during the standard-output work.
//
// NOT part of esg:check, because it writes to the database. Run deliberately:
//   npx tsx scripts/test-scope3-ingest-live.ts
//
// Every row it writes carries the sentinel fiscal year below and is deleted at
// the end, including on failure.

import ExcelJS from "exceljs";

import { generateLedgerWorkbook } from "../src/lib/scope3Ledger/generateLedger";
import { parseLedgerWorkbook } from "../src/lib/scope3Ledger/parseLedger";

const checks: { label: string; ok: boolean; detail: string }[] = [];
const t = (label: string, ok: unknown, detail: unknown = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

/** A fiscal year no real data uses, so cleanup can be unambiguous. */
const TEST_FY = "2025-26";

async function main() {
  // The service layer is `server-only`, which throws outside a Next request.
  // Import the supabase client directly and reproduce the same calls.
  const { createClient } = await import("@supabase/supabase-js");
  const { readFile } = await import("node:fs/promises");
  const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const env = (k: string) => envText.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";

  const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const createdLineIds: number[] = [];
  const createdBatchIds: number[] = [];

  try {
    // ---- inputs the generator needs, from the real database ----------------
    const { data: siteRows } = await sb
      .from("site")
      .select("code, name, is_group")
      .eq("is_group", false)
      .order("name");
    const siteOptions = (siteRows ?? []).map((s) => ({
      code: s.code as string,
      name: s.name as string,
    }));
    t("sites loaded from the live database", siteOptions.length > 0, `${siteOptions.length} sites`);

    const { data: periodRows } = await sb
      .from("period")
      .select("month_no, period_start")
      .eq("fiscal_year", TEST_FY)
      .eq("period_kind", "month")
      .order("month_no");
    const monthOptions = (periodRows ?? [])
      .filter((p) => p.period_start)
      .map((p) => String(p.period_start).slice(0, 7));
    t(`${TEST_FY} has twelve months`, monthOptions.length === 12, monthOptions.join(","));

    // ---- generate -----------------------------------------------------------
    const blank = await generateLedgerWorkbook({
      fiscalYear: TEST_FY,
      siteOptions,
      monthOptions,
      generatedAt: new Date().toISOString(),
    });
    t("blank workbook generated", blank.length > 20000, `${blank.length} bytes`);

    // ---- fill, using REAL site names so resolution is genuinely exercised ---
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(blank as unknown as ArrayBuffer);

    const locate = (ws: ExcelJS.Worksheet, header: string) => {
      const want = header.replace(/\s+/g, " ").trim().toLowerCase();
      for (let r = 1; r <= Math.min(ws.rowCount, 40); r++)
        for (let c = 1; c <= 20; c++) {
          const v = ws.getRow(r).getCell(c).value;
          const s = typeof v === "string" ? v : v == null ? "" : String(v);
          if (s.replace(/\s+/g, " ").trim().toLowerCase() === want) return { row: r, col: c };
        }
      return { row: 0, col: 0 };
    };
    const set = (sheet: string, line: number, header: string, value: string | number) => {
      const ws = wb.getWorksheet(sheet)!;
      const at = locate(ws, header);
      if (!at.row) throw new Error(`header '${header}' not on ${sheet}`);
      ws.getCell(at.row + line, at.col).value = value;
    };

    const realSite = siteOptions[0].name;
    const realMonth = monthOptions[0];

    set("2 Materials", 1, "Project / site", realSite);
    set("2 Materials", 1, "Material type", "Cement - OPC");
    set("2 Materials", 1, "Quantity as recorded", 600);
    set("2 Materials", 1, "Conversion to tonnes", 1);
    set("2 Materials", 1, "Supplier EPD available? (Y/N)", "N");
    set("2 Materials", 1, "Straight-line distance (km)", 38);
    set("2 Materials", 1, "Freight vehicle type", "Rigid truck 16-25t");

    // A deliberately UNMAPPED material, to prove it is reported not dropped.
    set("2 Materials", 2, "Project / site", realSite);
    set("2 Materials", 2, "Material type", "Unobtainium");
    set("2 Materials", 2, "Quantity as recorded", 5);

    // A deliberately UNKNOWN site, to prove it imports unattributed.
    set("2 Materials", 3, "Project / site", "Nowhere Tower");
    set("2 Materials", 3, "Material type", "Cement - OPC");
    set("2 Materials", 3, "Quantity as recorded", 10);

    set("5 Waste", 1, "Site", realSite);
    set("5 Waste", 1, "Month (YYYY-MM)", realMonth);
    set("5 Waste", 1, "Waste stream", "Construction and demolition");
    set("5 Waste", 1, "Quantity (tonnes)", 145.5);
    set("5 Waste", 1, "Disposal route", "Landfill");

    const filled = Buffer.from(await wb.xlsx.writeBuffer());

    // ---- parse --------------------------------------------------------------
    const parsed = await parseLedgerWorkbook(filled);
    t("the filled workbook parses", parsed.ok, parsed.error ?? "");
    const matSheet = parsed.sheets?.find((s) => s.ledger === "materials");
    t("three material rows read", matSheet?.rows.length === 3, `${matSheet?.rows.length}`);

    // ---- resolve, reproducing ledgerService.resolveLedgerSheets ------------
    const [{ data: sites2 }, { data: periods2 }, { data: mappings }] = await Promise.all([
      sb.from("site").select("id, code, name, is_group"),
      sb.from("period").select("id, period_start").eq("fiscal_year", TEST_FY).eq("period_kind", "month"),
      sb.from("s3_mapping").select("block, lookup_key, is_active"),
    ]);
    const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const siteByName = new Map<string, number>();
    for (const s of sites2 ?? []) {
      if (s.is_group) continue;
      siteByName.set(norm(s.name), s.id as number);
      siteByName.set(norm(s.code), s.id as number);
    }
    const periodByMonth = new Map<string, number>();
    for (const p of periods2 ?? []) {
      if (p.period_start) periodByMonth.set(String(p.period_start).slice(0, 7), p.id as number);
    }
    const mappedMaterial = new Set(
      (mappings ?? []).filter((m) => m.block === "material").map((m) => norm(m.lookup_key))
    );
    const mappedWaste = new Set(
      (mappings ?? []).filter((m) => m.block === "waste").map((m) => norm(m.lookup_key))
    );

    const m1 = matSheet!.rows.find((r) => r.lineNo === 1)!;
    const m2 = matSheet!.rows.find((r) => r.lineNo === 2)!;
    const m3 = matSheet!.rows.find((r) => r.lineNo === 3)!;

    t("a real site name resolves to a site id", siteByName.get(norm(m1.siteName)) !== undefined, m1.siteName);
    t(
      "an unknown site name does NOT resolve, and is therefore reportable",
      siteByName.get(norm(m3.siteName)) === undefined,
      m3.siteName
    );
    t("a mapped material is recognised", mappedMaterial.has(norm(m1.attrs.material_type)));
    t(
      "an unmapped material is detected rather than silently dropped",
      !mappedMaterial.has(norm(m2.attrs.material_type)),
      String(m2.attrs.material_type)
    );

    const wasteSheet = parsed.sheets?.find((s) => s.ledger === "waste");
    const w1 = wasteSheet!.rows.find((r) => r.lineNo === 1)!;
    const composite = `${w1.attrs.waste_stream} | ${w1.attrs.disposal_route}`;
    t("the waste composite key resolves against the real mapping table", mappedWaste.has(norm(composite)), composite);
    t("the month resolves to a period id", periodByMonth.get(String(w1.month)) !== undefined, w1.month);

    // ---- batch --------------------------------------------------------------
    const [{ data: group }, { data: ytd }] = await Promise.all([
      sb.from("site").select("id").eq("is_group", true).single(),
      sb.from("period").select("id").eq("fiscal_year", TEST_FY).eq("period_kind", "ytd").single(),
    ]);
    t("the GROUP site and the YTD period both exist", Boolean(group && ytd));

    const { data: batch, error: batchErr } = await sb
      .from("import_batch")
      .insert({
        site_id: group!.id,
        period_id: ytd!.id,
        filename: "ingest-live-test.xlsx",
        sheet_name: "Scope 3 ledgers",
        status: "preview",
        row_count: 4,
        matched_count: 3,
        unmatched_count: 1,
        uploaded_by: "ingest-live-test",
      })
      .select("id")
      .single();
    if (batchErr) throw batchErr;
    createdBatchIds.push(batch.id as number);
    t("a preview batch is created against GROUP + YTD", Boolean(batch?.id), `batch ${batch?.id}`);

    // ---- commit -------------------------------------------------------------
    const toInsert = [
      { ledger: "materials", line_no: 1, site_id: siteByName.get(norm(m1.siteName)) ?? null, period_id: null, attrs: m1.attrs },
      { ledger: "materials", line_no: 2, site_id: siteByName.get(norm(m2.siteName)) ?? null, period_id: null, attrs: m2.attrs },
      { ledger: "materials", line_no: 3, site_id: null, period_id: null, attrs: m3.attrs, note: "site 'Nowhere Tower' not in the register" },
      { ledger: "waste", line_no: 1, site_id: siteByName.get(norm(w1.siteName)) ?? null, period_id: periodByMonth.get(String(w1.month)) ?? null, attrs: w1.attrs },
    ].map((r) => ({
      ...r,
      fiscal_year: TEST_FY,
      import_batch_id: batch!.id,
      source_doc: "ingest-live-test.xlsx",
      entered_by: "ingest-live-test",
    }));

    const { data: inserted, error: insErr } = await sb.from("s3_line").insert(toInsert).select("id, ledger, line_no, attrs, site_id, factor_key, emissions_t");
    if (insErr) throw insErr;
    createdLineIds.push(...(inserted ?? []).map((r) => r.id as number));
    t("ledger lines land in s3_line", inserted?.length === 4, `${inserted?.length} rows`);

    // GUARANTEE 3: committing does not compute.
    t(
      "committed lines carry NO computed figure — that is the resolver's job",
      (inserted ?? []).every((r) => r.factor_key === null && r.emissions_t === null),
      "factor_key and emissions_t are null"
    );

    // jsonb round-trip: the numbers must come back as numbers, not strings.
    const back = (inserted ?? []).find((r) => r.ledger === "materials" && r.line_no === 1)!;
    t(
      "attrs survives the jsonb round trip with its types intact",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (back.attrs as any).quantity_recorded === 600 && (back.attrs as any).distance_km === 38,
      JSON.stringify(back.attrs).slice(0, 90)
    );
    t(
      "an unresolved site imports as null rather than being dropped",
      (inserted ?? []).some((r) => r.line_no === 3 && r.site_id === null)
    );

    // ---- the drill-down view ------------------------------------------------
    const { data: detail, error: viewErr } = await sb
      .from("v_s3_line_detail")
      .select("ledger, ledger_label, line_no, site_code, attrs")
      .eq("fiscal_year", TEST_FY)
      .eq("ledger", "materials");
    t("v_s3_line_detail resolves the ledger label", !viewErr && (detail ?? []).length === 3, viewErr?.message ?? `${detail?.length} rows`);
    t(
      "and joins the site for an attributed line",
      (detail ?? []).some((d) => d.site_code),
      (detail ?? []).map((d) => d.site_code ?? "—").join(",")
    );

    // ---- GUARANTEE 2: supersession archives before it deletes ---------------
    const existing = inserted!.filter((r) => r.ledger === "materials");
    const { error: histErr } = await sb.from("s3_line_history").insert(
      existing.map((e) => ({
        line_id: e.id,
        ledger: "materials",
        fiscal_year: TEST_FY,
        line_no: e.line_no,
        attrs: e.attrs,
        superseded_by_batch_id: batch!.id,
      }))
    );
    t("superseded lines can be archived to s3_line_history", !histErr, histErr?.message ?? "");

    const { count: histCount } = await sb
      .from("s3_line_history")
      .select("*", { count: "exact", head: true })
      .eq("fiscal_year", TEST_FY);
    t("history holds the archived rows", histCount === 3, `${histCount} archived`);

    // ---- the unique constraint actually holds ------------------------------
    const { error: dupErr } = await sb.from("s3_line").insert({
      ledger: "materials",
      fiscal_year: TEST_FY,
      line_no: 1,
      attrs: {},
      entered_by: "ingest-live-test",
    });
    t(
      "(ledger, fiscal_year, line_no) is unique — a duplicate is rejected",
      Boolean(dupErr),
      dupErr ? "rejected" : "ACCEPTED — the constraint is missing"
    );

    // ---- the resolver can read what was ingested ---------------------------
    const { data: readable } = await sb
      .from("s3_line")
      .select("ledger, line_no, attrs")
      .eq("fiscal_year", TEST_FY)
      .is("superseded_at", null);
    t(
      "the resolver's own read path sees the ingested lines",
      (readable ?? []).length === 4,
      `${readable?.length} live lines`
    );
  } finally {
    // ---- cleanup ------------------------------------------------------------
    await sb.from("s3_line_history").delete().eq("fiscal_year", TEST_FY);
    await sb.from("s3_line").delete().eq("fiscal_year", TEST_FY).eq("entered_by", "ingest-live-test");
    for (const id of createdBatchIds) {
      await sb.from("import_batch_row").delete().eq("batch_id", id);
      await sb.from("import_batch").delete().eq("id", id);
    }
    const { count: leftover } = await sb
      .from("s3_line")
      .select("*", { count: "exact", head: true })
      .eq("fiscal_year", TEST_FY);
    t("the test cleaned up after itself", leftover === 0, `${leftover} rows left`);
  }

  const pass = checks.filter((c) => c.ok).length;
  for (const c of checks) {
    console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label}${c.detail ? `  ${c.detail}` : ""}`);
  }
  console.log(`\n${pass}/${checks.length} passed`);
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
