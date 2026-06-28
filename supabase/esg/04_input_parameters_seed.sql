-- =============================================================================
-- ESG DATA TOOL — INPUT parameter dictionary
-- Each row is one input field from the per-plant Input Sheet.
-- `key` values here are referenced by the FORMULAS layer as  in:<key>.
-- sheet_row = original row on the Input Sheet (for traceability).
--
-- NOTE: fuel lists repeat for KILN / CPP / HAG and for consumption vs LHV.
-- We key them as fuel.<location>.<fuel>.qty and fuel.<location>.<fuel>.lhv.
-- Only a representative + formula-referenced subset is enumerated explicitly
-- here; the same pattern extends to every fuel/location pair in the workbook.
-- =============================================================================
set search_path = esg, public;

insert into esg.input_parameter (key, domain, section, subsection, label, unit, sheet_row, value_type) values
-- ---------------------------------------------------------------- PRODUCTION
('prod.clinker_production',     'PRODUCTION','PRODUCTION',null,'Clinker Production','Tons',6,'number'),
('prod.clinker_consumed',      'PRODUCTION','PRODUCTION',null,'Clinker Consumed','Tons',7,'number'),
('prod.clinker_export',        'PRODUCTION','PRODUCTION',null,'Clinker Export','Tons',8,'number'),
('prod.clinker_import',        'PRODUCTION','PRODUCTION',null,'Clinker Import','Tons',9,'number'),
('prod.raw_meal',              'PRODUCTION','PRODUCTION',null,'Raw meal production','Tons',10,'number'),
('prod.natural_gypsum',        'PRODUCTION','PRODUCTION',null,'Natural Gypsum Consumed','Tons',11,'number'),
('prod.limestone_raw',         'PRODUCTION','PRODUCTION',null,'Limestone consumed as raw material','Tons',12,'number'),
('prod.cement_dispatched',     'PRODUCTION','PRODUCTION',null,'Total Cement Dispatched','Tons',13,'number'),
('prod.opc',                   'PRODUCTION','PRODUCTION',null,'Total OPC Produced','Tons',14,'number'),
('prod.ppc',                   'PRODUCTION','PRODUCTION',null,'Total PPC Produced','Tons',15,'number'),
('prod.psc',                   'PRODUCTION','PRODUCTION',null,'Total PSC Produced','Tons',16,'number'),
('prod.cc',                    'PRODUCTION','PRODUCTION',null,'Total CC Produced','Tons',17,'number'),
('prod.ipc',                   'PRODUCTION','PRODUCTION',null,'Total IPC Produced','Tons',18,'number'),
('prod.super_ppc',             'PRODUCTION','PRODUCTION',null,'Total Super PPC Produced','Tons',19,'number'),
('prod.ggbs',                  'PRODUCTION','PRODUCTION',null,'Total GGBS produced','Tons',20,'number'),
('prod.super_opc',             'PRODUCTION','PRODUCTION',null,'Total Super OPC Produced','Tons',21,'number'),

