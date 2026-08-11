-- =============================================================================
-- BIRLA ESTATES — INPUT parameter dictionary
--
-- The canonical set of fields a site can report. Deliberately smaller than the
-- union of all site form rows: several differently-worded rows map onto one
-- canonical parameter (Aurora's "From Tanker (offsite)" and Sangamwadi's
-- "Water for drinking" both feed water.tanker / water.drinking respectively but
-- consolidate the same way). Per-site wording lives in site_form_field.
--
-- CANONICAL UNITS are the units the FORMULAS layer works in, which are not
-- always the units the form prints. Site forms use Ltrs and kg; BRSR discloses
-- kL and MT. The unit_factor on each site_form_field does the conversion at
-- entry so no user is ever asked to divide by a thousand in their head.
--
-- is_memo = true marks values captured for completeness and validation that do
-- NOT feed any BRSR output: tenant electricity (outside the entity boundary),
-- STP flows (no discharge is reported), DG running hours (a plausibility check
-- on diesel), and the site-computed "total fresh water" row (cross-checked
-- against the sum of its parts).
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- WATER  (canonical unit: KL; forms print m3, which is the same volume)
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('water.municipal',    'WATER','Water','Municipal supply',                     'KL', false, 110,
 'Feeds BRSR third-party water.'),
('water.groundwater',  'WATER','Water','Ground water (onsite / colony)',       'KL', false, 120,
 'Feeds BRSR ground water. NOTE: Tisya''s Apr-24 groundwater was consolidated as third-party water in the published template while Trimaya''s stayed groundwater — an inconsistency flagged for the ESG team, not silently resolved here.'),
('water.tanker',       'WATER','Water','Tanker water (offsite)',               'KL', false, 130,
 'Feeds BRSR third-party water.'),
('water.tanker_treated','WATER','Water','Tanker - treated STP water',          'KL', false, 140,
 'Trimaya form only. Feeds BRSR treated water.'),
('water.treated_used', 'WATER','Water','Treated water used at construction site','KL', false, 150,
 'Residential form. Feeds BRSR "Others - treated water".'),
('water.drinking',     'WATER','Water','Water for drinking',                   'KL', false, 160,
 'Sangamwadi form only. Booked to third-party water (assumption carried from the Middle Link).'),
('water.surface',      'WATER','Water','Surface water',                        'KL', false, 100,
 'No site currently reports surface water; present so the BRSR line has a source.'),
('water.rainwater',    'WATER','Water','Rain water harvesting',                'KL', false, 145,
 'Aurora''s FY24 form carried a rainwater-harvesting row (dropped in the FY25 revision). Every FY24 month filed NA. Feeds BRSR "Others" alongside treated water when a site does report it.'),
('water.seawater',     'WATER','Water','Seawater / desalinated',               'KL', false, 170,
 'No site currently reports seawater; present so the BRSR line has a source.'),

-- Memo water rows
('water.total_reported','WATER','Water','Total fresh water consumption (as filed)','KL', true, 180,
 'MEMO. The site''s own hand-computed total. Cross-checked against the sum of its sources — Sangamwadi and Trimaya both fail this check in the source data.'),
('water.stp_inlet',    'WATER','Water','Sewage generated - STP inlet',         'KL', true, 190,
 'MEMO. Validation only: outlet must not exceed inlet.'),
('water.stp_outlet',   'WATER','Water','Sewage recycled - STP outlet',         'KL', true, 200,
 'MEMO. Aurora reports outlet > inlet in four consecutive months.'),
('water.wastewater_generated','WATER','Water','Waste water generated',         'KL', true, 210,
 'MEMO. Trimaya form. No discharge is reported in the BRSR template.'),
('water.wastewater_recycled', 'WATER','Water','Waste water recycled',          'KL', true, 220,
 'MEMO. Trimaya form.'),
('water.flushing',     'WATER','Water','Flushing',                             'KL', true, 230, 'MEMO. Aurora end-use breakdown.'),
('water.irrigation',   'WATER','Water','Irrigation',                           'KL', true, 240, 'MEMO. Aurora end-use breakdown.'),
('water.car_wash',     'WATER','Water','Car wash',                             'KL', true, 250, 'MEMO. Aurora end-use breakdown.'),
('water.cooling_tower','WATER','Water','Cooling tower makeup',                 'KL', true, 260, 'MEMO. Aurora end-use breakdown.');

-- -----------------------------------------------------------------------------
-- ELECTRICITY  (canonical unit: kWh)
--
-- The Aurora split matters. Its form reports four electricity lines; only two
-- are BEPL's own consumption. Tenant electricity has been excluded from the
-- entity boundary since FY24 per the Data Book footnote, and the "green energy"
-- line feeds renewable while Level 8 + Level 13 feed non-renewable.
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('elec.grid',          'ENERGY','Electricity','Grid electricity consumption',  'kWh', false, 310,
 'Residential/commercial construction sites. Feeds BRSR non-renewable electricity.'),
