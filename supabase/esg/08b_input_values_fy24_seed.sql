-- =============================================================================
-- BIRLA ESTATES — INPUT VALUES: Aurora FY2023-24 (prior-year comparatives)
--
-- Aurora filed a complete twelve-month return for FY24, transcribed here from
-- input/BA_ESG_Monthly_Aug_24.xlsx (tabs 'April 23'..'March 24'). No other site
-- has FY24 data.
--
-- RUN AFTER 08_input_values_seed.sql — it reuses that file's esg.seed_input()
-- helper, which is dropped at the end of THIS file instead.
--
-- TWO THINGS TO KNOW ABOUT FY24
--
-- 1. The form changed mid-year. April 2023 to January 2024 use the FY24 layout
--    (FORM.COMMERCIAL.FY24); February and March 2024 use the current one.
--    The crucial difference is electricity: FY24's "Grid Electricity
--    consumption" is a plain grid draw feeding NON-RENEWABLE electricity, while
--    the identically-positioned row on the current form is "Grid Electricity
--    consmuption ( Green Energy)" and feeds RENEWABLE. Mapping by row number
--    rather than by form version would invert the split for ten months.
--
--    Consequence: Aurora reports NO renewable electricity at all for Apr-23 to
--    Jan-24 (the renewables row was filed NA every month), then 219,960 kWh in
--    Feb-24 and 238,129 kWh in Mar-24 once green energy began. That is a real
--    step change in the data, not an artefact.
--
-- 2. November 2023's water block is byte-identical to September 2023 —
--    1,903 / 961 / 942 / 1,425 across every row — while its electricity figures
--    differ. Almost certainly a copy-paste error in the source workbook. It is
--    loaded exactly as filed and flagged (see the data_flag insert at the end);
--    correcting it would mean inventing a number.
--
-- Values are CANONICAL units, already converted from the litres the form prints.
-- Several FY24 electricity figures carry long decimal tails (sub-metered
-- allocations); they are stored to 4 decimal places as filed.
-- =============================================================================
set search_path = esg, public;

-- April 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',1::smallint,'water.total_reported',1897,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.municipal',972,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.groundwater',925,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'water.stp_outlet',1732,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'elec.grid',250000,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'elec.tenant',184054,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'elec.own_floor_1',13287.2,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'elec.own_floor_2',2619.69,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'fuel.diesel_dg',0.13,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F19','imported','130 L',false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.municipal',1.341,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.food',1.92,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > April 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',1::smallint,'waste.food_recycled',0.0192,'BA_ESG_Monthly_Aug_24.xlsx > April 23!C28','imported',null,false,null);

-- May 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',2::smallint,'water.total_reported',1956,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.municipal',1067,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.groundwater',889,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'water.stp_outlet',1831,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'elec.grid',286120,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'elec.tenant',214663,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'elec.own_floor_1',14365.7,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'elec.own_floor_2',2938.22,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'fuel.diesel_dg',0.04,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F19','imported','40 L',false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.municipal',1.238,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.food',2.205,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > May 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',2::smallint,'waste.food_recycled',0.0221,'BA_ESG_Monthly_Aug_24.xlsx > May 23!C28','imported',null,false,null);

-- June 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',3::smallint,'water.total_reported',1947,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.municipal',1042,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.groundwater',905,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'water.stp_outlet',1649,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'elec.grid',280640,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'elec.tenant',214656,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'elec.own_floor_1',14111.2,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'elec.own_floor_2',2933.78,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'fuel.diesel_dg',0.155,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F19','imported','155 L',false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.municipal',1.341,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.food',2.217,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > June 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',3::smallint,'waste.food_recycled',0.0222,'BA_ESG_Monthly_Aug_24.xlsx > June 23!C28','imported',null,false,null);

-- July 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',4::smallint,'water.total_reported',1811,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.municipal',939,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.groundwater',872,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'water.stp_outlet',1597,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'elec.grid',257960,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'elec.tenant',191560,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'elec.own_floor_1',13788.5,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'elec.own_floor_2',2628.69,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'fuel.diesel_dg',0.05,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F19','imported','50 L',false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.municipal',0.802,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.food',2.68,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > July 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',4::smallint,'waste.food_recycled',0.0268,'BA_ESG_Monthly_Aug_24.xlsx > July 23!C28','imported',null,false,null);

