-- =============================================================================
-- BIRLA ESTATES — FORMULAS registry
--
-- OUTPUT = f(INPUT, CONSTANT, OUTPUT), stored as parseable expressions using
-- namespaced tokens:
--     in:<input_parameter.key>    -> esg.input_value
--     const:<constant.key>        -> esg.constant.value
--     out:<output_parameter.key>  -> esg.output_value (chaining)
--
-- eval_order ascending gives a safe evaluation sequence: every out: reference
-- is computed before it is read.
--
-- site_filter restricts which sites contribute to a GROUP rollup:
--     'all'            every in-scope site (the default)
--     'water_stressed' only sites inside the declared stressed area
--
-- CLASSIFICATION RULES ENCODED HERE
-- These mirror the published consolidation as reconstructed in the Middle Link.
-- Where the published treatment is questionable, the formula reproduces it and
-- is_assumption is set so the app can flag it, rather than quietly "fixing" the
-- number and breaking the tie-out to prior-year disclosures.
--
-- Rules the ESG team should confirm (all carry is_assumption = true):
--   1. Construction scrap consolidates into C&D waste (no BRSR scrap category).
--   2. Drinking water consolidates into third-party water.
--   3. Aurora's tenant electricity is outside the entity boundary; its occupied
--      floors (Level 8 + Level 13) are inside.
--   4. DG diesel is stationary combustion; plant, machinery and vehicle diesel
--      is mobile. Supported by Sangamwadi Dec-24: site DG 2,000 L vs template
--      stationary 2,043 L (98%).
--   5. Extinguisher CO2 release is counted in Scope 1.
--
-- NOT encoded, deliberately: the 197,838.76 kWh renewable deduction. It has no
-- documented basis, so it enters through the explicit
-- in:elec.renewable_adjustment parameter where it is visible and attributable,
-- instead of being hidden inside an expression.
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- ENERGY  (eval_order 10-40)
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('en.diesel_stationary',
 'in:fuel.diesel_dg',
 'DG-set diesel. Stationary combustion by definition.',
 'Middle Link FORMULAS!C6', 'all', 10, true),

('en.diesel_mobile',
 'in:fuel.diesel_plant + in:fuel.diesel_vehicle',
 'Plant, machinery and vehicle diesel. Mobile combustion.',
 'Middle Link FORMULAS!C7', 'all', 10, true),

('en.petrol',
 'in:fuel.petrol',
 'Petrol, mobile combustion.',
 'Middle Link FORMULAS!C8', 'all', 10, false),

-- Aurora contributes its occupied floors; construction sites contribute their
-- site grid draw. Tenant electricity is deliberately absent.
('en.electricity_nonrenew',
 'in:elec.grid + in:elec.own_floor_1 + in:elec.own_floor_2',
 'Grid electricity of BEPL''s own operations. Excludes tenant consumption, which has been outside the entity boundary since FY24 per the Data Book footnote.',
 'Middle Link FORMULAS!C9', 'all', 10, true),

('en.electricity_renew',
 'in:elec.green + in:elec.renewable + in:elec.renewable_adjustment',
 'Green power purchases plus onsite renewables, plus any documented adjustment. The adjustment term exists so the unexplained 197,838.76 kWh FY25 deduction against Aurora''s reported green energy is visible and attributable rather than silently absorbed. It should be zero once the ESG team documents or withdraws that deduction.',
 'Middle Link FORMULAS!C10 + Reconciliation section 2', 'all', 10, true),

('en.electricity_total',
 'out:en.electricity_nonrenew + out:en.electricity_renew',
 'Total electricity consumption.',
 null, 'all', 20, false),

('en.energy_total_gj',
 'out:en.electricity_total * const:CONV.kwh_to_gj',
 'Total energy in gigajoules. BRSR asks for joules or multiples; the template converts kWh at 3,600,000 J.',
 'Template Environment!row 10-12', 'all', 30, false);

-- -----------------------------------------------------------------------------
-- WATER — withdrawal by source (eval_order 10-30)
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('wtr.surface',
 'in:water.surface',
 'Surface water withdrawal. No site currently reports any.',
 null, 'all', 10, false),