('elec.green',         'ENERGY','Electricity','Grid electricity - green energy','kWh', false, 320,
 'Aurora''s green power purchase. Feeds BRSR renewable electricity. CAUTION: the published template books 11-16% LESS than Aurora reports each month Apr-Aug 24 (197,838.76 kWh total) — an undocumented deduction inside the missing consolidation file. Modelled explicitly as elec.renewable_adjustment rather than baked into a formula.'),
('elec.renewable',     'ENERGY','Electricity','Electricity from renewables',   'kWh', false, 330,
 'Onsite/procured renewables. Feeds BRSR renewable electricity.'),
('elec.own_floor_1',   'ENERGY','Electricity','Level 8 electricity consumption','kWh', false, 340,
 'Aurora. BEPL-occupied floor — inside the entity boundary, feeds non-renewable electricity.'),
('elec.own_floor_2',   'ENERGY','Electricity','Level 13 electricity consumption','kWh', false, 350,
 'Aurora. BEPL-occupied floor — inside the entity boundary, feeds non-renewable electricity.'),
('elec.tenant',        'ENERGY','Electricity','Tenant electricity consumption','kWh', true, 360,
 'MEMO. EXCLUDED from the entity boundary since FY24 (Data Book footnote). 1,023,308 kWh over Apr-Aug 24.'),
('elec.renewable_adjustment','ENERGY','Electricity','Renewable electricity - documented adjustment','kWh', false, 370,
 'Signed adjustment (negative reduces the reported figure) applied to renewable electricity where the consolidation differs from the site-reported green energy. Exists so the 197,838.76 kWh FY25 deduction is visible and attributable instead of silently absorbed. Should be zero once the ESG team documents or withdraws that deduction.');

-- -----------------------------------------------------------------------------
-- FUEL  (canonical unit: kL — forms print Ltrs, converted at entry)
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('fuel.diesel_dg',     'FUEL','Fuel','DG set - diesel',                        'kL', false, 410,
 'Feeds BRSR Diesel (Stationary Combustion).'),
('fuel.diesel_plant',  'FUEL','Fuel','Diesel for plant and machinery',         'kL', false, 420,
 'Feeds BRSR Diesel (Mobile Combustion).'),
('fuel.diesel_vehicle','FUEL','Fuel','Diesel for vehicles',                    'kL', false, 430,
 'Trimaya form wording. Feeds BRSR Diesel (Mobile Combustion).'),
('fuel.petrol',        'FUEL','Fuel','Petrol',                                 'kL', false, 440,
 'Feeds BRSR Petrol (Mobile).');

-- -----------------------------------------------------------------------------
-- NON-HAZARDOUS WASTE  (canonical unit: MT)
--
-- "Scrap" has no BRSR category. The Middle Link maps it into C&D waste and
-- records the decision; we do the same, as a separate parameter so the choice
-- stays reversible and visible rather than being merged at entry.
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, subsection, label, unit, is_memo, sort_order, notes) values
('waste.cnd',          'WASTE','Waste','Non-hazardous','C&D waste - debris',   'MT', false, 510, null),
('waste.scrap',        'WASTE','Waste','Non-hazardous','Scrap (rebar / steel / wood / other)','MT', false, 520,
 'No BRSR scrap category exists — consolidated into C&D waste. Change the formula, not the data, if the ESG team maps it elsewhere.'),
('waste.plastic',      'WASTE','Waste','Non-hazardous','Plastic waste',        'MT', false, 530, null),
('waste.municipal',    'WASTE','Waste','Non-hazardous','Municipal solid waste','MT', false, 540,
 'Thermocol, glass, cotton, paper, cardboard, cement bags, wood.'),
('waste.food',         'WASTE','Waste','Non-hazardous','Food waste',           'MT', false, 550, null);

-- Reused / recycled on site — the forms carry a separate column for this and
-- BRSR discloses recovery separately from generation.
insert into esg.input_parameter (key, domain, section, subsection, label, unit, is_memo, sort_order, notes) values
('waste.cnd_reused',       'WASTE','Waste','Recovery','C&D waste reused on site',    'MT', false, 610,
 'Trimaya reported 7.5 MT reused as precast in Feb-25 while the template''s Q4 C&D reused is only 3 MT.'),
