-- =============================================================================
-- ESG DATA TOOL — CONSTANTS seed
-- Values transcribed from the "Emission factor" and "GCCA calcination B2" sheets.
-- Keys here are referenced by the FORMULAS layer as  const:<key>.
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- Fossil fuel emission factors (kg CO2 / GJ)
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source) values
('EF.fuel.rb1',                'EF_FUEL_FOSSIL','RB1',                          96,   'kg CO2/GJ','IPCC default (coal+anthracite+waste coal)'),
('EF.fuel.rb2',                'EF_FUEL_FOSSIL','RB2',                          96,   'kg CO2/GJ','IPCC default (coal+anthracite+waste coal)'),
('EF.fuel.rb3',                'EF_FUEL_FOSSIL','RB3',                          96,   'kg CO2/GJ','IPCC default (coal+anthracite+waste coal)'),
('EF.fuel.indigenous_petcoke','EF_FUEL_FOSSIL','Indigenous pet coke',          92.8, 'kg CO2/GJ','CSI Task Force 1'),
('EF.fuel.imp_petcoke_hm',    'EF_FUEL_FOSSIL','Imported Petcoke HM Trading',  92.8, 'kg CO2/GJ','CSI Task Force 1'),
('EF.fuel.imp_petcoke_hc',    'EF_FUEL_FOSSIL','Imported Petcoke HC Saudi',    92.8, 'kg CO2/GJ','CSI Task Force 1'),
('EF.fuel.us_petcoke',        'EF_FUEL_FOSSIL','US Petcoke',                   92.8, 'kg CO2/GJ','CSI Task Force 1'),
('EF.fuel.indian_coal',       'EF_FUEL_FOSSIL','Indian Coal',                  96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.us_coal_6900',      'EF_FUEL_FOSSIL','US coal (NCV-6900)',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.us_coal_6250',      'EF_FUEL_FOSSIL','US coal (NCV-6250)',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g5_coal',           'EF_FUEL_FOSSIL','Indigenous G5 Coal',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g6_coal',           'EF_FUEL_FOSSIL','Indigenous G6 Coal',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g7_coal',           'EF_FUEL_FOSSIL','Indigenous G7 Coal',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g8_coal',           'EF_FUEL_FOSSIL','Indigenous G8 Coal',           96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g11_coal',          'EF_FUEL_FOSSIL','Indigenous G11 Coal',          96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.g13_coal',          'EF_FUEL_FOSSIL','Indigenous G13 Coal',          96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.washed_coal',       'EF_FUEL_FOSSIL','Washed Coal',                  96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.australian_coal',   'EF_FUEL_FOSSIL','Australian Coal',              96,   'kg CO2/GJ','IPCC default'),
('EF.fuel.carbonaceous_shale','EF_FUEL_FOSSIL','Carbonaceous Shale',           107,  'kg CO2/GJ','IPCC 2006 (oil shale and tar sands)'),
('EF.fuel.heavy_fuel',        'EF_FUEL_FOSSIL','Heavy Fuel',                   77.4, 'kg CO2/GJ','IPCC default residual fuel oil'),
('EF.fuel.diesel_oil',        'EF_FUEL_FOSSIL','Diesel oil',                   74.1, 'kg CO2/GJ','IPCC 2006'),
('EF.fuel.lignite',           'EF_FUEL_FOSSIL','Lignite',                      101,  'kg CO2/GJ','IPCC 2006');

