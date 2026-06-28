-- =============================================================================
-- ESG DATA TOOL — FORMULAS registry
-- OUTPUT = f(INPUT, CONSTANT, OUTPUT).  Each expression uses namespaced tokens:
--     in:<input_parameter.key>     const:<constant.key>     out:<output_parameter.key>
--
-- Expressions are transcribed faithfully from the workbook's calculation chain
-- (Input Sheet -> Derived Sheet -> GCCA engines).  excel_origin records where.
-- eval_order: lower = computed first (so out: references are already available).
--
-- Functions allowed by the resolver: IF(cond,a,b), IFERROR(expr,fallback),
-- SUM(...) [here written as explicit + for clarity], MAX, MIN.
-- The fuel-combustion outputs are written as the canonical per-fuel sum
--   Σ (qty_tons * lhv_kcalkg * 1e-9 * 4184 GJ-per... )  <- see note below.
--
-- FUEL CO2 NOTE: In the workbook, fuel energy = qty(t) * LHV(kcal/kg) gives
-- Gcal; the GCCA engine multiplies by the fuel's EF and /1000 to get tCO2,
-- with the kcal->GJ conversion folded into the engine. We express each fuel
-- term as:  in:qty * in:lhv * const:EF.<fuel> * 4.184e-6
--   (t * kcal/kg = Gcal; Gcal * 4.184e-3 = GJ... *1000 kg/t etc. -> see
--    07_resolver_notes.md for the exact unit reconciliation per the engine.)
-- Only kiln terms shown for the representative fuels seeded in INPUT; extend
-- the SUM with every fuel/location pair to match the full engine.
-- =============================================================================
set search_path = esg, public;

-- ---------------------------------------------------------------------------
-- PRODUCTION rollups  (Derived Sheet rows 11-28)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('prod.alt_cementitious',
 'in:res.gypsum_chemical + in:res.pi_limestone + in:res.slag + in:res.fly_ash + in:res.calcined_lime',
 'Sum of alternative cementitious materials consumed.',
 'Derived!N11 (=N745 alt-cementitious rollup)', 10),

('prod.total_minerals',
 'in:prod.natural_gypsum + out:prod.alt_cementitious',
 'Total mineral component = natural gypsum + alt cementitious material.',
 'Derived!N12 = SUM(N10:N11)', 15),

('prod.cementitious_produced',
 'in:prod.clinker_production + out:prod.total_minerals',
 'Cementitious produced = clinker production + total minerals consumed.',
 'Derived!N14 = SUM(N5,N12)', 20),

('prod.cement_produced',
 'in:prod.clinker_consumed + out:prod.total_minerals',
 'Cement produced = clinker consumed + total minerals consumed.',
 'Derived!N15 = SUM(N6,N12)', 20),

('prod.blended_total',
 'in:prod.psc + in:prod.cc + in:prod.ipc + in:prod.super_ppc + in:prod.ggbs + in:prod.super_opc + in:prod.ppc',
 'Total blended cements (PPC..Super OPC).',
 'Derived!N25 = SUM(N18:N24)', 20),

('kpi.clinker_factor',
 'IF(out:prod.cement_produced = 0, 0, in:prod.clinker_consumed / out:prod.cement_produced)',
 'Clinker factor = clinker consumed / cement produced.',
 'Derived!N26', 30),

('kpi.clinker_production_ratio',
 'IF(out:prod.cementitious_produced = 0, 0, in:prod.clinker_production / out:prod.cementitious_produced)',
 'Clinker production ratio = clinker production / cementitious produced.',
 'Derived!N27', 30),

('kpi.blended_share',
 'IF(out:prod.cement_produced = 0, 0, (out:prod.blended_total / out:prod.cement_produced) * 100)',
 'Blended cement share of total cement produced.',
 'Derived!N28', 35);

-- ---------------------------------------------------------------------------
-- ENERGY KPIs (Derived Sheet rows 47, 70-108)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('en.power_clinker_total',
 'in:pwr.clinker.ls_crusher + in:pwr.clinker.raw_mill + in:pwr.clinker.pyro + in:pwr.clinker.coal_mill',
 'Total power for clinker = crusher + raw mill + pyro + coal mill.',
 'Derived!N71 = SUM(N72:N75)', 20),

('en.power_grinding_total',
 'in:pwr.cement.grinding + in:pwr.cement.packing + in:pwr.cement.utilities',
 'Total power for grinding & packing.',
 'Derived!N81 = SUM(N82:N84)', 20),

