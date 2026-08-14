-- =============================================================================
-- BIRLA ESTATES — BRSR CELL BINDINGS (Principle 6, Environment)
--
-- Wires BRSR disclosure cells to computed metrics. Cell ids come from
-- src/lib/quantitativeCells.ts and were read off the live schema, not guessed.
--
-- SCOPE: only cells where a metric answers the disclosure AS ASKED, in the
-- unit asked, at (GROUP, YTD). Everything else is left unbound ON PURPOSE and
-- listed at the foot of this file with the reason. An unbound cell asks a human
-- for a number; a wrongly-bound cell answers with the wrong one, and nobody
-- looks at it again.
--
-- BOTH FY COLUMNS ARE BOUND. BRSR tables are current-FY / previous-FY pairs;
-- year_offset 0 and -1 select the year, and the resolver has FY24 and FY25 YTD
-- rows for both. Previous-FY bindings will be thin — FY24 has Aurora only.
--
-- COVERAGE, ALWAYS. Every figure these bindings surface is a sum of the
-- returns actually filed: 8 of 77 FY25 site-months. The cell shows a number;
-- the drilldown shows what is behind it. Do not let the first exist without
-- the second.
--
-- Apply after 19_report_binding.sql.
-- =============================================================================

set search_path = esg, public;

-- Idempotent: re-running re-points rather than duplicating.
insert into esg.report_binding
    (framework_id, quant_cell_id, output_key, site_code, period_kind, year_offset, cell_label, note, bound_by)
values

-- ---------------------------------------------------------------------------
-- C.P6.E1 — Total energy consumption
--
-- r0 (electricity) is NOT bound to en.electricity_total: the table is
-- denominated in joules and that metric is kWh. en.energy_total_gj already
-- folds electricity in at the right unit, so binding r0 would state kWh where
-- the form says GJ. A dedicated en.electricity_gj would fix it; until then r0
-- stays manual.
-- ---------------------------------------------------------------------------
('brsr','C.P6.E1.r1.currentFY','en.fuel_energy_gj','GROUP','ytd',0,
 'Total fuel consumption (B)',
 'Diesel and petrol converted at NCV. Both factors are unconfirmed assumptions.','seed'),
('brsr','C.P6.E1.r1.previousFY','en.fuel_energy_gj','GROUP','ytd',-1,
 'Total fuel consumption (B)',null,'seed'),

('brsr','C.P6.E1.r3.currentFY','en.energy_total_gj','GROUP','ytd',0,
 'Total energy consumption (A+B+C)',
 'Electricity converted at 0.0036 GJ/kWh plus fuel at NCV. Revised by 17_brsr_gap_metrics.sql — was electricity-only.','seed'),
('brsr','C.P6.E1.r3.previousFY','en.energy_total_gj','GROUP','ytd',-1,
 'Total energy consumption (A+B+C)',null,'seed'),

('brsr','C.P6.E1.r4.currentFY','en.intensity_turnover','GROUP','ytd',0,
 'Energy intensity per rupee of turnover',
 'DENOMINATED PER CRORE, not per rupee — per rupee the ratio rounds to zero at the resolver 4dp precision. State the unit in the report.','seed'),
('brsr','C.P6.E1.r4.previousFY','en.intensity_turnover','GROUP','ytd',-1,
 'Energy intensity per rupee of turnover',null,'seed'),

-- ---------------------------------------------------------------------------
-- C.P6.E3 — Water withdrawal, consumption, intensity
-- The one block that maps cleanly end to end: five sources, total, consumption.
-- ---------------------------------------------------------------------------
('brsr','C.P6.E3.r0.currentFY','wtr.surface','GROUP','ytd',0,
 'Water withdrawal — (i) Surface water (kL)','No site reports surface water; expect a filed zero.','seed'),
('brsr','C.P6.E3.r0.previousFY','wtr.surface','GROUP','ytd',-1,
 'Water withdrawal — (i) Surface water (kL)',null,'seed'),

('brsr','C.P6.E3.r1.currentFY','wtr.groundwater','GROUP','ytd',0,
 'Water withdrawal — (ii) Groundwater (kL)',
 'Stored as filed. The published FY25 consolidation reclassified Tisya Apr-24 groundwater as third-party; ours does not, and the inconsistency is flagged rather than encoded.','seed'),
('brsr','C.P6.E3.r1.previousFY','wtr.groundwater','GROUP','ytd',-1,
 'Water withdrawal — (ii) Groundwater (kL)',null,'seed'),

('brsr','C.P6.E3.r2.currentFY','wtr.third_party','GROUP','ytd',0,
 'Water withdrawal — (iii) Third-party water (kL)',
 'Municipal + tanker + drinking. The drinking-water consolidation is an assumption.','seed'),
