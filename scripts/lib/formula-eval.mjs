// =============================================================================
// Formula expression parser for the ESG FORMULAS layer.
//
// Extracted verbatim from the original resolver so the Birla Estates resolver
// and any future consumer share ONE evaluator — two implementations of the same
// grammar drifting apart is exactly how a disclosure silently changes value.
//
// Grammar (low -> high precedence):
//   comparison := add ( '=' add )?
//   add        := mul ( ('+'|'-') mul )*
//   mul        := unary ( ('*'|'/') unary )*
//   unary      := '-'? primary
//   primary    := number | 'string' | ident | FUNC '(' args ')' | '(' expr ')'
//
// Identifiers are the namespaced tokens the FORMULAS layer uses:
//   in:<input_parameter.key>    const:<constant.key>    out:<output_parameter.key>
//
// Functions: IF, IFERROR, MAX, MIN, SUM.
//
// The evaluator is deliberately NOT a JS eval: expressions come from the
// database, and a resolver that could execute arbitrary JS from a table row
// would be a remote-code-execution hole wearing a spreadsheet costume.
// =============================================================================

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

// tokenize / parse / evalAst are exported at their definitions above.
export { compile, toNum, isNumeric, truthy, FUNCS };
