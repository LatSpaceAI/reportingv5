-- =============================================================================
-- BIRLA ESTATES — OUTPUT parameter catalogue
--
-- Every computed metric, keyed to mirror the BRSR "Environment (Real Estate)"
-- disclosure lines so the exporter can address them directly.
--
-- `frequency` records the cadence the disclosure is made at, which is NOT
-- always the cadence the data arrives at. Energy and water are monthly; waste
-- is quarterly; air emissions half-yearly; refrigerants annual. The resolver
-- computes at the input cadence and rolls up to the disclosure cadence.
--
-- Cell references in the notes point at
-- birla-estates/output/Real Estate BRSR and IR Data template FY25 V1.xlsx,
-- sheet "Environment (Real Estate)".
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- ENERGY  (template rows 16-23)
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('en.diesel_stationary',  'FUEL',  null,'Diesel (Stationary Combustion)',       'kL',  'monthly', 110,
 'Template row 17. DG-set diesel across all sites.'),
('en.diesel_mobile',      'FUEL',  null,'Diesel (Mobile Combustion)',           'kL',  'monthly', 120,
 'Template row 18. Plant, machinery and vehicle diesel. NOTE: template cell F18 has no FY formula — 72% of diesel had no annual roll-up in the published file. Computed properly here.'),
('en.petrol',             'FUEL',  null,'Petrol (Mobile Combustion)',           'kL',  'monthly', 130,
 'Template row 19.'),
('en.electricity_nonrenew','ENERGY',null,'Electricity - non-renewable',         'kWh', 'monthly', 140,
 'Template row 20. Grid electricity of BEPL''s own operations: construction-site grid plus Aurora''s occupied floors. Tenant electricity is excluded.'),
('en.electricity_renew',  'ENERGY',null,'Electricity - renewable',              'kWh', 'monthly', 150,
 'Template row 23. Green energy purchases and onsite renewables, plus any documented adjustment.'),
('en.electricity_total',  'ENERGY',null,'Electricity - total',                  'kWh', 'monthly', 160, null),
('en.energy_total_gj',    'ENERGY',null,'Total energy consumption',             'GJ',  'monthly', 170,
 'BRSR asks for joules or multiples. Electricity converted at 0.0036 GJ/kWh.');

-- -----------------------------------------------------------------------------
-- WATER — withdrawal by source (template rows 27-34)
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('wtr.surface',      'WATER', null,'Water withdrawal - (i) Surface water',       'KL','monthly',210,'Template row 27.'),
('wtr.groundwater',  'WATER', null,'Water withdrawal - (ii) Ground water',       'KL','monthly',220,
 'Template row 28. See the classification note on the formula: Tisya''s groundwater was published as third-party water while Trimaya''s stayed groundwater.'),
('wtr.third_party',  'WATER', null,'Water withdrawal - (iii) Third party water', 'KL','monthly',230,
 'Template row 29. Municipal supply, tanker water and drinking water.'),
('wtr.seawater',     'WATER', null,'Water withdrawal - (iv) Seawater/desalinated','KL','monthly',240,'Template row 30.'),
('wtr.treated',      'WATER', null,'Water withdrawal - (v) Others: treated water','KL','monthly',250,'Template row 31.'),
('wtr.total',        'WATER', null,'Total water withdrawal',                     'KL','monthly',260,'Template row 32.'),
('wtr.discharged',   'WATER', null,'Total water discharged',                     'KL','monthly',270,
 'Template rows 40-54. Zero throughout the pack — STP water is recycled on site, not discharged.'),
('wtr.consumption',  'WATER', null,'Total water consumption',                    'KL','monthly',280,
 'Template row 34, which shows 0 because its monthly cells were never filled. Computed correctly here as withdrawal minus discharge.');

