#!/usr/bin/env node
// Exercises the dashboard data path through the running dev server, which is
// the only way to load modules guarded by `server-only`.
//
// Confirms the plant->site rename works end to end, that values match what the
// resolver wrote, that a site-month with no return reads null rather than zero,
// and that coverage reaches the client.
//
// Usage: node scripts/test-chart-data.mjs [baseUrl]
const BASE = process.argv[2] ?? "http://localhost:3113";

let pass = 0, total = 0;
const check = (label, ok, detail = "") => {
  total++; if (ok) pass++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? "  " + detail : ""}`);
};

async function chart(spec) {
  const res = await fetch(`${BASE}/api/esg/dashboard/tiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec, layout: { x: 0, y: 0, w: 4, h: 3 } }),
  });
  if (!res.ok) throw new Error(`create tile: ${res.status} ${await res.text()}`);
  const { tile } = await res.json();
  const dataRes = await fetch(`${BASE}/api/esg/dashboard/tiles/${tile.id}/data`);
  if (!dataRes.ok) throw new Error(`tile data: ${dataRes.status} ${await dataRes.text()}`);
  const { data } = await dataRes.json();
  // Tidy up: these tiles exist only for the test.
  await fetch(`${BASE}/api/esg/dashboard/tiles/${tile.id}`, { method: "DELETE" });
  return data;
}

const YTD = "2024-25:ytd";
const base = { granularity: "annual", compare_by: "time", period_code: YTD };

// ---- KPI: portfolio Scope 2 -------------------------------------------------
const kpi = await chart({
  ...base, kind: "kpi", title: "Scope 2",
  plant_codes: ["GROUP"], parameter_codes: ["ghg.scope2_total"],
});
const s2 = kpi.series[0]?.points[0]?.value;
check("KPI reads portfolio Scope 2", typeof s2 === "number" && s2 > 0, `= ${s2} tCO2e`);
check(
  "KPI carries coverage",
  !!kpi.coverage && kpi.coverage.sitesExpected > 0,
  kpi.coverage ? `${kpi.coverage.sitesReporting}/${kpi.coverage.sitesExpected}` : "(absent)"
);

// ---- Trend: Aurora water across FY25 months --------------------------------
const trend = await chart({
  kind: "trend", title: "Water", period_code: YTD,
  plant_codes: ["AURORA"], parameter_codes: ["wtr.total"],
  granularity: "monthly", compare_by: "time",
});
const pts = trend.series[0]?.points ?? [];
check("Trend returns 12 monthly points", pts.length === 12,
  `${pts.filter((p) => p.value != null).length} with data`);
check("April matches the resolver (1,832 KL)",
  Math.abs((pts[0]?.value ?? 0) - 1832) < 0.01, `= ${pts[0]?.value}`);
check("Months with no return are null, not zero", pts.slice(5).every((p) => p.value == null));

// ---- Compare across sites ---------------------------------------------------
const bySite = await chart({
  kind: "bar", title: "By site", period_code: YTD,
  plant_codes: ["AURORA", "TISYA", "SANGAMWADI", "TRIMAYA"],
  parameter_codes: ["wtr.total"], granularity: "annual", compare_by: "plant",
});
const points = bySite.series[0]?.points ?? [];
check("Site comparison returns one point per site", points.length === 4,
  points.map((p) => p.label).join(", "));
// Tisya's April: groundwater 1,396 + tanker 428.63 + treated 612.88 = 2,437.51.
//
// Note this is NOT the 1,824.63 the site wrote in its own "total fresh water"
// row — that row is a memo covering fresh sources only, while BRSR total
// withdrawal counts treated water as source (v). The two differ by exactly the
// 612.88 KL of treated water, and conflating them would understate the
// disclosure. The memo row is cross-checked separately by the entry-time
// WATER_TOTAL_MISMATCH rule.
const tisya = points.find((p) => p.label === "Birla Tisya")?.value;
check(
  "Tisya FY25 withdrawal = 2,437.51 KL (incl. treated water)",
  Math.abs((tisya ?? 0) - 2437.51) < 0.01,
  `= ${tisya}`
);

// ---- Water-stressed rollup is a subset --------------------------------------
const ws = await chart({
  ...base, kind: "kpi", title: "Stressed",
  plant_codes: ["GROUP"], parameter_codes: ["wtr.ws_total"],
});
const all = await chart({
  ...base, kind: "kpi", title: "Total",
  plant_codes: ["GROUP"], parameter_codes: ["wtr.total"],
});
const wsV = ws.series[0]?.points[0]?.value ?? 0;
const allV = all.series[0]?.points[0]?.value ?? 0;
check("Stressed withdrawal <= total withdrawal", wsV <= allV, `${wsV} <= ${allV}`);

// ---- A site that filed nothing ---------------------------------------------
const navya = await chart({
  ...base, kind: "kpi", title: "Navya",
  plant_codes: ["NAVYA"], parameter_codes: ["wtr.total"],
});
const navyaV = navya.series[0]?.points[0]?.value;
check("A site that filed nothing reads null, not zero", navyaV == null, `= ${navyaV}`);

console.log(`\n${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
