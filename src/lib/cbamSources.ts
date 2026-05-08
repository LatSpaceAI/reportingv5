// Per-question source / explanation text shown in the Excel-style report's
// right-pane "Source" panel. Content is extracted from
// CBAM_Template_Explanation.md — it documents where each filled field came
// from in the Renukoot working file and any methodology choice.

export const cbamSources: Record<string, string> = {
  "A.1": `Reporting period: 1 April 2024 – 31 March 2025 (FY25).

• Start date (I9) = 2024-04-01 — first day of the assessment period printed on every Renukoot tab ("1st Apr'24 to 31st Mar'25").
• End date (L9) = 2025-03-31 — last day of the same assessment period.`,

  "A.2": `About the installation. Source rows on "Summary- Emission CY25" rows 1–2 ("Organisation Name" + "Location" headers).

• Installation name — local (I19) = Hindalco Industries Limited – Renukoot. Same as English; no separate local-language name available.
• Installation name — English (I20) = Hindalco Industries Limited – Renukoot.
• Street, number (I21) = P.O. Renukoot, Industrial Area — standard postal address for the smelter complex.
• Economic activity (I22) = Aluminium smelting and casting — plant scope (potroom, cast house, carbon plant, FRP, extrusion).
• Post code (I23) = 231217 — Renukoot, Sonbhadra district PIN.
• P.O. Box — blank; full street address provided instead.
• City (I25) = Renukoot, Sonbhadra.
• Country (I26) = India — required as full English name (template MATCH(I26, CNTR_ListCountriesName, 0) lookup).
• UNLOCODE (I27) = INRNK — placeholder for Renukoot UN/LOCODE; user should verify.
• Latitude (I28) = 24.215, Longitude (I29) = 83.034 — approximate coordinates of the main potroom emission source.
• Authorised representative — name (I30) = Atul Sharma. The Renukoot working file's compare/Factors tabs cite "Final figures from CBAM sheet (Mr Atul Sharma)".
• Authorised representative — email (I31) = atul.sharma@adityabirla.com — standard Aditya Birla / Hindalco corporate email pattern; user should verify.
• Authorised representative — phone (I32) = +91-5446-252101 — Renukoot plant general contact number; user should verify.`,

  "A.3": `Verifier of the report — entire section left blank.

Verification is not required during the transitional period (Oct-2023 → Dec-2025). The reporting declarant can fill this in if a verifier is later engaged.`,

  "A.4": `Aggregated goods categories & production routes. Two CBAM-listed goods are produced in the installation.

• G1 — Unwrought aluminium / Primary (electrolytic) smelting (E62/G62). Renukoot is a Hall-Héroult prebake smelter with no secondary remelt feed for the unwrought stream. Covers ingots, slabs, billets, wire rod (CN 7601, 7605).
• G2 — Aluminium products / All production routes (E63/G63). "Aluminium products" has only one defined route in the EU constants. Covers FRP and extrusions (CN 7604, 7606+).`,

  "A.5": `Purchased precursors — section left empty.

Renukoot is fully integrated for relevant CBAM precursors:
• Anodes are produced internally (HIL Anodes carbon plant) — captured as on-site process emissions in B.1.
• Alumina is produced internally (Renukoot alumina plant) and is not a CBAM good.

There are therefore no precursors produced outside the installation.`,

  "B.1": `Calculation-based source streams (excluding PFC). 14 source streams entered (rows 17–30). For every stream the activity data, NCV, EF, oxidation factor and biomass content come directly from the corresponding Renukoot tab. Oxidation factor defaults to 100 % for every stream except CPP/Cogen coal (98 %, per CEA). Conversion factor and carbon content cells are left at template defaults (100 %).

• Row 17 — Coal (CPP), Combustion: AD 4,499,139 t; NCV 16.43 GJ/t; EF 90.6 tCO₂/TJ × 0.98 OxF. Source: Emission Intensity CPP CY25 rows 16–17 (4.499 Mt at 3,925 kCal/kg = 16.43 GJ/t); CEA EF + 0.98 oxidation.
• Row 18 — HSD (CPP & smelter aux), Combustion: AD 1,438 t; NCV 45.86 GJ/t; EF 73.30 tCO₂/TJ. 1,745 KL × density 0.8237 = 1,438 t (rows 24–26 same tab); GCV 10,955 kCal/kg → 45.86 GJ/t.
• Row 19 — Wood pellets (CPP biomass), Combustion: AD 706.51 t; NCV 16.0 GJ/t; EF 100 tCO₂/TJ, 100 % bio. Emission Intensity CPP CY25 row 20. EF 0.04824 t/t × inverse NCV.
• Row 20 — Coal (Cogen / CHP), Combustion: AD 651,037 t; NCV 14.61 GJ/t; EF 90.6 tCO₂/TJ × 0.98. Cogen CY25 row 3 (651,037 t); GCV 3,491 kCal/kg → 14.61 GJ/t.
• Row 21 — HSD (Cogen), Combustion: AD 321 t; NCV 45.0 GJ/t; EF 73.30 tCO₂/TJ. 382 KL × density 0.84 (Cogen CY25 rows 5–7).
• Row 22 — Biomass briquettes (Cogen), Combustion: AD 1,535 t; NCV 14.31 GJ/t; EF 100 tCO₂/TJ, 100 % bio. Cogen CY25 rows 8–9.
• Row 23 — LSHS / HFO (Anode bake furnace), Combustion: AD 13,338 t; NCV 40.4 GJ/t; EF 79.91 tCO₂/TJ. Carbon-HIL Anodes FY25 rows 12–13 (14,381 KL × density 0.927).
• Row 24 — LSHS / HFO (Cast House), Combustion: AD 12,011.7 t; NCV 40.4 GJ/t; EF 79.91 tCO₂/TJ. cold metal CY25 row 4 (total LSHS in cast house).
• Row 25 — Propane (Cast House), Combustion: AD 637.3 t; NCV 46.4 GJ/t; EF 56.10 tCO₂/TJ. gas cons CY25 rows 3–9 (extrusion + slab/billet casting propane).
• Row 26 — LPG (Cast House / Wire rod / DC slab), Combustion: AD 22.99 t; NCV 47.3 GJ/t; EF 63.10 tCO₂/TJ. gas cons CY25 rows 12–17 (cylinder counts × 47.5 kg).
• Row 27 — Net Anode Consumption (Smelter, prebake), Process emissions: AD 175,418 t; EF 3.557 tCO₂/t (= 624,134 ÷ 175,418). Hot Metal-Potroom CY25 row 28; IPCC 2006 Eq. 4.21 — ECO₂(AO).
• Row 28 — Pitch volatiles (anode baking), Process emissions: AD 231,654 t green anode; EF 0.18162 tCO₂/t. Carbon-HIL Anodes FY25 rows 47, 51; IPCC 2006 Eq. 4.22.
• Row 29 — Bake-furnace packing material (coke), Process emissions: AD 218,644 t baked anode; EF 0.05062 tCO₂/t. Carbon-HIL Anodes FY25 rows 22, 40; IPCC 2006 Eq. 4.23.
• Row 30 — Soda Ash (Na₂CO₃), Process emissions: AD 1,447 t; EF 0.415 tCO₂/t. Hot Metal-Potroom CY25 rows 36, 48 — CBAM guide page 250.`,

  "B.2": `PFC (perfluorocarbon) emissions. One row entered (row 98). Only Renukoot's primary potline contributes PFC.

• Method (D98) = Slope method — the Renukoot working file uses IPCC Tier-2 slope methodology (AEM × Slope EF).
• Technology (E98) = CWPB (Centre Worked Pre-Bake) — technology installed at Renukoot potlines.
• Aluminium produced (F98) = 407,602.44 t — Hot Metal-Potroom CY25 row 5 (Hot Metal Production).
• AE frequency (AG98) = 0.1520 AE/cell-day — same tab row 6 (AEF).
• AE duration (AH98) = 2.0594 min/AE — same tab row 7 (AED).
• Slope CF₄ (AI98) = 0.122 (kgCF₄/tAl)/(min/cell-day) — IPCC 2006 Ch.4 Table 4.16.
• F (C₂F₆/CF₄) (AM98) = 0.097 (t C₂F₆/t CF₄) — IPCC 2006 Ch.4 Table 4.16.
• GWP CF₄ (AP98) = 6,630 — AR5 GWP, working file row 46.
• GWP C₂F₆ (AQ98) = 11,100 — AR5 GWP, working file row 47.
• Collection efficiency (AT98) = blank — the template formula divides by AT98; leaving it blank uses divisor 1, giving the gross PFC release (no end-of-pipe abatement).

The template auto-computes 15.57 t CF₄ + 1.51 t C₂F₆ → 119,972 tCO₂e, which matches the working file exactly.`,

  "B.3": `Measurement-based emission sources — section left empty.

Renukoot does not use a Continuous Emission Monitoring System (CEMS) for any stack at the installation; all emissions are calculated.`,

  "C.1": `Fuel balance (TJ) — section left empty.

All four sub-fields (direct CBAM fuel, electricity production fuel, direct non-CBAM fuel, rest) auto-populate from Sheet B aggregates.`,

  "C.2": `GHG balance (tCO₂e).

• Total CO₂ emissions (H26) — auto-pulled from Sheet B SUMIFS. Calculated value 8,170,135 tCO₂.
• Biomass emissions (I26) — auto-pulled. Calculated 3,327 tCO₂.
• Total N₂O emissions (J26) — auto = 0. No N₂O sources at the smelter.
• Total PFC emissions (K26) — auto-pulled. Calculated 119,972 tCO₂e (matches PFC block).
• Total direct emissions (L26) — auto. Sum of the above = 8,290,107 tCO₂e.
• Total indirect emissions (M26) = 6,304,777 tCO₂e — manual entry required. = 6,154,274 (smelter electrical, Hot Metal-Potroom CY25 row 31) + 40,320 (cast-house indirect, Summary- Emission CY25 row 32) + 110,183 (grid Scope-2, row 44).`,

  "C.3": `Data quality & quality assurance — section left empty.

No deviations from CBAM default approach; quality-assurance text is optional during the transitional period.`,

  "D.1": `Per-process production & attributed emissions. Two rows entered (P1 and P2 — bubble approach for downstream FRP + Extrusion).

P1 — Unwrought aluminium (block at rows 11–72)
• Aggregated good (L11) = Unwrought aluminium — auto-pulled from A.4 G1.
• Output Route 1 (L16) = 407,602.44 t — Hot Metal-Potroom CY25 row 5.
• Total production (L24) — auto. Sum of routes = 407,602.44.
• Produced for the market (L27) = 229,530 t — total minus internal consumption (407,602 − 178,072).
• Consumed in P2 (L32) = 178,072 t — 120,866 (FRP feedstock — outside material CY25 row 9) + 57,206 (Extrusion billet route — same tab row 18).
• Non-CBAM consumption (L41) = 0 — all internal consumption goes to CBAM goods (P2).
• Attributed direct emissions DirEm* (L54) = 782,148.15 tCO₂e — Summary- Emission CY25 row 48 ("Direct attributed emission … up to cold metal excluding wire rod"). Includes smelter direct (744,707) + cold-metal direct (37,441) and inherently includes the carbon plant + PFC + soda ash sub-totals.
• Heat produced/consumed/imported/exported — blank. Renukoot does not import/export measurable heat across PP boundaries.
• Indirect-emissions relevant? (M50) = TRUE — Aluminium is indirect-relevant per CBAM Annex I.
• Electricity consumption (L65) = 5,884,634 MWh — Smelter Energy Balance CY25 row 31 (Total MWh smelter, AC + DC + compressors).
• Electricity EF (L66) = 1.063084 tCO₂/MWh — Elect. Emission Factor CY25 D10 (Combined CPP + Cogen + Grid factor).
• Electricity source method (L67) = "EF of electricity produced in the installation other than by cogeneration" — majority of supply is from CPP, a non-cogeneration unit.

P2 — Aluminium products (block at rows 76–140)
• Aggregated good (L76) = Aluminium products — auto-pulled from A.4 G2.
• Output Route 1 (L81) = 113,624 t — 78,331 (FRP, FRP CY25 C6) + 35,292 (Extrusion, Extrusion CY25 D6).
• Produced for the market (L92) = 113,624 t — all FRP / extrusion is sold; no further internal consumption.
• Precursor (UA) consumed in P2 (L97) = 178,072 t — mirrors P1 L32 so the mass-balance control sums to zero.
• Attributed direct emissions DirEm* (L119) = 4,333 tCO₂e — additional direct emissions for cold-mill / extrusion (LSHS for FRP processing + propane for extrusion presses). LSHS used in cast house is already in P1's DirEm*.
• Electricity consumption (L130) = 93,408 MWh — 71,408 (FRP cold-mill, slab casting, caster, rolled mill) + 22,000 (extrusion press + billet casting).
• Electricity EF (L131) = 1.063084 tCO₂/MWh — same combined factor as P1.
• Electricity source method (L132) = "EF of electricity produced in the installation other than by cogeneration" — same as P1.

The template's input-output matrix then propagates UA's emissions into Aluminium products via the CBAM mass-share precursor logic (Annex IV).`,

  "E.1": `Purchased precursors SEE — section left empty.

As noted in A.5, Renukoot is fully integrated:
• Anodes — produced internally (HIL carbon plant); their emissions are captured as B.1 process streams.
• Alumina — produced internally (raw material, not a CBAM good).

No row is therefore required in this sheet.`,

  "F.1": `Cogeneration (CHP) allocation — section left empty.

Although Renukoot operates a Cogen unit (Cogen CY25), its emissions and electricity output are already individually accounted for in Sheet B (coal, HSD, biomass briquettes) and the combined electricity EF used in Sheet D. Running the in-template CHP allocation tool would double-count.`,

  "F.2": `Carbon price due — section left empty.

India had no operative carbon-pricing instrument for aluminium during FY24-25 (CCTS for industrial sectors begins in 2026). No carbon price, rebate, currency or amount is applicable.`,

  "G.1": `Methodology notes & assumptions — section left empty in the spreadsheet.

Methodology notes are captured in the companion CBAM_Template_Explanation.md instead of free-text inside the template. Key choices to note for the reporting declarant:
• Hot metal production (407,602 t) used as the activity level for unwrought aluminium, consistent with the working file's SEE denominators.
• FRP and Extrusion bubbled into a single P2 because both are "Aluminium products" with similar SEE.
• LSHS consolidated into two rows (Anode bake furnace vs. Cast house) rather than per-area lines, to keep the source-stream count manageable.`,

  "SP.1": `Products by CN code. Six rows entered covering the main CBAM-relevant CN sub-codes shipped from Renukoot.

• Row 10 — CN 76011090 / P1 Unwrought aluminium. Aluminium, not alloyed, unwrought (excl. slabs). Covers EC-grade ingots.
• Row 11 — CN 76012040 / P1 Unwrought aluminium. Unwrought aluminium alloys, in form of billets — Renukoot Billet route.
• Row 12 — CN 76012080 / P1 Unwrought aluminium. Unwrought aluminium alloys (excl. slabs/billets) — covers alloy ingots/slabs.
• Row 13 — CN 76051100 / P1 Unwrought aluminium. Wire of non-alloy aluminium, > 7 mm — Properzi wire-rod product.
• Row 14 — CN 76061230 / P2 Aluminium products. Aluminium Composite Panel of aluminium alloys (> 0.2 mm) — main FRP class.
• Row 15 — CN 76042910 / P2 Aluminium products. Bars and rods of aluminium alloys — main extrusion class.

Notes:
• Older CBAM workings cite codes 76011000 / 76012010 / 76012020. The EU has since refined the sub-codes; the current valid codes (above) are used.
• SEE direct, SEE indirect and SEE total columns auto-populate from D.1 via the InputOutput matrix.
• Share-from-defaults / scrap / non-aluminium-elements / pre-consumer-scrap columns are left blank — Renukoot uses primary metal with no recycled feedstock declared.
• Carbon-price columns (AL–BA) are left blank — no carbon price applies (see F.2).`,

  "SC.1": `Installation snapshot — all five fields auto-populate from Section A entries (the sheet uses formulas referencing A_InstData). No manual entry was required.`,

  "SC.2": `Emissions by methodology (tCO₂e) — all four fields auto-populate from Sheet C/B aggregates.

• Calculation-based (excl. PFC) ≈ 8,170,135 tCO₂.
• Total PFC = 119,972 tCO₂e.
• Measurement-based = 0 (no CEMS).
• Other = 0.`,

  "SC.3": `Carbon price & additional information — left empty, consistent with F.2 (no carbon price applies to Renukoot).`,
};