-- ---------------------------------------------------------------- ENERGY / POWER
('pwr.onsite_gen',             'ENERGY','ENERGY/POWER','Onsite power generation','Total Power generation from On-site power plant','MWh',28,'number'),
('pwr.onsite_delivered',       'ENERGY','ENERGY/POWER','Onsite power generation','Power delivered to cement plant from On-site power plant','MWh',29,'number'),
('pwr.whrs_gen',               'ENERGY','ENERGY/POWER','WHRS','Total power generation from WHRS power plant','MWh',31,'number'),
('pwr.whrs_delivered',         'ENERGY','ENERGY/POWER','WHRS','Power delivered to cement plant by WHRS','MWh',32,'number'),
('pwr.solar_gen',              'ENERGY','ENERGY/POWER','Solar','Total power generation from Solar power plant','MWh',34,'number'),
('pwr.solar_delivered',        'ENERGY','ENERGY/POWER','Solar','Power delivered to cement plant by Solar','MWh',35,'number'),
('pwr.hydel_delivered',        'ENERGY','ENERGY/POWER','Hydel','Power delivered to cement plant by Hydel','MWh',37,'number'),
('pwr.grid_total',             'ENERGY','ENERGY/POWER','Grid','Total Grid Power consumed (incl. import from SCL-R)','MWh',38,'number'),
('pwr.grid_delivered',         'ENERGY','ENERGY/POWER','Grid','Power delivered to cement plant from the grid','MWh',39,'number'),
('pwr.total_upto_clinker',     'ENERGY','ENERGY/POWER',null,'Total power consumption up to clinker production','MWh',40,'number'),
('pwr.clinker.ls_crusher',     'ENERGY','ENERGY/POWER','Power for Clinker','LS crusher','kWh',42,'number'),
('pwr.clinker.raw_mill',       'ENERGY','ENERGY/POWER','Power for Clinker','Raw mill','kWh',43,'number'),
('pwr.clinker.pyro',           'ENERGY','ENERGY/POWER','Power for Clinker','Pyro','kWh',44,'number'),
('pwr.clinker.coal_mill',      'ENERGY','ENERGY/POWER','Power for Clinker','Coal mill','kWh',45,'number'),
('pwr.cement.grinding',        'ENERGY','ENERGY/POWER','Power for grinding/packing','Power consumed in cement grinding','kWh',47,'number'),
('pwr.cement.packing',         'ENERGY','ENERGY/POWER','Power for grinding/packing','Power consumed in cement packing','kWh',48,'number'),
('pwr.cement.utilities',       'ENERGY','ENERGY/POWER','Power for grinding/packing','Power consumed in Utilities and others','kWh',49,'number'),
('pwr.byproduct.opc',          'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for OPC','kWh',51,'number'),
('pwr.byproduct.ppc',          'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for PPC','kWh',52,'number'),
('pwr.byproduct.psc',          'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for PSC','kWh',53,'number'),
('pwr.byproduct.cc',           'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for CC','kWh',54,'number'),
('pwr.byproduct.ipc',          'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for IPC','kWh',55,'number'),
('pwr.byproduct.super_ppc',    'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for super PPC','kWh',56,'number'),
('pwr.byproduct.ggbs',         'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for GGBS','kWh',57,'number'),
('pwr.byproduct.super_opc',    'ENERGY','ENERGY/POWER','Power for overall cement','Power consumption for Super OPC','kWh',58,'number'),
('pwr.dg_consumption',         'ENERGY','ENERGY/POWER',null,'DG power consumption','MWh',59,'number'),
('pwr.onsite_export',          'ENERGY','ENERGY/POWER',null,'Onsite power generation export to grid','MWh',60,'number'),

-- ---------------------------------------------------------------- EMISSION QUALITY (B2 calcination inputs)
('qual.clinker_cao',           'EMISSIONS','EMISSION/Quality','Clinker quality','CaO (incl. free lime)','%',68,'number'),
('qual.clinker_mgo',           'EMISSIONS','EMISSION/Quality','Clinker quality','MgO','%',69,'number'),
('qual.ash.imported_coal',     'EMISSIONS','EMISSION/Quality','Coal Ash Content','Imported coal','%',73,'number'),
('qual.ash.indigenous_coal',   'EMISSIONS','EMISSION/Quality','Coal Ash Content','Indigenous coal','%',74,'number'),
('qual.ash.lignite',           'EMISSIONS','EMISSION/Quality','Coal Ash Content','Lignite','%',75,'number'),
('qual.ash.petcoke',           'EMISSIONS','EMISSION/Quality','Coal Ash Content','Pet coke','%',76,'number'),
('qual.ash.rice_husk',         'EMISSIONS','EMISSION/Quality','Coal Ash Content','Rice husk','%',77,'number'),
('qual.ash.tyres',             'EMISSIONS','EMISSION/Quality','Coal Ash Content','Tyres (Spent Carbon)','%',78,'number'),
('qual.ash_cao',               'EMISSIONS','EMISSION/Quality','Coal Ash analysis','CaO','%',82,'number'),
('qual.ash_mgo',               'EMISSIONS','EMISSION/Quality','Coal Ash analysis','MgO','%',83,'number'),