('waste.plastic_recycled', 'WASTE','Waste','Recovery','Plastic waste recycled',      'MT', false, 620, null),
('waste.municipal_recycled','WASTE','Waste','Recovery','Municipal waste recycled',   'MT', false, 630, null),
('waste.food_recycled',    'WASTE','Waste','Recovery','Food waste recycled on site', 'MT', false, 640,
 'Aurora composts food waste on site (OWC).');

-- -----------------------------------------------------------------------------
-- HAZARDOUS WASTE
--
-- Unit discipline matters here. The forms ask for used oil in LITRES, oil
-- filters and batteries in NUMBER OF UNITS, and everything else in kg — while
-- BRSR discloses all of it in MT. A count has no mass: Sangamwadi's "2 Nos" oil
-- filters cannot produce a tonnage, and the Middle Link left the template's
-- 0.03 MT entirely unexplained. Counts are therefore stored as counts, in their
-- own parameters, and never silently converted.
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, subsection, label, unit, is_memo, sort_order, notes) values
('waste.used_oil',      'WASTE','Waste','Hazardous','Used oil',                'L',   false, 710,
 'Filed in litres. Converting to MT needs a density the forms do not capture.'),
('waste.oil_filters_no','WASTE','Waste','Hazardous','Oil filters (count)',      'Nos', false, 720,
 'A COUNT, not a mass. Cannot feed the MT-based BRSR line without an average unit weight.'),
('waste.battery_no',    'WASTE','Waste','Hazardous','Battery waste (count)',    'Nos', false, 730,
 'A COUNT, not a mass.'),
('waste.contaminated',  'WASTE','Waste','Hazardous','Other contaminated waste', 'MT',  false, 740, null),
('waste.biomedical',    'WASTE','Waste','Hazardous','Bio-medical waste',        'MT',  false, 750, null),
('waste.ewaste',        'WASTE','Waste','Hazardous','Electronic waste',         'MT',  false, 760, null),
('waste.cotton_rags',   'WASTE','Waste','Hazardous','Cotton rags for cleaning', 'MT',  false, 770, null),
('waste.paint_drums',   'WASTE','Waste','Hazardous','Paint drums',              'MT',  false, 780,
 'Feeds BRSR "other hazardous (diesel barrels)".'),
('waste.coolant_oil',   'WASTE','Waste','Hazardous','Coolant oil from HVAC',    'L',   false, 790,
 'Filed in litres.');

-- -----------------------------------------------------------------------------
-- REFRIGERANTS & EXTINGUISHERS  (canonical unit: kg)
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('refrig.r404a',       'REFRIGERANT','Refrigerants','R404A refilled',           'kg', false, 810, null),
('refrig.r410a',       'REFRIGERANT','Refrigerants','R410A refilled',           'kg', false, 820, null),
('refrig.r407c',       'REFRIGERANT','Refrigerants','R407C refilled',           'kg', false, 830, null),
('refrig.r22',         'REFRIGERANT','Refrigerants','R22 refilled',             'kg', false, 840,
 'Montreal Protocol gas — disclosed as a quantity but excluded from Scope 1.'),
('refrig.r134a',       'REFRIGERANT','Refrigerants','R134a refilled',           'kg', false, 850, null),
('refrig.co2_extinguisher','REFRIGERANT','Refrigerants','CO2 fire extinguisher refilled','kg', false, 860,
 'Forms record cylinder size and a count (e.g. "9 Kg" x1); the entry form multiplies them to a mass.');

-- -----------------------------------------------------------------------------
-- AIR EMISSIONS  (canonical unit: kg)
--
-- NOT part of the monthly return. Air emissions come from half-yearly stack and
-- DG monitoring reports filed per site. Seeded so the data has a home and the
-- BRSR air block has a source.
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('air.nox',            'AIR','Air emissions','NOx',                 'kg', false, 910,
 'From half-yearly stack/DG monitoring reports, not the monthly EHS form.'),
('air.sox',            'AIR','Air emissions','SOx',                 'kg', false, 920, 'Half-yearly monitoring.'),
('air.pm',             'AIR','Air emissions','Particulate matter (PM)','kg', false, 930, 'Half-yearly monitoring.');

-- -----------------------------------------------------------------------------
-- OPERATIONS  (memo — plausibility checks and context)
-- -----------------------------------------------------------------------------
insert into esg.input_parameter (key, domain, section, label, unit, is_memo, sort_order, notes) values
('ops.dg_hours',       'OPERATIONS','DG details','DG running hours (total)','h', true, 1010,
 'MEMO. Sum of every DG on the form. Drives the litres-per-hour plausibility check: Sangamwadi at 2.7 L/h over 741 h and Aurora Aug-24 at ~70 L/h both warrant confirmation. Note the forms drift between Hrs and Min — Aurora filed Jul/Aug in minutes.');
