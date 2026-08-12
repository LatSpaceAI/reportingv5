-- =============================================================================
-- BIRLA ESTATES — SCOPE 3 OUTPUT PARAMETERS
--
-- The 11 category lines and the total, plus the new all-scopes total.
--
-- These are ORDINARY output_parameter rows and their values will be ORDINARY
-- output_value rows. That is the whole point of computing Scope 3 in a separate
-- pass rather than extending the formula grammar: once the category totals land
-- in output_value they are indistinguishable from any other computed figure, so
-- the standard output exporter, the dashboard and the BRSR export pick them up
-- with no change.
--
-- WHAT HAS NO FORMULA ROW, AND WHY
--
--   Every other output_parameter in this schema is paired with an esg.formula
--   holding a scalar expression. These have none. formula-eval.mjs binds three
--   token kinds (in:, const:, out:) each to ONE number, and every Scope 3
--   category is a set operation — sum over ledger lines where tag = X. Making
--   the grammar express that would turn a deliberately tiny, deliberately
--   not-eval parser into a query language, and the safety property that matters
--   (expressions come from a database table) would get much harder to reason
--   about.
--
--   scripts/resolve-scope3.mjs computes these instead and writes output_value
--   directly with formula_id = null. resolve-birla.mjs is untouched and never
--   sees a ledger.
--
-- Apply after 14_scope3_constants.sql.
-- =============================================================================

set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- A domain of its own.
--
-- Scope 3 spans energy, materials, waste, travel and downstream use — it does
-- not sit inside any existing domain, and bucketing it under EMISSIONS would
-- put eleven category lines in the middle of the Scope 1/2 disclosure they must
-- be read separately from.
-- -----------------------------------------------------------------------------
insert into esg.domain (code, name, sort_order) values
    ('SCOPE3', 'Scope 3 Value Chain Emissions', 35)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- THE CATEGORY LINES — 11, matching the workbook's summary sheet row for row.
--
-- frequency = 'annual' on every one. Scope 3 is disclosed annually, several of
-- its ledgers have no month at all, and resolve-scope3.mjs writes only against
-- the fiscal year's YTD period. Marking them monthly would make the dashboard
-- offer twelve empty months.
--
-- Category 1 is TWO rows, not one. The workbook splits it — spend-based and
-- tonnage-based — because they are different methods with different data
-- quality tiers, and the whole improvement story is spend shrinking as tonnage
-- grows. Collapsing them would hide the one number that shows whether the
-- inventory is getting better. Same for Category 4, split by what is being
-- moved.
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('s3.cat1_spend',     'SCOPE3','scope3','Category 1 - Purchased goods and services (spend based)','tCO2e','annual',3010,
 'EXIOBASE v3 India EEIO applied to procurement spend, deflated to the EF reference year at a market FX rate. Tier 3 - the weakest method here. It should SHRINK every year as tonnage and metered data replace it; that is the workbook''s stated objective, not an incidental.'),

('s3.cat1_materials', 'SCOPE3','scope3','Category 1 - Building materials (embodied)','tCO2e','annual',3020,
 'Tonnage x embodied carbon factor, supplier EPD where one exists (Tier 1) otherwise the India/ICE library. A material counted here MUST be tagged EXCLUDE on the procurement ledger or it is counted twice.'),

('s3.cat2_capital',   'SCOPE3','scope3','Category 2 - Capital goods','tCO2e','annual',3030,
 'Same spend-based method as cat1_spend, separated by the Scope 3 tag on the procurement line.'),

('s3.cat3_fera',      'SCOPE3','scope3','Category 3 - Fuel and energy related activities','tCO2e','annual',3040,
 'T&D losses on grid-delivered electricity, upstream of grid generation, and well-to-tank on diesel and petrol. NOT the combustion of that fuel, which is Scope 1, nor the grid electricity itself, which is Scope 2. Reconciles to the same quantities as the Scope 1/2 model by construction.'),

('s3.cat4_freight',   'SCOPE3','scope3','Category 4 - Transport of purchased goods','tCO2e','annual',3050,
 'Inbound freight for goods NOT on the materials ledger. Tonnes x road distance x vehicle factor, where road distance is straight-line x circuity.'),

('s3.cat4_materials', 'SCOPE3','scope3','Category 4 - Transport of building materials','tCO2e','annual',3060,
 'The delivery leg of the materials ledger. Same row produces cat1_materials (embodied) and this (freight); they are separate disclosures from one filed line.'),

('s3.cat5_waste',     'SCOPE3','scope3','Category 5 - Waste generated in operations','tCO2e','annual',3070,
 'BY DISPOSAL ROUTE, not against a single generated tonnage. C&D to landfill (1.26 kgCO2e/t) and organic to landfill (626.9) differ by five hundred times; applying one average factor to total waste is the single largest error available in this category.'),

