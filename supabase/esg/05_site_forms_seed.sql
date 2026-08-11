-- =============================================================================
-- BIRLA ESTATES — SITE FORM REPLICAS
--
-- Three form variants are in use across the portfolio. Each is reproduced row
-- for row, in its own order, with its own wording — including the typos site
-- teams see on their sheets every month ("Grid Electricity consmuption",
-- "Scarp - Wood -MT", "Collant Oil form HVAC"). Correcting them would make the
-- screen stop matching the paper.
--
--   FORM.COMMERCIAL.V1   Birla Aurora. Operating building: tenant + floor-wise
--                        electricity, water end-use breakdown, cooling tower,
--                        no C&D row, refrigerant and extinguisher block.
--   FORM.RESIDENTIAL.V1  Tisya, Sangamwadi and the other construction sites.
--                        Treated water, plant & machinery diesel, C&D + scrap,
--                        the full hazardous list, DG1-DG4 + marketing office.
--   FORM.RESIDENTIAL.F17 Trimaya only (Ref BRT/EHS/ESG/F-17). Different row
--                        numbers, no site/period header, waste-water rows
--                        instead of STP, "Diesel for vehicles" not "plant and
--                        machinery", a much shorter waste list.
--
-- HOW MAPPING WORKS
--   parameter_id  which canonical parameter the row feeds (null = captured but
--                 not consolidated, e.g. agency names)
--   unit_factor   multiplier to reach the canonical unit (0.001 for Ltrs->kL
--                 and kg->MT). The user types what the form asks for.
--   aggregate_key rows sharing a key are SUMMED into one parameter — Aurora's
--                 Level 8 + Level 13, and every DG running-time row.
--   is_form_total the site's own hand-computed total, cross-checked against the
--                 sum of its parts but never consolidated.
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- Form definitions
-- -----------------------------------------------------------------------------
insert into esg.site_form (code, name, description, form_ref, version, effective_from, effective_to) values
('FORM.COMMERCIAL.FY24', 'Monthly ESG Report - Commercial Asset (FY24)',
 'The FY24 commercial layout, superseded from February 2024. Carried a rainwater-harvesting row, a plain "Grid Electricity consumption" line (no green-energy designation), "Diesel for vehicles" rather than plant and machinery, no water end-use breakdown, no plastic-waste row and no refrigerant block.',
 null, 1, '2023-04-01', '2024-01-31');

insert into esg.site_form (code, name, description, form_ref, version, effective_from) values
('FORM.COMMERCIAL.V1',  'Monthly ESG Report - Commercial Asset',
 'Operating commercial building. Tenant and floor-wise electricity, water end-use breakdown, refrigerant and extinguisher refills. In use at Aurora from February 2024.',
 null, 2, '2024-02-01'),
('FORM.RESIDENTIAL.V1', 'Monthly ESG Report - Residential Assets',
 'Residential project under construction. Treated water, plant and machinery diesel, C&D waste and scrap, full hazardous waste list.',
 null, 1, '2023-04-01'),
('FORM.RESIDENTIAL.F17','Monthly ESG Report - Trimaya (F-17)',
 'Trimaya variant. No site/period header, waste-water rows in place of STP, condensed waste list.',
 'BRT/EHS/ESG/F-17', 1, '2024-04-01');

-- -----------------------------------------------------------------------------
-- Which site files which form
-- -----------------------------------------------------------------------------
-- Aurora filed the FY24 layout through January 2024, then the current one. The
-- assignment is date-bounded so a historic month still renders in the layout it
-- was actually filed under.
insert into esg.site_form_assignment (site_id, form_id, effective_from, effective_to)
select s.id, f.id, '2023-04-01', '2024-01-31'
from esg.site s, esg.site_form f
where s.code = 'AURORA' and f.code = 'FORM.COMMERCIAL.FY24';