-- -----------------------------------------------------------------------------
-- WATER — stressed areas (template rows 56-89)
-- Sums only sites where water_stressed = true ("Bangalore & NCR").
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('wtr.ws_groundwater','WATER', null,'Water-stressed withdrawal - (ii) Ground water','KL','monthly',310,'Template row 64.'),
('wtr.ws_third_party','WATER', null,'Water-stressed withdrawal - (iii) Third party','KL','monthly',320,'Template row 66.'),
('wtr.ws_treated',    'WATER', null,'Water-stressed withdrawal - (v) Treated water','KL','monthly',330,
 'Template row 67. Its Jan-25 value (149 KL) exceeds the company-wide treated total (146 KL) — an impossible subset in the published file.'),
('wtr.ws_total',      'WATER', null,'Total water withdrawal in stressed areas',     'KL','monthly',340,'Template row 68.'),
('wtr.ws_discharged', 'WATER', null,'Water discharged in stressed areas',           'KL','monthly',350,'Template rows 73-89. Zero.'),
('wtr.ws_consumption','WATER', null,'Water consumption in stressed areas',          'KL','monthly',360,
 'Template row 70, which double-counts: its SUM range spans its own subtotal row and skips groundwater, yielding 82,478 KL against a withdrawal of 41,575 KL. Computed correctly here.');

-- -----------------------------------------------------------------------------
-- WASTE — quarterly (template rows 122-190)
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('wst.cnd_generated',      'WASTE',null,'C&D waste - generated',        'MT','quarterly',410,
 'Includes construction scrap, which has no BRSR category of its own.'),
('wst.cnd_reused',         'WASTE',null,'C&D waste - reused',           'MT','quarterly',420, null),
('wst.cnd_landfilled',     'WASTE',null,'C&D waste - landfilled',       'MT','quarterly',430, null),
('wst.plastic_generated',  'WASTE',null,'Plastic waste - generated',    'MT','quarterly',440, null),
('wst.plastic_recycled',   'WASTE',null,'Plastic waste - recycled',     'MT','quarterly',450,
 'Template FY formula D136 references the generated row instead of the recycled one — same value, wrong cell.'),
('wst.municipal_generated','WASTE',null,'Municipal waste - generated',  'MT','quarterly',460, null),
('wst.municipal_recycled', 'WASTE',null,'Municipal waste - recycled',   'MT','quarterly',470,
 'Template FY value is hardcoded with no quarterly split.'),
('wst.food_generated',     'WASTE',null,'Food waste - generated',       'MT','quarterly',480, null),
('wst.food_recycled',      'WASTE',null,'Food waste - recycled',        'MT','quarterly',490, null),
('wst.biomedical_generated','WASTE',null,'Bio-medical waste - generated','MT','quarterly',500, null),
('wst.biomedical_incinerated','WASTE',null,'Bio-medical waste - incinerated','MT','quarterly',510, null),
('wst.used_oil_generated', 'WASTE',null,'Used oil - generated',         'MT','quarterly',520,
 'Filed in litres. Requires a density to express in MT — left unmapped until the ESG team supplies one.'),
('wst.used_oil_recycled',  'WASTE',null,'Used oil - recycled',          'MT','quarterly',530, null),
('wst.battery_generated',  'WASTE',null,'Battery waste - generated',    'MT','quarterly',540,
 'Filed as a count. Requires an average unit weight to express in MT.'),
('wst.battery_recycled',   'WASTE',null,'Battery waste - recycled',     'MT','quarterly',550, null),
('wst.oil_filters_generated','WASTE',null,'Oil filters - generated',    'MT','quarterly',560,
 'Filed as a count. Requires an average unit weight to express in MT.'),
('wst.oil_filters_incinerated','WASTE',null,'Oil filters - incinerated','MT','quarterly',570, null),
('wst.cotton_rags_generated','WASTE',null,'Cotton rags - generated',    'MT','quarterly',580, null),
('wst.cotton_rags_incinerated','WASTE',null,'Cotton rags - incinerated','MT','quarterly',590, null),
('wst.other_haz_generated','WASTE',null,'Other hazardous (diesel barrels) - generated','MT','quarterly',600,
 'Template Q2/Q3 formulas point at the cotton-rags row (81) instead of row 80, so the published Q2 0.0485 and Q3 0.026 are duplicated cotton-rags values.'),
