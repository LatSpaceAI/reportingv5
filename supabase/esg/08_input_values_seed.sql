-- =============================================================================
-- BIRLA ESTATES — INPUT VALUES: the eight evidenced site-months
--
-- Every figure below is transcribed from a monthly site return in
-- birla-estates/input/. This is the ONLY data in the system that rests on a
-- filed document; the published FY25 disclosures cover roughly 132 site-months
-- and these eight are what the folder actually evidences.
--
--   Birla Aurora      Apr, May, Jun, Jul, Aug 2024   (5)
--   Birla Tisya       Apr 2024                       (1)
--   Birla Sangamwadi  Dec 2024                       (1)
--   Birla Trimaya     Feb 2025                       (1)
--
-- Deliberately NOT seeded: the derived-balance rows that the Middle Link uses
-- to force a tie to the published template. Going forward this app is the
-- source of truth, so a total is the sum of what was actually filed and the
-- gap is shown as a coverage gap. Backfilling the remaining returns replaces
-- nothing — it simply adds rows.
--
-- provenance = 'imported' throughout (loaded from a historic return file).
-- Where a number had to be read out of free text, provenance = 'parsed' and
-- raw_text keeps the original so the parse can always be audited.
--
-- Units are CANONICAL here (kL, KL, MT, kWh, kg), already converted from the
-- litres and kilograms the forms print.
-- =============================================================================
set search_path = esg, public;

-- Helper: resolve (site code, fiscal year, month no, parameter key) to ids.
create or replace function esg.seed_input(
    p_site text, p_fy text, p_month smallint, p_param text,
    p_value numeric, p_source text,
    p_provenance text default 'imported', p_raw text default null,
    p_na boolean default false, p_comment text default null
) returns void language plpgsql as $$
declare v_site smallint; v_period integer; v_param integer;
begin
    select id into v_site   from esg.site where code = p_site;
    select id into v_period from esg.period
        where fiscal_year = p_fy and period_kind = 'month' and month_no = p_month;
    select id into v_param  from esg.input_parameter where key = p_param;
    if v_site is null then raise exception 'unknown site %', p_site; end if;
    if v_period is null then raise exception 'unknown period % %', p_fy, p_month; end if;
    if v_param is null then raise exception 'unknown parameter %', p_param; end if;

    insert into esg.input_value
        (site_id, period_id, parameter_id, value_num, source_doc,
         provenance, raw_text, is_not_available, comment, entered_by)
    values
        (v_site, v_period, v_param, p_value, p_source,
         p_provenance, p_raw, p_na, p_comment, 'seed:middle-link')
    on conflict (site_id, period_id, parameter_id) do update
        set value_num = excluded.value_num,
            source_doc = excluded.source_doc,
            provenance = excluded.provenance,
            raw_text = excluded.raw_text,
            is_not_available = excluded.is_not_available,
            comment = excluded.comment,
            updated_at = now();
end $$;

-- =============================================================================
-- BIRLA AURORA — Apr..Aug 2024
-- Source: input/BA_ESG_Monthly_Aug_24.xlsx, tabs 'April 24'..'Aug 24'
-- =============================================================================

-- Water (m3 = KL). Aurora reports municipal + groundwater only; tanker is NA.
select esg.seed_input('AURORA','2024-25',1::smallint,'water.municipal',    975, 'BA_ESG_Monthly_Aug_24.xlsx > April 24!B14');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.municipal',   1213, 'BA_ESG_Monthly_Aug_24.xlsx > May 24!B14');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.municipal',   1089, 'BA_ESG_Monthly_Aug_24.xlsx > June 24!B14');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.municipal',   1121, 'BA_ESG_Monthly_Aug_24.xlsx > July 24!B14');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.municipal',   1225, 'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B14');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.groundwater',  857, 'BA_ESG_Monthly_Aug_24.xlsx > April 24!B15', 'imported', null, false, 'Ties 1:1 to the published BRSR groundwater row for April.');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.groundwater',  863, 'BA_ESG_Monthly_Aug_24.xlsx > May 24!B15');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.groundwater',  786, 'BA_ESG_Monthly_Aug_24.xlsx > June 24!B15');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.groundwater',  783, 'BA_ESG_Monthly_Aug_24.xlsx > July 24!B15');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.groundwater',  719, 'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B15');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.tanker', null, 'BA_ESG_Monthly_Aug_24.xlsx > April 24!B16','imported','NA',true);
select esg.seed_input('AURORA','2024-25',2::smallint,'water.tanker', null, 'BA_ESG_Monthly_Aug_24.xlsx > May 24!B16',  'imported','NA',true);
select esg.seed_input('AURORA','2024-25',3::smallint,'water.tanker', null, 'BA_ESG_Monthly_Aug_24.xlsx > June 24!B16', 'imported','NA',true);
select esg.seed_input('AURORA','2024-25',4::smallint,'water.tanker', null, 'BA_ESG_Monthly_Aug_24.xlsx > July 24!B16', 'imported','NA',true);
select esg.seed_input('AURORA','2024-25',5::smallint,'water.tanker', null, 'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B16',  'imported','NA',true);