insert into esg.site_form_assignment (site_id, form_id, effective_from)
select s.id, f.id, '2024-02-01'
from esg.site s, esg.site_form f
where s.code = 'AURORA' and f.code = 'FORM.COMMERCIAL.V1';

insert into esg.site_form_assignment (site_id, form_id, effective_from)
select s.id, f.id, '2023-04-01'
from esg.site s, esg.site_form f
where f.code = 'FORM.COMMERCIAL.V1'
  and s.code in ('CENTURION','CENTURY_BHAVAN');

insert into esg.site_form_assignment (site_id, form_id, effective_from)
select s.id, f.id, '2023-04-01'
from esg.site s, esg.site_form f
where f.code = 'FORM.RESIDENTIAL.V1'
  and s.code in ('TISYA','SANGAMWADI','EVARA','OJASVI','NAVYA','ARIKA','NIYAARA');

insert into esg.site_form_assignment (site_id, form_id, effective_from)
select s.id, f.id, '2024-04-01'
from esg.site s, esg.site_form f
where s.code = 'TRIMAYA' and f.code = 'FORM.RESIDENTIAL.F17';

-- =============================================================================
-- FORM.COMMERCIAL.V1 — Birla Aurora
-- Source layout: input/BA_ESG_Monthly_Aug_24.xlsx, tabs 'April 24'..'Aug 24'
-- =============================================================================

-- Water Consumption (form rows 13-23, column B). Form unit m3 = canonical KL.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, is_form_total, notes)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, v.is_total, v.notes
from esg.site_form f,
(values
 ('Water Consumption', 10, 'Total fresh water consumption',  'm3', 'water.total_reported', 1, true,  'Site-computed total; checked against municipality + ground water.'),
 ('Water Consumption', 20, 'from Municipality',              'm3', 'water.municipal',      1, false, null),
 ('Water Consumption', 30, 'From Ground Water ( onsite)',    'm3', 'water.groundwater',    1, false, null),
 ('Water Consumption', 40, 'From Tanker ( offsite)',         'm3', 'water.tanker',         1, false, null),
 ('Water Consumption', 50, 'Sewage Generated - STP inlet',   'm3', 'water.stp_inlet',      1, false, 'Memo. Apr-24 was left blank on the filed form.'),
 ('Water Consumption', 60, 'Sewage Recycled - STP Outlet',   'm3', 'water.stp_outlet',     1, false, 'Memo. Checked against inlet.'),
 ('Water Consumption', 70, 'Flushing',                       'm3', 'water.flushing',       1, false, null),
 ('Water Consumption', 80, 'Irrigation',                     'm3', 'water.irrigation',     1, false, null),
 ('Water Consumption', 90, 'Car Wash',                       'm3', 'water.car_wash',       1, false, null),
 ('Water Consumption',100, 'Cooling Tower Makup',            'm3', 'water.cooling_tower',  1, false, null)
) as v(group_label, row_order, label, form_unit, pkey, factor, is_total, notes)
where f.code = 'FORM.COMMERCIAL.V1';

-- Electricity Consumption (form rows 13-17, column F).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key, notes)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, v.agg, v.notes
from esg.site_form f,
(values
 ('Electricity Consumption', 110, 'Grid Electricity consmuption ( Green Energy)', 'KWh', 'elec.green',      1, null, 'Green power purchase. Feeds renewable electricity.'),
 ('Electricity Consumption', 120, 'Electricty from renewables',                   'KWh', 'elec.renewable',  1, null, null),
 ('Electricity Consumption', 130, 'Tenant Electricity consumption',               'KWh', 'elec.tenant',     1, null, 'Memo. Outside the entity boundary since FY24.'),
 ('Electricity Consumption', 140, 'Level 8 Electricity consumption',              'KWh', 'elec.own_floor_1',1, 'own_floors', 'BEPL-occupied floor.'),
 ('Electricity Consumption', 150, 'Level 13 Electricity consumption',             'KWh', 'elec.own_floor_2',1, 'own_floors', 'BEPL-occupied floor.')
) as v(group_label, row_order, label, form_unit, pkey, factor, agg, notes)
where f.code = 'FORM.COMMERCIAL.V1';