('wst.other_haz_incinerated','WASTE',null,'Other hazardous - incinerated','MT','quarterly',610, null),
('wst.ewaste_generated',   'WASTE',null,'Electronic waste - generated', 'MT','quarterly',620, null),
('wst.total_generated',    'WASTE',null,'Total waste generated',        'MT','quarterly',630, null);

-- -----------------------------------------------------------------------------
-- AIR EMISSIONS — half-yearly (template rows 94-96)
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('air.nox_total','AIR',null,'NOx',                     'kg','half_yearly',710,
 'Template row 94. From half-yearly stack/DG monitoring, not the monthly returns. Navya dominates: 324.5 kg of the 333.1 kg FY total.'),
('air.sox_total','AIR',null,'SOx',                     'kg','half_yearly',720,'Template row 95.'),
('air.pm_total', 'AIR',null,'Particulate matter (PM)', 'kg','half_yearly',730,'Template row 96.');

-- -----------------------------------------------------------------------------
-- REFRIGERANTS — annual (template rows 101-106)
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('rf.r404a','REFRIGERANT',null,'R404A refilled','kg','annual',810,'Template row 101.'),
('rf.r410a','REFRIGERANT',null,'R410A refilled','kg','annual',820,'Template row 102.'),
('rf.r407c','REFRIGERANT',null,'R407C refilled','kg','annual',830,'Template row 103.'),
('rf.r22',  'REFRIGERANT',null,'R22 refilled',  'kg','annual',840,
 'Template row 104. Fully evidenced by Aurora''s returns (5 kg Apr + 5 kg Aug). Montreal gas — excluded from Scope 1.'),
('rf.r134a','REFRIGERANT',null,'R134a refilled','kg','annual',850,'Template row 105.'),
('rf.co2_extinguisher','REFRIGERANT',null,'CO2 fire extinguisher refilled','kg','annual',860,'Template row 106.');

-- -----------------------------------------------------------------------------
-- GHG EMISSIONS
--
-- Scope 2 is exact — the grid factor was back-derived from the published
-- figure and reproduces it to 0.005 tCO2e.
--
-- Scope 1 is INDICATIVE. With the assumed combustion factors it computes to
-- 603.82 tCO2e against a published 589.11 (+2.5%). The gap is the factor set,
-- which lives in the missing consolidation file.
-- -----------------------------------------------------------------------------
insert into esg.output_parameter (key, domain, scope, label, unit, frequency, sort_order, notes) values
('ghg.scope1_diesel',      'EMISSIONS','scope1','Scope 1 - diesel combustion',      'tCO2e','monthly',910, null),
('ghg.scope1_petrol',      'EMISSIONS','scope1','Scope 1 - petrol combustion',      'tCO2e','monthly',920, null),
('ghg.scope1_refrigerant', 'EMISSIONS','scope1','Scope 1 - refrigerant leakage',    'tCO2e','annual', 930,
 'R404A/R410A/R407C/R134a only. R22 is excluded as a Montreal Protocol gas (it would add 18.10 tCO2e).'),
('ghg.scope1_extinguisher','EMISSIONS','scope1','Scope 1 - extinguisher CO2 release','tCO2e','annual',940,
 'Whether these belong in Scope 1 is a boundary question for the ESG team.'),
('ghg.scope1_total',       'EMISSIONS','scope1','Scope 1 - total',                  'tCO2e','monthly',950,
 'INDICATIVE while the combustion factors remain assumptions.'),
('ghg.scope2_total',       'EMISSIONS','scope2','Scope 2 - purchased electricity',  'tCO2e','monthly',960,
 'Location-based, CEA grid factor 0.727 kg CO2/kWh. Reproduces the published FY25 figure of 2,678.16 tCO2e exactly.'),
('ghg.total',              'EMISSIONS',null,    'Total GHG emissions (Scope 1 + 2)','tCO2e','monthly',970, null);
