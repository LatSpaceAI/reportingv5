-- =============================================================================
-- BRSR GAP METRICS — the outputs the BRSR questionnaire asks for and the model
-- could not answer.
--
-- FOR REVIEW. Every constant seeded here carries is_assumption = true and a
-- PLACEHOLDER value. Nothing in this file is a disclosure until the ESG team
-- supplies the real figures at /settings/constants. Applying it makes the gaps
-- computable and visible; it does not make them true.
--
-- Four gaps, found by mapping brsrSections.ts against the output catalogue:
--
--   1. TOTAL ENERGY EXCLUDES FUEL.  en.energy_total_gj is
--      'out:en.electricity_total * const:CONV.kwh_to_gj' (07_formulas_seed.sql:76)
--      — electricity only. BRSR C.P6.E1 asks for "Total energy consumption
--      (A+B+C)" where B is fuel. Diesel and petrol are held in kL and never
--      converted to energy, because no calorific value exists in esg.constant
--      (02_constants_seed.sql:79-84 holds only SI conversions). So both the
--      fuel line and the total line are unanswerable today.
--
--   2. NO INTENSITY RATIOS.  BRSR asks for intensity per rupee of turnover in
--      C.P6.E1, E3, E6 and L4 — eight cells. output_parameter.is_intensity
--      exists (01_schema.sql:377) and no row sets it, because there is no
--      turnover anywhere in the model.
--
--   3. FOUR WASTE LINES REPORT ZERO.  used oil and coolant are filed in litres,
--      oil filters and batteries as counts, against MT-denominated BRSR lines.
--      Seeded as literal '0' with is_assumption = true
--      (07_formulas_seed.sql:200-211). The inputs exist; only the conversion
--      factors are missing.
--
--   4. THE WASTE TOTAL IS UNDERSTATED.  wst.total_generated
--      (07_formulas_seed.sql:215) sums eight categories and omits used oil,
--      batteries and oil filters — because they were zero, so including them
--      changed nothing. Once (3) is fixed they must be added, or the BRSR total
--      stays wrong in a way that now has a magnitude.
--
-- RUN AFTER 07_formulas_seed.sql. The dependency-regeneration block at the foot
-- of this file is mandatory: esg.formula_dependency has no trigger and is a
-- hand-refreshed cache of the expressions (see src/lib/esgConstants/graph.ts:8).
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- CATEGORY — turnover is not a unit conversion.
--
-- esg.constant.category is a FK to esg.constant_category (01_schema.sql:127),
-- which seeds only EF_GRID / EF_FUEL / GWP_REFRIG / CONVERSION. Filing an
-- audited financial figure under "unit conversion factor" would bury the one
-- constant here with the widest blast radius among the millilitre conversions.
-- -----------------------------------------------------------------------------
insert into esg.constant_category (code, name) values
    ('FINANCIAL', 'Financial figure (turnover, capex) - denominator of intensity ratios')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- CONSTANTS — all placeholders, all flagged.
--
-- Net calorific values are given per kilolitre because that is the unit the
-- fuel outputs already carry (en.diesel_stationary and friends are 'kL').
-- Indicative values below are IPCC 2006 defaults at typical density; they are
-- starting points for the ESG team, not sourced figures for this portfolio.
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('NCV.diesel', 'CONVERSION', 'Net calorific value - diesel', 38.6, 'GJ/kL',
 'PLACEHOLDER - IPCC 2006 default, 43.0 GJ/t at 0.898 t/kL', true,
 'REVIEW REQUIRED. Feeds en.fuel_energy_gj and therefore BRSR C.P6.E1 rows 1 and 3. Replace with the factor the ESG team assures against.'),

('NCV.petrol', 'CONVERSION', 'Net calorific value - petrol', 32.2, 'GJ/kL',
 'PLACEHOLDER - IPCC 2006 default, 44.3 GJ/t at 0.727 t/kL', true,
 'REVIEW REQUIRED. Feeds en.fuel_energy_gj.'),

('DENS.used_oil', 'CONVERSION', 'Density - used oil', 0.9, 'MT/kL',
 'PLACEHOLDER - typical mineral lubricating oil', true,
 'REVIEW REQUIRED. Converts waste.used_oil (filed in L) to the MT BRSR waste line. Resolves open item 3 in BIRLA_ESTATES.md.'),

('DENS.coolant_oil', 'CONVERSION', 'Density - HVAC coolant oil', 0.9, 'MT/kL',
 'PLACEHOLDER - assumed as used oil pending a specification', true,
 'REVIEW REQUIRED. waste.coolant_oil is filed in L. NOTE: no BRSR waste output currently consumes this input at all — decide whether coolant oil belongs in other-hazardous before wiring it.'),

('WT.oil_filter', 'CONVERSION', 'Average unit weight - oil filter', 0.0015, 'MT/unit',
 'PLACEHOLDER - 1.5 kg per spent filter', true,
 'REVIEW REQUIRED. waste.oil_filters_no is filed as a count. The published FY25 template shows 0.03 MT for Q3 with no derivable basis; 20 filters at this weight would reproduce it, which is a coincidence to check rather than evidence.'),