('wtr.groundwater',
 'in:water.groundwater',
 'Ground water withdrawal. NOTE: the published FY25 consolidation booked Tisya''s Apr-24 groundwater (1,396 KL) as third-party water while leaving Trimaya''s Feb-25 groundwater (52 KL) as groundwater. That inconsistency is a data-classification decision, not a formula one — it is raised as a flag rather than encoded here.',
 'Middle Link FORMULAS!C12', 'all', 10, false),

('wtr.third_party',
 'in:water.municipal + in:water.tanker + in:water.drinking',
 'Municipal supply, tanker water and drinking water.',
 'Middle Link FORMULAS!C13', 'all', 10, true),

('wtr.seawater',
 'in:water.seawater',
 'Seawater / desalinated withdrawal. None reported.',
 null, 'all', 10, false),

('wtr.treated',
 'in:water.treated_used + in:water.tanker_treated',
 'Treated water used at construction sites, including treated STP water delivered by tanker.',
 'Middle Link FORMULAS!C14', 'all', 10, false),

('wtr.total',
 'out:wtr.surface + out:wtr.groundwater + out:wtr.third_party + out:wtr.seawater + out:wtr.treated',
 'Total water withdrawal across all five BRSR sources.',
 'Middle Link FORMULAS!C15', 'all', 20, false),

('wtr.discharged',
 '0',
 'Zero throughout the reporting pack: STP water is recycled on site rather than discharged. Modelled as an explicit zero so the BRSR line has a formula rather than a blank.',
 'Template Environment!rows 40-54', 'all', 10, false),

('wtr.consumption',
 'out:wtr.total - out:wtr.discharged',
 'Withdrawal minus discharge, per the BRSR definition. The published template shows 0 here because its monthly cells were never filled; this computes the correct 167,508.58 KL for FY25.',
 'Reconciliation finding 3', 'all', 30, false);

-- -----------------------------------------------------------------------------
-- WATER — stressed areas. Identical arithmetic, restricted site set.
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('wtr.ws_groundwater',
 'in:water.groundwater',
 'Ground water withdrawn by sites inside the declared water-stressed area (Bengaluru and NCR).',
 'Middle Link FORMULAS!C18', 'water_stressed', 10, false),

('wtr.ws_third_party',
 'in:water.municipal + in:water.tanker + in:water.drinking',
 'Third-party water withdrawn by sites inside the stressed area.',
 'Middle Link FORMULAS!C19', 'water_stressed', 10, true),

('wtr.ws_treated',
 'in:water.treated_used + in:water.tanker_treated',
 'Treated water used by sites inside the stressed area.',
 'Middle Link FORMULAS!C20', 'water_stressed', 10, false),

('wtr.ws_total',
 'out:wtr.ws_groundwater + out:wtr.ws_third_party + out:wtr.ws_treated',
 'Total withdrawal in stressed areas.',
 'Middle Link FORMULAS!C21', 'water_stressed', 20, false),

('wtr.ws_discharged',
 '0',
 'Zero, as for the company-wide figure.',
 'Template Environment!rows 73-89', 'water_stressed', 10, false),

('wtr.ws_consumption',
 'out:wtr.ws_total - out:wtr.ws_discharged',
 'Stressed-area withdrawal minus discharge. The published template shows 82,478.18 KL from a SUM range that spans its own subtotal row and skips groundwater — roughly double the true 41,575.09 KL, which cannot exceed withdrawal.',
 'Reconciliation finding 3', 'water_stressed', 30, false);

-- -----------------------------------------------------------------------------
-- WASTE (eval_order 10-30)
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('wst.cnd_generated',
 'in:waste.cnd + in:waste.scrap',
 'C&D waste including construction scrap (rebar, steel, wood). BRSR has no scrap category, so the published consolidation folds it into C&D. Change this expression, not the underlying data, if the ESG team maps scrap elsewhere.',
 'Middle Link FORMULAS!C24', 'all', 10, true),

('wst.cnd_reused',
 'in:waste.cnd_reused',
 'C&D waste reused on site.',
 null, 'all', 10, false),