-- ---------------------------------------------------------------- FUEL (kiln) — representative set; pattern repeats per fuel
-- consumption (Tons unless noted) ...
('fuel.kiln.indigenous_petcoke.qty','FUEL','FUEL/Kiln','Conventional fossil','Indigenous pet coke','Tons',103,'number'),
('fuel.kiln.g5_coal.qty',          'FUEL','FUEL/Kiln','Conventional fossil','Indigenous G5 Coal','Tons',110,'number'),
('fuel.kiln.diesel_oil.qty',       'FUEL','FUEL/Kiln','Conventional fossil','Diesel oil','KL',121,'number'),
('fuel.kiln.spent_carbon.qty',     'FUEL','FUEL/Kiln','Alternate','Spent Carbon','Tons',124,'number'),
('fuel.kiln.shredded_plastic.qty', 'FUEL','FUEL/Kiln','Alternate','Shredded Plastic','Tons',126,'number'),
('fuel.kiln.organic_residue.qty',  'FUEL','FUEL/Kiln','Alternate','Organic Residue','Tons',128,'number'),
('fuel.kiln.organic_solvents.qty', 'FUEL','FUEL/Kiln','Alternate','Organic Liquid Solvents','Tons',129,'number'),
('fuel.kiln.wood_sawdust.qty',     'FUEL','FUEL/Kiln','Biomass','Wood, non impregnated saw dust','Tons',136,'number'),
-- ... and their LHV (kCal/kg)
('fuel.kiln.indigenous_petcoke.lhv','FUEL','FUEL/Kiln','LHV fossil','Indigenous pet coke','kCal/kg',150,'number'),
('fuel.kiln.g5_coal.lhv',          'FUEL','FUEL/Kiln','LHV fossil','Indigenous G5 Coal','kCal/kg',157,'number'),
('fuel.kiln.diesel_oil.lhv',       'FUEL','FUEL/Kiln','LHV fossil','Diesel oil','kCal/kg',168,'number'),
('fuel.kiln.spent_carbon.lhv',     'FUEL','FUEL/Kiln','LHV alternate','Spent Carbon','kCal/kg',171,'number'),
('fuel.kiln.shredded_plastic.lhv', 'FUEL','FUEL/Kiln','LHV alternate','Shredded Plastic','kCal/kg',173,'number'),
('fuel.kiln.organic_residue.lhv',  'FUEL','FUEL/Kiln','LHV alternate','Organic Residue','kCal/kg',175,'number'),
('fuel.kiln.organic_solvents.lhv', 'FUEL','FUEL/Kiln','LHV alternate','Organic Liquid Solvents','kCal/kg',176,'number'),
('fuel.kiln.wood_sawdust.lhv',     'FUEL','FUEL/Kiln','LHV biomass','Wood, non impregnated saw dust','kCal/kg',183,'number'),

-- ---------------------------------------------------------------- COMPANY VEHICLES / DG / OTHER
('veh.diesel',                 'EMISSIONS','COMPANY VEHICLES',null,'Diesel','kL',387,'number'),
('veh.petrol',                 'EMISSIONS','COMPANY VEHICLES',null,'Petrol/Gasoline','kL',388,'number'),
('veh.other_fossil',           'EMISSIONS','COMPANY VEHICLES',null,'Other fossil fuels','kL',389,'number'),
('veh.bio_diesel',             'EMISSIONS','COMPANY VEHICLES',null,'Bio and mixed diesel','kL',390,'number'),
('dg.is_company_owned',        'EMISSIONS','DG SETS',null,'Whether the DG set is company owned','Yes/No',395,'text'),
('dg.diesel',                  'EMISSIONS','DG SETS',null,'Diesel Consumption','kL',397,'number'),
('other.refrig_r407c',         'EMISSIONS','OTHER EMISSION','Refrigeration','Refrigerant R407C','kg',404,'number'),
('other.refrig_r134a',         'EMISSIONS','OTHER EMISSION','Refrigeration','Refrigerant R134A','kg',405,'number'),
('other.refrig_r32',           'EMISSIONS','OTHER EMISSION','Refrigeration','Refrigerant R32','kg',406,'number'),
('other.refrig_r410a',         'EMISSIONS','OTHER EMISSION','Refrigeration','Refrigerant R410A','kg',407,'number'),
('other.refrig_r22',           'EMISSIONS','OTHER EMISSION','Refrigeration','Refrigerant R22','kg',408,'number'),
('other.fire_co2',             'EMISSIONS','OTHER EMISSION',null,'Fire extinguisher (CO2 type)','kg',409,'number'),
('other.welding_lpg',          'EMISSIONS','OTHER EMISSION','Cutting & Welding','LPG','kg',411,'number'),
('other.welding_diacetylene',  'EMISSIONS','OTHER EMISSION','Cutting & Welding','Di Acetylene','kg',412,'number'),
('other.canteen_lpg',          'EMISSIONS','OTHER EMISSION','Canteen','LPG','kg',414,'number'),
('other.canteen_fuel_oil',     'EMISSIONS','OTHER EMISSION','Canteen','Fuel oil','kg',415,'number'),
('other.canteen_other',        'EMISSIONS','OTHER EMISSION','Canteen','Other','kg',416,'number'),