-- Fuel Consumption (form rows 19-21, column F). Ltrs -> kL.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor
from esg.site_form f,
(values
 ('Fuel Consumption', 160, 'DG set - Diesel',                'Ltrs', 'fuel.diesel_dg',    0.001),
 ('Fuel Consumption', 170, 'Diesel for plant and Machinery', 'Ltrs', 'fuel.diesel_plant', 0.001),
 ('Fuel Consumption', 180, 'Petrol',                         'Ltrs', 'fuel.petrol',       0.001)
) as v(group_label, row_order, label, form_unit, pkey, factor)
where f.code = 'FORM.COMMERCIAL.V1';

-- Waste Management — generated column (form rows 28-41, column B).
-- Aurora's form splits scrap across three rows (steel / wood / other) which sum
-- into the single canonical scrap parameter.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key, notes)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, v.agg, v.notes
from esg.site_form f,
(values
 ('Non Hazardous waste', 200, 'C&D Waste - Debris -MT',                   'MT',    'waste.cnd',           1,     null,    null),
 ('Non Hazardous waste', 210, 'Scrap - Steel -MT',                        'MT',    'waste.scrap',         1,     'scrap', null),
 ('Non Hazardous waste', 220, 'Scarp - Wood -MT',                         'MT',    'waste.scrap',         1,     'scrap', 'Form typo "Scarp" retained.'),
 ('Non Hazardous waste', 230, 'Scrap -Other -MT',                         'MT',    'waste.scrap',         1,     'scrap', null),
 ('Non Hazardous waste', 240, 'Plastic Waste - MT',                       'MT',    'waste.plastic',       1,     null,    null),
 ('Non Hazardous waste', 250, 'Municipal solid waste (Thermocoal, Glass, Cotton, Paper, Wood waste) -MT','MT','waste.municipal',1,null,null),
 ('Non Hazardous waste', 260, 'food waste - From site -MT',               'MT',    'waste.food',          1,     null,    null),
 ('Hazardous waste',     270, 'Used Oil - Litres',                        'Litres','waste.used_oil',      1,     null,    'Canonical unit is litres — no density available to convert to MT.'),
 ('Hazardous waste',     280, 'Oil Filters - Nos',                        'Nos',   'waste.oil_filters_no',1,     null,    'A count, not a mass.'),
 ('Hazardous waste',     290, 'Other Contaminated Waste - kg',            'kg',    'waste.contaminated',  0.001, null,    null),
 ('Hazardous waste',     300, 'Bio-Medical waste - kg',                   'kg',    'waste.biomedical',    0.001, null,    null),
 ('Hazardous waste',     310, 'Battery Waste - Nos',                      'Nos',   'waste.battery_no',    1,     null,    'A count, not a mass.'),
 ('Hazardous waste',     320, 'Electronic waste - kg',                    'kg',    'waste.ewaste',        0.001, null,    null)
) as v(group_label, row_order, label, form_unit, pkey, factor, agg, notes)
where f.code = 'FORM.COMMERCIAL.V1';

-- Waste — recycled-on-site column, for the rows where the form asks for it.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, column_kind)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, 'reused_onsite'
from esg.site_form f,
(values
 ('Non Hazardous waste', 240, 'Plastic Waste - MT',        'MT', 'waste.plastic_recycled',   1),
 ('Non Hazardous waste', 250, 'Municipal solid waste -MT', 'MT', 'waste.municipal_recycled', 1),
 ('Non Hazardous waste', 260, 'food waste - From site -MT','MT', 'waste.food_recycled',      1)
) as v(group_label, row_order, label, form_unit, pkey, factor)
where f.code = 'FORM.COMMERCIAL.V1';