('kpi.sec_clinker',
 'IF(in:prod.clinker_production = 0, 0, out:en.power_clinker_total / in:prod.clinker_production)',
 'Specific power consumption for clinker (kWh/t clinker).',
 'Derived!N76', 30),

('kpi.sec_grinding_packing',
 'IF(out:prod.cement_produced = 0, 0, out:en.power_grinding_total / out:prod.cement_produced)',
 'SEC of cement grinding & packing.',
 'Derived!N85', 30),

('kpi.sec_overall_cement',
 '(out:kpi.sec_clinker * out:kpi.clinker_production_ratio) + out:kpi.sec_grinding_packing',
 'Overall cement SEC = clinker SEC * clinker prod ratio + grinding/packing SEC.',
 'Derived!N98 = (N76*N27)+N85', 40),

('kpi.sec_cementitious',
 'IF(out:prod.cementitious_produced = 0, 0, (out:en.power_clinker_total + out:en.power_grinding_total) / out:prod.cementitious_produced)',
 'SEC per t cementitious (total relevant power / cementitious).',
 'Derived!N70 (N69*1000/N14)', 40),

('kpi.green_energy_ratio',
 'IF((in:pwr.onsite_delivered + in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered + in:pwr.grid_delivered) = 0, 0, (in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered) / (in:pwr.onsite_delivered + in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered + in:pwr.grid_delivered) * 100)',
 'Green electrical energy ratio on a DELIVERED basis (WHRS+solar+hydel / total delivered).',
 'Derived!N107', 40),

('kpi.renewable_energy_ratio',
 'IF((in:pwr.onsite_delivered + in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered + in:pwr.grid_delivered) = 0, 0, (in:pwr.solar_delivered + in:pwr.hydel_delivered) / (in:pwr.onsite_delivered + in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered + in:pwr.grid_delivered) * 100)',
 'Renewable energy ratio on a DELIVERED basis (solar+hydel / total delivered).',
 'Derived!N108', 40),

('kpi.whrs_generation',
 'IF(in:prod.clinker_production = 0, 0, (in:pwr.whrs_gen * 1000) / in:prod.clinker_production)',
 'WHRS generation per t clinker (kWh/t).',
 'Monthly!D43 = (Derived!N57*1000)/N5', 40);

-- ---------------------------------------------------------------------------
-- THERMAL: TSR + SHC. These reference fuel ENERGY aggregates the engine
-- computes (kiln fossil/AF/biomass energy, total). We expose them via the
-- per-fuel sums below; here they reference fuel energy outputs.
-- For SHC the workbook uses: (10^12/4184) * kiln_fossil_energy_TJ / (clinker*1000)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('kpi.tsr_alt',
 'IF((out:en.energy_kiln_total_tj + out:en.energy_cpp_total_tj) = 0, 0, (out:en.energy_kiln_alt_tj + out:en.energy_cpp_alt_tj) / (out:en.energy_kiln_total_tj + out:en.energy_cpp_total_tj) * 100)',
 'TSR (alternate fuels) = alt fuel energy / total thermal energy.',
 'Derived!N44', 60),

('kpi.tsr_biomass',
 'IF((out:en.energy_kiln_total_tj + out:en.energy_cpp_total_tj) = 0, 0, (out:en.energy_kiln_biomass_tj + out:en.energy_cpp_biomass_tj) / (out:en.energy_kiln_total_tj + out:en.energy_cpp_total_tj) * 100)',
 'TSR (biomass) = biomass energy / total thermal energy.',
 'Derived!N45', 60),

('kpi.tsr',
 'out:kpi.tsr_alt + out:kpi.tsr_biomass',
 'Total thermal substitution ratio.',
 'Derived!N46 = SUM(N44:N45)', 65),

('kpi.shc',
 'IF(in:prod.clinker_production = 0, 0, const:PHYS.tj_per_kcal_e12 * out:en.energy_kiln_total_tj / (in:prod.clinker_production * 1000))',
 'Specific heat consumption (kcal/kg clinker) from kiln thermal energy.',
 'Derived!N47 = (10^12/4184)*N37/(N5*1000)', 65);