-- ---------------------------------------------------------------- SCOPE 3 (representative)
('s3.cement_road.qty',         'SCOPE3','Cement Despatch by Road',null,'Qty despatch by road','MT',423,'number'),
('s3.cement_road.distance',    'SCOPE3','Cement Despatch by Road',null,'Wt avg despatch distance (one way)','km',424,'number'),
('s3.cement_road.loading',     'SCOPE3','Cement Despatch by Road',null,'Wt avg lorry loading','MT/lorry',425,'number'),
('s3.cement_road.mileage',     'SCOPE3','Cement Despatch by Road',null,'Wt avg mileage of lorry','KMPL',426,'number'),
('s3.cement_rail.qty',         'SCOPE3','Cement despatch by Rail',null,'Qty despatch by Rail','MT',429,'number'),
('s3.cement_rail.distance',    'SCOPE3','Cement despatch by Rail',null,'Wt avg despatch distance (one way)','km',430,'number'),

-- ---------------------------------------------------------------- EMPLOYEE COMMUTING
('commute.scooter.distance',   'SCOPE3','Employee Commuting','Scooter','Total distance travelled (two way)/month','KM',515,'number'),
('commute.motorcycle.distance','SCOPE3','Employee Commuting','Motorcycle','Total distance travelled (two way)/month','KM',519,'number'),
('commute.car_petrol.distance','SCOPE3','Employee Commuting','Car-Petrol','Total distance travelled (two way)','KM',523,'number'),
('commute.car_diesel.distance','SCOPE3','Employee Commuting','Car-Diesel','Total distance travelled (two way)','KM',527,'number'),
('commute.bus.employees',      'SCOPE3','Employee Commuting','Bus','Total number of employees','Number',530,'number'),
('commute.bus.distance',       'SCOPE3','Employee Commuting','Bus','Total distance travelled (two way)/month','KM',531,'number'),

-- ---------------------------------------------------------------- RESOURCES (alt cementitious -> clinker factor)
('res.gypsum_chemical',        'RESOURCES','Alt Cementitious',null,'Gypsum consumed - Chemical','Tons',553,'number'),
('res.pi_limestone',           'RESOURCES','Alt Cementitious',null,'P.I (Performance Improver) - Lime stone','Tons',554,'number'),
('res.slag',                   'RESOURCES','Alt Cementitious',null,'Slag consumed','Tons',555,'number'),
('res.fly_ash',                'RESOURCES','Alt Cementitious',null,'Fly Ash consumed','Tons',556,'number'),
('res.calcined_lime',          'RESOURCES','Alt Cementitious',null,'Calcined lime','Tons',557,'number'),

-- ---------------------------------------------------------------- WATER (representative; full GCCA water-positivity set extends here)
('water.consume.cement_process','WATER','Freshwater by section',null,'Fresh water consumption in cement process','k Litres',566,'number'),
('water.consume.power_plant',  'WATER','Freshwater by section',null,'Fresh water consumption in on-site power plant','k Litres',567,'number'),
('water.consume.township',     'WATER','Freshwater by section',null,'Fresh water consumption in township','k Litres',568,'number'),
('water.wd.borewell',          'WATER','Withdrawal/Ground',null,'Sub-surface - Bore-well','TCM',577,'number'),
('water.wd.open_well',         'WATER','Withdrawal/Ground',null,'Sub-surface - Open Well','TCM',578,'number'),
('water.wd.mine_pit',          'WATER','Withdrawal/Surface',null,'Surface Water Body - Mine Pit','TCM',580,'number'),
('water.wd.river',             'WATER','Withdrawal/Surface',null,'Surface Water Body - River','TCM',581,'number'),
('water.wd.reservoir',         'WATER','Withdrawal/Surface',null,'Surface Water Body - Reservoir/Lake','TCM',582,'number'),
('water.wd.pond',              'WATER','Withdrawal/Surface',null,'Surface Water Body - Pond','TCM',583,'number'),
('water.wd.canal',             'WATER','Withdrawal/Surface',null,'Surface Water Body - Canal','TCM',584,'number'),
('water.wd.municipal',         'WATER','Withdrawal/Surface',null,'Surface Water Body - Municipal Supply','TCM',585,'number'),
('water.discharge.surface',    'WATER','Discharge',null,'Surface','TCM',636,'number'),
('water.discharge.ground',     'WATER','Discharge',null,'Ground','TCM',637,'number'),
('water.recycled',             'WATER','Discharge',null,'Total Water Recycled/Reused','KL',649,'number'),