-- DG Details (form rows 44-45). Two DGs, summed. The form's own unit column
-- drifts between Hrs and Min — the entry UI asks explicitly which.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key, help_text)
select f.id, 'DG Details', v.row_order, v.label, 'Hrs',
       (select id from esg.input_parameter where key = 'ops.dg_hours'), 1, 'dg_hours', v.help
from esg.site_form f,
(values
 (400, 'DG1 running time', 'Enter in hours. Jul-24 and Aug-24 were historically filed in minutes.'),
 (410, 'DG2 running time', 'Enter in hours.')
) as v(row_order, label, help)
where f.code = 'FORM.COMMERCIAL.V1';

-- Refrigerants & extinguishers (form rows 47-50).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, help_text)
select f.id, 'Refrigerants & Extinguisher Refilling', v.row_order, v.label, 'Kg',
       (select id from esg.input_parameter where key = v.pkey), 1, v.help
from esg.site_form f,
(values
 (500, 'R404A',  'refrig.r404a', null),
 (510, 'R410A',  'refrig.r410a', null),
 (520, 'R407C',  'refrig.r407c', null),
 (530, 'R22',    'refrig.r22',   'Montreal Protocol gas — reported as a quantity, excluded from Scope 1.'),
 (540, 'R134a',  'refrig.r134a', null),
 (550, 'Co2 based Extinguisher Refilling', 'refrig.co2_extinguisher',
  'Total mass refilled. Where the form lists cylinder size and count (e.g. 9 Kg x1, 4.5 Kg x1), enter the total: 13.5.')
) as v(row_order, label, pkey, help)
where f.code = 'FORM.COMMERCIAL.V1';

-- =============================================================================
-- FORM.RESIDENTIAL.V1 — Tisya, Sangamwadi, and other construction sites
-- Source layout: input/Monthy ESG Report - ... Birla Tisya- Apr'24.xlsx
--                input/Monthy ESG Report - Sangamwadi_Dec'24.xlsx
-- =============================================================================

-- Water Consumption (form rows 13-19).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, is_form_total, notes)
select f.id, 'Water Consumption', v.row_order, v.label, 'm3',
       (select id from esg.input_parameter where key = v.pkey), 1, v.is_total, v.notes
from esg.site_form f,
(values
 (10, 'Total fresh water consumption',            'water.total_reported', true,  'Site-computed total; checked against the sum of its sources.'),
 (20, 'from Municipality',                        'water.municipal',      false, null),
 (30, 'From Ground Water ( colony)',              'water.groundwater',    false, null),
 (40, 'From Tanker ( offsite)',                   'water.tanker',         false, null),
 (50, 'Sewage Waste Generated  STP inlet',        'water.stp_inlet',      false, 'Memo.'),
 (60, 'Treated Water used at construction site',  'water.treated_used',   false, null),
 (70, 'Water for drinking',                       'water.drinking',       false, 'Present on the Sangamwadi variant; booked to third-party water.')
) as v(row_order, label, pkey, is_total, notes)
where f.code = 'FORM.RESIDENTIAL.V1';

-- Electricity (form rows 13-14).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, 'Electricity Consumption', v.row_order, v.label, 'KWh',
       (select id from esg.input_parameter where key = v.pkey), 1
from esg.site_form f,
(values
 (110, 'Grid Electricity consmuption', 'elec.grid'),
 (120, 'Electricty from renewables',   'elec.renewable')
) as v(row_order, label, pkey)
where f.code = 'FORM.RESIDENTIAL.V1';

-- Fuel (form rows 19-21). Ltrs -> kL.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, 'Fuel Consumption', v.row_order, v.label, 'Ltrs',
       (select id from esg.input_parameter where key = v.pkey), 0.001