-- Site-reported total (memo). Equals municipal + groundwater each month.
select esg.seed_input('AURORA','2024-25',1::smallint,'water.total_reported',1832,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B13');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.total_reported',2076,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B13');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.total_reported',1875,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B13');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.total_reported',1904,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B13');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.total_reported',1944,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B13');

-- STP flows (memo). April inlet is blank on the form; outlet exceeds inlet in
-- every month that has both — flagged, not corrected.
select esg.seed_input('AURORA','2024-25',1::smallint,'water.stp_inlet', null,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B18','imported',null,true,'Blank on the filed form.');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.stp_inlet', 1915,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B18');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.stp_inlet', 1438,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B18');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.stp_inlet', 1042,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B18');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.stp_inlet',  767,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B18');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.stp_outlet',2257,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B19');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.stp_outlet',2276,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B19');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.stp_outlet',1496,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B19');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.stp_outlet',2570,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B19');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.stp_outlet',2172,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B19');

-- Water end-use breakdown (memo).
select esg.seed_input('AURORA','2024-25',1::smallint,'water.flushing',857,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B20');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.flushing',804,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B20');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.flushing',752,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B20');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.flushing',840,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B20');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.flushing',712,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B20');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.irrigation',480,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B21');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.irrigation',515,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B21');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.irrigation',280,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B21');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.irrigation',121,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B21');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.irrigation',281,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B21');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.car_wash',0,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B22');

select esg.seed_input('AURORA','2024-25',1::smallint,'water.cooling_tower',471,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B23');
select esg.seed_input('AURORA','2024-25',2::smallint,'water.cooling_tower',653,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B23');
select esg.seed_input('AURORA','2024-25',3::smallint,'water.cooling_tower',610,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B23');
select esg.seed_input('AURORA','2024-25',4::smallint,'water.cooling_tower',675,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B23');
select esg.seed_input('AURORA','2024-25',5::smallint,'water.cooling_tower',633,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B23');

-- Electricity. Green energy is the renewable feed; Level 8 + Level 13 are
-- BEPL's own floors; tenant consumption is memo (outside the boundary).
select esg.seed_input('AURORA','2024-25',1::smallint,'elec.green',271906,     'BA_ESG_Monthly_Aug_24.xlsx > April 24!F13');
select esg.seed_input('AURORA','2024-25',2::smallint,'elec.green',300506,     'BA_ESG_Monthly_Aug_24.xlsx > May 24!F13');
select esg.seed_input('AURORA','2024-25',3::smallint,'elec.green',272897,     'BA_ESG_Monthly_Aug_24.xlsx > June 24!F13');
select esg.seed_input('AURORA','2024-25',4::smallint,'elec.green',293411.9992,'BA_ESG_Monthly_Aug_24.xlsx > July 24!F13', 'imported', null, false, 'The .9992 decimal appears identically in the published template — Aurora is unmistakably the source of that row.');
select esg.seed_input('AURORA','2024-25',5::smallint,'elec.green',280825,     'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!F13');

select esg.seed_input('AURORA','2024-25',1::smallint,'elec.own_floor_1',13991,'BA_ESG_Monthly_Aug_24.xlsx > April 24!F16');
select esg.seed_input('AURORA','2024-25',2::smallint,'elec.own_floor_1',14322,'BA_ESG_Monthly_Aug_24.xlsx > May 24!F16');
select esg.seed_input('AURORA','2024-25',3::smallint,'elec.own_floor_1',13455,'BA_ESG_Monthly_Aug_24.xlsx > June 24!F16');
select esg.seed_input('AURORA','2024-25',4::smallint,'elec.own_floor_1',14523,'BA_ESG_Monthly_Aug_24.xlsx > July 24!F16');
select esg.seed_input('AURORA','2024-25',5::smallint,'elec.own_floor_1',16563,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!F16');

select esg.seed_input('AURORA','2024-25',1::smallint,'elec.own_floor_2',3122,'BA_ESG_Monthly_Aug_24.xlsx > April 24!F17');
select esg.seed_input('AURORA','2024-25',2::smallint,'elec.own_floor_2',3312,'BA_ESG_Monthly_Aug_24.xlsx > May 24!F17');
select esg.seed_input('AURORA','2024-25',3::smallint,'elec.own_floor_2',3120,'BA_ESG_Monthly_Aug_24.xlsx > June 24!F17');
select esg.seed_input('AURORA','2024-25',4::smallint,'elec.own_floor_2',4102,'BA_ESG_Monthly_Aug_24.xlsx > July 24!F17');
select esg.seed_input('AURORA','2024-25',5::smallint,'elec.own_floor_2',4237,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!F17');

select esg.seed_input('AURORA','2024-25',1::smallint,'elec.tenant',193428,'BA_ESG_Monthly_Aug_24.xlsx > April 24!F15','imported',null,false,'MEMO. Excluded from the entity boundary since FY24.');
select esg.seed_input('AURORA','2024-25',2::smallint,'elec.tenant',201992,'BA_ESG_Monthly_Aug_24.xlsx > May 24!F15');
select esg.seed_input('AURORA','2024-25',3::smallint,'elec.tenant',209982,'BA_ESG_Monthly_Aug_24.xlsx > June 24!F15');
select esg.seed_input('AURORA','2024-25',4::smallint,'elec.tenant',213933,'BA_ESG_Monthly_Aug_24.xlsx > July 24!F15');
select esg.seed_input('AURORA','2024-25',5::smallint,'elec.tenant',203973,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!F15');

-- Fuel: DG diesel, litres -> kL.
select esg.seed_input('AURORA','2024-25',1::smallint,'fuel.diesel_dg',0.030,'BA_ESG_Monthly_Aug_24.xlsx > April 24!F19','imported','30 L');
select esg.seed_input('AURORA','2024-25',2::smallint,'fuel.diesel_dg',0.105,'BA_ESG_Monthly_Aug_24.xlsx > May 24!F19',  'imported','105 L');
select esg.seed_input('AURORA','2024-25',3::smallint,'fuel.diesel_dg',0.120,'BA_ESG_Monthly_Aug_24.xlsx > June 24!F19', 'imported','120 L');
select esg.seed_input('AURORA','2024-25',4::smallint,'fuel.diesel_dg',0.030,'BA_ESG_Monthly_Aug_24.xlsx > July 24!F19', 'imported','30 L');
select esg.seed_input('AURORA','2024-25',5::smallint,'fuel.diesel_dg',0.110,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!F19',  'imported','110 L');

-- Waste (MT). Aurora files no C&D or scrap; hazardous rows are all NA.
select esg.seed_input('AURORA','2024-25',1::smallint,'waste.plastic',0.499,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B32');
select esg.seed_input('AURORA','2024-25',2::smallint,'waste.plastic',0.560,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B32');
select esg.seed_input('AURORA','2024-25',3::smallint,'waste.plastic',0.508,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B32');
select esg.seed_input('AURORA','2024-25',4::smallint,'waste.plastic',0.546,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B32');
select esg.seed_input('AURORA','2024-25',5::smallint,'waste.plastic',0.498,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B32');

select esg.seed_input('AURORA','2024-25',1::smallint,'waste.municipal',1.446,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B33');
select esg.seed_input('AURORA','2024-25',2::smallint,'waste.municipal',1.513,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B33');
select esg.seed_input('AURORA','2024-25',3::smallint,'waste.municipal',1.506,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B33');
select esg.seed_input('AURORA','2024-25',4::smallint,'waste.municipal',1.628,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B33');
select esg.seed_input('AURORA','2024-25',5::smallint,'waste.municipal',1.505,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B33');

select esg.seed_input('AURORA','2024-25',1::smallint,'waste.food',1.417,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B34');
select esg.seed_input('AURORA','2024-25',2::smallint,'waste.food',1.433,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B34');
select esg.seed_input('AURORA','2024-25',3::smallint,'waste.food',1.490,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B34');
select esg.seed_input('AURORA','2024-25',4::smallint,'waste.food',1.667,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B34');
select esg.seed_input('AURORA','2024-25',5::smallint,'waste.food',1.486,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B34');

-- Food waste is composted on site (OWC) — generation equals recovery.
select esg.seed_input('AURORA','2024-25',1::smallint,'waste.food_recycled',1.417,'BA_ESG_Monthly_Aug_24.xlsx > April 24!C34');
select esg.seed_input('AURORA','2024-25',2::smallint,'waste.food_recycled',1.433,'BA_ESG_Monthly_Aug_24.xlsx > May 24!C34');
select esg.seed_input('AURORA','2024-25',3::smallint,'waste.food_recycled',1.490,'BA_ESG_Monthly_Aug_24.xlsx > June 24!C34');
select esg.seed_input('AURORA','2024-25',4::smallint,'waste.food_recycled',1.667,'BA_ESG_Monthly_Aug_24.xlsx > July 24!C34');
select esg.seed_input('AURORA','2024-25',5::smallint,'waste.food_recycled',1.486,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!C34');

-- Plastic and municipal waste go to a recycler (Natural Gold).
select esg.seed_input('AURORA','2024-25',1::smallint,'waste.plastic_recycled',0.499,'BA_ESG_Monthly_Aug_24.xlsx > April 24!E32');
select esg.seed_input('AURORA','2024-25',2::smallint,'waste.plastic_recycled',0.560,'BA_ESG_Monthly_Aug_24.xlsx > May 24!E32');
select esg.seed_input('AURORA','2024-25',3::smallint,'waste.plastic_recycled',0.508,'BA_ESG_Monthly_Aug_24.xlsx > June 24!E32');
select esg.seed_input('AURORA','2024-25',4::smallint,'waste.plastic_recycled',0.546,'BA_ESG_Monthly_Aug_24.xlsx > July 24!E32');
select esg.seed_input('AURORA','2024-25',5::smallint,'waste.plastic_recycled',0.498,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!E32');

-- DG hours (memo). Jul/Aug were filed in MINUTES and are converted here.
select esg.seed_input('AURORA','2024-25',1::smallint,'ops.dg_hours',1.000,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B44:B45','parsed','0.5 + 0.5 Hrs');
select esg.seed_input('AURORA','2024-25',2::smallint,'ops.dg_hours',2.000,'BA_ESG_Monthly_Aug_24.xlsx > May 24!B44:B45',  'parsed','0.7 + 1.3 Hrs');
select esg.seed_input('AURORA','2024-25',3::smallint,'ops.dg_hours',3.000,'BA_ESG_Monthly_Aug_24.xlsx > June 24!B44:B45', 'parsed','1.1 + 1.9 Hrs');
select esg.seed_input('AURORA','2024-25',4::smallint,'ops.dg_hours',0.900,'BA_ESG_Monthly_Aug_24.xlsx > July 24!B44:B45', 'parsed','36 + 18 Min',false,'Filed in minutes; converted to hours.');
select esg.seed_input('AURORA','2024-25',5::smallint,'ops.dg_hours',1.583,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B44:B45',  'parsed','60 min + 35 Min',false,'Filed in minutes; converted to hours. 110 L over 1.583 h is ~70 L/h — implausibly high, flagged for review.');

-- Refrigerants and extinguishers, parsed from text cells.
select esg.seed_input('AURORA','2024-25',1::smallint,'refrig.r22',5,'BA_ESG_Monthly_Aug_24.xlsx > April 24!B50','parsed','5 Kg');
select esg.seed_input('AURORA','2024-25',5::smallint,'refrig.r22',5,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!B50',  'parsed','5 Kg',false,'Apr + Aug = 10 kg, exactly the published Aurora R22 figure.');
select esg.seed_input('AURORA','2024-25',5::smallint,'refrig.co2_extinguisher',13.5,'BA_ESG_Monthly_Aug_24.xlsx > Aug 24!E48:F49','parsed','9 Kg x1 + 4.5Kg x1');

-- =============================================================================
-- BIRLA TISYA — Apr 2024
-- Source: input/Monthy ESG Report - Residential Assets - Birla Tisya- Apr'24.xlsx
-- =============================================================================
select esg.seed_input('TISYA','2024-25',1::smallint,'water.municipal',       0,      'Birla Tisya!B14');
select esg.seed_input('TISYA','2024-25',1::smallint,'water.groundwater',     1396,   'Birla Tisya!B15','imported',null,false,
  'CLASSIFICATION CONFLICT: the published FY25 consolidation booked this as THIRD-PARTY water, while Trimaya''s groundwater stayed groundwater. Stored as filed; raised as a flag for the ESG team to resolve.');
select esg.seed_input('TISYA','2024-25',1::smallint,'water.tanker',          428.63, 'Birla Tisya!B16');
select esg.seed_input('TISYA','2024-25',1::smallint,'water.stp_inlet',       977,    'Birla Tisya!B17');
select esg.seed_input('TISYA','2024-25',1::smallint,'water.treated_used',    612.88, 'Birla Tisya!B18','imported',null,false,'Ties 1:1 to the published treated-water row for April.');
select esg.seed_input('TISYA','2024-25',1::smallint,'water.total_reported',  1824.63,'Birla Tisya!B13');

select esg.seed_input('TISYA','2024-25',1::smallint,'elec.grid',      23935.5,'Birla Tisya!F13');
select esg.seed_input('TISYA','2024-25',1::smallint,'elec.renewable',  1522.76,'Birla Tisya!F14');

select esg.seed_input('TISYA','2024-25',1::smallint,'fuel.diesel_dg',    0.180,'Birla Tisya!F19','imported','180 L');
select esg.seed_input('TISYA','2024-25',1::smallint,'fuel.diesel_plant', 1.345,'Birla Tisya!F20','imported','1345 L');
select esg.seed_input('TISYA','2024-25',1::smallint,'fuel.petrol',      0,     'Birla Tisya!F21');

select esg.seed_input('TISYA','2024-25',1::smallint,'waste.cnd',      180.38,'Birla Tisya!B26');
select esg.seed_input('TISYA','2024-25',1::smallint,'waste.scrap',      3.67,'Birla Tisya!B27','parsed','Rebar - 3.5 / Steel - 0.02 / Wood - 0.15',false,'Parsed 3.5 + 0.02 + 0.15. Consolidated into C&D waste.');
select esg.seed_input('TISYA','2024-25',1::smallint,'waste.municipal',  0.008,'Birla Tisya!B28','parsed','Paper & Card Board - 0.008');
select esg.seed_input('TISYA','2024-25',1::smallint,'waste.food',       0.058,'Birla Tisya!B29','parsed','58 kg',false,'kg converted to MT in an MT-labelled row.');
select esg.seed_input('TISYA','2024-25',1::smallint,'waste.municipal_recycled',0.008,'Birla Tisya!E28');

select esg.seed_input('TISYA','2024-25',1::smallint,'ops.dg_hours',41.5,'Birla Tisya!B44:B48','parsed','1 + 13 + 13 + 12 + 2.5 Hrs');

-- =============================================================================
-- BIRLA SANGAMWADI — Dec 2024
-- Source: input/Monthy ESG Report - Sangamwadi_Dec'24.xlsx
-- =============================================================================
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.municipal',     0,   'Birla Sangamwadi_pune!B14');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.groundwater',   0,   'Birla Sangamwadi_pune!B15');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.tanker',        280, 'Birla Sangamwadi_pune!B16');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.stp_inlet',     0,   'Birla Sangamwadi_pune!B17');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.treated_used',  0,   'Birla Sangamwadi_pune!B18');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.drinking',      3.2, 'Birla Sangamwadi_pune!B19','imported',null,false,'Booked to third-party water.');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'water.total_reported',0,   'Birla Sangamwadi_pune!B13','imported',null,false,
  'Site filed 0 but its own sources sum to 283.2 KL — fails the total-vs-components check.');

select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'elec.grid',     1709,'Birla Sangamwadi_pune!F13');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'elec.renewable',   0,'Birla Sangamwadi_pune!F14');

select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'fuel.diesel_dg',   2.000,'Birla Sangamwadi_pune!F19','imported','2000 L',false,
  'Alone accounts for 98% of the published December stationary diesel (2.000 of 2.043 kL) — a clean lineage proof.');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'fuel.diesel_plant',0,    'Birla Sangamwadi_pune!F20');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'fuel.petrol',      0,    'Birla Sangamwadi_pune!F21');

select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.cnd',        1.2,'Birla Sangamwadi_pune!B26');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.scrap',      4.1,'Birla Sangamwadi_pune!B27','parsed','Rebar - 0.1 / Wooden waste -4',false,'Parsed 0.1 + 4. Consolidated into C&D waste.');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.municipal',  3,  'Birla Sangamwadi_pune!B28','parsed','Paper& Card Board - 3');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.food',       0,  'Birla Sangamwadi_pune!B29');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.oil_filters_no',2,'Birla Sangamwadi_pune!B34','imported','2 Nos',false,
  'A COUNT with no mass. Cannot feed the MT-denominated BRSR oil-filter line.');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.paint_drums',0.004,'Birla Sangamwadi_pune!B39','parsed','paint drums - kg: 4',false,'kg converted to MT.');
select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'waste.municipal_recycled',3,'Birla Sangamwadi_pune!E28');

select esg.seed_input('SANGAMWADI','2024-25',9::smallint,'ops.dg_hours',741,'Birla Sangamwadi_pune!B44:B46','parsed','410 + 305 + 26 Hrs',false,
  '2000 L over 741 h is 2.7 L/h — implausibly low for a DG set. Flagged for confirmation.');

-- =============================================================================
-- BIRLA TRIMAYA — Feb 2025
-- Source: input/ESG Online data Trimaya -Feb-25.xlsx (Ref BRT/EHS/ESG/F-17)
-- =============================================================================
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.municipal',     null,   'Sheet1!B8','imported','Nil',true);
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.groundwater',   52,     'Sheet1!B9','imported',null,false,
  'Ties 1:1 to the published February groundwater AND water-stressed groundwater rows. Note this stayed classified as groundwater while Tisya''s was reclassified to third-party.');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.tanker',        1877.92,'Sheet1!B10');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.tanker_treated',null,   'Sheet1!B11','imported','NIL',true);
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.wastewater_generated',1400,'Sheet1!B13','imported',null,false,'MEMO. The template reports zero discharge.');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.wastewater_recycled',   280, 'Sheet1!B14','imported',null,false,'MEMO.');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'water.total_reported', 120.4, 'Sheet1!B7','imported',null,false,
  'Site filed 120.4 but its own sources sum to 1,929.92 KL — fails the total-vs-components check.');

select esg.seed_input('TRIMAYA','2024-25',11::smallint,'elec.grid',     14523,'Sheet1!F7');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'elec.renewable',null, 'Sheet1!F8','imported','NIL',true);

select esg.seed_input('TRIMAYA','2024-25',11::smallint,'fuel.diesel_dg',     0.900,'Sheet1!F13','imported','900 L');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'fuel.diesel_vehicle',3.942,'Sheet1!F14','imported','3942 L');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'fuel.petrol',        0,    'Sheet1!F15');

select esg.seed_input('TRIMAYA','2024-25',11::smallint,'waste.cnd',       7.5,'Sheet1!B20');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'waste.cnd_reused',7.5,'Sheet1!C20','imported','box type Precast making for pathway purpose',false,
  'Site reports the full 7.5 MT reused on site, but the published Q4 C&D reused figure is only 3 MT.');
select esg.seed_input('TRIMAYA','2024-25',11::smallint,'waste.municipal', 0.5,'Sheet1!B21','parsed','500 kg',false,'kg converted to MT.');

select esg.seed_input('TRIMAYA','2024-25',11::smallint,'ops.dg_hours',82,'Sheet1!B32:B35','parsed','9 + 40 + 21 + 12 hours');

-- =============================================================================
-- SUBMISSION STATE — mark the eight evidenced site-months as approved.
-- =============================================================================
insert into esg.site_submission (site_id, period_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_note)
select s.id, p.id, 'approved', 'seed:middle-link', now(), 'seed:middle-link', now(),
       'Imported from the filed monthly return; reconciled in the Middle Link reconstruction.'
from esg.site s
join esg.period p on p.period_kind = 'month' and p.fiscal_year = '2024-25'
where (s.code = 'AURORA'     and p.month_no in (1,2,3,4,5))
   or (s.code = 'TISYA'      and p.month_no = 1)
   or (s.code = 'SANGAMWADI' and p.month_no = 9)
   or (s.code = 'TRIMAYA'    and p.month_no = 11)
on conflict (site_id, period_id) do nothing;

-- NOTE: esg.seed_input() is deliberately left in place here — the FY24 seed
-- (08b_input_values_fy24_seed.sql) reuses it and drops it at the end.