-- ---------------------------------------------------------------- WASTE (the three category tables roll up by formula; representative)
('waste.gen.hazardous_total',  'WASTE','Waste Generation','Hazardous','Hazardous waste (sum)','Tons',653,'number'),
('waste.gen.nonhaz_total',     'WASTE','Waste Generation','Non Hazardous','Non hazardous waste (sum)','Tons',663,'number'),
('waste.divert.haz.reused',    'WASTE','Waste Disposal','Diverted/Hazardous','Reused in the kiln','Tons',940,'number'),
('waste.divert.haz.recycled',  'WASTE','Waste Disposal','Diverted/Hazardous','recycled','Tons',941,'number'),
('waste.divert.haz.other',     'WASTE','Waste Disposal','Diverted/Hazardous','Other recovery operations','Tons',942,'number'),
('waste.divert.nonhaz.reused', 'WASTE','Waste Disposal','Diverted/NonHaz','Reused','Tons',945,'number'),
('waste.divert.nonhaz.recycled','WASTE','Waste Disposal','Diverted/NonHaz','recycled','Tons',946,'number'),
('waste.divert.nonhaz.other',  'WASTE','Waste Disposal','Diverted/NonHaz','Other recovery operations','Tons',947,'number'),
('waste.disp.haz.recyclers',   'WASTE','Waste Disposal','Directed/Hazardous','Authorized recyclers (CPCB/SPCB)','Tons',951,'number'),
('waste.disp.haz.incin_er',    'WASTE','Waste Disposal','Directed/Hazardous','Incineration (with energy recovery)','Tons',952,'number'),
('waste.disp.haz.incin_noer',  'WASTE','Waste Disposal','Directed/Hazardous','Incineration (without energy recovery)','Tons',953,'number'),
('waste.disp.haz.landfill',    'WASTE','Waste Disposal','Directed/Hazardous','Landfilling','Tons',954,'number'),
('waste.disp.nonhaz.recyclers','WASTE','Waste Disposal','Directed/NonHaz','Authorized recyclers (CPCB/SPCB)','Tons',957,'number'),
('waste.disp.nonhaz.landfill', 'WASTE','Waste Disposal','Directed/NonHaz','Landfilling','Tons',960,'number'),
('waste.disp.nonhaz.other',    'WASTE','Waste Disposal','Directed/NonHaz','Other disposal operations','Tons',961,'number'),

-- ---------------------------------------------------------------- BIODIVERSITY
('bio.new_plantation_area',    'BIODIVERSITY','Biodiversity',null,'Area of new plantation developed','Hectares',968,'number'),
('bio.new_plants',             'BIODIVERSITY','Biodiversity',null,'Number of new plants grown','Number',969,'number'),
('bio.investment',             'BIODIVERSITY','Biodiversity',null,'Investment in plantation/biodiversity projects','INR',970,'number'),
('bio.area_impacted',          'BIODIVERSITY','Biodiversity',null,'Total area impacted from operation','m2',971,'number'),
('bio.habitats_restored',      'BIODIVERSITY','Biodiversity',null,'Habitats protected or restored','Hectares',972,'number'),
('bio.greenbelt_area',         'BIODIVERSITY','Biodiversity',null,'Total area developed as green belt','Hectares',975,'number'),
('bio.total_plant_area',       'BIODIVERSITY','Water/Plant area',null,'Total Plant Area (incl. mine, CPP, colony)','m2',591,'number'),

-- ---------------------------------------------------------------- AIR (non-GHG)
('air.dust',                   'AIR','Air Emission',null,'Dust - Absolute emissions','Ton',987,'number'),
('air.nox',                    'AIR','Air Emission',null,'NOx - Absolute emissions','Ton',988,'number'),
('air.sox',                    'AIR','Air Emission',null,'SOx - Absolute emissions','Ton',989,'number'),
('air.pm',                     'AIR','Air Emission',null,'PM','Ton',990,'number');
