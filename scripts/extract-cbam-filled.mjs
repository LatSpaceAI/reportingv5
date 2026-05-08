import ExcelJS from "exceljs";

const SRC = "CBAM_template_filled.xlsx";

function val(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);

console.log("Sheets:", wb.worksheets.map((s) => s.name));

function read(sheet, cell) {
  const s = wb.getWorksheet(sheet);
  if (!s) return `<no sheet ${sheet}>`;
  return val(s.getCell(cell));
}

console.log("=== A.1 Reporting period ===");
console.log("start:", read("A_InstData", "I9"));
console.log("end:", read("A_InstData", "L9"));

console.log("\n=== A.2 Installation ===");
const a2Map = {
  nameLocal: "I19", nameEn: "I20", street: "I21", economicActivity: "I22",
  postcode: "I23", poBox: "I24", city: "I25", country: "I26",
  unlocode: "I27", lat: "I28", lng: "I29",
  repName: "I30", repEmail: "I31", repTel: "I32",
};
for (const [k, c] of Object.entries(a2Map)) console.log(k, "=", read("A_InstData", c));

console.log("\n=== A.3 Verifier ===");
const a3Map = {
  verifierCompany: "I37", verifierStreet: "I38", verifierCity: "I39",
  verifierPostcode: "I40", verifierCountry: "I41",
  verifierRepName: "I45", verifierRepEmail: "I46", verifierRepTel: "I47",
  accreditationMS: "I51", accreditationBody: "I52", accreditationRegNo: "I53",
};
for (const [k, c] of Object.entries(a3Map)) console.log(k, "=", read("A_InstData", c));

console.log("\n=== A.4 Aggregated goods table ===");
const sA = wb.getWorksheet("A_InstData");
for (let r = 62; r <= 71; r++) {
  const good = val(sA.getCell(`E${r}`));
  const route1 = val(sA.getCell(`I${r}`));
  const route2 = val(sA.getCell(`J${r}`));
  const pfcRelevant = val(sA.getCell(`K${r}`));
  if (good || route1 || route2) console.log(`row ${r}:`, { good, route1, route2, pfcRelevant });
}

console.log("\n=== A.5 Purchased precursors ===");
for (let r = 102; r <= 121; r++) {
  const good = val(sA.getCell(`E${r}`));
  const country = val(sA.getCell(`F${r}`));
  const route = val(sA.getCell(`G${r}`));
  if (good || country || route) console.log(`row ${r}:`, { good, country, route });
}

console.log("\n=== B.1 Source streams ===");
const sB = wb.getWorksheet("B_EmInst");
for (let r = 17; r <= 90; r++) {
  const name = val(sB.getCell(`E${r}`));
  if (!name) continue;
  console.log(`row ${r}:`, {
    method: val(sB.getCell(`D${r}`)),
    name,
    ad: val(sB.getCell(`F${r}`)),
    adUnit: val(sB.getCell(`G${r}`)),
    ncv: val(sB.getCell(`H${r}`)),
    ef: val(sB.getCell(`J${r}`)),
    efUnit: val(sB.getCell(`K${r}`)),
    cContent: val(sB.getCell(`L${r}`)),
    oxF: val(sB.getCell(`N${r}`)),
    convF: val(sB.getCell(`P${r}`)),
    biomass: val(sB.getCell(`R${r}`)),
  });
}

console.log("\n=== B.2 PFC ===");
for (let r = 97; r <= 110; r++) {
  const tech = val(sB.getCell(`E${r}`));
  const method = val(sB.getCell(`D${r}`));
  if (!tech && !method) continue;
  console.log(`row ${r}:`, {
    method, tech,
    tAl: val(sB.getCell(`F${r}`)),
    aeFreq: val(sB.getCell(`H${r}`)),
    aeDur: val(sB.getCell(`J${r}`)),
    overvoltage: val(sB.getCell(`L${r}`)),
    slopeCF4: val(sB.getCell(`N${r}`)),
    slopeC2F6: val(sB.getCell(`P${r}`)),
  });
}

console.log("\n=== B.3 CEMS ===");
for (let r = 111; r <= 125; r++) {
  const name = val(sB.getCell(`D${r}`));
  if (!name) continue;
  console.log(`row ${r}:`, {
    name,
    ghg: val(sB.getCell(`E${r}`)),
    conc: val(sB.getCell(`F${r}`)),
    flow: val(sB.getCell(`H${r}`)),
    hours: val(sB.getCell(`J${r}`)),
  });
}

console.log("\n=== C.1 Fuel balance ===");
console.log("cbamDirect:", read("C_Emissions&Energy", "I16"));
console.log("electricity:", read("C_Emissions&Energy", "J16"));
console.log("nonCbam:", read("C_Emissions&Energy", "K16"));
console.log("rest:", read("C_Emissions&Energy", "L16"));