('wst.cnd_landfilled',
 'out:wst.cnd_generated - out:wst.cnd_reused',
 'C&D waste not reused is landfilled.',
 null, 'all', 20, false),

('wst.plastic_generated',  'in:waste.plastic',            'Plastic waste generated.',   'Middle Link FORMULAS!C25','all',10,false),
('wst.plastic_recycled',   'in:waste.plastic_recycled',   'Plastic waste recycled.',    null,'all',10,false),
('wst.municipal_generated','in:waste.municipal',          'Municipal solid waste generated.','Middle Link FORMULAS!C26','all',10,false),
('wst.municipal_recycled', 'in:waste.municipal_recycled', 'Municipal waste recycled.',  null,'all',10,false),
('wst.food_generated',     'in:waste.food',               'Food waste generated.',      'Middle Link FORMULAS!C27','all',10,false),
('wst.food_recycled',      'in:waste.food_recycled',      'Food waste recycled (onsite composting at Aurora).',null,'all',10,false),
('wst.biomedical_generated','in:waste.biomedical',        'Bio-medical waste generated.',null,'all',10,false),
('wst.biomedical_incinerated','in:waste.biomedical',      'Bio-medical waste is incinerated in full.',null,'all',10,true),
('wst.cotton_rags_generated','in:waste.cotton_rags',      'Cotton rags generated.',     null,'all',10,false),
('wst.cotton_rags_incinerated','in:waste.cotton_rags',    'Cotton rags are incinerated in full.',null,'all',10,true),
('wst.other_haz_generated','in:waste.paint_drums + in:waste.contaminated',
 'Other hazardous waste: paint drums and other contaminated waste. The published template''s Q2/Q3 cells for this line wrongly reference the cotton-rags row, so its published quarterly split duplicates cotton-rags values.',
 'Reconciliation finding 4','all',10,true),
('wst.other_haz_incinerated','out:wst.other_haz_generated','Other hazardous waste is incinerated in full.',null,'all',20,true),
('wst.ewaste_generated',   'in:waste.ewaste',             'Electronic waste generated.',null,'all',10,false);

-- Waste lines whose inputs are counts or litres, with no conversion to MT
-- available. Seeded as explicit zeros rather than left without a formula, so
-- the BRSR line resolves and the gap is documented instead of silent. Supply an
-- average unit weight (batteries, oil filters) or a density (used oil) and
-- these become real expressions.
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('wst.used_oil_generated','0',
 'Used oil is filed in LITRES; the BRSR line is in MT. Needs a density to convert. Until then this reports zero rather than a fabricated tonnage.',
 'Validation section 7','all',10,true),
('wst.used_oil_recycled','0','As above.',null,'all',10,true),
('wst.battery_generated','0',
 'Battery waste is filed as a COUNT of units; the BRSR line is in MT. Needs an average unit weight.',
 'Validation section 7','all',10,true),
('wst.battery_recycled','0','As above.',null,'all',10,true),
('wst.oil_filters_generated','0',
 'Oil filters are filed as a COUNT ("2 Nos"); the BRSR line is in MT. Needs an average unit weight. The published template shows 0.03 MT for Q3 with no derivable basis.',
 'Validation section 7','all',10,true),
('wst.oil_filters_incinerated','0','As above.',null,'all',10,true);

insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('wst.total_generated',
 'out:wst.cnd_generated + out:wst.plastic_generated + out:wst.municipal_generated + out:wst.food_generated + out:wst.biomedical_generated + out:wst.cotton_rags_generated + out:wst.other_haz_generated + out:wst.ewaste_generated',
 'Total waste generated across all categories.',
 null, 'all', 30, false);

-- -----------------------------------------------------------------------------
-- AIR EMISSIONS (half-yearly monitoring reports, not the monthly return)
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('air.nox_total','in:air.nox','NOx from half-yearly stack and DG monitoring reports.','Template Environment!row 94','all',10,false),
('air.sox_total','in:air.sox','SOx from half-yearly stack and DG monitoring reports.','Template Environment!row 95','all',10,false),
('air.pm_total', 'in:air.pm', 'Particulate matter from half-yearly monitoring.',      'Template Environment!row 96','all',10,false);

