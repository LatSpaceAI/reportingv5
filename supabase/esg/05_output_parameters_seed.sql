-- =============================================================================
-- ESG DATA TOOL — OUTPUT parameter catalogue
-- Every computed metric the tool produces. `key` is referenced by formulas
-- (as out:<key> when one output feeds another).
-- =============================================================================
set search_path = esg, public;

insert into esg.output_parameter (key, domain, scope, label, unit, is_intensity, sort_order) values
-- ---- PRODUCTION rollups (intermediates used widely as denominators) --------
('prod.total_minerals',          'PRODUCTION',null,'Total Mineral component materials consumed','Tons',false,10),
('prod.alt_cementitious',        'PRODUCTION',null,'Alternative Cementitious Material','Tons',false,11),
('prod.cementitious_produced',   'PRODUCTION',null,'Total Cementitious Produced','Tons',false,12),
('prod.cement_produced',         'PRODUCTION',null,'Total Cement Produced','Tons',false,13),
('prod.blended_total',           'PRODUCTION',null,'Total Blended Cements','Tons',false,14),
('kpi.clinker_factor',           'PRODUCTION',null,'Clinker Factor','Ratio',false,15),
('kpi.clinker_production_ratio', 'PRODUCTION',null,'Clinker Production Ratio','Ratio',false,16),
('kpi.blended_share',            'PRODUCTION',null,'Blended Cements share','%',false,17),

-- ---- ENERGY / KPIs ---------------------------------------------------------
('en.power_clinker_total',       'ENERGY',null,'Power consumption for Clinker (total)','kWh',false,20),
('en.power_grinding_total',      'ENERGY',null,'Power for grinding & packing (total)','kWh',false,21),
('kpi.sec_clinker',              'ENERGY',null,'Specific power consumption for Clinker','kWh/t clinker',true,22),
('kpi.sec_grinding_packing',     'ENERGY',null,'SEC of cement grinding and packing','kWh/t cement',true,23),
('kpi.sec_overall_cement',       'ENERGY',null,'Specific power consumption overall cement','kWh/t cement',true,24),
('kpi.sec_cementitious',         'ENERGY',null,'Specific power consumption for cementitious','kWh/t cementitious',true,25),
('kpi.shc',                      'ENERGY',null,'Specific Heat Consumption','kcal/kg clinker',true,26),
('kpi.tsr',                      'ENERGY',null,'Thermal Substitution Ratio (total)','%',false,27),
('kpi.tsr_alt',                  'ENERGY',null,'TSR - alternate fuels','%',false,28),
('kpi.tsr_biomass',              'ENERGY',null,'TSR - biomass','%',false,29),
('kpi.green_energy_ratio',       'ENERGY',null,'Ratio of electrical green energy','%',false,30),
('kpi.renewable_energy_ratio',   'ENERGY',null,'Ratio of renewable energy','%',false,31),
('kpi.whrs_generation',          'ENERGY',null,'WHRS Generation','kWh/t clinker',true,32),
('en.consumption_total_tj',      'ENERGY',null,'Energy consumption within organization','TJ',false,33),
-- fuel thermal-energy intermediates (TJ) consumed by TSR / SHC / fuel-CO2 formulas
('en.energy_kiln_total_tj',      'ENERGY',null,'Kiln thermal energy (total)','TJ',false,34),
('en.energy_kiln_alt_tj',        'ENERGY',null,'Kiln thermal energy (alternate fuels)','TJ',false,34),
('en.energy_kiln_biomass_tj',    'ENERGY',null,'Kiln thermal energy (biomass)','TJ',false,34),
('en.energy_cpp_total_tj',       'ENERGY',null,'CPP thermal energy (total)','TJ',false,34),
('en.energy_cpp_alt_tj',         'ENERGY',null,'CPP thermal energy (alternate fuels)','TJ',false,34),
('en.energy_cpp_biomass_tj',     'ENERGY',null,'CPP thermal energy (biomass)','TJ',false,34),