from esg.site_form f,
(values
 (160, 'DG set - Diesel',                'fuel.diesel_dg'),
 (170, 'Diesel for plant and Machinery', 'fuel.diesel_plant'),
 (180, 'Petrol',                         'fuel.petrol')
) as v(row_order, label, pkey)
where f.code = 'FORM.RESIDENTIAL.V1';

-- Waste — generated column (form rows 26-40).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, help_text, notes)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, v.help, v.notes
from esg.site_form f,
(values
 ('Non Hazardous waste', 200, 'C&D Waste - Debris -MT',                       'MT',    'waste.cnd',           1,
  null, null),
 ('Non Hazardous waste', 210, 'Scrap (Rebar, steel, Threading, Wooden - MT',  'MT',    'waste.scrap',         1,
  'Enter the total tonnage. Historically filed as free text ("Rebar - 3.5 / Steel - 0.02 / Wood - 0.15") and parsed to a single number.',
  'Consolidated into C&D waste — BRSR has no scrap category.'),
 ('Non Hazardous waste', 220, 'Municipal solid waste ( General waste,Paper, cardboard, Cement bags,Plastic waste)  MT','MT','waste.municipal',1,
  null, null),
 ('Non Hazardous waste', 230, 'food waste - From site -MT',                   'MT',    'waste.food',          1,
  'Filed in kg on some returns ("58 kg") — enter MT.', null),
 ('Hazardous waste',     240, 'Used Oil - Litres',                            'Litres','waste.used_oil',      1,     null, null),
 ('Hazardous waste',     250, 'Oil Filters - Nos',                            'Nos',   'waste.oil_filters_no',1,
  'A count. The BRSR tonnage line cannot be derived from it without an average unit weight.', null),
 ('Hazardous waste',     260, 'Other Contaminated Waste - kg',                'kg',    'waste.contaminated',  0.001, null, null),
 ('Hazardous waste',     270, 'Battery Waste - Nos',                          'Nos',   'waste.battery_no',    1,     null, null),
 ('Hazardous waste',     280, 'Electronic waste - kg',                        'kg',    'waste.ewaste',        0.001, null, null),
 ('Hazardous waste',     290, 'Cotton rags for Cleaning Hazardous Waste - Kg','kg',    'waste.cotton_rags',   0.001, null, null),
 ('Hazardous waste',     300, 'paint drums - kg',                             'kg',    'waste.paint_drums',   0.001, null, 'Feeds BRSR "other hazardous (diesel barrels)".'),
 ('Hazardous waste',     310, 'Collant Oil form HVAC - Litres',               'Litres','waste.coolant_oil',   1,     null, 'Form typo retained.')
) as v(group_label, row_order, label, form_unit, pkey, factor, help, notes)
where f.code = 'FORM.RESIDENTIAL.V1';

-- Waste — reused-on-site column.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, column_kind)
select f.id, 'Non Hazardous waste', v.row_order, v.label, 'MT',
       (select id from esg.input_parameter where key = v.pkey), 1, 'reused_onsite'
from esg.site_form f,
(values
 (200, 'C&D Waste - Debris -MT',      'waste.cnd_reused'),
 (220, 'Municipal solid waste  MT',   'waste.municipal_recycled'),
 (230, 'food waste - From site -MT',  'waste.food_recycled')
) as v(row_order, label, pkey)
where f.code = 'FORM.RESIDENTIAL.V1';

-- DG Details (form rows 44-48). Five DG rows, summed.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key)
select f.id, 'DG Details', v.row_order, v.label, 'Hrs',
       (select id from esg.input_parameter where key = 'ops.dg_hours'), 1, 'dg_hours'
from esg.site_form f,
(values
 (400, 'DG1 running time -Site'),
 (410, 'DG2 running time -Site'),
 (420, 'DG3 running time- Site'),
 (430, 'DG4 running time- Labour Camp'),
 (440, 'DG4 running time - Birla Marketing Office')
) as v(row_order, label)
where f.code = 'FORM.RESIDENTIAL.V1';

