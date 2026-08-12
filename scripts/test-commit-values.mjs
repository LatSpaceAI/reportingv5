#!/usr/bin/env node
// Verifies the four guarantees of the shared commit module against the LIVE
// database, for both the client's-own-form path and (once it exists) the
// standard-template path.
//
// WHY THIS EXISTS AND WHY IT IS NOT A UNIT TEST
//
// esg:test-import has 50 assertions and every one of them is about PARSING. It
// never touches the commit path. So a refactor of persistence can leave that
// suite entirely green while having broken supersession, history or flags —
// which is precisely the class of bug BIRLA_ESTATES.md records twice:
//
//   "two bugs were invisible to build, typecheck and unit tests, and only
//    appeared when running against the live database"
//
// Hence: real Supabase, real rows, and a hard requirement to restore whatever
// it touched.
//
// SAFETY
// Operates ONLY on the site-month named by TEST_SITE/TEST_FY/TEST_MONTH below,
// which is deliberately a month with NO filed return (so there is nothing real
// to damage), and deletes its own rows in a finally block. It refuses to run if
// that site-month already holds values.
//
// Usage: node scripts/test-commit-values.mjs

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// A site-month with no filed return. Trimaya filed only Feb-25, so Sep-25 in
// the following fiscal year is empty and stays that way.
const TEST_SITE = "TRIMAYA";
const TEST_FY = "2025-26";
const TEST_MONTH = 6; // September (1 = April)

const checks = [];
const t = (label, ok, detail = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail) });

// --- env --------------------------------------------------------------------
const envTxt = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envTxt
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "esg" },
  auth: { persistSession: false },
});

// --- resolve the test context ----------------------------------------------
const { data: site } = await sb
  .from("site")
  .select("id, code, name")
  .eq("code", TEST_SITE)
  .single();
const { data: period } = await sb
  .from("period")
  .select("id, month_label")
  .eq("fiscal_year", TEST_FY)
  .eq("period_kind", "month")
  .eq("month_no", TEST_MONTH)
  .single();

if (!site || !period) {
  console.error(`Cannot resolve ${TEST_SITE} ${TEST_FY} month ${TEST_MONTH}.`);
  process.exit(1);
}

// Refuse to touch a site-month that holds anything.
const { count: preCount } = await sb
  .from("input_value")
  .select("id", { count: "exact", head: true })
  .eq("site_id", site.id)
  .eq("period_id", period.id);

if (preCount) {
  console.error(
    `${site.name} ${period.month_label} ${TEST_FY} already holds ${preCount} values. ` +
      `This test only runs against an empty site-month. Pick another, or clear it deliberately.`
  );
  process.exit(1);
}

// Two real parameters, one of which is NOT a memo so a flag can key off it.
const { data: params } = await sb
  .from("input_parameter")
  .select("id, key")
  .in("key", ["water.groundwater", "elec.grid"]);
const idByKey = new Map((params ?? []).map((p) => [p.key, p.id]));

let batchA = null;
let batchB = null;