('brsr','C.P6.E3.r2.previousFY','wtr.third_party','GROUP','ytd',-1,
 'Water withdrawal — (iii) Third-party water (kL)',null,'seed'),

('brsr','C.P6.E3.r3.currentFY','wtr.seawater','GROUP','ytd',0,
 'Water withdrawal — (iv) Seawater / desalinated water (kL)',null,'seed'),
('brsr','C.P6.E3.r3.previousFY','wtr.seawater','GROUP','ytd',-1,
 'Water withdrawal — (iv) Seawater / desalinated water (kL)',null,'seed'),

('brsr','C.P6.E3.r4.currentFY','wtr.treated','GROUP','ytd',0,
 'Water withdrawal — (v) Others (kL)',
 'Treated STP water, tanker-delivered treated water and rainwater. BRSR (v) Others is where treated water belongs as a withdrawal SOURCE.','seed'),
('brsr','C.P6.E3.r4.previousFY','wtr.treated','GROUP','ytd',-1,
 'Water withdrawal — (v) Others (kL)',null,'seed'),

('brsr','C.P6.E3.r5.currentFY','wtr.total','GROUP','ytd',0,
 'Total volume of water withdrawal (kL) (i+ii+iii+iv+v)',null,'seed'),
('brsr','C.P6.E3.r5.previousFY','wtr.total','GROUP','ytd',-1,
 'Total volume of water withdrawal (kL) (i+ii+iii+iv+v)',null,'seed'),

('brsr','C.P6.E3.r6.currentFY','wtr.consumption','GROUP','ytd',0,
 'Total volume of water consumption (kL)',
 'Withdrawal minus discharge. Discharge is zero across the pack: STP water is recycled on site.','seed'),
('brsr','C.P6.E3.r6.previousFY','wtr.consumption','GROUP','ytd',-1,
 'Total volume of water consumption (kL)',null,'seed'),

('brsr','C.P6.E3.r7.currentFY','wtr.intensity_turnover','GROUP','ytd',0,
 'Water intensity per rupee of turnover (Water consumed / turnover)',
 'DENOMINATED PER CRORE — see the energy intensity note.','seed'),
('brsr','C.P6.E3.r7.previousFY','wtr.intensity_turnover','GROUP','ytd',-1,
 'Water intensity per rupee of turnover (Water consumed / turnover)',null,'seed'),

-- ---------------------------------------------------------------------------
-- C.P6.E6 — Scope 1 and Scope 2
-- ---------------------------------------------------------------------------
('brsr','C.P6.E6.r0.currentFY','ghg.scope1_total','GROUP','ytd',0,
 'Total Scope 1 emissions (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3 if available) — Metric tonnes CO2e',
 'Diesel, petrol, refrigerant leakage and extinguisher CO2. Combustion factors are assumptions: 603.82 tCO2e against a published 589.11 (+2.5%).','seed'),
('brsr','C.P6.E6.r0.previousFY','ghg.scope1_total','GROUP','ytd',-1,
 'Total Scope 1 emissions (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3 if available) — Metric tonnes CO2e',null,'seed'),

('brsr','C.P6.E6.r1.currentFY','ghg.scope2_total','GROUP','ytd',0,
 'Total Scope 2 emissions — Metric tonnes CO2e',
 'Grid factor 0.727 is back-derived and reproduces published Scope 2 to 0.005 t — the one emission factor here that is not an assumption.','seed'),
('brsr','C.P6.E6.r1.previousFY','ghg.scope2_total','GROUP','ytd',-1,
 'Total Scope 2 emissions — Metric tonnes CO2e',null,'seed'),

('brsr','C.P6.E6.r2.currentFY','ghg.intensity_turnover','GROUP','ytd',0,
 'Total Scope 1 + Scope 2 emissions per rupee of turnover',
 'DENOMINATED PER CRORE — see the energy intensity note.','seed'),
('brsr','C.P6.E6.r2.previousFY','ghg.intensity_turnover','GROUP','ytd',-1,
 'Total Scope 1 + Scope 2 emissions per rupee of turnover',null,'seed'),

-- ---------------------------------------------------------------------------
-- C.P6.E8 — Waste by BRSR category
--
-- Only the categories where OUR stream is exactly the BRSR category. The rest
-- are aggregates we do not compute — see the unbound list below.
-- ---------------------------------------------------------------------------
('brsr','C.P6.E8.r0.currentFY','wst.plastic_generated','GROUP','ytd',0,
 'Plastic waste (A)',null,'seed'),
('brsr','C.P6.E8.r0.previousFY','wst.plastic_generated','GROUP','ytd',-1,
 'Plastic waste (A)',null,'seed'),

('brsr','C.P6.E8.r1.currentFY','wst.ewaste_generated','GROUP','ytd',0,
 'E-waste (B)',null,'seed'),