-- =============================================================================
-- FORM.RESIDENTIAL.F17 — Birla Trimaya
-- Source layout: input/ESG Online data Trimaya -Feb-25.xlsx › Sheet1
--
-- Note the differences from RESIDENTIAL.V1: waste-water generated/recycled
-- instead of an STP inlet row, a treated-STP-tanker source, "Diesel for
-- vehicles" rather than "plant and Machinery", no scrap or food-waste row, and
-- a condensed hazardous list.
-- =============================================================================

-- Water Consumption (form rows 7-14).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, is_form_total, notes)
select f.id, 'Water Consumption', v.row_order, v.label, 'm3',
       (select id from esg.input_parameter where key = v.pkey), 1, v.is_total, v.notes
from esg.site_form f,
(values
 (10, 'Total fresh water consumption',    'water.total_reported',        true,  'Site-computed total; the Feb-25 return failed this check (120.4 filed vs 1,929.92 from its sources).'),
 (20, 'from Municipality',                'water.municipal',             false, null),
 (30, 'From Ground Water ( onsite)',      'water.groundwater',           false, null),
 (40, 'From Tanker ( offsite)',           'water.tanker',                false, null),
 (50, 'From Tanker - Treated STP Water',  'water.tanker_treated',        false, null),
 (60, 'Waste water Generated',            'water.wastewater_generated',  false, 'Memo — the template reports zero discharge.'),
 (70, 'Waste water Recycled',             'water.wastewater_recycled',   false, 'Memo.')
) as v(row_order, label, pkey, is_total, notes)
where f.code = 'FORM.RESIDENTIAL.F17';

-- Electricity (form rows 7-8).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, 'Electricity Consumption', v.row_order, v.label, 'KWh',
       (select id from esg.input_parameter where key = v.pkey), 1
from esg.site_form f,
(values
 (110, 'Grid Electricity consmuption', 'elec.grid'),
 (120, 'Electricty from renewables',   'elec.renewable')
) as v(row_order, label, pkey)
where f.code = 'FORM.RESIDENTIAL.F17';

-- Fuel (form rows 13-15). Ltrs -> kL.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, 'Fuel Consumption', v.row_order, v.label, 'Ltrs',
       (select id from esg.input_parameter where key = v.pkey), 0.001
from esg.site_form f,
(values
 (160, 'DG set - Diesel',        'fuel.diesel_dg'),
 (170, 'Diesel for vehicles',    'fuel.diesel_vehicle'),
 (180, 'Petrol',                 'fuel.petrol')
) as v(row_order, label, pkey)
where f.code = 'FORM.RESIDENTIAL.F17';

-- Waste — generated column (form rows 20-29).
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, help_text)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor, v.help
from esg.site_form f,
(values
 ('Non Hazardous waste', 200, 'C&D Waste',                              'MT',    'waste.cnd',           1,     null),
 ('Non Hazardous waste', 210, 'Municipal solid waste (Plastic, cardboard etc)','MT','waste.municipal', 1,
  'Filed as "500 kg" on the Feb-25 return — enter MT.'),
 ('Hazardous waste',     220, 'Battery Waste',                          'Nos',   'waste.battery_no',    1,     null),
 ('Hazardous waste',     230, 'Electronic waste',                       'kg',    'waste.ewaste',        0.001, null),
 ('Hazardous waste',     240, 'Used Oil',                               'Litres','waste.used_oil',      1,     null),
 ('Hazardous waste',     250, 'Oil Filters',                            'Nos',   'waste.oil_filters_no',1,     null),
 ('Hazardous waste',     260, 'Other Contaminated Waste',               'kg',    'waste.contaminated',  0.001, null),
 ('Hazardous waste',     270, 'Bio-Medical waste',                      'kg',    'waste.biomedical',    0.001, null)
) as v(group_label, row_order, label, form_unit, pkey, factor, help)
where f.code = 'FORM.RESIDENTIAL.F17';