('WT.battery', 'CONVERSION', 'Average unit weight - battery', 0.025, 'MT/unit',
 'PLACEHOLDER - 25 kg, a mid-size lead-acid unit', true,
 'REVIEW REQUIRED. waste.battery_no is filed as a count and battery mass varies by an order of magnitude across types. If sites discard mixed types this needs a weighted average, or the form needs a weight column.'),

('FIN.turnover', 'FINANCIAL', 'Turnover for the reporting year', 1, 'INR',
 'PLACEHOLDER - MUST BE SET FROM AUDITED FINANCIALS', true,
 'REVIEW REQUIRED, AND THE MOST CONSEQUENTIAL ENTRY HERE. Denominator of every BRSR intensity ratio. Left at 1 deliberately: a wrong turnover yields a plausible-looking intensity, whereas 1 yields an obviously absurd one. NOTE THE GRAIN PROBLEM - this is a single scalar but the resolver evaluates per site-month, so monthly intensities computed against an annual turnover are meaningless. Only the (GROUP, YTD) intensity figures should be disclosed; see the note on the intensity formulas below.');

-- -----------------------------------------------------------------------------
-- OUTPUT PARAMETERS
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, is_intensity, frequency, sort_order, notes) values
('en.fuel_energy_gj', 'ENERGY', null, 'Fuel energy consumption', 'GJ', false, 'monthly', 165,
 'BRSR C.P6.E1 row 2, "Total fuel consumption (B)". Diesel and petrol converted from kL to GJ. Did not exist: the fuel outputs stop at volume.'),

('en.intensity_turnover', 'ENERGY', null, 'Energy intensity per rupee of turnover', 'GJ/INR', true, 'annual', 180,
 'BRSR C.P6.E1 row 5. Meaningful only at (GROUP, YTD).'),

('wtr.intensity_turnover', 'WATER', null, 'Water intensity per rupee of turnover', 'KL/INR', true, 'annual', 290,
 'BRSR C.P6.E3 row 8. Meaningful only at (GROUP, YTD).'),

('ghg.intensity_turnover', 'EMISSIONS', null, 'Scope 1 + Scope 2 intensity per rupee of turnover', 'tCO2e/INR', true, 'annual', 640,
 'BRSR C.P6.E6 row 3. Meaningful only at (GROUP, YTD).');

-- -----------------------------------------------------------------------------
-- FORMULAS — new
--
-- EVAL_ORDER IS LOad-BEARING AND THERE IS NO TOPOLOGICAL SORT.
-- resolve-birla.mjs:211-212 sorts by (eval_order, output_key) — nothing more.
-- So eval_order must STRICTLY INCREASE along every dependency edge; a formula
-- sharing a tier with something it reads resolves against a stale or absent
-- value, silently, and only for some alphabetical orderings.
--
--   en.fuel_energy_gj      25  reads the fuel outputs (10)
--   en.energy_total_gj     30  reads en.electricity_total (20) + fuel (25)
--   the *_recycled pairs   20  read their *_generated (10)
--   wst.total_generated    30  reads every *_generated (10)
--   the three intensities  90  read totals (30) and ghg.total (60)
--
-- 25 rather than 20 for fuel energy: at 20 it would tie with
-- en.electricity_total and resolve correctly only because 'e' sorts before 'f'.
-- Correct by accident is not correct.
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('en.fuel_energy_gj',
 'out:en.diesel_stationary * const:NCV.diesel + out:en.diesel_mobile * const:NCV.diesel + out:en.petrol * const:NCV.petrol',
 'Fuel energy in gigajoules. Stationary and mobile diesel share a calorific value and are summed separately only because the BRSR combustion split is preserved upstream.',
 'BRSR C.P6.E1 row 2', 'all', 25, true),

-- WHY THESE ARE is_assumption AND annual-only:
-- The resolver evaluates every formula per site-month (resolve-birla.mjs:274),
-- so these will produce a row for every site-month, each dividing a monthly
-- figure by an ANNUAL turnover. Those rows are arithmetic noise. Only the
-- (GROUP, YTD) row is a disclosure. frequency = 'annual' records that, but
-- nothing enforces it — the exporter and any requirement binding must select
-- the YTD period explicitly.
('en.intensity_turnover',
 'IFERROR(out:en.energy_total_gj / const:FIN.turnover, 0)',
 'Energy intensity per rupee of turnover. Disclose the (GROUP, YTD) value only.',
 'BRSR C.P6.E1 row 5', 'all', 90, true),

('wtr.intensity_turnover',
 'IFERROR(out:wtr.consumption / const:FIN.turnover, 0)',
 'Water intensity per rupee of turnover, on consumption per the BRSR definition. Disclose the (GROUP, YTD) value only.',
 'BRSR C.P6.E3 row 8', 'all', 90, true),