('brsr','C.P6.E8.r1.previousFY','wst.ewaste_generated','GROUP','ytd',-1,
 'E-waste (B)',null,'seed'),

('brsr','C.P6.E8.r2.currentFY','wst.biomedical_generated','GROUP','ytd',0,
 'Bio-medical waste (C)',null,'seed'),
('brsr','C.P6.E8.r2.previousFY','wst.biomedical_generated','GROUP','ytd',-1,
 'Bio-medical waste (C)',null,'seed'),

('brsr','C.P6.E8.r3.currentFY','wst.cnd_generated','GROUP','ytd',0,
 'Construction & demolition waste (D)',
 'Construction scrap consolidates into C&D — an assumption: BRSR has no scrap category.','seed'),
('brsr','C.P6.E8.r3.previousFY','wst.cnd_generated','GROUP','ytd',-1,
 'Construction & demolition waste (D)',null,'seed'),

('brsr','C.P6.E8.r4.currentFY','wst.battery_generated','GROUP','ytd',0,
 'Battery waste (E)',
 'Count times an assumed 25 kg unit weight. Every filed return to date marks batteries NA, so this is currently zero from absence, not from measurement.','seed'),
('brsr','C.P6.E8.r4.previousFY','wst.battery_generated','GROUP','ytd',-1,
 'Battery waste (E)',null,'seed')

on conflict (framework_id, quant_cell_id) do update set
    output_key  = excluded.output_key,
    site_code   = excluded.site_code,
    period_kind = excluded.period_kind,
    year_offset = excluded.year_offset,
    cell_label  = excluded.cell_label,
    note        = excluded.note,
    updated_at  = now();

-- =============================================================================
-- DELIBERATELY UNBOUND — and why. Each is a decision, not an omission.
--
-- C.P6.E1.r0  electricity (A)
--     en.electricity_total is kWh; the table is denominated in joules. Binding
--     it would print kWh under a GJ heading. Needs an en.electricity_gj.
--
-- C.P6.E1.r2 / L1.r2 / L1.r6  "energy through other sources"
--     No such input is collected. Genuinely blank, not missing.
--
-- C.P6.E1.r5, E6.r3, L4.r2  "(optional)" intensity rows
--     The entity chooses the denominator (per sqft, per unit sold). Nobody has.
--
-- C.P6.E5  air emissions (NOx, SOx, PM)
--     Metrics exist (air.*) but come from half-yearly stack monitoring, and no
--     data has ever been entered. Binding them would show a confident zero for
--     a pollutant nobody measured. Bind once the first report is loaded.
--
-- C.P6.E8.r5  radioactive waste
--     A real estate developer generates none. Leave to a human to write 0.
--
-- C.P6.E8.r6  Other Hazardous (G)
--     BRSR's "other hazardous" is an AGGREGATE — our used oil, oil filters,
--     cotton rags, coolant and diesel barrels all fall inside it. We have the
--     streams, not the aggregate. Needs a wst.other_hazardous_total.
--
-- C.P6.E8.r7  Other Non-hazardous (H)
--     Same shape: municipal + food + cotton rags. Needs an aggregate.
--
-- C.P6.E8.r8  Total (A+B+C+D+E+F+G+H)
--     wst.total_generated is close but NOT this sum: it excludes cotton rags
--     and other-hazardous stream membership is unsettled (r6). Binding a total
--     that disagrees with the visible rows above it is the one error a reviewer
--     always catches. Resolve r6/r7 first.
--
-- C.P6.E8.r9-r15  recovery and disposal
--     We compute recovery per STREAM (plastic recycled, C&D reused) but BRSR
--     asks for portfolio-wide recycled / re-used / other-recovery /
--     incinerated / landfilled / other-disposal. Six aggregates, none computed.
--
-- C.P6.L1  renewable / non-renewable split
--     en.electricity_renew and _nonrenew are kWh against a joules table — the
--     r0 problem again, twice. Also asks for renewable FUEL, which is nil.
--
-- C.P6.L2  water discharge by destination and treatment level
--     wtr.discharged is a single portfolio zero; the table wants ten
--     destination-by-treatment cells. A zero total does imply ten zeros, but
--     the destination breakdown is a claim about treatment infrastructure that
--     the model does not hold.
--
-- C.P6.L3  water withdrawal in stressed areas
--     wtr.ws_* exist and are correct. UNBOUND ONLY BECAUSE the cell ids were
--     not read off the schema for this block; bind them next, they are clean.
--
-- C.P6.L4.r0  total Scope 3
--     s3.total exists. Left unbound until the Scope 3 drilldown lands: Scope 3
--     outputs carry formula_id = null and come from the s3_line ledger, so a
--     drilldown keyed on formulas returns nothing for them. Binding a number
--     whose provenance the UI cannot show inverts the point of this feature.
-- =============================================================================
