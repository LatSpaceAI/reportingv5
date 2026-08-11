// Unit tests for the ESG formula expression engine (scripts/lib/formula-eval.mjs),
// which resolve-birla.mjs evaluates every disclosure through.
// Run: node scripts/test-resolver.mjs
import { tokenize, parse, evalAst } from "./lib/formula-eval.mjs";

const ev = (expr, ctx = {}) => evalAst(parse(tokenize(expr)), ctx);

const tests = [
  ["2 + 3 * 4", {}, 14],
  ["(2+3)*4", {}, 20],
  ["10 * 4.184e-6", {}, 10 * 4.184e-6],
  ["IF(0 = 0, 5, 9)", {}, 5],
  ["IF(1 = 0, 5, 9)", {}, 9],
  ["IFERROR(1/0, 42)", {}, 42],
  ["IFERROR(8/2, 42)", {}, 4],
  ["MAX(3, 7, 2)", {}, 7],
  ["MIN(3, 7, 2)", {}, 2],
  ["-5 + 2", {}, -3],
  ["in:a + const:b", { "in:a": 10, "const:b": 2.5 }, 12.5],
  ["IF(in:x = 0, 0, out:y / in:x)", { "in:x": 4, "out:y": 8 }, 2],
  ["IF(in:dg = 'yes', 100, 0)", { "in:dg": "yes" }, 100],
  ["IF(in:dg = 'yes', 100, 0)", { "in:dg": "no" }, 0],
  // a real scope-2-shaped expr
  [
    "((in:pwr.grid_total - in:pwr.onsite_export) * const:EF.grid_2023)",
    { "in:pwr.grid_total": 1000, "in:pwr.onsite_export": 100, "const:EF.grid_2023": 0.716 },
    900 * 0.716,
  ],
  // calcination-shaped nested expr with subtraction of a parenthesised group
  [
    "( (in:cl * in:cao/100)/const:mw_cao ) * const:mw_co2 - ( (in:cl * 0)/const:mw_cao ) * const:mw_co2",
    { "in:cl": 90000, "in:cao": 65, "const:mw_cao": 56.08, "const:mw_co2": 44.01 },
    ((90000 * 65) / 100 / 56.08) * 44.01,
  ],
  // missing ref → 0
  ["in:never_seeded + 5", {}, 5],
  // unary minus inside multiplication
  ["3 * -2", {}, -6],
];

let pass = 0;
for (const [expr, ctx, exp] of tests) {
  let got;
  try {
    got = ev(expr, ctx);
  } catch (e) {
    console.log("FAIL (threw)", expr, "→", e.message);
    continue;
  }
  const ok = Math.abs(got - exp) < 1e-9;
  console.log(ok ? "PASS" : "FAIL", expr, "=>", got, ok ? "" : `(expected ${exp})`);
  if (ok) pass++;
}
console.log(`\n${pass}/${tests.length} passed`);
process.exit(pass === tests.length ? 0 : 1);