-- Aug 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',5::smallint,'water.total_reported',1846,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.municipal',995,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.groundwater',851,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'water.stp_outlet',1658,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'elec.grid',258880,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'elec.tenant',189888,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'elec.own_floor_1',13042.7,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'elec.own_floor_2',2124.48,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'fuel.diesel_dg',0.08,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F19','imported','80 L',false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.municipal',1.28,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.food',2.546,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',5::smallint,'waste.food_recycled',0.0255,'BA_ESG_Monthly_Aug_24.xlsx > Aug 23!C28','imported',null,false,null);

-- Sept 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',6::smallint,'water.total_reported',1903,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.municipal',961,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.groundwater',942,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'water.stp_outlet',1425,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'elec.grid',241760,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'elec.tenant',178163,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'elec.own_floor_1',12048,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'elec.own_floor_2',2131.08,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'fuel.diesel_dg',0.085,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F19','imported','85 L',false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.municipal',1.646,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.food',2.471,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',6::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Sept 23!B35','imported','NA',true,null);

-- Oct 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',7::smallint,'water.total_reported',1992,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.municipal',1002,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.groundwater',990,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'water.stp_outlet',1844,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'elec.grid',255120,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'elec.tenant',189385,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'elec.own_floor_1',12913.6,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'elec.own_floor_2',2848.34,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'fuel.diesel_dg',0.115,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F19','imported','115 L',false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.municipal',1.375,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.food',2.047,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',7::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Oct 23!B35','imported','NA',true,null);

-- Nov 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',8::smallint,'water.total_reported',1903,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.municipal',961,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.groundwater',942,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'water.stp_outlet',1425,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'elec.grid',240880,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'elec.tenant',176194,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'elec.own_floor_1',11885,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'elec.own_floor_2',2825,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'fuel.diesel_dg',0.055,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F19','imported','55 L',false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.municipal',1.309,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.food',2.351,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',8::smallint,'waste.food_recycled',2.351,'BA_ESG_Monthly_Aug_24.xlsx > Nov 23!C28','imported',null,false,null);

-- Dec 23 (FY24 layout)
select esg.seed_input('AURORA','2023-24',9::smallint,'water.total_reported',1905,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.municipal',1083,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.groundwater',822,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'water.stp_outlet',1489,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'elec.grid',231160,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'elec.tenant',163331,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'elec.own_floor_1',12347.1,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'elec.own_floor_2',2778.83,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'fuel.diesel_dg',0.1,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F19','imported','100 L',false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.municipal',2.005,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.food',2.095,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'waste.food_recycled',2.095,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!C28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',9::smallint,'ops.dg_hours',2.1,'BA_ESG_Monthly_Aug_24.xlsx > Dec 23!B38:B39','parsed','0.9 + 1.2 hrs',false,null);

-- Jan 24 (FY24 layout)
select esg.seed_input('AURORA','2023-24',10::smallint,'water.total_reported',1981,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.municipal',1030,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.groundwater',951,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B15','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.rainwater',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.stp_inlet',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B18','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'water.stp_outlet',1583,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'elec.grid',233720,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F12','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'elec.tenant',171048,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'elec.own_floor_1',11932,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'elec.own_floor_2',2438,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'fuel.diesel_dg',0.04,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F19','imported','40 L',false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'fuel.diesel_vehicle',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B26','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.municipal',1.313,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B27','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.food',1.57,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B28','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B30','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B31','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B32','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B33','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B34','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B35','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',10::smallint,'ops.dg_hours',1.5,'BA_ESG_Monthly_Aug_24.xlsx > Jan 24!B38:B39','parsed','0.8 + 0.7 hrs',false,null);

