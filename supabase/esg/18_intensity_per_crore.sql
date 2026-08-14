-- =============================================================================
-- FIX — intensity ratios stored as exactly zero.
--
-- THE BUG
--
-- 17_brsr_gap_metrics.sql defined the three intensity metrics as
-- <metric> / const:FIN.turnover, with turnover in absolute rupees. Both
-- resolvers round every stored value to 4 decimal places
-- (resolve-birla.mjs:111, resolve-scope3.mjs:138), and an intensity per RUPEE
-- is far below that precision:
--
--   en.intensity_turnover    5,925.3529 GJ    / 5e10  = 1.1851e-7  -> stored 0
--   wtr.intensity_turnover  14,281.63   KL    / 5e10  = 2.8563e-7  -> stored 0
--   ghg.intensity_turnover     118.4076 tCO2e / 5e10  = 2.3682e-9  -> stored 0
--
-- So all three resolved, wrote a row, and reported zero — the worst failure
-- shape available: a plausible-looking figure, present and precise, and wrong.
-- Verified against the live database after the first resolver run.
--
-- WHY NOT WIDEN round4
--
-- It is shared by all 78 metrics across both resolvers. Widening it to absorb
-- one family of ratios would silently change the stored precision of every
-- other figure, including the ones the Middle Link reconstruction is asserted
-- against. The unit is what is wrong here, not the rounding.
--
-- THE FIX — DENOMINATE IN CRORES
--
-- Divide by turnover expressed in crores (turnover / 1e7), which puts the
-- ratios in the 0.02-2.9 range: comfortably inside 4dp, and the convention
-- Indian listed entities already report intensity in. BRSR asks for "per rupee
-- of turnover" and every filer answers it in a scaled unit; the unit string
-- carries the scale so the disclosure stays honest.
--
-- CONV.inr_to_crore is a genuine unit conversion (1e-7), NOT an assumption —
-- it is exact by definition, so it ships is_assumption = false.
--
-- RUN AFTER 17_brsr_gap_metrics.sql, THEN RE-RUN npm run esg:resolve.
-- =============================================================================
set search_path = esg, public;

insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('CONV.inr_to_crore', 'CONVERSION', 'Rupees to crores', 0.0000001, 'crore/INR', 'SI', false,
 'Exact by definition: 1 crore = 10,000,000. Denominates the BRSR intensity ratios so they land inside the resolver''s 4-decimal storage precision — per-rupee they round to zero. See the header of 18_intensity_per_crore.sql.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Units — the scale lives in the unit string, so the number is never ambiguous.
-- -----------------------------------------------------------------------------
update esg.output_parameter set
    unit  = 'GJ/crore',
    label = 'Energy intensity per crore of turnover',
    notes = 'BRSR C.P6.E1 row 5. Denominated per crore, not per rupee: per-rupee the ratio is 1.2e-7 and rounds to zero at the resolver''s 4dp precision. Meaningful only at (GROUP, YTD).'
where key = 'en.intensity_turnover';

update esg.output_parameter set
    unit  = 'KL/crore',
    label = 'Water intensity per crore of turnover',
    notes = 'BRSR C.P6.E3 row 8. Denominated per crore — see en.intensity_turnover. Meaningful only at (GROUP, YTD).'
where key = 'wtr.intensity_turnover';

update esg.output_parameter set
    unit  = 'tCO2e/crore',
    label = 'Scope 1 + Scope 2 intensity per crore of turnover',
    notes = 'BRSR C.P6.E6 row 3. Denominated per crore — see en.intensity_turnover. Meaningful only at (GROUP, YTD).'
where key = 'ghg.intensity_turnover';

-- -----------------------------------------------------------------------------
-- Expressions — multiply the denominator into crores.
--
-- IFERROR still guards a turnover of zero. eval_order stays 90.
-- -----------------------------------------------------------------------------
update esg.formula set
    expression  = 'IFERROR(out:en.energy_total_gj / (const:FIN.turnover * const:CONV.inr_to_crore), 0)',
    description = 'Energy intensity per crore of turnover. Per rupee this rounds to zero at 4dp. Disclose the (GROUP, YTD) value only.'
where output_key = 'en.intensity_turnover';

update esg.formula set
    expression  = 'IFERROR(out:wtr.consumption / (const:FIN.turnover * const:CONV.inr_to_crore), 0)',
    description = 'Water intensity per crore of turnover, on consumption per the BRSR definition. Disclose the (GROUP, YTD) value only.'
where output_key = 'wtr.intensity_turnover';

update esg.formula set
    expression  = 'IFERROR(out:ghg.total / (const:FIN.turnover * const:CONV.inr_to_crore), 0)',
    description = 'Scope 1 + Scope 2 intensity per crore of turnover. Disclose the (GROUP, YTD) value only.'
where output_key = 'ghg.intensity_turnover';

-- =============================================================================
-- DEPENDENCY INDEX — regenerate. MANDATORY (formula_dependency has no trigger).
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
-- THEN:  npm run esg:resolve
--
-- EXPECTED at (GROUP, FY2024-25 YTD), against turnover = 50,000,000,000:
--   en.intensity_turnover    1.1851  GJ/crore
--   wtr.intensity_turnover   2.8563  KL/crore
--   ghg.intensity_turnover   0.0237  tCO2e/crore
--
-- If any of the three is still 0, the resolver did not pick up the new
-- expression — check that this file ran and that FIN.turnover is not zero.
-- =============================================================================
