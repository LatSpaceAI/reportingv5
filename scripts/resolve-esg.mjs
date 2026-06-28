// =============================================================================
// ESG resolver + demo-data seeder.
//
// The dashboard reads pre-computed values from esg.output_value (and raw inputs
// from esg.input_value). On a fresh project both are empty, so charts render
// "No data". This script:
//
//   1. (optional, default on) seeds plausible esg.input_value for every
//      plant × period so there is something to compute from — values vary by
//      plant and month so trends/comparisons look real.
//   2. evaluates the FORMULAS layer (esg.formula) with a safe expression
//      parser — supports + - * / ( ), comparison =, and IF / IFERROR / MAX /
//      MIN, plus in:/const:/out: tokens — in eval_order (DAG-safe), and upserts
//      esg.output_value.
//
// Usage:
//   node scripts/resolve-esg.mjs              # seed inputs (if empty) + resolve
//   node scripts/resolve-esg.mjs --resolve-only   # don't touch inputs, just compute
//   node scripts/resolve-esg.mjs --reseed     # overwrite inputs even if present
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// =============================================================================

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ---- env --------------------------------------------------------------------
async function loadEnv() {
  const txt = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const args = new Set(process.argv.slice(2));
const RESOLVE_ONLY = args.has("--resolve-only");
const RESEED = args.has("--reseed");

let sb; // initialized in main()
async function initClient() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  sb = createClient(url, key, {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- helpers ----------------------------------------------------------------
async function selectAll(table, columns) {
  // Page through to avoid the default 1000-row PostgREST cap.
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

// =============================================================================
// Safe expression evaluator
// =============================================================================
// Tokenizer: numbers, identifiers (in:/const:/out: keys, function names),
// string literals 'yes', operators + - * / ( ) , and comparison =.
export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const isIdentChar = (c) => /[A-Za-z0-9_.:]/.test(c);
  while (i < expr.length) {
    const c = expr[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      let s = "";
      while (j < expr.length && expr[j] !== "'") s += expr[j++];
      tokens.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if ("+-*/(),=".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c) && !(c === "." && !/[0-9]/.test(expr[i + 1] ?? ""))) {
      // number (supports 4.184e-6)
      let j = i;
      let num = "";
      while (
        j < expr.length &&
        (/[0-9.]/.test(expr[j]) ||
          ((expr[j] === "e" || expr[j] === "E") && /[0-9+\-]/.test(expr[j + 1] ?? "")) ||
          ((expr[j] === "+" || expr[j] === "-") &&
            (expr[j - 1] === "e" || expr[j - 1] === "E")))
      ) {
        num += expr[j++];
      }
      tokens.push({ t: "num", v: parseFloat(num) });
      i = j;
      continue;
    }
    if (isIdentChar(c)) {
      let j = i;
      let id = "";
      while (j < expr.length && isIdentChar(expr[j])) id += expr[j++];
      tokens.push({ t: "id", v: id });
      i = j;
      continue;
    }
    throw new Error(`Unexpected char '${c}' at ${i} in: ${expr}`);
  }
  return tokens;
}

const FUNCS = new Set(["IF", "IFERROR", "MAX", "MIN", "SUM"]);

// Recursive-descent parser → AST. Grammar (low→high precedence):
//   comparison := add ( '=' add )?
//   add        := mul ( ('+'|'-') mul )*
//   mul        := unary ( ('*'|'/') unary )*
//   unary      := '-'? primary
//   primary    := num | str | id | func '(' args ')' | '(' comparison ')'
export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (v) => {
    const tk = next();
    if (!tk || tk.v !== v) throw new Error(`Expected '${v}'`);
  };

  function parseComparison() {
    let left = parseAdd();
    if (peek() && peek().t === "op" && peek().v === "=") {
      next();
      const right = parseAdd();
      return { type: "cmp", op: "=", left, right };
    }
    return left;
  }
  function parseAdd() {
    let left = parseMul();
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v;
      left = { type: "bin", op, left, right: parseMul() };
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = next().v;
      left = { type: "bin", op, left, right: parseUnary() };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().t === "op" && peek().v === "-") {
      next();
      return { type: "neg", arg: parseUnary() };
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const tk = next();
    if (!tk) throw new Error("Unexpected end of expression");
    if (tk.t === "num") return { type: "num", v: tk.v };
    if (tk.t === "str") return { type: "str", v: tk.v };
    if (tk.t === "op" && tk.v === "(") {
      const e = parseComparison();
      expect(")");
      return e;
    }
    if (tk.t === "id") {
      if (FUNCS.has(tk.v) && peek() && peek().v === "(") {
        next(); // (
        const argsList = [];
        if (peek() && peek().v !== ")") {
          argsList.push(parseComparison());
          while (peek() && peek().v === ",") {
            next();
            argsList.push(parseComparison());
          }
        }
        expect(")");
        return { type: "call", name: tk.v, args: argsList };
      }
      return { type: "ref", key: tk.v };
    }
    throw new Error(`Unexpected token ${JSON.stringify(tk)}`);
  }

  const ast = parseComparison();
  if (pos !== tokens.length) throw new Error("Trailing tokens");
  return ast;
}

export function evalAst(node, ctx) {
  switch (node.type) {
    case "num":
      return node.v;
    case "str":
      return node.v;
    case "ref": {
      if (!(node.key in ctx)) {
        // Unknown reference → treat as 0 (missing input). Keeps the engine
        // robust when only a representative subset of inputs is seeded.
        return 0;
      }
      const v = ctx[node.key];
      return v == null ? 0 : v;
    }
    case "neg":
      return -toNum(evalAst(node.arg, ctx));
    case "cmp": {
      const l = evalAst(node.left, ctx);
      const r = evalAst(node.right, ctx);
      // String-aware equality (e.g. is_company_owned = 'yes'). If either side is
      // a non-numeric string, compare as strings; otherwise compare numerically.
      const lNum = isNumeric(l);
      const rNum = isNumeric(r);
      if (!lNum || !rNum) return String(l) === String(r);
      return toNum(l) === toNum(r);
    }
    case "bin": {
      const l = toNum(evalAst(node.left, ctx));
      const r = toNum(evalAst(node.right, ctx));
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? Infinity : l / r; // IFERROR catches Inf/NaN downstream
      }
      break;
    }
    case "call": {
      const a = node.args;
      switch (node.name) {
        case "IF":
          return truthy(evalAst(a[0], ctx)) ? evalAst(a[1], ctx) : evalAst(a[2], ctx);
        case "IFERROR": {
          const v = evalAst(a[0], ctx);
          const n = typeof v === "number" ? v : toNum(v);
          return Number.isFinite(n) ? v : evalAst(a[1], ctx);
        }
        case "MAX":
          return Math.max(...a.map((x) => toNum(evalAst(x, ctx))));
        case "MIN":
          return Math.min(...a.map((x) => toNum(evalAst(x, ctx))));
        case "SUM":
          return a.reduce((s, x) => s + toNum(evalAst(x, ctx)), 0);
      }
      break;
    }
  }
  throw new Error(`Cannot eval node ${node.type}`);
}

function isNumeric(v) {
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return true;
  if (typeof v === "string") return v.trim() !== "" && !Number.isNaN(Number(v));
  return false;
}
function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}
function truthy(v) {
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

// Compile each formula once.
function compile(expr) {
  return parse(tokenize(expr));
}

// =============================================================================
// Demo input seeding
// =============================================================================
// Deterministic pseudo-random in [0,1) from integer seed — so reruns are stable.
function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Per-plant scale: integrated plants (clinker) are big; grinding units smaller;
// GROUP is the largest (a stand-in consolidated site, ~3.5× a single plant).
function plantScale(plant) {
  if (plant.code === "GROUP") return 3.5;
  if (plant.plant_type === "integrated") return 1.0 + (plant.id % 3) * 0.25;
  return 0.45; // grinding
}

// Anchor: monthly clinker production (tonnes) for this plant/month. Everything
// physical (fuel, power, water) is derived from this with realistic specific
// factors so SHC/SEC/scope intensities land in believable ranges.
function clinkerTPM(plant, monthNo, seed) {
  if (plant.plant_type === "grinding") return 0; // grinding units make no clinker
  return 90000 * plantScale(plant) * seasonal(monthNo, seed);
}

// Seasonality factor for a given fiscal month_no (1=Apr..12=Mar).
function seasonal(monthNo, seed) {
  const base = 1 + 0.12 * Math.sin(((monthNo - 1) / 12) * 2 * Math.PI);
  return base * (0.92 + 0.16 * rand(seed));
}

// Choose a realistic per-plant-per-month value for an input key.
function seedValueFor(param, plant, monthNo) {
  const key = param.key;
  const scale = plantScale(plant);
  const seed = (plant.id * 1000 + monthNo) * 31 + hashStr(key);
  const s = seasonal(monthNo, seed);
  const r = rand(seed);

  // text inputs
  if (param.value_type === "text") {
    if (key === "dg.is_company_owned") return { value_text: "yes" };
    return { value_text: "" };
  }

  // LHV: roughly constant calorific values by fuel (kcal/kg), small jitter.
  if (key.endsWith(".lhv")) {
    const lhvBase = {
      "fuel.kiln.indigenous_petcoke.lhv": 8200,
      "fuel.kiln.g5_coal.lhv": 4200,
      "fuel.kiln.diesel_oil.lhv": 10200,
      "fuel.kiln.spent_carbon.lhv": 6000,
      "fuel.kiln.shredded_plastic.lhv": 7000,
      "fuel.kiln.organic_residue.lhv": 3500,
      "fuel.kiln.organic_solvents.lhv": 6500,
      "fuel.kiln.wood_sawdust.lhv": 3000,
    };
    return { value_num: round((lhvBase[key] ?? 5000) * (0.97 + 0.06 * r)) };
  }

  // percentages
  if (param.unit === "%") {
    const pctBase = {
      "qual.clinker_cao": 65,
      "qual.clinker_mgo": 1.6,
      "qual.ash_cao": 3.5,
      "qual.ash_mgo": 1.2,
      "qual.ash.petcoke": 1.0,
      "qual.ash.indigenous_coal": 35,
      "qual.ash.imported_coal": 12,
      "qual.ash.lignite": 8,
      "qual.ash.rice_husk": 18,
      "qual.ash.tyres": 10,
    };
    return { value_num: round2((pctBase[key] ?? 5) * (0.95 + 0.1 * r)) };
  }

  // Physical anchor: this plant/month clinker tonnage. Fuel, power and water
  // are derived from it with realistic specific factors so KPIs land in range.
  const clk = clinkerTPM(plant, monthNo, seed);
  // A grinding-only unit still grinds cement; give it a cement basis.
  const cementTPM = clk > 0 ? clk / 0.62 : 55000 * scale * s; // clinker factor ~0.62
  const num = (v) => ({ value_num: round(v) });
  const num2 = (v) => ({ value_num: round2(v) });

  // ---- PRODUCTION (tonnes) ----
  if (key === "prod.clinker_production") return num(clk);
  if (key === "prod.clinker_consumed") return num(clk * 0.97);
  if (key === "prod.raw_meal") return num(clk * 1.55);
  if (key === "prod.limestone_raw") return num(clk * 1.3);
  if (key === "prod.cement_dispatched") return num(cementTPM * 0.98);
  if (key === "prod.natural_gypsum") return num(cementTPM * 0.04);
  if (key.startsWith("prod.")) {
    // blended cement components — split the non-clinker cement among types
    return num(cementTPM * (0.05 + 0.1 * r));
  }
  if (key.startsWith("res.")) return num(cementTPM * (0.02 + 0.04 * r)); // alt cementitious

  // ---- FUEL (qty in tonnes/kL) — specific thermal ~3.1 GJ/t clinker ----
  if (key.endsWith(".qty")) {
    if (clk === 0) return num(0);
    // Coal/petcoke dominate; alt+biomass are a modest share (gives TSR ~15-20%).
    // Specific fuel consumption (t fuel / t clinker), tuned so kiln thermal
    // energy ≈ 3.1 GJ/t clinker → SHC ≈ 750-850 kcal/kg and TSR ≈ 15-20%.
    const share = {
      "fuel.kiln.indigenous_petcoke.qty": 0.058,
      "fuel.kiln.g5_coal.qty": 0.034,
      "fuel.kiln.diesel_oil.qty": 0.0004,
      "fuel.kiln.spent_carbon.qty": 0.008,
      "fuel.kiln.shredded_plastic.qty": 0.007,
      "fuel.kiln.organic_residue.qty": 0.006,
      "fuel.kiln.organic_solvents.qty": 0.003,
      "fuel.kiln.wood_sawdust.qty": 0.011,
    };
    return num(clk * (share[key] ?? 0.005) * (0.9 + 0.2 * r));
  }

  // ---- ENERGY / POWER ----
  if (key === "pwr.grid_total") return num(cementTPM * 0.075); // MWh (~75 kWh/t)
  if (key === "pwr.grid_delivered") return num(cementTPM * 0.07);
  if (key === "pwr.onsite_gen") return num(cementTPM * 0.02);
  if (key === "pwr.onsite_delivered") return num(cementTPM * 0.018);
  if (key === "pwr.onsite_export") return num(cementTPM * 0.004); // < grid_total
  if (key === "pwr.whrs_gen") return num(clk * 0.011);
  if (key === "pwr.whrs_delivered") return num(clk * 0.01);
  if (key === "pwr.solar_gen" || key === "pwr.solar_delivered") return num(cementTPM * 0.006);
  if (key === "pwr.hydel_delivered") return num(cementTPM * 0.003);
  if (key === "pwr.total_upto_clinker") return num(clk * 0.06);
  if (key === "pwr.dg_consumption") return num(cementTPM * 0.001);
  if (key.startsWith("pwr.clinker.")) return num(clk * (15 + 20 * r)); // kWh components
  if (key.startsWith("pwr.cement.")) return num(cementTPM * (10 + 15 * r)); // kWh
  if (key.startsWith("pwr.byproduct.")) return num(cementTPM * (2 + 4 * r)); // kWh

  // ---- WATER (TCM / kL / k-litres) ----
  if (key.startsWith("water.")) return num2(cementTPM * 0.0009 * (0.8 + 0.4 * r));

  // ---- WASTE (tonnes) ----
  if (key.startsWith("waste.")) return num2(cementTPM * 0.0005 * (0.6 + 0.8 * r));

  // ---- SCOPE 3 ----
  if (key === "s3.cement_road.qty" || key === "s3.cement_rail.qty")
    return num(cementTPM * (key.includes("rail") ? 0.3 : 0.6)); // MT split road/rail
  if (key.includes("distance")) return num2(200 + 300 * r); // km
  if (key === "s3.cement_road.loading") return num2(25 + 5 * r); // MT/lorry
  if (key === "s3.cement_road.mileage") return num2(3 + 1.5 * r); // KMPL
  if (key.startsWith("commute.")) return num(key.includes("employees") ? 80 + 120 * r : 150 + 250 * r);

  // ---- vehicles / DG / other (small) ----
  if (key.startsWith("veh.")) return num2((10 + 20 * r) * scale);
  if (key.startsWith("dg.")) return num2((4 + 8 * r) * scale);
  if (key.startsWith("other.")) return num2((10 + 50 * r) * scale);

  // ---- AIR (tonnes) ----
  if (key.startsWith("air.")) return num2(cementTPM * 0.00002 * (0.5 + r));

  // ---- BIODIVERSITY ----
  if (key === "bio.total_plant_area") return num(700000 + 300000 * r); // m2
  if (key === "bio.greenbelt_area") return num2(20 + 30 * r); // hectares
  if (key.startsWith("bio.")) return num2((10 + 40 * r) * scale);

  // fallback
  return num((50 + 100 * r) * scale);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function round(n) {
  return Math.round(n);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  await initClient();
  console.log("Loading catalogue…");
  const [plants, periods, inputParams, outputParams, constants, formulas] =
    await Promise.all([
      selectAll("plant", "id, code, name, plant_type, is_group"),
      selectAll("period", "id, fiscal_year, period_kind, month_no"),
      selectAll("input_parameter", "id, key, domain, unit, value_type, is_active"),
      selectAll("output_parameter", "id, key"),
      selectAll("constant", "key, value"),
      selectAll("formula", "id, output_key, expression, eval_order, is_active"),
    ]);

  const activeInputs = inputParams.filter((p) => p.is_active !== false);
  const inputIdByKey = new Map(activeInputs.map((p) => [p.key, p.id]));
  const outputIdByKey = new Map(outputParams.map((p) => [p.key, p.id]));
  const constByKey = new Map(constants.map((c) => [c.key, Number(c.value)]));

  // Only seed the months we want trends over: the 12 monthly periods + YTD.
  const monthPeriods = periods.filter((p) => p.period_kind === "month");
  const ytdPeriods = periods.filter((p) => p.period_kind === "ytd");
  const targetPeriods = [...monthPeriods, ...ytdPeriods];

  // ---- 1. seed inputs -------------------------------------------------------
  if (!RESOLVE_ONLY) {
    const { count } = await sb
      .from("input_value")
      .select("id", { count: "exact", head: true });
    if (count > 0 && !RESEED) {
      console.log(`input_value already has ${count} rows — skipping seed (use --reseed to overwrite).`);
    } else {
      console.log(`Seeding inputs for ${plants.length} plants × ${targetPeriods.length} periods…`);
      const rows = [];
      for (const plant of plants) {
        for (const period of targetPeriods) {
          // For YTD, sum-ish: use 12× a representative month so YTD looks annual.
          const monthForCalc = period.period_kind === "ytd" ? 6 : period.month_no;
          const ytdMult = period.period_kind === "ytd" ? 12 : 1;
          for (const param of activeInputs) {
            const v = seedValueFor(param, plant, monthForCalc);
            const row = {
              plant_id: plant.id,
              period_id: period.id,
              parameter_id: param.id,
            };
            if ("value_num" in v) {
              row.value_num = v.value_num == null ? null : v.value_num * ytdMult;
            }
            if ("value_text" in v) row.value_text = v.value_text;
            rows.push(row);
          }
        }
      }
      // upsert in chunks
      console.log(`Upserting ${rows.length} input_value rows…`);
      await upsertChunks("input_value", rows, "plant_id,period_id,parameter_id");
    }
  }

  // ---- 2. resolve formulas --------------------------------------------------
  console.log("Compiling formulas…");
  const compiled = formulas
    .filter((f) => f.is_active !== false)
    .sort((a, b) => a.eval_order - b.eval_order || a.output_key.localeCompare(b.output_key))
    .map((f) => ({ ...f, ast: compile(f.expression) }));

  // Load all input values once, index by (plant,period) → {in:key: num}.
  console.log("Loading input values…");
  const inputValues = await selectAll(
    "input_value",
    "plant_id, period_id, parameter_id, value_num, value_text"
  );
  const inputKeyById = new Map(activeInputs.map((p) => [p.id, p.key]));
  const inByPP = new Map(); // `${plant}|${period}` → ctx fragment
  for (const iv of inputValues) {
    const k = `${iv.plant_id}|${iv.period_id}`;
    if (!inByPP.has(k)) inByPP.set(k, {});
    const key = inputKeyById.get(iv.parameter_id);
    if (!key) continue;
    inByPP.get(k)[`in:${key}`] =
      iv.value_num != null ? Number(iv.value_num) : iv.value_text ?? 0;
  }

  const constCtx = {};
  for (const [k, v] of constByKey) constCtx[`const:${k}`] = v;

  console.log(`Resolving ${compiled.length} formulas over ${plants.length} plants × ${targetPeriods.length} periods…`);
  const outRows = [];
  for (const plant of plants) {
    for (const period of targetPeriods) {
      const ctx = { ...constCtx, ...(inByPP.get(`${plant.id}|${period.id}`) ?? {}) };
      for (const f of compiled) {
        let val;
        try {
          val = toNum(evalAst(f.ast, ctx));
        } catch (e) {
          val = 0;
        }
        if (!Number.isFinite(val)) val = 0;
        ctx[`out:${f.output_key}`] = val;
        const pid = outputIdByKey.get(f.output_key);
        if (pid == null) continue;
        outRows.push({
          plant_id: plant.id,
          period_id: period.id,
          parameter_id: pid,
          value_num: round4(val),
          formula_id: f.id,
        });
      }
    }
  }

  console.log(`Upserting ${outRows.length} output_value rows…`);
  await upsertChunks("output_value", outRows, "plant_id,period_id,parameter_id");

  console.log("Done.");
  // quick sanity print
  await sanity(plants, periods, outputIdByKey);
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

async function upsertChunks(table, rows, onConflict) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + chunk, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function sanity(plants, periods, outputIdByKey) {
  const group = plants.find((p) => p.code === "GROUP");
  const ytd = periods.find((p) => p.period_kind === "ytd");
  const s1 = outputIdByKey.get("emis.scope1_total");
  const s2 = outputIdByKey.get("emis.scope2_total");
  const cf = outputIdByKey.get("kpi.clinker_factor");
  for (const [label, pid] of [
    ["Scope 1 total", s1],
    ["Scope 2 total", s2],
    ["Clinker factor", cf],
  ]) {
    const { data } = await sb
      .from("output_value")
      .select("value_num")
      .eq("plant_id", group.id)
      .eq("period_id", ytd.id)
      .eq("parameter_id", pid)
      .maybeSingle();
    console.log(`  GROUP/YTD ${label}: ${data?.value_num ?? "—"}`);
  }
}

// Only run when invoked directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