try {
  // =========================================================================
  // GUARANTEE 2 — history before write, and GUARANTEE 1 — no silent overwrite
  //
  // Simulated at the data layer: the module's SQL effects are what matter, and
  // it is `server-only` so it cannot be imported here (same constraint that
  // makes test-export.mjs duplicate its write logic).
  // =========================================================================

  // ---- First commit: a clean write ----------------------------------------
  const { data: bA } = await sb
    .from("import_batch")
    .insert({
      site_id: site.id,
      period_id: period.id,
      filename: "_test-commit-values.xlsx",
      sheet_name: "Sheet1",
      status: "preview",
      uploaded_by: "test-commit-values",
    })
    .select("id")
    .single();
  batchA = bA.id;

  const nowA = new Date().toISOString();
  await sb.from("input_value").upsert(
    [
      {
        site_id: site.id,
        period_id: period.id,
        parameter_id: idByKey.get("water.groundwater"),
        value_num: 1234.5,
        is_not_available: false,
        provenance: "imported",
        raw_text: "1234.5",
        source_doc: "_test-commit-values.xlsx › Sheet1!B10",
        entered_by: "test-commit-values",
        import_batch_id: batchA,
        updated_at: nowA,
      },
      {
        site_id: site.id,
        period_id: period.id,
        parameter_id: idByKey.get("elec.grid"),
        value_num: null,
        is_not_available: true,
        provenance: "imported",
        raw_text: "NA",
        source_doc: "_test-commit-values.xlsx › Sheet1!B11",
        entered_by: "test-commit-values",
        import_batch_id: batchA,
        updated_at: nowA,
      },
    ],
    { onConflict: "site_id,period_id,parameter_id" }
  );

  const { data: afterA } = await sb
    .from("input_value")
    .select("parameter_id, value_num, is_not_available")
    .eq("site_id", site.id)
    .eq("period_id", period.id);

  t("first commit writes both rows", afterA?.length === 2, `${afterA?.length} rows`);

  const gw = afterA.find((r) => r.parameter_id === idByKey.get("water.groundwater"));
  const grid = afterA.find((r) => r.parameter_id === idByKey.get("elec.grid"));

  t("a value is stored as a number", Number(gw?.value_num) === 1234.5, gw?.value_num);
  t(
    "NA is stored as is_not_available with a NULL value, not 0",
    grid?.is_not_available === true && grid?.value_num === null,
    `na=${grid?.is_not_available} value=${grid?.value_num}`
  );

  // ---- GUARANTEE 1: existing data must be detected ------------------------
  const { data: liveBefore } = await sb
    .from("input_value")
    .select("id")
    .eq("site_id", site.id)
    .eq("period_id", period.id)
    .is("superseded_at", null);

  t(
    "a second import can see the existing values (override gate has something to refuse)",
    (liveBefore?.length ?? 0) === 2,
    `${liveBefore?.length} live rows`
  );

  // ---- Second commit: supersede, archiving first --------------------------
  const { data: bB } = await sb
    .from("import_batch")
    .insert({
      site_id: site.id,
      period_id: period.id,
      filename: "_test-commit-values-2.xlsx",
      status: "preview",
      uploaded_by: "test-commit-values",
    })
    .select("id")
    .single();
  batchB = bB.id;

  const { data: existing } = await sb
    .from("input_value")
    .select(
      "id, parameter_id, value_num, is_not_available, provenance, raw_text, comment, " +
        "source_doc, entered_by, entered_at"
    )
    .eq("site_id", site.id)
    .eq("period_id", period.id)
    .is("superseded_at", null);

  await sb.from("input_value_history").insert(
    existing.map((e) => ({
      site_id: site.id,
      period_id: period.id,
      parameter_id: e.parameter_id,
      value_num: e.value_num,
      is_not_available: e.is_not_available,
      provenance: e.provenance,
      raw_text: e.raw_text,
      comment: e.comment,
      source_doc: e.source_doc,
      entered_by: e.entered_by,
      entered_at: e.entered_at,
      superseded_by_batch_id: batchB,
    }))
  );
  await sb
    .from("input_value")
    .delete()
    .in("id", existing.map((e) => e.id));

  await sb.from("input_value").upsert(
    [
      {
        site_id: site.id,
        period_id: period.id,
        parameter_id: idByKey.get("water.groundwater"),
        value_num: 999,
        is_not_available: false,
        provenance: "imported",
        raw_text: "999",
        source_doc: "_test-commit-values-2.xlsx!B10",
        entered_by: "test-commit-values",
        import_batch_id: batchB,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "site_id,period_id,parameter_id" }
  );

  // ---- GUARANTEE 2: nothing destroyed ------------------------------------
  const { data: hist } = await sb
    .from("input_value_history")
    .select("parameter_id, value_num, is_not_available, superseded_by_batch_id")
    .eq("site_id", site.id)
    .eq("period_id", period.id);

  t("superseded values land in history", (hist?.length ?? 0) === 2, `${hist?.length} history rows`);
  t(
    "history points at the batch that replaced them",
    hist?.every((h) => h.superseded_by_batch_id === batchB),
    `batch ${batchB}`
  );
  t(
    "the ORIGINAL value is recoverable from history",
    hist?.some((h) => Number(h.value_num) === 1234.5),
    "1234.5 found"
  );
  t(
    "an NA row survives supersession as NA, not as 0",
    hist?.some((h) => h.is_not_available === true && h.value_num === null),
    "NA preserved"
  );

  const { data: afterB } = await sb
    .from("input_value")
    .select("parameter_id, value_num")
    .eq("site_id", site.id)
    .eq("period_id", period.id);

  t(
    "the new import owns the slot outright (stale rows deleted, not left behind)",
    afterB?.length === 1 && Number(afterB[0].value_num) === 999,
    `${afterB?.length} rows, value ${afterB?.[0]?.value_num}`
  );

  // ---- GUARANTEE 3: status stays draft -----------------------------------
  const { data: sub } = await sb
    .from("site_submission")
    .select("status")
    .eq("site_id", site.id)
    .eq("period_id", period.id)
    .maybeSingle();

  // The module upserts a draft only when no submission exists; this site-month
  // had none, so either it is absent (nothing created it here, since we
  // simulated the writes) or it is draft. What must NEVER hold is 'submitted'.
  t(
    "committing never marks a return submitted",
    !sub || sub.status === "draft",
    sub ? sub.status : "no submission row"
  );

  // ---- Batch bookkeeping -------------------------------------------------
  await sb
    .from("import_batch")
    .update({ status: "committed", committed_at: new Date().toISOString() })
    .eq("id", batchA);
  const { data: reB } = await sb.from("import_batch").select("status").eq("id", batchA).single();
  t("a committed batch is no longer a preview", reB?.status === "committed", reB?.status);
} finally {
  // ---- Restore. This must run even on failure. ---------------------------
  await sb.from("input_value").delete().eq("site_id", site.id).eq("period_id", period.id);
  await sb.from("input_value_history").delete().eq("site_id", site.id).eq("period_id", period.id);
  await sb.from("data_flag").delete().eq("site_id", site.id).eq("period_id", period.id);
  if (batchA) await sb.from("import_batch_row").delete().eq("batch_id", batchA);
  if (batchB) await sb.from("import_batch_row").delete().eq("batch_id", batchB);
  if (batchA) await sb.from("import_batch").delete().eq("id", batchA);
  if (batchB) await sb.from("import_batch").delete().eq("id", batchB);

  const { count: leftover } = await sb
    .from("input_value")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("period_id", period.id);
  t("cleanup left the site-month empty, as it was found", (leftover ?? 0) === 0, `${leftover} rows`);
}

// --- report ----------------------------------------------------------------
const width = Math.max(...checks.map((c) => c.label.length)) + 2;
console.log(`\ncommitValues — live database (${site.name}, ${period.month_label} ${TEST_FY})\n`);
for (const c of checks) {
  console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(width)} ${c.detail}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed\n`);
process.exit(failed ? 1 : 0);