-- ---- EMISSIONS: absolute (Scope 1 components) ------------------------------
('emis.calcination',             'EMISSIONS','scope1','CO2 from raw meal calcination (B2)','T CO2',false,40),
('emis.fuel_kiln_gross',         'EMISSIONS','scope1','Gross fuel CO2 - Kiln (incl AF & biomass)','T CO2',false,41),
('emis.fuel_kiln_af',            'EMISSIONS','scope1','CO2 from AF & biomass - Kiln','T CO2',false,42),
('emis.fuel_kiln_biomass',       'EMISSIONS','scope1','Biogenic CO2 (biomass) - Kiln','T CO2',false,43),
('emis.fuel_cpp_gross',          'EMISSIONS','scope1','Gross fuel CO2 - CPP','T CO2',false,44),
('emis.fuel_cpp_af',             'EMISSIONS','scope1','CO2 from AF & biomass - CPP','T CO2',false,45),
('emis.fuel_cpp_biomass',        'EMISSIONS','scope1','Biogenic CO2 (biomass) - CPP','T CO2',false,46),
('emis.fuel_hag_gross',          'EMISSIONS','scope1','Gross fuel CO2 - HAG (cement mill)','T CO2',false,47),
('emis.fuel_hag_af',             'EMISSIONS','scope1','CO2 from AF & biomass - HAG','T CO2',false,48),
('emis.fuel_hag_biomass',        'EMISSIONS','scope1','Biogenic CO2 (biomass) - HAG','T CO2',false,49),
('emis.internal_transport',      'EMISSIONS','scope1','CO2 - internal transport (owned vehicles)','T CO2',false,50),
('emis.other_sources',           'EMISSIONS','scope1','CO2 - other sources (refrigerants etc.)','T CO2',false,51),
('emis.scope1_total',            'EMISSIONS','scope1','Gross Scope 1 CO2','T CO2',false,52),
('emis.scope1_af_biomass',       'EMISSIONS','scope1','CO2 from alternate fuels & biomass (total)','T CO2',false,53),
('emis.scope1_net',              'EMISSIONS','scope1','Net Scope 1 CO2 (excl AF & biomass)','T CO2',false,54),
('emis.biogenic_total',          'EMISSIONS','scope1','Biogenic CO2 (biomass only, total)','T CO2',false,55),

-- ---- EMISSIONS: Scope 2 & 3 ------------------------------------------------
('emis.scope2_total',            'EMISSIONS','scope2','Scope 2 CO2 (purchased grid electricity)','T CO2',false,60),
('emis.scope3_total',            'EMISSIONS','scope3','Scope 3 CO2 (transport + commuting, 3 cats)','T CO2',false,61),

-- ---- EMISSIONS: intensities ------------------------------------------------
('emis.intensity_scope1_cementitious','EMISSIONS','scope1','Scope 1 intensity per t cementitious','kg CO2/t cementitious',true,70),
('emis.intensity_scope2_cementitious','EMISSIONS','scope2','Scope 2 intensity per t cementitious','kg CO2/t cementitious',true,71),
('emis.intensity_scope3_cementitious','EMISSIONS','scope3','Scope 3 intensity per t cementitious','kg CO2/t cementitious',true,72),
('emis.intensity_total_cementitious', 'EMISSIONS',null,'Total GHG intensity per t cementitious','kg CO2/t cementitious',true,73),
('emis.intensity_calcination_clinker','EMISSIONS','scope1','Calcination intensity per t clinker','kg CO2/t clinker',true,74),
('emis.intensity_scope2_clinker',     'EMISSIONS','scope2','Scope 2 intensity per t clinker','kg CO2/t clinker',true,75),

-- ---- WATER -----------------------------------------------------------------
('water.withdrawal_total',       'WATER',null,'Total water withdrawal (all sources)','TCM',false,80),
('water.withdrawal_surface',     'WATER',null,'Surface water withdrawal','TCM',false,81),
('water.withdrawal_ground',      'WATER',null,'Groundwater withdrawal','TCM',false,82),
('water.discharge_total',        'WATER',null,'Total water discharge','TCM',false,83),
('water.consumption_total',      'WATER',null,'Total water consumption','TCM',false,84),

-- ---- WASTE -----------------------------------------------------------------
('waste.diverted_total',         'WASTE',null,'Waste diverted from disposal (306-4)','Tons',false,90),
('waste.directed_total',         'WASTE',null,'Waste directed to disposal (306-5)','Tons',false,91),
('waste.generated_total',        'WASTE',null,'Total waste generated (306-3)','Tons',false,92),

-- ---- BIODIVERSITY ----------------------------------------------------------
('bio.greenbelt_pct',            'BIODIVERSITY',null,'% green belt of total plant area','%',false,100),

-- ---- AIR (non-GHG) ---------------------------------------------------------
('air.total_particulate',        'AIR',null,'Total particulate (Dust + PM)','Ton',false,110);