-- Waste — reused-on-site column.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, column_kind, notes)
select f.id, 'Non Hazardous waste', 200, 'C&D Waste', 'MT',
       (select id from esg.input_parameter where key = 'waste.cnd_reused'), 1, 'reused_onsite',
       'Feb-25 reported 7.5 MT reused as precast pathway blocks; the template''s Q4 C&D reused is only 3 MT.'
from esg.site_form f where f.code = 'FORM.RESIDENTIAL.F17';

-- DG Running time (form rows 32-35). Four DGs with ratings in the label.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key)
select f.id, 'DG Running time', v.row_order, v.label, 'hours',
       (select id from esg.input_parameter where key = 'ops.dg_hours'), 1, 'dg_hours'
from esg.site_form f,
(values
 (400, 'DG 1 -125KVA'),
 (410, 'DG 2 -125KVA'),
 (420, 'DG3 - 250KVA'),
 (430, 'DG4 -250KVA')
) as v(row_order, label)
where f.code = 'FORM.RESIDENTIAL.F17';

-- =============================================================================
-- FORM.COMMERCIAL.FY24 — Birla Aurora, April 2023 to January 2024
-- Source layout: input/BA_ESG_Monthly_Aug_24.xlsx, tabs 'April 23'..'Jan 24'
--
-- Superseded by FORM.COMMERCIAL.V1 in February 2024. Kept so FY24 months render
-- in the layout they were filed under rather than being retro-fitted to a form
-- that did not exist yet.
--
-- Differences from the current commercial form:
--   * "From rain water Harvesting" row (dropped in the revision; always NA)
--   * "Grid Electricity consumption" — a plain grid line with NO green-energy
--     designation, so it feeds NON-RENEWABLE electricity. The FY25 form renamed
--     this row to "Grid Electricity consmuption ( Green Energy)" and it became
--     the renewable feed. Same row position, opposite meaning: mapping FY24 by
--     row number instead of by form version would silently invert the split.
--   * "Diesel for vehicles" rather than "Diesel for plant and Machinery"
--   * No water end-use breakdown (flushing / irrigation / car wash / cooling)
--   * No plastic-waste row, no scrap rows, no refrigerant or extinguisher block
--   * Waste labels unqualified ("C&D Waste" not "C&D Waste - Debris -MT")
-- =============================================================================

insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, is_form_total, notes)
select f.id, 'Water Consumption', v.row_order, v.label, 'M3',
       (select id from esg.input_parameter where key = v.pkey), 1, v.is_total, v.notes
from esg.site_form f,
(values
 (10, 'Total fresh water consumption', 'water.total_reported', true,  'Site-computed total; equals municipality + ground water each month.'),
 (20, 'from Municipality',             'water.municipal',      false, null),
 (30, 'From Ground Water ( onsite)',   'water.groundwater',    false, null),
 (40, 'From Tanker ( offsite)',        'water.tanker',         false, null),
 (50, 'From rain water Harvesting',    'water.rainwater',      false, 'Dropped in the FY25 form revision. Filed NA in every FY24 month.'),
 (60, 'Sewage Generated',              'water.stp_inlet',      false, 'Memo. Filed NA in every FY24 month.'),
 (70, 'Sewage Recycled',               'water.stp_outlet',     false, 'Memo. Reported without a corresponding inlet all year, so the inlet/outlet check cannot run for FY24.')
) as v(row_order, label, pkey, is_total, notes)
where f.code = 'FORM.COMMERCIAL.FY24';

insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key, notes)
select f.id, 'Electricity Consumption', v.row_order, v.label, 'KWh',
       (select id from esg.input_parameter where key = v.pkey), 1, v.agg, v.notes