-- -----------------------------------------------------------------------------
-- REFRIGERANTS
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('rf.r404a','in:refrig.r404a','R404A refilled.','Template Environment!row 101','all',10,false),
('rf.r410a','in:refrig.r410a','R410A refilled.','Template Environment!row 102','all',10,false),
('rf.r407c','in:refrig.r407c','R407C refilled.','Template Environment!row 103','all',10,false),
('rf.r22',  'in:refrig.r22',  'R22 refilled. Disclosed as a quantity; excluded from Scope 1 as a Montreal Protocol gas.','Template Environment!row 104','all',10,false),
('rf.r134a','in:refrig.r134a','R134a refilled.','Template Environment!row 105','all',10,false),
('rf.co2_extinguisher','in:refrig.co2_extinguisher','CO2-based fire extinguisher refills.','Template Environment!row 106','all',10,false);

-- -----------------------------------------------------------------------------
-- GHG EMISSIONS (eval_order 40-60 — depend on the energy outputs above)
-- -----------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, source_ref, site_filter, eval_order, is_assumption) values
('ghg.scope1_diesel',
 '(out:en.diesel_stationary + out:en.diesel_mobile) * 1000 * const:EF.diesel / 1000',
 'Diesel combustion, stationary and mobile. kL to litres, times kg CO2e/L, back to tonnes.',
 'Emissions Check!Scope 1 build-up', 'all', 40, true),

('ghg.scope1_petrol',
 'out:en.petrol * 1000 * const:EF.petrol / 1000',
 'Petrol combustion.',
 'Emissions Check!Scope 1 build-up', 'all', 40, true),

('ghg.scope1_refrigerant',
 '(out:rf.r404a * const:GWP.r404a + out:rf.r410a * const:GWP.r410a + out:rf.r407c * const:GWP.r407c + out:rf.r134a * const:GWP.r134a) / 1000',
 'Refrigerant leakage, refill mass as proxy. R22 is deliberately absent — a Montreal Protocol gas, conventionally excluded from Scope 1. Including it would add 18.10 tCO2e.',
 'Emissions Check!Scope 1 build-up', 'all', 40, true),

('ghg.scope1_extinguisher',
 'out:rf.co2_extinguisher * const:EF.co2_extinguisher / 1000',
 'CO2 released by extinguisher refills, assumed 1:1 with refilled mass. Whether this belongs in Scope 1 at all is a boundary question for the ESG team.',
 'Emissions Check!Scope 1 build-up', 'all', 40, true),

('ghg.scope1_total',
 'out:ghg.scope1_diesel + out:ghg.scope1_petrol + out:ghg.scope1_refrigerant + out:ghg.scope1_extinguisher',
 'Total Scope 1. INDICATIVE: computes to 603.82 tCO2e for FY25 against a published 589.11 (+2.5%), a gap attributable to the assumed combustion factors rather than the activity data.',
 'Emissions Check!Scope 1 build-up', 'all', 50, true),

('ghg.scope2_total',
 'out:en.electricity_nonrenew * const:EF.grid / 1000',
 'Location-based Scope 2. Reproduces the published FY25 figure of 2,678.16 tCO2e to within 0.005 t, which is print rounding — the grid factor was back-derived from exactly this relationship.',
 'Emissions Check!Tie-outs', 'all', 50, false),

('ghg.total',
 'out:ghg.scope1_total + out:ghg.scope2_total',
 'Total gross GHG emissions, Scope 1 plus Scope 2.',
 null, 'all', 60, false);

-- =============================================================================
-- DEPENDENCY EDGES
--
-- Extracted from each expression by regex so the resolver can topologically
-- sort, and so v_formula_missing_refs can prove every referenced key exists.
-- Regenerate after any expression change by re-running this block.
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
-- VALIDATION — both queries must return zero rows.
-- =============================================================================
-- select * from esg.v_formula_missing_refs;
-- select * from esg.v_formula_dag_edges;   -- inspect: must be acyclic
