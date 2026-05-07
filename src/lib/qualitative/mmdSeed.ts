import type { Block, Comment, Metric, QualitativeDoc, Requirement } from "./types";

// Stable IDs so the seed is deterministic across reloads. Anything created
// after seeding uses genId().
const now = new Date("2026-04-01T09:00:00.000Z").toISOString();

const blocks: Block[] = [
  {
    id: "b_title",
    kind: "heading",
    level: 1,
    text: "Monitoring Methodology Document — Hindalco Renukoot Aluminium Complex",
  },
  {
    id: "b_subtitle",
    kind: "paragraph",
    text:
      "CBAM Transitional Period — Aluminium Sector. Installation: Hindalco Industries Limited — Renukoot Aluminium Complex, P.O. Renukoot, District Sonbhadra, Uttar Pradesh – 231217, India. Operator: Hindalco Industries Limited (an Aditya Birla Group company). Document version: Draft v0.1. Reporting period: Indian Fiscal Year (1 April – 31 March). Implementing Regulation reference: Commission Implementing Regulation (EU) 2023/1773 of 17 August 2023.",
  },
  {
    id: "b_draft_note",
    kind: "paragraph",
    text:
      "DRAFT NOTE: This is a comprehensive working draft prepared on the basis of publicly available information about the Renukoot complex and the European Commission's CBAM Guidance Document for installation operators outside the EU (Ricardo / Umweltbundesamt, December 2023). Sections, equations, threshold values and structural requirements are taken from that guidance and the Implementing Regulation. All operational figures shown as illustrative placeholders must be replaced with installation-specific verified data before the MMD is used for actual reporting.",
  },

  // ── 1. Identification ────────────────────────────────────────────────────
  { id: "b_s1_h", kind: "heading", level: 2, text: "1. Identification of the Operator and the Installation", sectionTag: "Identification" },

  { id: "b_s1_1_h", kind: "heading", level: 3, text: "1.1 Operator" },
  {
    id: "b_s1_1_t",
    kind: "table",
    columns: ["Field", "Value"],
    rows: [
      ["Legal name", "Hindalco Industries Limited"],
      ["Registered office", "Aditya Birla Centre, S. K. Ahire Marg, Worli, Mumbai 400 030, India"],
      ["Corporate Identification Number (CIN)", "L27020MH1958PLC011238"],
      ["GSTIN of installation", "[TO BE FILLED]"],
      ["EORI number (if any)", "Not applicable — Indian operator"],
      ["Authorised representative for CBAM", "[Name, designation, e-mail, phone]"],
      ["Alternate contact", "[Name, designation, e-mail, phone]"],
    ],
  },

  { id: "b_s1_2_h", kind: "heading", level: 3, text: "1.2 Installation" },
  {
    id: "b_s1_2_t",
    kind: "table",
    columns: ["Field", "Value"],
    rows: [
      ["Installation name", "Hindalco Renukoot Aluminium Complex"],
      ["Location", "P.O. Renukoot, Tehsil Dudhi, District Sonbhadra, Uttar Pradesh – 231217, India"],
      ["Geographic coordinates", "24.2167° N, 83.0333° E (approximate)"],
      ["Year of first commissioning", "1962"],
      ["Total site area", "[TO BE FILLED]"],
      ["Activity classification", "NACE 24.42 (equivalent) — Aluminium production"],
      ["Industrial sector under CBAM", "Aluminium"],
      ["UNLOCODE of nearest port of export", "INMUN (Mundra) / INNSA (Nhava Sheva) — to be confirmed per shipment"],
    ],
  },
  {
    id: "b_inst_req",
    kind: "requirement-ref",
    requirementId: "MMD-INST-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s1_3_h", kind: "heading", level: 3, text: "1.3 Production capacity at the installation (nameplate)" },
  {
    id: "b_s1_3_t",
    kind: "table",
    columns: ["Unit", "Capacity", "Comment"],
    rows: [
      ["Alumina refinery (Renukoot)", "~700,000 t Al₂O₃ / year", "Bayer process; supplements alumina supply from Hindalco's Muri / Belagavi / Utkal refineries"],
      ["Primary aluminium smelter", "~410,000 t Al / year (potline nameplate); ~342,000 t Al / year (current operating capacity post-Potline 3 restart)", "11 potlines, ~2,038 reduction cells, Centre-Worked Pre-Bake (CWPB) technology"],
      ["Anode (Carbon) plant", "[TO BE FILLED] t baked anodes / year", "Horizontal flue ring-type bake furnace (Alcan Alesa Engineering technology)"],
      ["Cast-house", "[TO BE FILLED] t / year (ingots, sows, slabs, billets)", ""],
      ["Hot & cold rolling mill", "[TO BE FILLED] t / year", "Sheets, plates, foil-stock"],
      ["Extrusion plant", "[TO BE FILLED] t / year", "Bars, rods, profiles"],
      ["Wire-rod mill", "[TO BE FILLED] t / year", "EC-grade and alloy rod"],
      ["Renusagar Captive Power Plant", "801.57 MW (10 PF-fired sub-critical units; ~742 MW operating)", "~30 km from Renukoot, dedicated 220 kV line"],
      ["Cogeneration plant at Renukoot", "78 MW", "Provides power and process steam to smelter / refinery"],
    ],
  },

  // ── 2. Description ───────────────────────────────────────────────────────
  { id: "b_s2_h", kind: "heading", level: 2, text: "2. Description of the Installation", sectionTag: "Installation overview" },
  { id: "b_s2_1_h", kind: "heading", level: 3, text: "2.1 Narrative description" },
  {
    id: "b_s2_1_p",
    kind: "paragraph",
    text:
      "Hindalco's Renukoot complex is a vertically integrated primary aluminium installation. Bauxite is sourced from Hindalco's captive mines in Jharkhand, Odisha, Chhattisgarh and Maharashtra, supplemented by Hindalco's own alumina refineries at Muri, Belagavi and Utkal where required. Alumina is produced on-site via the low-temperature Bayer process. Calcined petroleum coke (CPC) and coal-tar pitch are received from external suppliers and converted into pre-baked carbon anodes at the on-site Carbon Plant. Alumina, anodes, cryolite (sodium hexafluoroaluminate) and aluminium fluoride are charged to the Centre-Worked Pre-Bake (CWPB) Hall–Héroult electrolysis cells. Liquid aluminium is tapped to the cast-house where it is alloyed and cast as sows, ingots, slabs, billets or rolled in-line. Downstream operations comprise a hot/cold rolling mill, extrusion plant and wire-rod mill, all on the same Renukoot site.",
  },
  {
    id: "b_s2_1_p2",
    kind: "paragraph",
    text:
      "Electricity is supplied from two auto-produced sources: the Renusagar Captive Power Plant (~742 MW operating, 10 sub-critical pulverised-coal units) located ~30 km from Renukoot and connected by a dedicated 220 kV transmission line — the primary electricity source for the smelter — and the on-site Renukoot Cogeneration Plant (78 MW), supplying power and process steam.",
  },

  { id: "b_s2_2_h", kind: "heading", level: 3, text: "2.2 Process flow (high level)" },
  {
    id: "b_s2_2_d",
    kind: "diagram",
    format: "mermaid",
    source: `flowchart TD
  Bauxite[Bauxite — captive mines] --> Bayer[Bayer Refinery — Renukoot]
  Bayer --> Alumina[Alumina Al₂O₃]
  CPC[CPC + Coal-tar pitch] --> AnodePlant[Anode Plant: Green-mill, Bake Furnace, Rodding]
  AnodePlant --> Anodes[Pre-baked anodes]
  Alumina --> Pots[11 Potlines — CWPB]
  Anodes --> Pots
  AlF3[AlF₃ + Cryolite] --> Pots
  Pots --> LiquidAl[Liquid aluminium]
  LiquidAl --> CastHouse[Cast-house]
  CastHouse --> Forms[Ingots / Sows / Slabs / Billets / Wire-rod]
  Forms --> Rolling[Rolling]
  Forms --> Extrusion[Extrusion]
  Forms --> WireRod[Wire-rod]
  Forms --> Sales[Sales / Export — CN 7601]
  Renusagar[Renusagar 742 MW coal] -->|220 kV| Pots
  Cogen[Renukoot Cogen 78 MW coal] -->|on-site| Pots
  Cogen -.steam.-> Bayer
  Cogen -.steam.-> AnodePlant
  Cogen -.steam.-> CastHouse`,
    caption: "High-level process flow. A detailed P&ID-style diagram with measurement instrument tag numbers is given in Annex A.",
  },

  { id: "b_s2_3_h", kind: "heading", level: 3, text: "2.3 Installations technically connected" },
  {
    id: "b_s2_3_p",
    kind: "paragraph",
    text:
      "For CBAM purposes, Renusagar Captive Power Plant is directly technically connected via a dedicated transmission line and operated by the same operator — treated as part of the installation for attributing direct fuel emissions of electricity to the smelter (auto-producer rules, Annex III Section D). The Renukoot 78 MW Cogeneration Plant sits inside the installation boundary; CHP allocation rules of Annex III Section D apply. Hindalco Muri / Belagavi / Utkal alumina refineries are separate installations; alumina received from them is treated as a precursor with zero embedded emissions (Annex II §3.17).",
  },

  // ── 3. System boundaries ─────────────────────────────────────────────────
  { id: "b_s3_h", kind: "heading", level: 2, text: "3. System Boundaries, Production Processes and Reporting Period", sectionTag: "System boundary" },
  { id: "b_s3_1_h", kind: "heading", level: 3, text: "3.1 Reporting period" },
  {
    id: "b_s3_1_p",
    kind: "paragraph",
    text:
      "The reporting period adopted is the Indian fiscal year (1 April to 31 March), in line with Hindalco's statutory financial accounts and the Bureau of Energy Efficiency (BEE) Perform-Achieve-Trade (PAT) cycle reporting. This period exceeds the three-month minimum permitted under §4.3.3 of the CBAM Guidance and is justified by the additional rigour of statutory financial audit and PAT M&V verification.",
  },

  { id: "b_s3_2_h", kind: "heading", level: 3, text: "3.2 Aggregated goods categories produced" },
  {
    id: "b_s3_2_t",
    kind: "table",
    columns: ["Aggregated goods category", "CN codes produced at Renukoot", "Production route"],
    rows: [
      ["Unwrought aluminium", "7601 (in particular 7601 10 — non-alloyed; 7601 20 — alloyed)", "Primary aluminium — electrolytic smelting (CWPB pre-baked anode route)"],
      ["Aluminium products", "7604 (bars, rods, profiles); 7605 (wire); 7606 (plates, sheets, strip > 0.2 mm); 7607 (foil ≤ 0.2 mm); other CN codes within 7603–7616 as applicable", "Forming — rolling, extrusion, wire-rod drawing, casting"],
    ],
  },

  { id: "b_s3_3_h", kind: "heading", level: 3, text: "3.3 Production processes" },
  {
    id: "b_s3_3_p1",
    kind: "paragraph",
    text:
      "Production Process 1 (PP1) — Unwrought aluminium. System boundary (per IR Annex II §3.17, primary smelting route): CO₂ from consumption of pre-baked anodes during electrolysis; CO₂ from any fuels used (drying, pre-heating of raw materials, heating of cells, casting fuels); CO₂ from flue-gas treatment (e.g. soda ash / limestone if used); PFC emissions (CF₄, C₂F₆) caused by anode effects, monitored per IR Annex III Section B.7; indirect emissions from electricity consumed in PP1. Inside the boundary: raw-material storage; pot-feed and crust-breaker systems; the 11 potlines; gas-treatment centres (GTC); fume-treatment scrubbers; the cast-house including holding furnaces, alloying, and casting machines.",
  },
  {
    id: "b_s3_3_p2",
    kind: "paragraph",
    text:
      "Outside the system boundary (treated separately): on-site anode production at the Carbon Plant — anodes are raw materials with zero embedded emissions, monitored only on a voluntary basis for completeness in Part 2 of the data communication; the Bayer alumina refinery on the same site, treated as a separate installation, with alumina as a zero-emissions raw material; and Renusagar CPP, whose direct fuel emissions are attributed to the electricity consumed by PP1 / PP2 via the auto-producer EF (§8 of this MMD).",
  },
  {
    id: "b_s3_3_p3",
    kind: "paragraph",
    text:
      "Production Process 2 (PP2) — Aluminium products. System boundary covers all forming steps occurring at Renukoot for products under CN 7604 / 7605 / 7606 / 7607 etc.: CO₂ from fuels used in re-heat / homogenising / annealing / holding furnaces in the rolling mill, extrusion plant and wire-rod mill (stationary plant only — vehicles excluded); CO₂ from production of measurable heat consumed (e.g. cogen steam used in homogenising); indirect emissions from electricity consumed in PP2. The precursor of PP2 is unwrought aluminium produced in PP1 (and any externally purchased ingots, if used).",
  },
  {
    id: "b_bound_req",
    kind: "requirement-ref",
    requirementId: "MMD-BND-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s3_4_h", kind: "heading", level: 3, text: "3.4 Bubble approach" },
  {
    id: "b_s3_4_p",
    kind: "paragraph",
    text:
      "Per §7.4.1.2 of the Guidance, an installation producing both unwrought aluminium and aluminium products may declare a single joint production process (a 'bubble') for both, provided no intermediate product is sold or transferred out of the installation. DECISION REQUIRED: Renukoot routinely sells unwrought aluminium ingots and sows on the open market in addition to feeding the on-site rolling/extrusion mills. Therefore the bubble approach is not available, and PP1 and PP2 are reported separately. This decision is recorded here and revisited annually.",
  },
  {
    id: "b_bubble_req",
    kind: "requirement-ref",
    requirementId: "MMD-BUBBLE-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s3_5_h", kind: "heading", level: 3, text: "3.5 Out-of-scope activities at the same site" },
  {
    id: "b_s3_5_p",
    kind: "paragraph",
    text:
      "Out of scope: loading / unloading and on-site logistics — diesel HEMM, locomotives and forklifts are excluded as mobile units (§7.4.1.1); office buildings, township, hospital and schools — non-process emissions; effluent / sewage treatment plant — excluded unless using carbonate-based reagents for flue-gas treatment.",
  },

  // ── 4. Source streams ────────────────────────────────────────────────────
  { id: "b_s4_h", kind: "heading", level: 2, text: "4. Source Streams and Emission Sources", sectionTag: "Source streams" },
  {
    id: "b_s4_intro",
    kind: "paragraph",
    text:
      "The methodology is calculation-based for all source streams. CEMS is not used for any combustion source (CEMS is mandatory only for N₂O in the fertiliser sector and is voluntary elsewhere — §6.5.2).",
  },

  { id: "b_s4_1_h", kind: "heading", level: 3, text: "4.1 Source streams — Production Process 1 (Unwrought aluminium)" },
  {
    id: "b_s4_1_t",
    kind: "table",
    columns: ["ID", "Source stream", "Type", "Method", "Activity-data unit", "Calculation factor source"],
    rows: [
      ["SS1.01", "Pre-baked carbon anodes consumed in electrolysis", "Process material", "Standard methodology", "tonnes net carbon consumed", "EF = 3.664 t CO₂ / t C; carbon content from anode COA"],
      ["SS1.02", "Anode butts returned (recycled)", "Process material (deduction from SS1.01)", "Mass balance on anode flow", "tonnes", "—"],
      ["SS1.03", "Cryolite (Na₃AlF₆) make-up", "Process material", "Negligible CO₂ from carbonate; tracked for completeness", "tonnes", "—"],
      ["SS1.04", "Aluminium fluoride (AlF₃) make-up", "Process material", "No CO₂ from this stream", "tonnes", "—"],
      ["SS1.05", "Soda ash (Na₂CO₃) used in dry / semi-dry GTC scrubbing", "Process material", "Standard methodology, process emissions", "tonnes Na₂CO₃", "EF = 0.4149 t CO₂ / t Na₂CO₃ (stoichiometric)"],
      ["SS1.06", "Limestone (if used in scrubber)", "Process material", "Standard methodology, process emissions", "tonnes CaCO₃", "EF = 0.4397 t CO₂ / t CaCO₃"],
      ["SS1.07", "Natural gas / LPG / FO used in cast-house holding furnaces", "Combustion fuel", "Standard methodology, combustion emissions", "tonnes (or Nm³ × density)", "NCV and EF: Annex VIII IR / IPCC 2006 Vol 2 Table 1.4"],
      ["SS1.08", "HSD / LDO used for pot pre-heat / start-up", "Combustion fuel", "Standard methodology, combustion", "kL", "Annex VIII IR"],
      ["SS1.09", "Pet coke / coal used in anode bake furnace (voluntary)", "Combustion fuel — voluntary", "Standard methodology", "tonnes", "Annex VIII IR"],
    ],
  },
  {
    id: "b_s4_1_pfc",
    kind: "paragraph",
    text:
      "Emission source for PFCs (PP1): ES1.01 — all 11 potlines (CWPB), anode-effect events; GHGs CF₄ and C₂F₆; method: Calculation Method A — Slope (IR Annex III §B.7.1).",
  },

  { id: "b_s4_2_h", kind: "heading", level: 3, text: "4.2 Source streams — Production Process 2 (Aluminium products)" },
  {
    id: "b_s4_2_t",
    kind: "table",
    columns: ["ID", "Source stream", "Type", "Method", "Unit"],
    rows: [
      ["SS2.01", "Natural gas / LPG / RLNG used in re-heat & homogenising furnaces (rolling)", "Combustion", "Standard", "tonnes / Nm³"],
      ["SS2.02", "Natural gas / LPG used in billet pre-heat & ageing ovens (extrusion)", "Combustion", "Standard", "tonnes / Nm³"],
      ["SS2.03", "Natural gas / LPG used in casting / annealing furnaces (wire-rod)", "Combustion", "Standard", "tonnes / Nm³"],
      ["SS2.04", "Soda ash / limestone in any flue-gas treatment of the above furnaces", "Process", "Standard", "tonnes"],
      ["SS2.05", "Aluminium scrap re-melted in cast-house / mill (if any)", "Mass tracked; no fuel-CO₂ from scrap; fuel covered under SS2.01–SS2.03", "—", "tonnes"],
    ],
  },

  { id: "b_s4_3_h", kind: "heading", level: 3, text: "4.3 Indirect emission sources" },
  {
    id: "b_s4_3_t",
    kind: "table",
    columns: ["ID", "Source", "Method"],
    rows: [
      ["ES-I.01", "Electricity drawn by PP1 (smelter pots + rectifiers + GTC + cast-house)", "Auto-producer EF from Renusagar CPP + Renukoot Cogen weighted average"],
      ["ES-I.02", "Electricity drawn by PP2 (rolling + extrusion + wire-rod + auxiliaries)", "Same auto-producer EF"],
      ["ES-I.03", "Marginal grid imports (if any, during CPP outage)", "India national grid default EF as published by the European Commission"],
    ],
  },
  {
    id: "b_data_req",
    kind: "requirement-ref",
    requirementId: "MMD-DATA-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s4_4_h", kind: "heading", level: 3, text: "4.4 Heat flows" },
  {
    id: "b_s4_4_t",
    kind: "table",
    columns: ["ID", "Heat flow", "Source", "Sink"],
    rows: [
      ["HT1", "Process steam from Renukoot Cogen", "Cogeneration plant", "Bayer digestion, anode-bake recuperation, cast-house pre-heat, rolling mill homogenising"],
      ["HT2", "Recovered waste heat from potline gas treatment", "Pots → GTC → economiser", "District / process water heating"],
    ],
  },

  { id: "b_s4_5_h", kind: "heading", level: 3, text: "4.5 De-minimis / minor source streams" },
  {
    id: "b_s4_5_p",
    kind: "paragraph",
    text:
      "Source streams contributing less than 2 % to total emissions of the production process, but never more than 20,000 t CO₂/yr cumulatively, may be classified as de-minimis and monitored to a lower tier (e.g. supplier defaults). Currently de-minimis: SS1.06, SS1.08 (subject to annual confirmation). Cumulative de-minimis emissions are tracked separately and the threshold checked each reporting period.",
  },

  // ── 5. Direct emissions ──────────────────────────────────────────────────
  { id: "b_s5_h", kind: "heading", level: 2, text: "5. Monitoring Methodology — Direct Emissions", sectionTag: "Direct emissions" },
  {
    id: "b_s5_p1",
    kind: "paragraph",
    text:
      "General formula (IR Annex III Equation 4): Em_Inst = Σ Em_calc,i + Σ Em_meas,j + Σ Em_other,k. For Renukoot, all source streams use the calculation-based standard methodology (IR Annex III §B.4 and B.5). No measurement-based (CEMS) source is currently in use; no 'other' non-EU method is invoked except the IPCC 2006 default values where Annex VIII of the Implementing Regulation refers back to IPCC.",
  },

  { id: "b_s5_1_h", kind: "heading", level: 3, text: "5.1 Standard methodology — combustion emissions" },
  {
    id: "b_s5_1_p",
    kind: "paragraph",
    text:
      "Per source stream: Em = AD × NCV × EF_preliminary × OF, where AD is activity data (mass or volume of fuel consumed), NCV is the net calorific value (TJ/t or TJ/Nm³), EF_preliminary is the preliminary emission factor (t CO₂ / TJ), and OF is the oxidation factor (default 1, per §6.5.1.1.1 of Guidance).",
  },

  { id: "b_s5_2_h", kind: "heading", level: 3, text: "5.2 Standard methodology — process emissions (anodes, soda ash, limestone)" },
  {
    id: "b_s5_2_p",
    kind: "paragraph",
    text:
      "Per source stream: Em = AD × CC × CF × 3.664, where AD is the mass of material consumed, CC is the carbon content (t C / t material; for anodes derived from supplier COA cross-checked with in-house analysis), CF is the conversion factor (default 1), and 3.664 is the molar ratio CO₂/C.",
  },

  { id: "b_s5_3_h", kind: "heading", level: 3, text: "5.3 Activity data — measurement instruments and tier requirements" },
  {
    id: "b_s5_3_t",
    kind: "table",
    columns: ["Source stream", "Primary AD source", "Corroborating AD source", "Instrument tag(s)", "Permissible uncertainty (target)"],
    rows: [
      ["SS1.01 Anode net consumption", "Anode mass-balance: (anodes set to pots) − (butts returned) on a daily basis, weighed on calibrated weighbridge", "Anode-cycle counter × average weight; potline rectifier MWh × Faraday consumption check", "WB-CB-01, WB-CB-02", "≤ 1.5 %"],
      ["SS1.05 Soda ash", "Daily issue from stores via calibrated weigh hopper", "Purchase invoice + monthly stock measurement", "WH-GTC-01", "≤ 2.5 %"],
      ["SS1.07 NG / LPG / FO at cast-house", "Custody-transfer flow meter (Coriolis for LPG; orifice + temp/press compensation for NG)", "Supplier invoice; daily log", "FM-CH-01..05", "≤ 1.5 %"],
      ["SS2.01–SS2.03 Fuel at rolling/extrusion/wire-rod", "Custody-transfer flow meters per furnace", "Tank-dip and supplier invoice", "FM-RM-xx", "≤ 1.5 %"],
    ],
  },
  {
    id: "b_s5_3_p",
    kind: "paragraph",
    text:
      "Calibration plan: every meter is calibrated annually by a NABL-accredited agency or in-house against a standard traceable to the National Physical Laboratory (NPL), New Delhi. Calibration records are kept for ten years per IR Article 11.",
  },

  { id: "b_s5_4_h", kind: "heading", level: 3, text: "5.4 Calculation factors" },
  {
    id: "b_s5_4_t",
    kind: "table",
    columns: ["Parameter", "Source stream", "Method", "Frequency", "Accredited lab"],
    rows: [
      ["Carbon content of anodes", "SS1.01", "Lab analysis per ISO 17499 (S and ash) and ISO 17431 (calcined coke C); EF derived as (1 − ash − S − impurities) × 3.664", "One sample per anode batch; 12 monthly composites", "Hindalco R&D Centre, Belur (NABL ISO/IEC 17025)"],
      ["Sulphur and ash of anodes", "SS1.01", "ISO 12980 / ISO 8005", "Per batch", "As above"],
      ["NCV of natural gas", "SS1.07, SS2.01–03", "Supplier COA cross-checked with monthly composite analysis (ISO 6976 / ASTM D 3588)", "Daily supplier value; monthly composite", "GAIL / supplier + Renukoot lab"],
      ["EF of natural gas", "SS1.07, SS2.01–03", "Standard value: 56.1 t CO₂ / TJ (Annex VIII IR / 2006 IPCC)", "Annual review", "n/a"],
      ["NCV of LPG", "various", "Supplier COA", "Per delivery", "n/a"],
      ["EF of LPG", "various", "63.1 t CO₂ / TJ (Annex VIII IR)", "Annual review", "n/a"],
      ["NCV of HSD", "SS1.08", "Supplier COA", "Per delivery", "n/a"],
      ["EF of HSD", "SS1.08", "74.1 t CO₂ / TJ (Annex VIII IR)", "Annual review", "n/a"],
      ["EF of soda ash", "SS1.05", "Stoichiometric: 0.4149 t CO₂ / t Na₂CO₃", "Constant", "n/a"],
      ["EF of limestone", "SS1.06", "Stoichiometric: 0.4397 t CO₂ / t CaCO₃", "Constant", "n/a"],
    ],
  },
  {
    id: "b_s5_4_p",
    kind: "paragraph",
    text:
      "Standard values are sourced in priority order: (i) Annex VIII of IR; (ii) IPCC 2006 Guidelines Volume 2 (Energy) Tables; (iii) values published by the European Commission for the CBAM transitional period; (iv) values from India's national GHG inventory (Biennial Update Report submitted to the UNFCCC) where the above are not applicable.",
  },

  { id: "b_s5_5_h", kind: "heading", level: 3, text: "5.5 Emissions calculation example (illustrative — placeholders)" },
  {
    id: "b_s5_5_p",
    kind: "paragraph",
    text:
      "Annual primary aluminium production (PrAl, PP1): 342,000 t (assumption). Net anode consumption rate: 0.42 t C / t Al (typical CWPB). Annual carbon consumption: 342,000 × 0.42 = 143,640 t C. Direct CO₂ from anodes: 143,640 × 3.664 = 526,300 t CO₂. Soda ash consumed: 1,800 t/yr. Direct CO₂ from soda ash: 1,800 × 0.4149 = 747 t CO₂. Cast-house NG consumption: 15 million Nm³/yr; at NCV 0.0357 GJ/Nm³ and EF 56.1 t CO₂ / TJ → 30,040 t CO₂. PFC emissions: see §6.",
  },
  {
    id: "b_method_req",
    kind: "requirement-ref",
    requirementId: "MMD-MTH-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  // ── 6. PFC ───────────────────────────────────────────────────────────────
  { id: "b_s6_h", kind: "heading", level: 2, text: "6. Monitoring Methodology — PFC Emissions", sectionTag: "PFC emissions" },
  {
    id: "b_s6_p",
    kind: "paragraph",
    text:
      "PFCs (CF₄ and C₂F₆) are formed during anode-effect events and expressed as t CO₂-eq using GWP-AR4 values (Annex VIII §3 IR): GWP CF₄ = 7,390; GWP C₂F₆ = 12,200.",
  },

  { id: "b_s6_1_h", kind: "heading", level: 3, text: "6.1 Method selection" },
  {
    id: "b_s6_1_p",
    kind: "paragraph",
    text:
      "Method A — Slope Method (IR Annex III §B.7.1) is selected for Renukoot because the pot-control system records anode-effect occurrences and durations on every pot via the Pot Process Control System (PPCS), and anode-effect overvoltage integration (required for Method B) is not currently implemented on every potline.",
  },
  {
    id: "b_pfc_req",
    kind: "requirement-ref",
    requirementId: "MMD-PFC-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s6_2_h", kind: "heading", level: 3, text: "6.2 Equations (Method A)" },
  {
    id: "b_s6_2_p",
    kind: "paragraph",
    text:
      "CF4 emissions [t] = AEM × (SEFCF4 / 1000) × PrAl (Eq. 21). C2F6 emissions [t] = CF4 emissions × FC2F6 (Eq. 22). AEM = frequency × average duration (Eq. 23). For CWPB technology, SEF_CF4 = 0.143 (kg CF₄ / t Al) / (AE-min / cell-day) (IR Table 7-20 / Annex III Table 1) and F_C2F6 = 0.121 t C₂F₆ / t CF₄. These technology-specific factors are the minimum requirement; recommended improvement is to establish installation-specific SEFs by intermittent stack measurement at least every 3 years per the International Aluminium Institute Best Practice Guidelines on PFC Measurement (currently not yet implemented).",
  },

  { id: "b_s6_3_h", kind: "heading", level: 3, text: "6.3 Activity data — anode-effect monitoring" },
  {
    id: "b_s6_3_t",
    kind: "table",
    columns: ["Parameter", "Source", "Frequency"],
    rows: [
      ["Number of AE events per cell", "PPCS event log (continuous)", "Continuous"],
      ["Duration of each AE event (minutes)", "PPCS event log; clock from start of cell-voltage rise above target to extinction", "Per event"],
      ["Number of operating cell-days", "Pot status master (operating cells × calendar days)", "Daily"],
      ["PrAl (tonnes Al)", "Cast-house weighing (sows + ingots + DC slabs + billets + wire-rod) cross-checked against rectifier MWh × Faraday CE", "Daily; monthly close"],
    ],
  },
  {
    id: "b_s6_3_p",
    kind: "paragraph",
    text:
      "Cell-day (per IAI definition): one cell operating for one calendar day. Cells in early start-up or cold-start phase are excluded for the first 14 days (Hindalco internal procedure WP-PPCS-04).",
  },

  { id: "b_s6_4_h", kind: "heading", level: 3, text: "6.4 Fugitive PFC corrections" },
  {
    id: "b_s6_4_p",
    kind: "paragraph",
    text:
      "Where stack measurements of CF₄ are conducted (recommended, every 3 years), fugitive emissions from cell-room ventilation are accounted for using the GTC collection efficiency η: PFC total = PFC measured at duct / η (Eq. 20). Currently η is taken as 98 % (IAI typical value pending site-specific measurement).",
  },

  { id: "b_s6_5_h", kind: "heading", level: 3, text: "6.5 Illustrative PFC calculation" },
  {
    id: "b_s6_5_p",
    kind: "paragraph",
    text:
      "Cell-days per year: 2,038 cells × 365 = 743,870 cell-days. AE frequency: 0.10 events / cell-day → 74,387 events. Average AE duration: 1.2 min/event. AEM = 0.10 × 1.2 = 0.12 AE-min / cell-day. CF₄ = 0.12 × (0.143 / 1000) × 342,000 = 5,869 kg = 5.87 t. C₂F₆ = 5.87 × 0.121 = 0.71 t. Direct PFC in CO₂-eq = 5.87 × 7,390 + 0.71 × 12,200 = 43,376 + 8,662 = 52,038 t CO₂-eq.",
  },

  // ── 7. Heat ──────────────────────────────────────────────────────────────
  { id: "b_s7_h", kind: "heading", level: 2, text: "7. Monitoring Methodology — Measurable Heat", sectionTag: "Measurable heat" },
  { id: "b_s7_1_h", kind: "heading", level: 3, text: "7.1 Heat flows monitored" },
  {
    id: "b_s7_1_p",
    kind: "paragraph",
    text:
      "Per §6.7.2 of the Guidance, 'measurable heat' means heat transported via a medium (steam, hot water, etc.) where flow can be metered. Heat used directly inside a burner / kiln (e.g. anode-bake furnace direct heating) is not monitored as a heat flow — its emissions are determined from the fuel consumption of that burner.",
  },
  {
    id: "b_s7_1_t",
    kind: "table",
    columns: ["Heat flow", "Producer", "Consumer(s)", "Heat meter"],
    rows: [
      ["Process steam — saturated, ~10 bar(g)", "Renukoot Cogen 78 MW", "Bayer digestion (Refinery), anode-bake recuperator, cast-house pre-heat, rolling-mill homogenising furnace pre-heat", "HM-CG-01 / 02 / 03 (orifice + RTD + saturation correction)"],
      ["Recovered waste heat (potline GTC)", "Potline GTC scrubber", "Process water heating", "Optional, voluntary"],
    ],
  },

  { id: "b_s7_2_h", kind: "heading", level: 3, text: "7.2 Net heat calculation" },
  {
    id: "b_s7_2_p",
    kind: "paragraph",
    text:
      "Heat content per IR Annex III Section C: Q_net = ṁ × (h_supply − h_return), where ṁ is mass flow rate and h is specific enthalpy at measured T, p, and saturation. Returned condensate flow and temperature are metered separately.",
  },

  { id: "b_s7_3_h", kind: "heading", level: 3, text: "7.3 Heat emission factor" },
  {
    id: "b_s7_3_p",
    kind: "paragraph",
    text:
      "Heat-related emissions are attributed to the heat consumer (each PP) per the heat-EF approach (§6.7.2.2 of Guidance): EF_heat = Em_cogen, attributable to heat / Q_heat_produced. For Renukoot Cogen (CHP), allocation between heat and electricity is performed by the 'alternative method' (efficiency-based allocation, IR Annex III §C.2 / D.2.1.4), η_heat / (η_heat + η_elec_ref), with reference efficiencies η_elec_ref = 0.525 and η_heat_ref = 0.80 (Implementing Regulation Annex IX).",
  },

  // ── 8. Indirect ──────────────────────────────────────────────────────────
  { id: "b_s8_h", kind: "heading", level: 2, text: "8. Monitoring Methodology — Indirect Emissions (Electricity)", sectionTag: "Indirect emissions" },
  { id: "b_s8_1_h", kind: "heading", level: 3, text: "8.1 Sources of electricity" },
  {
    id: "b_s8_1_t",
    kind: "table",
    columns: ["Path", "Annual share (illustrative)", "Treatment"],
    rows: [
      ["Renusagar CPP (auto-produced)", "~85 %", "Auto-producer EF (§8.2)"],
      ["Renukoot Cogen (auto-produced, electrical part of CHP)", "~14 %", "Auto-producer EF, with CHP allocation (§8.3)"],
      ["UPPCL grid import (back-up)", "~1 %", "India grid default EF published by EU Commission"],
    ],
  },

  { id: "b_s8_2_h", kind: "heading", level: 3, text: "8.2 Auto-producer emission factor — Renusagar CPP" },
  {
    id: "b_s8_2_p",
    kind: "paragraph",
    text:
      "Renusagar is operated by Hindalco and is directly technically connected to Renukoot via a dedicated 220 kV transmission line. Per §6.7.3 of the Guidance, electricity from such an installation may be attributed at the actual EF of the power plant (treated as if it were on-site auto-production). EF_elec = Em_cpp / E_net_delivered, where Em_cpp is direct CO₂ emissions of Renusagar CPP — calculated by the standard methodology applied to coal (and any back-up oil) consumed — and E_net_delivered is the net electricity delivered to Renukoot at the receiving 220 kV bus (generation − auxiliaries − transmission loss).",
  },
  {
    id: "b_s8_2_t",
    kind: "table",
    columns: ["Parameter", "Method", "Source"],
    rows: [
      ["Coal consumption", "Belt-weighers on each unit's coal feeder (M&V calibrated 6-monthly)", "Renusagar daily Generation Report"],
      ["GCV / NCV of coal", "Daily composite sample, bomb calorimeter (ASTM D 5865 / IS 1350)", "Renusagar lab (NABL accredited)"],
      ["Carbon content of coal", "Ultimate analysis (ASTM D 3176 / IS 1350-Pt 4), monthly composite", "Renusagar lab"],
      ["Oxidation factor", "1.00 (default; ash carbon content < 1 %)", "per IR §B.5"],
      ["EF of coal (calculation)", "EF = C × 3.664 / NCV", "Calculated"],
      ["HSD/FO for unit start-up", "Tank-dip, monthly", "Renusagar fuel ledger"],
      ["Net electricity exported to Renukoot", "220 kV revenue meter at Renukoot end (bi-directional, ABT-class 0.2s)", "UPPCL/Hindalco joint metering"],
      ["Auxiliary consumption", "Unit aux meters", "Renusagar"],
    ],
  },
  {
    id: "b_renusagar_req",
    kind: "requirement-ref",
    requirementId: "MMD-RENUSAGAR-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s8_3_h", kind: "heading", level: 3, text: "8.3 Auto-producer emission factor — Renukoot Cogen 78 MW (CHP)" },
  {
    id: "b_s8_3_p",
    kind: "paragraph",
    text:
      "CHP allocation per IR Annex III §D.2 is required because the same fuel produces both heat (PP1, PP2) and electricity (PP1, PP2). Steps: (1) direct emissions of cogen = AD_coal × NCV × EF_coal; (2) allocate to electricity and heat by their respective reference efficiencies; (3) EF_elec_cogen = Em_allocated_to_elec / E_net_delivered_cogen; (4) EF_heat = Em_allocated_to_heat / Q_net_delivered. The combined auto-producer EF for the smelter is the energy-weighted average of EF_renusagar and EF_elec_cogen.",
  },

  { id: "b_s8_4_h", kind: "heading", level: 3, text: "8.4 Grid imports (back-up)" },
  {
    id: "b_s8_4_p",
    kind: "paragraph",
    text:
      "For any kWh imported from the UPPCL grid (e.g. during a CPP outage), the India default emission factor published by the European Commission for the CBAM transitional period is used (currently the IEA-derived value, ~0.95 t CO₂ / MWh for India, to be set per the latest EU publication). The volume is metered at the 220 kV import meter.",
  },

  { id: "b_s8_5_h", kind: "heading", level: 3, text: "8.5 Allocation to production processes" },
  {
    id: "b_s8_5_p",
    kind: "paragraph",
    text:
      "Electricity drawn by the smelter (PP1) is metered separately from the rolling mill / extrusion / wire-rod (PP2) through dedicated 11 kV / 33 kV feeders. Auxiliary electricity not attributable to a single PP is allocated pro-rata to PP1 and PP2 by their primary electricity share.",
  },
  {
    id: "b_s8_5_t",
    kind: "table",
    columns: ["Sub-meter ID", "Process", "Application"],
    rows: [
      ["EM-PP1-01..04", "PP1", "Rectifier substations (potlines 1–11), pot-room services, GTC, cast-house"],
      ["EM-PP2-01..03", "PP2", "Hot rolling mill, cold rolling mill, extrusion press hall, wire-rod mill"],
      ["EM-AUX-01", "Auxiliary", "Refinery, anode plant, water treatment — allocated by the rules of §6.7.3.2"],
    ],
  },

  { id: "b_s8_6_h", kind: "heading", level: 3, text: "8.6 Renewable PPA electricity" },
  {
    id: "b_s8_6_p",
    kind: "paragraph",
    text:
      "If, during the reporting period, any electricity is sourced under a renewable Power Purchase Agreement, the operator may apply EF = 0 only if all conditions of IR Annex III §D.4 and Annex IV §6 are met (PPA is long-term, traceable, additional, with retirement of the corresponding Energy Attribute Certificates). Not currently applicable — to be re-assessed if Hindalco's group renewable PPAs are allocated to Renukoot.",
  },
  {
    id: "b_ppa_req",
    kind: "requirement-ref",
    requirementId: "MMD-PPA-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  // ── 9. Precursors ────────────────────────────────────────────────────────
  { id: "b_s9_h", kind: "heading", level: 2, text: "9. Monitoring of Precursors", sectionTag: "Precursors" },
  { id: "b_s9_1_h", kind: "heading", level: 3, text: "9.1 Precursors of PP1 — Unwrought aluminium" },
  {
    id: "b_s9_1_p",
    kind: "paragraph",
    text:
      "Per IR Annex II §3.17, primary aluminium from CWPB has no relevant precursors for CBAM purposes: alumina is a raw material (zero embedded emissions); pre-baked anodes are a raw material (zero embedded emissions) — even when produced on-site; aluminium fluoride and cryolite are raw materials (zero embedded emissions); fuels are not precursors. Therefore PP1 has no embedded-emissions contribution from precursors — only its own direct + indirect emissions.",
  },

  { id: "b_s9_2_h", kind: "heading", level: 3, text: "9.2 Precursors of PP2 — Aluminium products" },
  {
    id: "b_s9_2_p",
    kind: "paragraph",
    text:
      "The relevant precursor of PP2 is unwrought aluminium. The bulk is internal (PP1). Where externally-purchased ingots / sows are used, the supplier-communicated specific embedded emissions (SEE_direct, SEE_indirect) are obtained per §6.8.2 of the Guidance.",
  },
  {
    id: "b_s9_2_t",
    kind: "table",
    columns: ["Source of unwrought aluminium", "Quantity (t/yr)", "SEE_direct (t CO₂ / t)", "SEE_indirect (t CO₂ / t)", "Source of data"],
    rows: [
      ["Internal (PP1)", "[TO BE FILLED]", "Calculated from this MMD", "Calculated from this MMD", "This MMD"],
      ["External (Indian smelters – e.g. Vedanta, NALCO)", "[if any]", "From supplier's data communication or default value", "Same", "Communication template per §6.11"],
      ["External (imported ingots)", "[if any]", "From supplier or default", "Same", "Communication template"],
    ],
  },
  {
    id: "b_s9_2_p2",
    kind: "paragraph",
    text:
      "If a supplier does not provide data, the European Commission's default value for unwrought aluminium (transitional period) is applied only as a last resort and the reason is recorded in the data communication.",
  },
  {
    id: "b_prc_req",
    kind: "requirement-ref",
    requirementId: "MMD-PRC-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s9_3_h", kind: "heading", level: 3, text: "9.3 Receipt and verification of precursor data" },
  {
    id: "b_s9_3_p",
    kind: "paragraph",
    text:
      "Precursor data is requested from external suppliers via the European Commission's 'Communication template — operator to importer' (Annex IV IR), adapted as a 'supplier-to-Hindalco' template. Data is received quarterly and reviewed by the Carbon Cell. Where the supplier has its own carbon price (e.g. an EU ETS supplier), the carbon-price information is collected per §12 below.",
  },

  { id: "b_s9_4_h", kind: "heading", level: 3, text: "9.4 Alumina from off-site Hindalco refineries (Muri / Belagavi / Utkal)" },
  {
    id: "b_s9_4_p",
    kind: "paragraph",
    text:
      "Although the off-site Bayer refineries are part of the same parent company, alumina is treated as a raw material with zero embedded emissions under the primary-aluminium system boundary (IR Annex II §3.17 footnote and Guidance §5.7.3.1). No precursor monitoring is required. For full transparency, the upstream alumina-production emissions are reported voluntarily in Part 2 (optional) of the data communication.",
  },

  // ── 10. Activity levels ──────────────────────────────────────────────────
  { id: "b_s10_h", kind: "heading", level: 2, text: "10. Monitoring of Activity Levels (Production Output)", sectionTag: "Activity levels" },
  { id: "b_s10_1_h", kind: "heading", level: 3, text: "10.1 Unwrought aluminium (PP1)" },
  {
    id: "b_s10_1_p",
    kind: "paragraph",
    text:
      "Activity level = mass of unwrought aluminium produced and stockpiled or transferred out of PP1 (whether sold, transferred to PP2, or held as inventory) — per IR Annex III §F.",
  },
  {
    id: "b_s10_1_t",
    kind: "table",
    columns: ["Output stream", "Measurement", "Frequency"],
    rows: [
      ["Sows / ingots dispatched as 7601", "Cast-house revenue weighbridge (calibrated, NABL traceable)", "Per cast"],
      ["Slabs / billets transferred to PP2", "In-house weighbridge", "Per cast"],
      ["Wire-rod cast", "In-line weigh roll", "Per coil"],
      ["Inventory adjustment", "Monthly stock-take (sow yard, ingot bay)", "Monthly"],
    ],
  },

  { id: "b_s10_2_h", kind: "heading", level: 3, text: "10.2 Aluminium products (PP2)" },
  {
    id: "b_s10_2_t",
    kind: "table",
    columns: ["CN code", "Product", "Measurement"],
    rows: [
      ["7604", "Bars, rods, profiles (extrusion)", "Press-line weigh and dispatch weighbridge"],
      ["7605", "Aluminium wire", "Drawing-line weigh"],
      ["7606", "Plates, sheets, strip (>0.2 mm)", "Coil weigh on each rolling mill"],
      ["7607", "Foil (≤0.2 mm)", "Coil weigh on foil mill"],
    ],
  },

  { id: "b_s10_3_h", kind: "heading", level: 3, text: "10.3 Stock measurement and reconciliation" },
  {
    id: "b_s10_3_p",
    kind: "paragraph",
    text:
      "Monthly stock balance is performed for unwrought aluminium and for each product CN code. Differences in excess of the procedural tolerance (1 % of monthly throughput) trigger a corrective-action review.",
  },

  { id: "b_s10_4_h", kind: "heading", level: 3, text: "10.4 Treatment of scrap" },
  {
    id: "b_s10_4_p",
    kind: "paragraph",
    text:
      "Per Guidance §7.4.1.3 the operator must report tonnes of scrap used per tonne of unwrought aluminium product, the percentage which is pre-consumer (run-around / process scrap), and the alloy content where total non-Al elements exceed 1 %. Renukoot is a primary aluminium producer; scrap usage in PP1 is limited to internal cast-house run-around (clean commercial scrap added to holding furnace) which is by definition pre-consumer (100 %). Per Guidance footnote 50, where alloy content > 5 %, the alloying mass is treated as if it were primary unwrought aluminium for SEE purposes.",
  },

  // ── 11. Sector parameters ────────────────────────────────────────────────
  { id: "b_s11_h", kind: "heading", level: 2, text: "11. Sector-Specific Reporting Parameters", sectionTag: "Sector parameters" },
  {
    id: "b_s11_t",
    kind: "table",
    columns: ["Parameter", "PP1 (Unwrought aluminium)", "PP2 (Aluminium products)"],
    rows: [
      ["Tonnes of scrap used per tonne of product", "Tracked monthly", "Tracked monthly"],
      ["% of scrap that is pre-consumer", "100 % (cast-house run-around)", "Tracked monthly"],
      ["Alloy content (only if non-Al elements > 1 %)", "Per heat / per alloy COA", "Per heat / per alloy COA"],
    ],
  },

  // ── 12. Carbon price ─────────────────────────────────────────────────────
  { id: "b_s12_h", kind: "heading", level: 2, text: "12. Carbon Price Information", sectionTag: "Carbon price" },
  {
    id: "b_s12_p",
    kind: "paragraph",
    text:
      "Per Article 7 IR and §6.10 of Guidance, the operator must report any effective carbon price due in the country of production that can be attributed to CBAM goods.",
  },
  { id: "b_s12_1_h", kind: "heading", level: 3, text: "12.1 Indian regulatory landscape (as at the date of this MMD)" },
  {
    id: "b_s12_1_t",
    kind: "table",
    columns: ["Instrument", "Applicability to Renukoot", "CBAM-recognised?"],
    rows: [
      ["Perform-Achieve-Trade (PAT), BEE — energy-saving certificates (ESCerts)", "Yes — Renusagar and Renukoot are PAT designated consumers", "Not a direct carbon price; not recognised as a carbon price for CBAM under current EU practice. Reported as zero unless the EU clarifies otherwise."],
      ["Coal Cess / GST Compensation Cess on coal (₹400/t)", "Yes — paid on coal consumed at Renusagar / Cogen", "Not currently recognised by the EU as a 'carbon price' for CBAM purposes. Reported as zero pending guidance."],
      ["Carbon Credit Trading Scheme (CCTS), Ministry of Power, notified June 2023", "The aluminium sector is expected to be brought under CCTS in subsequent phases", "Will be reported once a market price emerges and the EU recognises it."],
    ],
  },
  {
    id: "b_s12_1_p",
    kind: "paragraph",
    text:
      "DECISION REQUIRED: a position note shall be prepared by Hindalco Legal & Sustainability functions confirming the treatment of (i) coal cess and (ii) any prospective CCTS price under Article 9 of the CBAM Regulation. Until that position is finalised, the carbon price due reported to importers is zero (€ / t CO₂) with a footnote stating the reason.",
  },
  {
    id: "b_carbonprice_req",
    kind: "requirement-ref",
    requirementId: "MMD-CARBONPRICE-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s12_2_h", kind: "heading", level: 3, text: "12.2 Carbon price on precursors" },
  {
    id: "b_s12_2_p",
    kind: "paragraph",
    text:
      "As per §6.10, if a precursor of PP2 (i.e. external unwrought aluminium) was produced under a recognised carbon price, the supplier must communicate that price. If the supplier does not provide the information, the carbon price for that precursor is assumed zero (Guidance §6.10).",
  },

  // ── 13. Data flow & QA/QC ────────────────────────────────────────────────
  { id: "b_s13_h", kind: "heading", level: 2, text: "13. Data Flow, Written Procedures and Control System", sectionTag: "QA / QC" },
  { id: "b_s13_1_h", kind: "heading", level: 3, text: "13.1 Data flow diagram" },
  {
    id: "b_s13_1_d",
    kind: "diagram",
    format: "mermaid",
    source: `flowchart TD
  Field[Field instruments — DCS, SCADA, weighbridges, pot-control, lab LIMS]
  Hist[Plant Historian PI/OSI — minute-level archival]
  MES[Daily / monthly aggregation in MES]
  WB[CBAM Calculation Workbook — version-controlled]
  Recon[Quarterly reconciliation by Carbon Cell — 4-eye review]
  Comm[Communication template per EU importer]
  Review[Annual review and improvement plan]
  Field --> Hist --> MES --> WB --> Recon --> Comm --> Review`,
    caption: "End-to-end data flow from field instruments to importer communication.",
  },

  { id: "b_s13_2_h", kind: "heading", level: 3, text: "13.2 Risk assessment" },
  {
    id: "b_s13_2_t",
    kind: "table",
    columns: ["Node", "Risk", "Severity (L × I)", "Control"],
    rows: [
      ["Anode net consumption — manual butt-weight log", "Mis-keying, transposition", "M × H = High", "Daily 4-eye sign-off; weekly variance check vs. rectifier MWh-implied consumption"],
      ["PPCS anode-effect log", "Sensor loss / time-stamp error", "L × H = Medium", "Heart-beat alarm; daily PPCS export reviewed"],
      ["Weighbridge calibration drift", "Under-/over-reporting AD", "M × M = Medium", "Quarterly calibration with reference weights; cross-check vs. supplier dispatch slip"],
      ["Cogen heat-meter saturation drift", "Mis-allocation between heat & electricity", "M × M = Medium", "Monthly steam-table verification"],
      ["Coal sampling at Renusagar", "Sampling not representative of as-fired", "M × H = High", "Mechanical sampler at silo + manual cross-check"],
    ],
  },

  { id: "b_s13_3_h", kind: "heading", level: 3, text: "13.3 Quality assurance and control measures" },
  {
    id: "b_s13_3_p",
    kind: "paragraph",
    text:
      "Per §6.4.6 of Guidance: every primary instrument is calibrated annually with calibration certificates filed and traceable to NPL; historian access is role-controlled and the CBAM workbook is version-controlled in SharePoint with change log; data entry, validation and approval are performed by three different individuals; annual GHG monitoring training is delivered by an external accredited body, with at least one internal trainer holding ISO 14064-1 / ISO 14065 lead-verifier qualification; monthly time-series consistency checks (specific energy intensity, specific anode consumption, AEM trend, specific NG consumption per t Al product) are performed; non-conformances are logged in the Hindalco SAP-EHS module with root-cause analysis within 30 days; outsourced lab analyses (IS 1350 coal, ASTM D 5865 GCV, ISO 12980 anodes) are performed only at NABL-accredited labs with documented chain-of-custody; records are kept for 10 years (IR Article 11).",
  },
  {
    id: "b_qaqc_req",
    kind: "requirement-ref",
    requirementId: "MMD-QAQC-01",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  { id: "b_s13_4_h", kind: "heading", level: 3, text: "13.4 Sampling plan" },
  {
    id: "b_s13_4_p",
    kind: "paragraph",
    text:
      "A sampling plan (controlled document SP-CBAM-01) is maintained for: anode lots — one composite per batch, 12 monthly composites; coal — ASME PTC 4 mechanical sampler at silo, daily composite, monthly cross-laboratory comparison; natural gas — monthly grab sample for Wobbe / NCV cross-check against supplier COA; soda ash — certificate of analysis per consignment plus quarterly in-house verification.",
  },

  { id: "b_s13_5_h", kind: "heading", level: 3, text: "13.5 Estimation method for data gaps" },
  {
    id: "b_s13_5_p",
    kind: "paragraph",
    text:
      "Where activity data is missing for a period of less than 30 days, the missing value is replaced by a 12-month rolling average of the same parameter, or by a directly correlated parameter (e.g. rectifier MWh × Faraday-equivalent C-consumption for anode AD). The estimation is conservative (i.e. results in equal or higher emissions) per Guidance §6.4.4. All gaps and substitutions are logged in the CBAM workbook with rationale.",
  },

  { id: "b_s13_6_h", kind: "heading", level: 3, text: "13.6 Improvements" },
  {
    id: "b_s13_6_p",
    kind: "paragraph",
    text:
      "Annual improvement review identifies opportunities such as: roll-out of overvoltage logging on remaining potlines (switch from PFC Method A to Method B); installation-specific PFC slope-factor measurement campaign every 3 years; smart sub-metering on rolling-mill furnaces to remove pro-rata allocation; a dedicated MRV software in place of the Excel workbook.",
  },

  // ── 14. Roles ────────────────────────────────────────────────────────────
  { id: "b_s14_h", kind: "heading", level: 2, text: "14. Roles, Responsibilities and Competency", sectionTag: "Roles" },
  {
    id: "b_s14_t",
    kind: "table",
    columns: ["Role", "Responsible person", "Key duty"],
    rows: [
      ["Data Owner — overall MMD", "[VP Operations, Renukoot]", "Approval of MMD and any modifications"],
      ["Carbon Cell Lead", "[Head, Carbon & Sustainability]", "Day-to-day MMD ownership; quarterly emissions calculation"],
      ["Process Data Steward — PP1", "[DGM, Smelter Process]", "Anode flow, AE log, smelter activity levels"],
      ["Process Data Steward — PP2", "[DGM, Downstream]", "Fuel flow, product weights, scrap"],
      ["Power & Heat Steward", "[Head, Renusagar] / [Head, Cogen]", "Coal AD, NCV, EF calculation; heat-flow data"],
      ["Lab Manager", "[Head, R&D / QC]", "Anode and coal analyses"],
      ["Internal Auditor", "[Head, Internal Audit]", "Annual independent review of the data flow and control system"],
      ["Document Controller", "[DC, Renukoot]", "Version control; distribution; archival"],
    ],
  },
  {
    id: "b_s14_p",
    kind: "paragraph",
    text:
      "Competency requirements: each role-holder shall have completed the Hindalco Internal CBAM Training (8 hours) and at least one external course on ISO 14064-1 / ISO 14065 within 24 months.",
  },

  // ── 15. Document management ──────────────────────────────────────────────
  { id: "b_s15_h", kind: "heading", level: 2, text: "15. Document Management and Review Cycle", sectionTag: "Document management" },
  {
    id: "b_s15_p",
    kind: "paragraph",
    text:
      "This MMD is a controlled document — only the latest approved version is used. Distribution is on a 'need-to-know' basis via the Hindalco SharePoint controlled-document library. Routine review is annual, by 31 May for the prior FY. A triggered review is initiated on any of: change of installation technology; change of fuel mix > 5 %; addition of a new CN code; change in CBAM regulation; change of EU default values. A revision log is maintained on the cover page.",
  },
  {
    id: "b_s15_t",
    kind: "table",
    columns: ["Version", "Date", "Author", "Approver", "Description"],
    rows: [
      ["0.1", "[draft date]", "Carbon Cell", "—", "Initial draft for internal review"],
      ["1.0", "[TBD]", "Carbon Cell", "VP Operations", "First approved version"],
    ],
  },

  // ── 16. Annexes ──────────────────────────────────────────────────────────
  { id: "b_s16_h", kind: "heading", level: 2, text: "16. Annexes", sectionTag: "Annexes" },
  {
    id: "b_s16_p",
    kind: "paragraph",
    text:
      "Annex A — Detailed process flow diagram with measurement instrument tag numbers (P&ID extract), separately controlled. Annex B — Master list of measurement instruments, their make/model, range, accuracy class, calibration agency, last-calibration date, next-due date. Annex C — List of standard values used (NCV, EF, GWP) with their source (Annex VIII IR / IPCC 2006 / EU Commission default). Annex D — Communication template to EU importers (the European Commission's voluntary 'Operator-to-Importer' Excel workbook), populated for each reporting period. Annex E — Risk register and control-measure log. Annex F — Sampling plan SP-CBAM-01. Annex G — Glossary of CBAM terms (per IR Article 3 and Annex IV definitions). Annex H — Worked example for a representative reporting period (mirrors Guidance §7.4.2 example structure, populated with Renukoot data).",
  },
];

const requirements: Requirement[] = [
  {
    id: "MMD-INST-01",
    name: "Installation identity",
    description:
      "Provide legal name, registered office, CIN, GSTIN of the installation, the authorised CBAM representative, geographic coordinates and UNLOCODE of the nearest port of export for the Renukoot complex.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-BND-01",
    name: "System boundary description",
    description:
      "Describe the system boundaries for PP1 (Unwrought aluminium) and PP2 (Aluminium products), including auxiliary energy flows and which on-site activities (anode plant, alumina refinery, mobile equipment) are excluded and why.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-BUBBLE-01",
    name: "Bubble approach decision",
    description:
      "Confirm whether the single-process 'bubble' approach (Guidance §7.4.1.2) is available given that Renukoot sells unwrought aluminium externally in addition to feeding the on-site rolling and extrusion mills, and record the decision and rationale.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-DATA-01",
    name: "Activity data sources",
    description:
      "Tabulate each activity-data stream (SS1.01–SS1.09 for PP1; SS2.01–SS2.05 for PP2; ES-I.01–ES-I.03 for indirect), the measurement instrument or invoice, the measurement frequency, the assigned uncertainty target and the calibration plan.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-MTH-01",
    name: "Calculation methodology",
    description:
      "Specify the calculation approach (calculation-based standard methodology), the formulae used for combustion and process emissions, the priority order for emission factors (Annex VIII IR → IPCC 2006 → EC defaults → India BUR), and any default values applied.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-PFC-01",
    name: "PFC method selection",
    description:
      "Confirm selection of PFC Method A (Slope) versus Method B (Overvoltage) for the 11 CWPB potlines, including readiness of overvoltage integration and the schedule for an installation-specific SEF measurement campaign per the IAI Best Practice Guidelines.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-RENUSAGAR-01",
    name: "Renusagar auto-producer treatment",
    description:
      "Confirm with the verifier that Renusagar CPP qualifies as 'directly technically connected' to Renukoot under §6.7.3 and Annex III §D, and document the calculation of EF_elec from coal AD, NCV, carbon content and net electricity delivered at the 220 kV revenue meter.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-PPA-01",
    name: "Renewable PPA allocation",
    description:
      "Re-assess whether any group renewable PPA can be allocated to Renukoot with retirement of the corresponding Energy Attribute Certificates so that EF = 0 may be applied per IR Annex III §D.4 and Annex IV §6.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-PRC-01",
    name: "Precursor accounting",
    description:
      "List the precursors of PP2 (internal unwrought Al from PP1, external Indian smelters, imported ingots), how their embedded emissions are obtained (this MMD, supplier communication template, default values) and the verification process for supplier-communicated SEEs.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-CARBONPRICE-01",
    name: "Carbon price position",
    description:
      "Record the position note from Hindalco Legal & Sustainability on whether (i) coal cess / GST compensation cess and (ii) any prospective CCTS price qualify as a recognised carbon price under Article 9 of the CBAM Regulation. Until finalised, the carbon price reported is zero with the reason footnoted.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "MMD-QAQC-01",
    name: "QA / QC procedures",
    description:
      "Document the procedures for instrument calibration, segregation of duties, IT-system access control, monthly time-series consistency checks, non-conformance handling in SAP-EHS, outsourced-lab requirements (NABL accreditation, chain-of-custody) and 10-year record retention.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement created from MMD template." }],
    createdAt: now,
    updatedAt: now,
  },
];

const metrics: Metric[] = [
  { id: "M-PRAL", name: "Primary aluminium produced (PP1)", unit: "t/yr", value: 342000, source: "Cast-house weighing (illustrative)", updatedAt: now },
  { id: "M-ANODE-C", name: "Net anode carbon consumption", unit: "t C/yr", value: 143640, source: "Anode mass balance (illustrative)", updatedAt: now },
  { id: "M-DIRECT-ANODE", name: "Direct CO₂ from anodes (PP1)", unit: "t CO₂/yr", value: 526300, source: "Calculation (illustrative)", updatedAt: now },
  { id: "M-DIRECT-NG", name: "Direct CO₂ from cast-house NG", unit: "t CO₂/yr", value: 30040, source: "Flow meter + Annex VIII EF (illustrative)", updatedAt: now },
  { id: "M-PFC-CO2E", name: "PFC emissions (CO₂-eq)", unit: "t CO₂-eq/yr", value: 52038, source: "PPCS + Method A (illustrative)", updatedAt: now },
  { id: "M-RENUSAGAR", name: "Renusagar CPP — operating capacity", unit: "MW", value: 742, source: "Renusagar Generation Report", updatedAt: now },
  { id: "M-COGEN", name: "Renukoot Cogen — installed capacity", unit: "MW", value: 78, source: "Plant nameplate", updatedAt: now },
  { id: "M-CELLS", name: "Operating reduction cells", unit: "cells", value: 2038, source: "Pot status master", updatedAt: now },
];

const comments: Comment[] = [];

export function buildMmdSeed(frameworkId: string): QualitativeDoc {
  return {
    frameworkId,
    title: "MMD — Hindalco Renukoot Aluminium Complex (Draft v0.1)",
    blocks,
    requirements,
    metrics,
    comments,
    proposals: [],
    updatedAt: now,
  };
}