from esg.site_form f,
(values
 (110, 'Grid Electricity consumption',      'elec.grid',        null,
  'NOT green energy on this form version — a plain grid draw feeding non-renewable electricity. The identically-positioned row on the FY25 form is the RENEWABLE feed.'),
 (120, 'Tenant Electricity consumption',    'elec.tenant',      null, 'Memo. Outside the entity boundary.'),
 (130, 'Electricity from renewables',       'elec.renewable',   null, 'Filed NA in every FY24 month.'),
 (140, 'Level 8 Electricity consumption',   'elec.own_floor_1', 'own_floors', 'BEPL-occupied floor.'),
 (150, 'Level 13th Electricity consumption','elec.own_floor_2', 'own_floors', 'BEPL-occupied floor. Labelled "Level 13th" on early FY24 tabs and "Level 13" later.')
) as v(row_order, label, pkey, agg, notes)
where f.code = 'FORM.COMMERCIAL.FY24';

insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, 'Fuel Consumption', v.row_order, v.label, 'Ltrs',
       (select id from esg.input_parameter where key = v.pkey), 0.001
from esg.site_form f,
(values
 (160, 'DG set - Diesel',      'fuel.diesel_dg'),
 (170, 'Diesel for vehicles',  'fuel.diesel_vehicle'),
 (180, 'Petrol',               'fuel.petrol')
) as v(row_order, label, pkey)
where f.code = 'FORM.COMMERCIAL.FY24';

insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor)
select f.id, v.group_label, v.row_order, v.label, v.form_unit,
       (select id from esg.input_parameter where key = v.pkey), v.factor
from esg.site_form f,
(values
 ('Non Hazardous waste', 200, 'C&D Waste',                                   'MT',    'waste.cnd',           1),
 ('Non Hazardous waste', 210, 'Municipal solid waste (Plastic, cardboard etc)','MT',  'waste.municipal',     1),
 ('Non Hazardous waste', 220, 'food waste',                                  'MT',    'waste.food',          1),
 ('Hazardous waste',     230, 'Used Oil',                                    'Litres','waste.used_oil',      1),
 ('Hazardous waste',     240, 'Oil Filters',                                 'Nos',   'waste.oil_filters_no',1),
 ('Hazardous waste',     250, 'Other Contaminated Waste',                    'kg',    'waste.contaminated',  0.001),
 ('Hazardous waste',     260, 'Bio-Medical waste',                           'kg',    'waste.biomedical',    0.001),
 ('Hazardous waste',     270, 'Battery Waste',                               'Nos',   'waste.battery_no',    1),
 ('Hazardous waste',     280, 'Electronic waste',                            'kg',    'waste.ewaste',        0.001)
) as v(group_label, row_order, label, form_unit, pkey, factor)
where f.code = 'FORM.COMMERCIAL.FY24';

insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, column_kind)
select f.id, 'Non Hazardous waste', v.row_order, v.label, 'MT',
       (select id from esg.input_parameter where key = v.pkey), 1, 'reused_onsite'
from esg.site_form f,
(values
 (210, 'Municipal solid waste (Plastic, cardboard etc)', 'waste.municipal_recycled'),
 (220, 'food waste',                                     'waste.food_recycled')
) as v(row_order, label, pkey)
where f.code = 'FORM.COMMERCIAL.FY24';

-- DG Details appear only from December 2023 on this form version; earlier tabs
-- have no DG block at all.
insert into esg.site_form_field
    (form_id, group_label, row_order, label, form_unit, parameter_id, unit_factor, aggregate_key, notes)
select f.id, 'DG Details', v.row_order, v.label, 'hrs',
       (select id from esg.input_parameter where key = 'ops.dg_hours'), 1, 'dg_hours',
       'The DG block was added to this form from December 2023; Apr-Nov 23 returns have no DG hours.'
from esg.site_form f,
(values (400, 'DG1 running time'), (410, 'DG2 running time')) as v(row_order, label)
where f.code = 'FORM.COMMERCIAL.FY24';