-- ---------------------------------------------------------------------------
-- EMISSIONS: Scope 1 — CALCINATION (GCCA B2 stoichiometry)
-- Uncorrected = ((CaO_amt/MW.cao)+(MgO_amt/MW.mgo))*MW.co2 ; minus non-carbonate corr.
-- CaO_amt = clinker*CaO% ; non-carbonate from coal-ash CaO/MgO * ash consumption.
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('emis.calcination',
 '( (in:prod.clinker_production * in:qual.clinker_cao/100)/const:MW.cao + (in:prod.clinker_production * in:qual.clinker_mgo/100)/const:MW.mgo ) * const:MW.co2 '
 || '- ( ( ( (in:fuel.kiln.indigenous_petcoke.qty*in:qual.ash.petcoke + in:fuel.kiln.g5_coal.qty*in:qual.ash.indigenous_coal)/100 ) * in:qual.ash_cao/100 )/const:MW.cao '
 || '  + ( ( (in:fuel.kiln.indigenous_petcoke.qty*in:qual.ash.petcoke + in:fuel.kiln.g5_coal.qty*in:qual.ash.indigenous_coal)/100 ) * in:qual.ash_mgo/100 )/const:MW.mgo ) * const:MW.co2',
 'GCCA B2 calcination CO2: stoichiometric from clinker CaO/MgO, corrected for non-carbonate CaO/MgO contributed by coal ash. (Coal-ash term shown for the seeded representative fuels; extend to all ash-bearing fuels.)',
 'GCCA calcination B2!N30 = N27 - N28', 50),

-- EMISSIONS: Scope 1 — FUEL ENERGY aggregates (TJ) per location/category.
-- energy_TJ = Σ qty(t) * LHV(kcal/kg) * 4.184e-6   [t*kcal/kg = Gcal; *4.184e-3 = GJ; /1000 = TJ]
('en.energy_kiln_total_tj',
 '( in:fuel.kiln.indigenous_petcoke.qty*in:fuel.kiln.indigenous_petcoke.lhv + in:fuel.kiln.g5_coal.qty*in:fuel.kiln.g5_coal.lhv + in:fuel.kiln.diesel_oil.qty*in:fuel.kiln.diesel_oil.lhv '
 || '+ in:fuel.kiln.spent_carbon.qty*in:fuel.kiln.spent_carbon.lhv + in:fuel.kiln.shredded_plastic.qty*in:fuel.kiln.shredded_plastic.lhv + in:fuel.kiln.organic_residue.qty*in:fuel.kiln.organic_residue.lhv '
 || '+ in:fuel.kiln.organic_solvents.qty*in:fuel.kiln.organic_solvents.lhv + in:fuel.kiln.wood_sawdust.qty*in:fuel.kiln.wood_sawdust.lhv ) * 4.184e-6',
 'Total kiln thermal energy (TJ) = Σ qty*LHV across fossil+AF+biomass. (Representative seeded fuels; extend with all kiln fuels.)',
 'GCCA fuel for kiln (energy block, dry basis)', 45),

('en.energy_kiln_alt_tj',
 '( in:fuel.kiln.spent_carbon.qty*in:fuel.kiln.spent_carbon.lhv + in:fuel.kiln.shredded_plastic.qty*in:fuel.kiln.shredded_plastic.lhv + in:fuel.kiln.organic_residue.qty*in:fuel.kiln.organic_residue.lhv + in:fuel.kiln.organic_solvents.qty*in:fuel.kiln.organic_solvents.lhv ) * 4.184e-6',
 'Kiln alternate-fuel thermal energy (TJ).',
 'GCCA fuel for kiln (AF block)', 45),

('en.energy_kiln_biomass_tj',
 '( in:fuel.kiln.wood_sawdust.qty*in:fuel.kiln.wood_sawdust.lhv ) * 4.184e-6',
 'Kiln biomass thermal energy (TJ).',
 'GCCA fuel for kiln (biomass block)', 45),

-- CPP energy placeholders (seed CPP fuels into INPUT and expand identically)
('en.energy_cpp_total_tj',   '0', 'CPP total thermal energy (TJ). Wire to CPP fuel inputs.','GCCA fuel for CPP', 45),
('en.energy_cpp_alt_tj',     '0', 'CPP alternate-fuel thermal energy (TJ).','GCCA fuel for CPP', 45),
('en.energy_cpp_biomass_tj', '0', 'CPP biomass thermal energy (TJ).','GCCA fuel for CPP', 45),