-- -----------------------------------------------------------------------------
-- Alternate fuel emission factors (kg CO2 / GJ) — fossil carbon content
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source) values
('EF.alt.spent_carbon',       'EF_FUEL_ALT','Spent Carbon',            80, 'kg CO2/GJ','Other fossil based wastes (CSI Task Force 1)'),
('EF.alt.carbon_black',       'EF_FUEL_ALT','Carbon Black',            85, 'kg CO2/GJ','CSI Task Force 1 (tyres)'),
('EF.alt.shredded_plastic',   'EF_FUEL_ALT','Shredded Plastic',        75, 'kg CO2/GJ','CSI Task Force 1 (plastics)'),
('EF.alt.rdf',                'EF_FUEL_ALT','Refused Derived Fuels',   75, 'kg CO2/GJ','CSI Task Force 1 (plastics)'),
('EF.alt.organic_residue',    'EF_FUEL_ALT','Organic Residue',         80, 'kg CO2/GJ','Other fossil based wastes (CSI Task Force 1)'),
('EF.alt.organic_solvents',   'EF_FUEL_ALT','Organic Liquid Solvents', 74, 'kg CO2/GJ','CSI Task Force 1 (solvents)'),
('EF.alt.organic_waste',      'EF_FUEL_ALT','Organic Waste',           80, 'kg CO2/GJ','Other fossil based wastes (CSI Task Force 1)'),
('EF.alt.dolochar',           'EF_FUEL_ALT','Dolochar',                80, 'kg CO2/GJ','Other fossil based wastes (CSI Task Force 1)'),
('EF.alt.spent_coffee',       'EF_FUEL_ALT','Spent Coffee',            80, 'kg CO2/GJ','Other fossil based wastes (CSI Task Force 1)'),
('EF.alt.waste_oil',          'EF_FUEL_ALT','Waste oil / fossil content',73.3,'kg CO2/GJ','CSI Task Force 1 (waste oil)'),
('EF.alt.waste_tyres',        'EF_FUEL_ALT','Waste tyres / fossil content',85,'kg CO2/GJ','CSI Task Force 1 (tyres)'),
('EF.alt.impreg_sawdust',     'EF_FUEL_ALT','Impregnated saw dust / fossil',75,'kg CO2/GJ','CSI Task Force 1'),
('EF.alt.mixed_industrial',   'EF_FUEL_ALT','Mixed industrial waste / fossil',83,'kg CO2/GJ','CSI Task Force 1'),
('EF.alt.other_fossil_waste', 'EF_FUEL_ALT','Other fossil based wastes',80,'kg CO2/GJ','CSI Task Force 1');

-- -----------------------------------------------------------------------------
-- Biomass fuel emission factors (kg CO2 / GJ) — biogenic, tracked separately
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source) values
('EF.bio.sewage_sludge',      'EF_FUEL_BIOMASS','Sewage sludge',                       110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.wood_sawdust',       'EF_FUEL_BIOMASS','Wood, non impregnated saw dust',      110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.paper_carton',       'EF_FUEL_BIOMASS','Paper, carton',                       110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.animal_meal',        'EF_FUEL_BIOMASS','Animal meal',                          89,'kg CO2/GJ','Estimate CSI Task Force 1'),
('EF.bio.animal_bone_meal',   'EF_FUEL_BIOMASS','Animal bone meal',                     89,'kg CO2/GJ','Estimate CSI Task Force 1'),
('EF.bio.animal_fat',         'EF_FUEL_BIOMASS','Animal fat',                           89,'kg CO2/GJ','Estimate CSI Task Force 1'),
('EF.bio.agri_organic',       'EF_FUEL_BIOMASS','Agricultural/organic/diaper/charcoal',110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.other_biomass',      'EF_FUEL_BIOMASS','Other biomass',                       110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.rice_husk',          'EF_FUEL_BIOMASS','Rice Husk',                           110,'kg CO2/GJ','IPCC default solid biomass'),
('EF.bio.biomass_from_alt',   'EF_FUEL_BIOMASS','Biomass content from alternate fuels',110,'kg CO2/GJ','IPCC default solid biomass');

-- -----------------------------------------------------------------------------
-- Internal transport (owned vehicles) — kg CO2 / L
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, source_date) values
('EF.transport.diesel',  'EF_TRANSPORT','Diesel (100% mineral)',  2.626,   'kg/L','GHG Protocol (mobile combustion - fuel use)','13 Mar 2024'),
('EF.transport.petrol',  'EF_TRANSPORT','Petrol (motor gasoline)',2.33086, 'kg/L','GHG Protocol (mobile combustion - fuel use)','13 Mar 2024'),
('EF.transport.biodiesel','EF_TRANSPORT','Biodiesel ME3',         2.39,    'kg/L','GHG Protocol (mobile combustion - fuel use)','13 Mar 2024');

-- -----------------------------------------------------------------------------
-- Scope 2 — grid electricity
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, source_date, effective_from) values
('EF.grid_2023', 'EF_SCOPE2','Grid emission factor', 0.716, 't CO2/MWh',
 'CO2 Baseline Database for the Indian Power Sector (CEA)','2023-12-01','2023-12-01');

-- -----------------------------------------------------------------------------
-- Scope 3 — upstream/downstream transport
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, source_date) values
('EF.s3.hdv_road',  'EF_SCOPE3','HDV (>12 T) road & bulk transport', 0.7375,  'kg CO2/km',   'India Specific Road Transport Emission Factors','2015'),
('EF.s3.rail',      'EF_SCOPE3','Rail transport',                    0.00996, 'kg CO2/t-km', 'India Specific Rail Transport Emission Factors','2015');

