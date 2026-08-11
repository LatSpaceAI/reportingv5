// Plain-JS mirror of src/lib/brsrExport/normalizeSharedFormulas.ts, so the
// standalone export test can use it without a TypeScript loader.
//
// The TS module is the one the app ships; this exists only for scripts. If you
// change one, change both — scripts/test-export.mjs asserts the behaviour that
// matters (shared groups expand, references translate, the file still writes).

function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return m ? { col: m[1], row: Number(m[2]) } : null;
}

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function numToCol(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function translateFormula(formula, dCol, dRow) {
  const REF = /((?:\[\d+\])?(?:'[^']+'|[A-Za-z0-9_]+)!)?(\$?)([A-Z]{1,3})(\$?)(\d{1,7})/g;
  return formula.replace(REF, (whole, sheet, colAbs, col, rowAbs, row) => {
    const newCol = colAbs ? col : numToCol(Math.max(1, colToNum(col) + dCol));
    const newRow = rowAbs ? row : String(Math.max(1, Number(row) + dRow));
    return `${sheet ?? ""}${colAbs}${newCol}${rowAbs}${newRow}`;
  });
}

export function normalizeSharedFormulas(ws) {
  const masters = new Map();
  const clones = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (!v || typeof v !== "object") return;
      if (v.formula && v.shareType === "shared") masters.set(cell.address, v.formula);
      else if (v.sharedFormula) clones.push({ cell, masterRef: v.sharedFormula });
    });
  });

  let expanded = 0;

  for (const [address, formula] of masters) {
    const cell = ws.getCell(address);
    const prev = cell.value;
    cell.value = { formula, result: prev?.result };
    expanded++;
  }

  for (const { cell, masterRef } of clones) {
    const masterFormula = masters.get(masterRef);
    const master = parseRef(masterRef);
    const self = parseRef(cell.address);
    if (!masterFormula || !master || !self) continue;
    const translated = translateFormula(
      masterFormula,
      colToNum(self.col) - colToNum(master.col),
      self.row - master.row
    );
    const prev = cell.value;
    cell.value = { formula: translated, result: prev?.result };
    expanded++;
  }

  return expanded;
}