console.log("\n=== C.2 GHG balance ===");
console.log("co2:", read("C_Emissions&Energy", "H26"));
console.log("biomass:", read("C_Emissions&Energy", "I26"));
console.log("n2o:", read("C_Emissions&Energy", "J26"));
console.log("pfc:", read("C_Emissions&Energy", "K26"));
console.log("direct:", read("C_Emissions&Energy", "L26"));
console.log("indirect:", read("C_Emissions&Energy", "M26"));

console.log("\n=== C.3 Data quality ===");
console.log("quality:", read("C_Emissions&Energy", "H40"));
console.log("justification:", read("C_Emissions&Energy", "H41"));
console.log("verification:", read("C_Emissions&Energy", "H42"));

console.log("\n=== D.1 Production processes ===");
const sD = wb.getWorksheet("D_Processes");
for (let i = 0; i < 10; i++) {
  const anchor = 15 + 65 * i;
  const good = val(sD.getCell(`E${anchor}`));
  const output = val(sD.getCell(`L${anchor + 1}`));
  if (!good && !output) continue;
  console.log(`P${i + 1} (anchor ${anchor}):`, {
    good,
    output,
    directEm: val(sD.getCell(`L${anchor + 39}`)),
    heatProduced: val(sD.getCell(`L${anchor + 42}`)),
    heatConsumed: val(sD.getCell(`L${anchor + 43}`)),
    heatImported: val(sD.getCell(`L${anchor + 42}`)),
    heatExported: val(sD.getCell(`M${anchor + 42}`)),
    elecMWh: val(sD.getCell(`L${anchor + 50}`)),
    elecEF: val(sD.getCell(`L${anchor + 51}`)),
    elecSource: val(sD.getCell(`L${anchor + 52}`)),
  });
}

console.log("\n=== E.1 Purchased precursors SEE ===");
const sE = wb.getWorksheet("E_PurchPrec");
for (let i = 0; i < 20; i++) {
  const anchor = 16 + 44 * i;
  const good = val(sE.getCell(`E${anchor}`));
  const country = val(sE.getCell(`F${anchor}`));
  const mass = val(sE.getCell(`L${anchor + 1}`));
  if (!good && !country && !mass) continue;
  console.log(`PP${i + 1} (anchor ${anchor}):`, {
    good,
    country,
    mass,
    seeDirect: val(sE.getCell(`L${anchor + 33}`)),
    elecPerT: val(sE.getCell(`L${anchor + 34}`)),
    elecEF: val(sE.getCell(`L${anchor + 35}`)),
    seeIndirect: val(sE.getCell(`L${anchor + 36}`)),
    measurement: val(sE.getCell(`M${anchor + 33}`)),
    elecSource: val(sE.getCell(`M${anchor + 35}`)),
    justification: val(sE.getCell(`K${anchor + 38}`)),
  });
}

console.log("\n=== F.1 CHP ===");
console.log("hasCHP:", read("F_Tools", "H17"));
console.log("fuelIn:", read("F_Tools", "J21"));
console.log("heatOut:", read("F_Tools", "K21"));
console.log("elecOut:", read("F_Tools", "L21"));
console.log("allocationHeat:", read("F_Tools", "H30"));

console.log("\n=== F.2 Carbon price ===");
console.log("priceType:", read("F_Tools", "E97"));
console.log("rebateType:", read("F_Tools", "F97"));
console.log("currency:", read("F_Tools", "J97"));
console.log("pricePerTon:", read("F_Tools", "H101"));
console.log("amountDue:", read("F_Tools", "H102"));
console.log("notes:", read("F_Tools", "E130"));

console.log("\n=== G.1 Notes ===");
console.log("notes:", read("G_FurtherGuidance", "E10"));

// Summary sheet (SP / SC) — try common SEE summary sheet names
const summaryNames = wb.worksheets.map((s) => s.name).filter((n) => /sum|sp|sc/i.test(n));
console.log("\nPossible summary sheets:", summaryNames);

for (const name of summaryNames) {
  const s = wb.getWorksheet(name);
  console.log(`\n--- Sheet: ${name} (rows ${s.actualRowCount}, cols ${s.actualColumnCount}) ---`);
  // Dump first 60 rows of cols A-P
  for (let r = 1; r <= Math.min(80, s.actualRowCount + 5); r++) {
    const row = [];
    for (let c = 1; c <= 16; c++) {
      const v = val(s.getCell(r, c));
      if (v !== null && v !== "") row.push(`${String.fromCharCode(64 + c)}${r}=${JSON.stringify(v)}`);
    }
    if (row.length) console.log(row.join(" | "));
  }
}