-- EMISSIONS: Scope 1 — FUEL CO2 per location.  CO2_t = Σ (energy_per_fuel_GJ * EF_fuel) /1000
('emis.fuel_kiln_gross',
 '( in:fuel.kiln.indigenous_petcoke.qty*in:fuel.kiln.indigenous_petcoke.lhv*const:EF.fuel.indigenous_petcoke + in:fuel.kiln.g5_coal.qty*in:fuel.kiln.g5_coal.lhv*const:EF.fuel.g5_coal + in:fuel.kiln.diesel_oil.qty*in:fuel.kiln.diesel_oil.lhv*const:EF.fuel.diesel_oil '
 || '+ in:fuel.kiln.spent_carbon.qty*in:fuel.kiln.spent_carbon.lhv*const:EF.alt.spent_carbon + in:fuel.kiln.shredded_plastic.qty*in:fuel.kiln.shredded_plastic.lhv*const:EF.alt.shredded_plastic + in:fuel.kiln.organic_residue.qty*in:fuel.kiln.organic_residue.lhv*const:EF.alt.organic_residue '
 || '+ in:fuel.kiln.organic_solvents.qty*in:fuel.kiln.organic_solvents.lhv*const:EF.alt.organic_solvents + in:fuel.kiln.wood_sawdust.qty*in:fuel.kiln.wood_sawdust.lhv*const:EF.bio.wood_sawdust ) * 4.184e-6 / 1000 * 1000',
 'Gross kiln fuel CO2 (incl AF & biomass) = Σ qty*LHV*EF with kcal->GJ conversion. (Representative seeded fuels.)',
 'GCCA fuel for kiln!N298 = SUM(energy*EF terms)', 50),

('emis.fuel_kiln_af',
 '( in:fuel.kiln.spent_carbon.qty*in:fuel.kiln.spent_carbon.lhv*const:EF.alt.spent_carbon + in:fuel.kiln.shredded_plastic.qty*in:fuel.kiln.shredded_plastic.lhv*const:EF.alt.shredded_plastic + in:fuel.kiln.organic_residue.qty*in:fuel.kiln.organic_residue.lhv*const:EF.alt.organic_residue + in:fuel.kiln.organic_solvents.qty*in:fuel.kiln.organic_solvents.lhv*const:EF.alt.organic_solvents + in:fuel.kiln.wood_sawdust.qty*in:fuel.kiln.wood_sawdust.lhv*const:EF.bio.wood_sawdust ) * 4.184e-6',
 'CO2 from AF & biomass - Kiln.',
 'GCCA fuel for kiln!N299', 50),

('emis.fuel_kiln_biomass',
 '( in:fuel.kiln.wood_sawdust.qty*in:fuel.kiln.wood_sawdust.lhv*const:EF.bio.wood_sawdust ) * 4.184e-6',
 'Biogenic CO2 (biomass only) - Kiln.',
 'GCCA fuel for kiln!N302', 50),

-- CPP / HAG fuel CO2 placeholders — wire identically once CPP/HAG fuels seeded
('emis.fuel_cpp_gross',  '0','Gross fuel CO2 - CPP. Wire to CPP fuel inputs.','GCCA fuel for CPP!N292', 50),
('emis.fuel_cpp_af',     '0','CO2 from AF & biomass - CPP.','GCCA fuel for CPP!N293', 50),
('emis.fuel_cpp_biomass','0','Biogenic CO2 - CPP.','GCCA fuel for CPP!N296', 50),
('emis.fuel_hag_gross',  '0','Gross fuel CO2 - HAG. Wire to HAG fuel inputs.','GCCA fuel for Cement Mill HAG!N292', 50),
('emis.fuel_hag_af',     '0','CO2 from AF & biomass - HAG.','GCCA fuel for Cement Mill HAG!N293', 50),
('emis.fuel_hag_biomass','0','Biogenic CO2 - HAG.','GCCA fuel for Cement Mill HAG!N296', 50),

-- EMISSIONS: Scope 1 — internal transport (owned vehicles) + DG
('emis.internal_transport',
 '(in:veh.diesel + IF(in:dg.is_company_owned = ''yes'', in:dg.diesel, 0)) * const:EF.transport.diesel + in:veh.petrol * const:EF.transport.petrol + in:veh.bio_diesel * const:EF.transport.biodiesel',
 'Internal transport CO2 = (diesel + owned-DG diesel)*EF + petrol*EF + biodiesel*EF.',
 'GCCA Internal Transport!N26', 50),