('ghg.intensity_turnover',
 'IFERROR(out:ghg.total / const:FIN.turnover, 0)',
 'Scope 1 + Scope 2 intensity per rupee of turnover. Disclose the (GROUP, YTD) value only.',
 'BRSR C.P6.E6 row 3', 'all', 90, true);

-- -----------------------------------------------------------------------------
-- FORMULAS — revised
--
-- esg.formula has a UNIQUE constraint on output_key (01_schema.sql:451), so
-- these are updates, not inserts.
-- -----------------------------------------------------------------------------

-- (1) Total energy now includes fuel. This is the line BRSR actually asks for.
update esg.formula set
    expression  = 'out:en.electricity_total * const:CONV.kwh_to_gj + out:en.fuel_energy_gj',
    description = 'Total energy in gigajoules: electricity plus fuel. Previously electricity only, which understated the BRSR total energy line by the whole of fuel.',
    eval_order  = 30,
    is_assumption = true
where output_key = 'en.energy_total_gj';

-- (3) The four waste lines that reported zero.
update esg.formula set
    expression  = 'in:waste.used_oil * const:CONV.l_to_kl * const:DENS.used_oil',
    description = 'Used oil, litres converted to MT via density.',
    is_assumption = true
where output_key = 'wst.used_oil_generated';

update esg.formula set
    expression  = 'out:wst.used_oil_generated',
    description = 'Used oil is recycled in full, matching the treatment of the other recovered streams.',
    eval_order  = 20,
    is_assumption = true
where output_key = 'wst.used_oil_recycled';

update esg.formula set
    expression  = 'in:waste.battery_no * const:WT.battery',
    description = 'Battery waste, unit count converted to MT via average unit weight.',
    is_assumption = true
where output_key = 'wst.battery_generated';

update esg.formula set
    expression  = 'out:wst.battery_generated',
    description = 'Batteries are recycled in full.',
    eval_order  = 20,
    is_assumption = true
where output_key = 'wst.battery_recycled';

update esg.formula set
    expression  = 'in:waste.oil_filters_no * const:WT.oil_filter',
    description = 'Oil filters, unit count converted to MT via average unit weight.',
    is_assumption = true
where output_key = 'wst.oil_filters_generated';

update esg.formula set
    expression  = 'out:wst.oil_filters_generated',
    description = 'Oil filters are incinerated in full.',
    eval_order  = 20,
    is_assumption = true
where output_key = 'wst.oil_filters_incinerated';

-- (4) The waste total, now that the three streams above are non-zero.
-- Adding them CHANGES A PUBLISHED-EQUIVALENT FIGURE. It was correct to omit
-- them while they were zero; it is wrong to keep omitting them now.
update esg.formula set
    expression  = 'out:wst.cnd_generated + out:wst.plastic_generated + out:wst.municipal_generated + out:wst.food_generated + out:wst.biomedical_generated + out:wst.cotton_rags_generated + out:wst.other_haz_generated + out:wst.ewaste_generated + out:wst.used_oil_generated + out:wst.battery_generated + out:wst.oil_filters_generated',
    description = 'Total waste generated across all categories, including used oil, batteries and oil filters — previously excluded because they resolved to zero.',
    is_assumption = true
where output_key = 'wst.total_generated';

-- =============================================================================
-- DEPENDENCY INDEX — regenerate. MANDATORY.
--
-- Character-for-character the block at 07_formulas_seed.sql:284-293, whose
-- regex is mirrored in src/lib/esgConstants/graph.ts:23. formula_dependency has
-- no trigger; skipping this leaves the blast radius UNDER-reporting, which is
-- the failure direction that feature exists to prevent.
-- =============================================================================
delete from esg.formula_dependency;

insert into esg.formula_dependency (formula_id, ref_kind, ref_key)
select distinct
       f.id,
       case m[1] when 'in' then 'input' when 'const' then 'constant' else 'output' end,
       m[2]
from   esg.formula f,
       lateral regexp_matches(f.expression, '(in|const|out):([A-Za-z0-9_.]+)', 'g') as m
on conflict do nothing;

-- =============================================================================
-- VALIDATION — both must return zero rows, then re-run the resolver.
-- =============================================================================
-- select * from esg.v_formula_missing_refs;
-- select * from esg.v_formula_dag_edges;   -- inspect: must be acyclic
--
--   npm run esg:resolve
--
-- EXPECT THESE FIGURES TO MOVE: en.energy_total_gj (up, by all fuel energy),
-- wst.total_generated (up), and the three waste streams above (off zero).
-- Tests asserting the old values will fail — read BIRLA_ESTATES.md "Corrections"
-- before treating a failure as a bug.
--
-- IFERROR NOTE: these are the FIRST seeded expressions to use a function. The
-- evaluator supports IF/IFERROR/MAX/MIN/SUM (scripts/lib/formula-eval.mjs:77)
-- but until now every expression was pure arithmetic, so this path is untested
-- against real data. Verify the intensity rows resolve before trusting them.
-- =============================================================================