('s3.cat6_travel',    'SCOPE3','scope3','Category 6 - Business travel','tCO2e','annual',3080,
 'Combustion AND well-to-tank per mode, plus hotel room-nights. Air factors include radiative forcing.'),

('s3.cat7_commute',   'SCOPE3','scope3','Category 7 - Employee commuting','tCO2e','annual',3090,
 'Survey emissions grossed up by headcount / respondents, including a working-from-home component. Whether contract site workers are in scope (s3.contract_workers_in_cat7) can move this by an order of magnitude - HR reports zero workers while Safety reports 15.6M worker-hours.'),

('s3.cat11_sold',     'SCOPE3','scope3','Category 11 - Use of sold products','tCO2e','annual',3100,
 'Area x conversion x EPI x EXPECTED LIFETIME x grid EF. The lifetime multiplier makes this roughly 99.5% of total Scope 3, which is correct per the GHG Protocol but means the total is insensitive to improvement anywhere else. Decide how to present that before anyone reads the flat total as a modelling artefact.'),

('s3.cat13_leased',   'SCOPE3','scope3','Category 13 - Downstream leased assets','tCO2e','annual',3110,
 'Tenant electricity and diesel, plus refrigerant top-up at AR6 GWPs. This is the consumption REMOVED from the Scope 2 boundary - the two disclosures must be read together or the tenant load disappears from both.'),

('s3.total',          'SCOPE3','scope3','Total Scope 3','tCO2e','annual',3200,
 'Sum of the eleven category lines above. Covers categories 1, 2, 3, 4, 5, 6, 7, 11 and 13. Categories 8, 9, 10, 12, 14 and 15 are NOT quantified - the GHG Protocol requires each to be either quantified or explicitly excluded with a written justification, and 12 (end-of-life of sold buildings) and 15 (JV / joint-development) are the two a reviewer is most likely to challenge.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- ⚠ ghg.total MEANS SCOPE 1 + 2 AND IS LEFT ALONE.
--
-- 07_formulas_seed.sql defines it as 'out:ghg.scope1_total + out:ghg.scope2_total'
-- and labels it "Total GHG emissions (Scope 1 + 2)". Dashboard tiles, the BRSR
-- export and saved charts all read that key today.
--
-- Redefining it to include Scope 3 would make every one of them jump by three
-- orders of magnitude with no visible cause and no code change to point at
-- during the investigation. The all-scopes figure gets its OWN key instead.
--
-- This row has no formula either — resolve-scope3.mjs writes it, because it
-- needs the Scope 3 total that only that pass knows. It is written ONLY for
-- (GROUP, YTD), the one grain where all three scopes exist together.
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('ghg.total_all_scopes', 'EMISSIONS', null, 'Total GHG emissions (Scope 1 + 2 + 3)','tCO2e','annual',980,
 'Scope 1 + Scope 2 + Scope 3. DISTINCT FROM ghg.total, which means Scope 1 + 2 and must keep meaning that - every existing tile and export cell reads it. Written by resolve-scope3.mjs for (GROUP, YTD) only, since that is the only grain at which a Scope 3 figure exists.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Scope 3 dominance, as a check rather than a disclosure.
--
-- The workbook's VALIDATION check 13: for a real estate developer Scope 3
-- should dominate, and if it does not, a category is missing or understated.
-- Held as an output so the dashboard can show it and the check can read it,
-- and marked is_intensity so nothing sums it across periods.
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, is_intensity, frequency, sort_order, notes) values
('s3.share_of_footprint', 'SCOPE3', null, 'Scope 3 share of total footprint', 'fraction', true, 'annual', 3210,
 'Scope 3 / (Scope 1 + 2 + 3). For a developer this normally lands above 95%. Anything much lower suggests a category is missing or understated - the workbook treats it as a CHECK, not a target. is_intensity = true: it is a ratio and must be RE-DERIVED at any rollup, never summed.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Verification: every parameter this file promises resolve-scope3.mjs will
-- write must actually exist, with the scope value the exporter sections on.
-- -----------------------------------------------------------------------------
do $$
declare
    n integer;
begin
    select count(*) into n from esg.output_parameter where domain = 'SCOPE3';
    if n <> 13 then
        raise exception 'Expected 13 SCOPE3 output parameters (11 categories + total + share), found %', n;
    end if;

    select count(*) into n
      from esg.output_parameter
     where domain = 'SCOPE3' and scope = 'scope3' and frequency <> 'annual';
    if n > 0 then
        raise exception '% Scope 3 category parameter(s) are not annual - resolve-scope3.mjs writes only YTD periods', n;
    end if;

    -- The constraint on output_parameter.scope already permits 'scope3'
    -- (01_schema.sql:374), so this is a check that it was not narrowed since.
    select count(*) into n from esg.output_parameter where scope = 'scope3';
    if n = 0 then
        raise exception 'No scope3 parameters were inserted - check the scope check constraint';
    end if;
end $$;

notify pgrst, 'reload schema';