-- EMISSIONS: Scope 1 — other sources (refrigerants/fire/welding/canteen) -> /1000 to t
('emis.other_sources',
 '( in:other.refrig_r407c*const:EF.other.r407c + in:other.refrig_r134a*const:EF.other.r134a + in:other.refrig_r32*const:EF.other.r32 + in:other.refrig_r410a*const:EF.other.r410a + in:other.refrig_r22*const:EF.other.r22 '
 || '+ in:other.fire_co2*const:EF.other.fire_co2 + in:other.welding_lpg*const:EF.other.lpg + in:other.welding_diacetylene*const:EF.other.diacetylene + in:other.canteen_lpg*const:EF.other.lpg + in:other.canteen_fuel_oil*const:EF.other.fuel_oil/1000 ) / 1000',
 'Other-source CO2 (GWP-weighted refrigerants + fire + welding + canteen), converted to t.',
 'GCCA other emission!N49 = N48/1000', 50);

-- ---------------------------------------------------------------------------
-- EMISSIONS: Scope 1 totals (Derived 606, 644-648)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('emis.scope1_total',
 'out:emis.calcination + out:emis.fuel_kiln_gross + out:emis.fuel_cpp_gross + out:emis.fuel_hag_gross + out:emis.internal_transport + out:emis.other_sources',
 'Gross Scope 1 = calcination + kiln + CPP + HAG fuel + internal transport + other.',
 'Derived!N606 = SUM(N607:N612); Monthly N644', 70),

('emis.scope1_af_biomass',
 'out:emis.fuel_kiln_af + out:emis.fuel_cpp_af + out:emis.fuel_hag_af',
 'CO2 from alternate fuels & biomass across kiln+CPP+HAG.',
 'Derived!N645 = SUM(N635,N617,N626)', 72),

('emis.scope1_net',
 'out:emis.scope1_total - out:emis.scope1_af_biomass',
 'Net Scope 1 excluding AF & biomass.',
 'Derived!N646 = N644-N645', 74),

('emis.biogenic_total',
 'out:emis.fuel_kiln_biomass + out:emis.fuel_cpp_biomass + out:emis.fuel_hag_biomass',
 'Biogenic (biomass) CO2 total — reported separately, excluded from net Scope 1.',
 'Derived!N647 = SUM(N620,N629,N638)', 74);

-- ---------------------------------------------------------------------------
-- EMISSIONS: Scope 2 (Derived 485) — (grid total - onsite export) * EF
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('emis.scope2_total',
 '((in:pwr.grid_total - in:pwr.onsite_export) * const:EF.grid_2023)',
 'Scope 2 CO2 = (grid power consumed - onsite export) * grid EF (0.716 t/MWh).',
 'Derived!N485 = ((N481-N483)*N484)/1000  [N484=716 kg/MWh]', 70);

-- ---------------------------------------------------------------------------
-- EMISSIONS: Scope 3 (3 categories: up/down transport + commuting)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('emis.scope3_total',
 'IF(in:s3.cement_road.mileage = 0, 0, (in:s3.cement_road.qty / in:s3.cement_road.loading) * in:s3.cement_road.distance * const:EF.s3.hdv_road) / 1000 '
 || '+ (in:s3.cement_rail.qty * in:s3.cement_rail.distance * const:EF.s3.rail) / 1000 '
 || '+ (in:commute.scooter.distance * const:EF.commute.scooter + in:commute.motorcycle.distance * const:EF.commute.motorcycle + in:commute.car_petrol.distance * const:EF.commute.car_petrol + in:commute.car_diesel.distance * const:EF.commute.car_diesel + in:commute.bus.employees * in:commute.bus.distance * const:EF.commute.bus) / 1000',
 'Scope 3 (partial, 3 categories): road dispatch (trips*distance*HDV EF) + rail (t-km*EF) + employee commuting. Result in t CO2.',
 '1Scope 3!O25 (+ commuting & transport engines)', 75);

-- ---------------------------------------------------------------------------
-- EMISSIONS intensities (Derived 659-677)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('emis.intensity_scope1_cementitious',
 'IFERROR(out:emis.scope1_total * 1000 / out:prod.cementitious_produced, 0)',
 'Scope 1 intensity per t cementitious (kg CO2/t).',
 'Derived!N674 sum of N659:N664', 80),

('emis.intensity_scope2_cementitious',
 'IFERROR(out:emis.scope2_total * 1000 / out:prod.cementitious_produced, 0)',
 'Scope 2 intensity per t cementitious.',
 'Derived!N675', 80),

('emis.intensity_scope3_cementitious',
 'IFERROR(out:emis.scope3_total * 1000 / out:prod.cementitious_produced, 0)',
 'Scope 3 intensity per t cementitious.',
 'Derived!N676', 80),

