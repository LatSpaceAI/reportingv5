-- =============================================================================
-- BIRLA ESTATES — CONSTANTS seed
--
-- Emission factors, GWPs and unit conversions referenced by the FORMULAS layer
-- as const:<key>.
--
-- PROVENANCE OF THESE VALUES
-- The authoritative factor set lives in the original consolidation workbook
-- (ESG Data FY 24-25.xlsx), which is not in our possession — it sits on the ESG
-- department's OneDrive and the BRSR template only reaches it through external
-- links. The grid factor below is therefore BACK-DERIVED and exact; the
-- combustion factors are documented assumptions carried over from the Middle
-- Link reconstruction's Emissions Check sheet.
--
-- Anything marked is_assumption = true needs ESG-team confirmation before
-- assurance. The app surfaces these rather than hiding them.
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- Grid electricity emission factor
--
-- NOT an assumption: back-derived from the published FY25 disclosure and exact
-- to five decimal places. Published Scope 2 (2,678.16 tCO2e) divided by
-- non-renewable electricity (3,683,858.31 kWh) = 0.727 kg CO2/kWh, which is the
-- CEA grid average. Recomputing Scope 2 from this factor reproduces the
-- published figure to 0.005 tCO2e — i.e. print rounding.
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, source_date, is_assumption, notes) values
('EF.grid', 'EF_GRID', 'Grid electricity emission factor', 0.727, 'kg CO2/kWh',
 'CEA grid average (back-derived from published FY25 Scope 2)', 'FY2024-25', false,
 'Verified: 3,683,858.31 kWh x 0.727 / 1000 = 2,678.165 tCO2e vs published 2,678.16 tCO2e.');

-- -----------------------------------------------------------------------------
-- Liquid fuel emission factors (Scope 1 stationary + mobile combustion)
--
-- ASSUMPTIONS. Diesel sits in the IPCC / India GHG Program range 2.55-2.68
-- kg CO2e/L; 2.65 is the mid-range value the reconstruction used. With these
-- factors the computed Scope 1 is 603.82 tCO2e against a published 589.11 —
-- a +2.5% gap that is almost certainly the factor set rather than the activity
-- data. Tune here once the ESG team confirms their factors.
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('EF.diesel', 'EF_FUEL', 'Diesel emission factor', 2.65, 'kg CO2e/L',
 'IPCC / India GHG Program (range 2.55-2.68)', true,
 'Applies to both stationary (DG sets) and mobile (plant, machinery, vehicles) combustion.'),
('EF.petrol', 'EF_FUEL', 'Petrol emission factor', 2.30, 'kg CO2e/L',
 'IPCC / India GHG Program', true,
 'Mobile combustion only. FY25 petrol is 0.027 kL, so this barely moves Scope 1.');

-- -----------------------------------------------------------------------------
-- Refrigerant GWPs (AR4 GWP100) and extinguisher CO2 release
--
-- R22 is an HCFC controlled under the Montreal Protocol and is conventionally
-- EXCLUDED from Scope 1 GHG reporting. It is seeded so the refill quantity can
-- still be disclosed on the BRSR refrigerant line, but no Scope 1 formula
-- references it. Including it would add 18.10 tCO2e.
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('GWP.r404a', 'GWP_REFRIG', 'GWP100 - R404A', 3922, 'kg CO2e/kg', 'IPCC AR4', false, null),
('GWP.r410a', 'GWP_REFRIG', 'GWP100 - R410A', 2088, 'kg CO2e/kg', 'IPCC AR4', false, null),
('GWP.r407c', 'GWP_REFRIG', 'GWP100 - R407C', 1774, 'kg CO2e/kg', 'IPCC AR4', false, null),
('GWP.r134a', 'GWP_REFRIG', 'GWP100 - R134a', 1430, 'kg CO2e/kg', 'IPCC AR4', false, null),
('GWP.r22',   'GWP_REFRIG', 'GWP100 - R22 (HCFC)', 1810, 'kg CO2e/kg', 'IPCC AR4', false,
 'Montreal Protocol gas - EXCLUDED from Scope 1 by convention. Disclosed as a refill quantity only.'),
('EF.co2_extinguisher', 'GWP_REFRIG', 'CO2 released per kg of extinguisher refill', 1, 'kg CO2/kg',
 'Refilled mass assumed released 1:1', true,
 'Whether extinguisher refills belong in Scope 1 at all is a boundary question for the ESG team.');

-- -----------------------------------------------------------------------------
-- Unit conversions
--
-- Site forms are filed in litres, kilograms and cubic metres; BRSR discloses in
-- kilolitres, metric tonnes and kilolitres respectively. m3 and KL are the same
-- volume, so that conversion is 1 and exists only to make the intent explicit
-- where a form says m3 and the disclosure says KL.
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('CONV.l_to_kl',  'CONVERSION', 'Litres to kilolitres',        0.001, 'kL/L',  'SI', false, null),
('CONV.kg_to_mt', 'CONVERSION', 'Kilograms to metric tonnes',  0.001, 'MT/kg', 'SI', false, null),
('CONV.m3_to_kl', 'CONVERSION', 'Cubic metres to kilolitres',  1,     'KL/m3', 'SI', false,
 'Identity - 1 m3 = 1 KL. Present so form-unit m3 to disclosure-unit KL is explicit.'),
('CONV.kwh_to_mwh','CONVERSION','kWh to MWh',                  0.001, 'MWh/kWh','SI', false, null),
('CONV.kwh_to_gj', 'CONVERSION','kWh to gigajoules',           0.0036,'GJ/kWh', 'SI', false,
 'BRSR asks for energy in joules or multiples; the template uses kWh with a 3,600,000 J conversion.');