-- -----------------------------------------------------------------------------
-- Scope 3 — employee commuting
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, source_date) values
('EF.commute.scooter',     'EF_COMMUTE','Scooter (avg)',     0.03425,  'kg CO2/km',     'India Specific Road Transport Emission Factors','2015'),
('EF.commute.motorcycle',  'EF_COMMUTE','Motorcycle (avg)',  0.04063,  'kg CO2/km',     'India Specific Road Transport Emission Factors','2015'),
('EF.commute.car_diesel',  'EF_COMMUTE','Car - diesel (avg)',0.174,    'kg CO2/km',     'India Specific Road Transport Emission Factors','2015'),
('EF.commute.car_petrol',  'EF_COMMUTE','Car - petrol (avg)',0.173,    'kg CO2/km',     'India Specific Road Transport Emission Factors','2015'),
('EF.commute.bus',         'EF_COMMUTE','Bus',               0.015161, 'kg CO2/pax-km', 'India Specific Road Transport Emission Factors','2015');

-- -----------------------------------------------------------------------------
-- Other-source GWP / emission factors (refrigerants, welding, canteen).
-- NOTE: these cells were left BLANK in the workbook's "Emission factor" sheet
-- (values not yet supplied). Seeded here as 0 placeholders so the formula
-- registry resolves; replace with the plant's chosen GWP100 / EF values.
-- Refrigerant values are AR5 GWP100 suggestions (verify before use).
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source, notes) values
('EF.other.r407c',       'EF_OTHER_GWP','Refrigerant R407C (GWP100)',   0, 'kg CO2e/kg','TBD - blank in source sheet','Suggested AR5 ~1774; confirm'),
('EF.other.r134a',       'EF_OTHER_GWP','Refrigerant R134a (GWP100)',   0, 'kg CO2e/kg','TBD - blank in source sheet','Suggested AR5 ~1300; confirm'),
('EF.other.r32',         'EF_OTHER_GWP','Refrigerant R32 (GWP100)',     0, 'kg CO2e/kg','TBD - blank in source sheet','Suggested AR5 ~677; confirm'),
('EF.other.r410a',       'EF_OTHER_GWP','Refrigerant R410A (GWP100)',   0, 'kg CO2e/kg','TBD - blank in source sheet','Suggested AR5 ~1924; confirm'),
('EF.other.r22',         'EF_OTHER_GWP','Refrigerant R22 (GWP100)',     0, 'kg CO2e/kg','TBD - blank in source sheet','Suggested AR5 ~1760; confirm'),
('EF.other.fire_co2',    'EF_OTHER_GWP','Fire extinguisher CO2 type',   1, 'kg CO2e/kg','Direct CO2','CO2 discharged = 1:1'),
('EF.other.lpg',         'EF_OTHER_GWP','LPG (welding/canteen)',        0, 'kg CO2e/kg','TBD - blank in source sheet','~3.0 kgCO2/kg typical; confirm'),
('EF.other.diacetylene', 'EF_OTHER_GWP','Di Acetylene',                 0, 'kg CO2e/kg','TBD - blank in source sheet',null),
('EF.other.fuel_oil',    'EF_OTHER_GWP','Fuel oil (canteen)',           0, 'kg CO2e/kg','TBD - blank in source sheet',null);

-- -----------------------------------------------------------------------------
-- Molecular weights (g/mol) — used by the calcination (B2) calculation
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source) values
('MW.caco3', 'MOL_WEIGHT','CaCO3', 100.0869,  'g/mol','GCCA calcination B2'),
('MW.mgco3', 'MOL_WEIGHT','MgCO3', 84.313899, 'g/mol','GCCA calcination B2'),
('MW.cao',   'MOL_WEIGHT','CaO',   56.0774,   'g/mol','GCCA calcination B2'),
('MW.mgo',   'MOL_WEIGHT','MgO',   40.3044,   'g/mol','GCCA calcination B2'),
('MW.co2',   'MOL_WEIGHT','CO2',   44.0095,   'g/mol','GCCA calcination B2'),
('MW.ca',    'MOL_WEIGHT','Ca',    40.078,    'g/mol','GCCA calcination B2'),
('MW.mg',    'MOL_WEIGHT','Mg',    24.305,    'g/mol','GCCA calcination B2');

-- -----------------------------------------------------------------------------
-- Physical / conversion constants
-- -----------------------------------------------------------------------------
insert into esg.constant (key, category, label, value, unit, source) values
('PHYS.kcal_to_j',      'PHYS_CONST','Conversion kcal -> J',                4184,       'J/kcal','Definition'),
('PHYS.tj_per_kcal_e12','PHYS_CONST','10^12 / 4184 (TJ basis SHC factor)',  239006700.7,'-','Derived from SHC formula 10^12/4184'),
('PHYS.installed_mw',   'PHYS_CONST','Assumed installed CPP capacity (PLF)',18,         'MW','Plant Load Factor denominator (18*24*28)');