-- Feb 24 (current layout)
select esg.seed_input('AURORA','2023-24',11::smallint,'water.total_reported',1713,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.municipal',917,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.groundwater',796,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.stp_inlet',1906,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B18','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.stp_outlet',1422,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.flushing',869,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B20','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.irrigation',443,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B21','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.car_wash',0,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B22','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'water.cooling_tower',273,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B23','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'elec.green',219960,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'elec.tenant',163845,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'elec.own_floor_1',10189,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'elec.own_floor_2',2226,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F17','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'fuel.diesel_dg',0.6009,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F19','imported','600.9 L',false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'fuel.diesel_plant',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B28','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.plastic',0.313,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B32','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.municipal',0.886,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B33','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.food',1.866,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B34','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B36','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B37','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B38','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B39','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B40','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B41','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'waste.food_recycled',1.866,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!C34','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',11::smallint,'ops.dg_hours',7.5,'BA_ESG_Monthly_Aug_24.xlsx > Feb 24!B44:B45','parsed','2.5 + 5 hrs',false,null);

-- March 24 (current layout)
select esg.seed_input('AURORA','2023-24',12::smallint,'water.total_reported',1629,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.municipal',845,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B14','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.groundwater',784,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.tanker',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B16','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.stp_inlet',1295,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B18','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.stp_outlet',1587,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B19','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.flushing',784,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B20','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.irrigation',428,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B21','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.car_wash',0,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B22','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'water.cooling_tower',445,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B23','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'elec.green',238129,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F13','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'elec.renewable',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F14','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'elec.tenant',172198,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F15','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'elec.own_floor_1',12011,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F16','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'elec.own_floor_2',2652,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F17','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'fuel.diesel_dg',0.225,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F19','imported','225 L',false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'fuel.diesel_plant',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F20','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'fuel.petrol',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!F21','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.cnd',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B28','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.plastic',0.382,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B32','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.municipal',1.181,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B33','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.food',2.387,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B34','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.used_oil',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B36','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.oil_filters_no',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B37','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.contaminated',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B38','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.biomedical',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B39','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.battery_no',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B40','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.ewaste',null,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B41','imported','NA',true,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'waste.food_recycled',2.387,'BA_ESG_Monthly_Aug_24.xlsx > March 24!C34','imported',null,false,null);
select esg.seed_input('AURORA','2023-24',12::smallint,'ops.dg_hours',2,'BA_ESG_Monthly_Aug_24.xlsx > March 24!B44:B45','parsed','0.8 + 1.2 hrs',false,null);

-- =============================================================================
-- SUBMISSION STATE — all twelve FY24 months are filed and reconciled.
-- =============================================================================
insert into esg.site_submission (site_id, period_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_note)
select s.id, p.id, 'approved', 'seed:aurora-fy24', now(), 'seed:aurora-fy24', now(),
       'Imported from Aurora''s FY24 monthly returns.'
from esg.site s
join esg.period p on p.period_kind = 'month' and p.fiscal_year = '2023-24'
where s.code = 'AURORA'
on conflict (site_id, period_id) do nothing;

-- =============================================================================
-- DATA FLAG — the November/September duplication.
-- Raised rather than corrected: the correct November figures are unknown.
-- =============================================================================
insert into esg.data_flag (site_id, period_id, parameter_id, rule_code, severity, message)
select s.id, p.id, ip.id, 'DUPLICATE_OF_PRIOR_MONTH', 'warning',
       'Nov-23 water figures are identical to Sept-23 (total 1,903 / municipal 961 / ground 942 / STP outlet 1,425) while electricity differs. Likely a copy-paste error in the source return. Loaded as filed; confirm the true November figures with the site.'
from esg.site s
join esg.period p on p.period_kind = 'month' and p.fiscal_year = '2023-24' and p.month_no = 8
join esg.input_parameter ip on ip.key = 'water.total_reported'
where s.code = 'AURORA'
on conflict (site_id, period_id, rule_code, parameter_id) do nothing;

-- The seeding helper (created in 08_input_values_seed.sql) is not part of the
-- runtime surface. Dropped here, after the last file that uses it.
drop function esg.seed_input(text, text, smallint, text, numeric, text, text, text, boolean, text);