('emis.intensity_total_cementitious',
 'out:emis.intensity_scope1_cementitious + out:emis.intensity_scope2_cementitious + out:emis.intensity_scope3_cementitious',
 'Total GHG intensity per t cementitious (Scope 1+2+3).',
 'Derived!N677 = SUM(N674:N676)', 85),

('emis.intensity_calcination_clinker',
 'IFERROR(out:emis.calcination * 1000 / in:prod.clinker_production, 0)',
 'Calcination intensity per t clinker.',
 'Derived!N665', 80),

('emis.intensity_scope2_clinker',
 'IFERROR(out:emis.scope2_total * 1000 / in:prod.clinker_production, 0)',
 'Scope 2 intensity per t clinker.',
 'Derived!N671', 80);

-- ---------------------------------------------------------------------------
-- WATER (GRI 303)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('water.withdrawal_ground',
 'in:water.wd.borewell + in:water.wd.open_well',
 'Groundwater withdrawal = bore-well + open well.',
 'GRI 303-3 Groundwater', 30),

('water.withdrawal_surface',
 'in:water.wd.mine_pit + in:water.wd.river + in:water.wd.reservoir + in:water.wd.pond + in:water.wd.canal + in:water.wd.municipal',
 'Surface water withdrawal = sum of surface bodies.',
 'GRI 303-3 Surface water', 30),

('water.withdrawal_total',
 'out:water.withdrawal_ground + out:water.withdrawal_surface',
 'Total water withdrawal (all sources).',
 'GRI 303-3 total', 35),

('water.discharge_total',
 'in:water.discharge.surface + in:water.discharge.ground',
 'Total water discharge.',
 'GRI 303-4', 30),

('water.consumption_total',
 'out:water.withdrawal_total - out:water.discharge_total',
 'Water consumption = withdrawal - discharge.',
 'GRI 303-5', 40);

-- ---------------------------------------------------------------------------
-- WASTE (GRI 306)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('waste.diverted_total',
 'in:waste.divert.haz.reused + in:waste.divert.haz.recycled + in:waste.divert.haz.other + in:waste.divert.nonhaz.reused + in:waste.divert.nonhaz.recycled + in:waste.divert.nonhaz.other',
 'Waste diverted from disposal (306-4) = haz + non-haz recovery operations.',
 'GRI 306-4', 30),

('waste.directed_total',
 'in:waste.disp.haz.recyclers + in:waste.disp.haz.incin_er + in:waste.disp.haz.incin_noer + in:waste.disp.haz.landfill + in:waste.disp.nonhaz.recyclers + in:waste.disp.nonhaz.landfill + in:waste.disp.nonhaz.other',
 'Waste directed to disposal (306-5) = haz + non-haz disposal routes.',
 'GRI 306-5', 30),

('waste.generated_total',
 'in:waste.gen.hazardous_total + in:waste.gen.nonhaz_total',
 'Total waste generated (306-3).',
 'GRI 306-3', 30);

-- ---------------------------------------------------------------------------
-- ENERGY: total energy consumption within the organization (GRI 302-1)
-- electricity(TJ) [= delivered MWh * 0.0036] + total fuel thermal energy(TJ)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('en.consumption_total_tj',
 '(in:pwr.onsite_delivered + in:pwr.whrs_delivered + in:pwr.solar_delivered + in:pwr.hydel_delivered + in:pwr.grid_delivered) * 0.0036 '
 || '+ out:en.energy_kiln_total_tj + out:en.energy_cpp_total_tj',
 'Energy consumption within organization (TJ) = delivered electricity (MWh*0.0036) + kiln+CPP thermal energy.',
 'GRI 302-1 (Energy sheet rollup)', 60);

-- ---------------------------------------------------------------------------
-- BIODIVERSITY
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('bio.greenbelt_pct',
 'IFERROR(in:bio.greenbelt_area * 10000 / in:bio.total_plant_area * 100, 0)',
 '% green belt of total plant area (greenbelt ha -> m2 / total plant area m2).',
 'Input Sheet row 976', 30);

-- ---------------------------------------------------------------------------
-- AIR (non-GHG)
-- ---------------------------------------------------------------------------
insert into esg.formula (output_key, expression, description, excel_origin, eval_order) values
('air.total_particulate',
 'in:air.dust + in:air.pm',
 'Total particulate = Dust + PM.',
 'GRI 305-7', 30);
