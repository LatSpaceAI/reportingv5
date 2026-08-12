-- =============================================================================
-- BIRLA ESTATES — SCOPE 3 REFERENCE DATA
--
-- The 95 emission factors, the CONTROL-sheet assumptions, and the 111 mapping
-- rows, transcribed from birla-estates/Birla Estates - Scope 3 Calculator
-- (Template) v1.0.xlsx by script rather than by hand.
--
-- 90 OF THE 95 FACTORS ARE SEEDED WITH is_assumption = true.
--
--   That is not caution, it is what the workbook says. Its own README:
--   "Every factor on the CONSTANTS sheet starts marked INDICATIVE. Those values
--   are placeholders of the right order of magnitude, put there so the model
--   runs end to end and can be tested. They are NOT the published values."
--
--   Seeding them as confirmed to make a validation pass go green would convert
--   a test fixture into a disclosure. The constants settings page already
--   implements exactly the workflow the workbook asks for — open the cited
--   source, enter the real figure, record a reason, clear the flag — so the ESG
--   team gets a working list of 90 with a confirm action each, and every
--   confirmation lands in constant_revision with its reason attached.
--
--   The five already confirmed: EF-ELEC-CEA-COMB (0.727, the CEA grid average —
--   independently back-derived by this platform to the same three decimals),
--   EF-MAT-SUPPLIER-EPD (per-line, Tier 1), EF-CMT-WALK-CYCLE (zero by
--   definition), GWP-CO2 (1), and EF-ZERO.
--
-- Apply after 13_scope3_schema.sql.
-- =============================================================================

set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- Categories. Scope 1/2 already has EF_GRID, EF_FUEL, GWP_REFRIG and
-- CONVERSION; these are additional and deliberately separate.
--
-- EF_S3_ELEC and EF_S3_FUEL exist rather than reusing EF_GRID / EF_FUEL because
-- they hold UPSTREAM factors (well-to-tank, T&D loss) that must never be
-- confused with the combustion factors the Scope 1/2 formulas read. A settings
-- page listing 'Diesel' twice with different values and no distinguishing
-- category is a trap.
--
-- GWP_AR6 is separate from the existing GWP_REFRIG for the same reason and a
-- sharper one: GWP_REFRIG holds AR4 values (R22 = 1810), this workbook uses AR6
-- (R22 = 1760). Both are correct for their own disclosure. The keys differ, the
-- categories differ, and constant.assessment_report records which set a factor
-- belongs to, because the CONTROL sheet has to disclose it.
-- -----------------------------------------------------------------------------
insert into esg.constant_category (code, name) values
    ('EF_S3_ELEC',  'Emission factor - electricity, upstream and losses (Scope 3)'),
    ('EF_S3_FUEL',  'Emission factor - fuel, well-to-tank and tenant combustion (Scope 3)'),
    ('EF_FREIGHT',  'Emission factor - freight (kg CO2e / tonne-km)'),
    ('EF_MATERIAL', 'Emission factor - building material embodied carbon (kg CO2e / tonne)'),
    ('EF_SPEND',    'Emission factor - spend-based EEIO (kg CO2e / EUR)'),
    ('EF_WASTE',    'Emission factor - waste by disposal route (kg CO2e / tonne)'),
    ('EF_TRAVEL',   'Emission factor - business travel (kg CO2e / passenger-km or room-night)'),
    ('EF_COMMUTE',  'Emission factor - employee commuting (kg CO2e / km)'),
    ('GWP_AR6',     'Global warming potential - IPCC AR6, 100-year (kg CO2e / kg)'),
    ('EF_UTILITY',  'Definitional and utility factors'),
    ('S3_CONTROL',  'Scope 3 CONTROL sheet - boundary and calculation assumptions')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- THE FACTOR REGISTER — 95 rows.
--
-- Column mapping from the workbook:
--   Factor ID         -> key                Value             -> value
--   Description       -> label              Unit (denominator)-> unit
--   Source            -> source             Version / edition -> version
--   Reference year    -> reference_year     Geography         -> geography
--   Data quality tier -> data_quality_tier
--   Status 'INDICATIVE...'                  -> is_assumption = true
--   Notes and derivation                    -> notes
--
-- TWO ROWS ARE NOT PLAIN TRANSCRIPTIONS:
--
--   EF-ELEC-UPSTREAM is a LIVE FORMULA in the workbook
--   (= EF-ELEC-CEA-COMB x EF-ELEC-WTT-UPLIFT). Seeded here as its evaluated
--   product, 0.727 x 0.08 = 0.05816. It does NOT recompute when either input
--   changes. Whoever edits the grid factor or the uplift must edit this too;
--   its notes say so, and the settings page's blast radius shows the dependents.
--
--   EF-MAT-SUPPLIER-EPD carries NO register value: the factor is supplied per
--   line on the materials ledger, from the supplier's own EPD. Seeded as 0
--   because value is NOT NULL. resolve-scope3.mjs never reads it — a line with
--   epd_available = 'Y' takes its factor from the line itself — and asserts
--   that it never does, because reading it would compute a silent zero.
-- -----------------------------------------------------------------------------
insert into esg.constant
    (key, category, label, value, unit, source, version, reference_year, geography,
     data_quality_tier, is_assumption, assessment_report, notes)
values
('EF-ELEC-CEA-COMB', 'EF_S3_ELEC', 'India grid electricity - generation (combustion) emission factor', 0.727, 'kgCO2e / kWh', 'CEA CO2 Baseline Database for the Indian Power Sector', 'User to enter version (e.g. v20)', 'FY2024-25', 'India', 'Tier 2 - country average', false, null, '0.727 is the factor that exactly reproduces BEPL''s published FY25 Scope 2 of 2,678.16 tCO2e from 3,683,858.31 kWh. Update to the latest CEA weighted-average each year and re-confirm.'),
('EF-ELEC-TD-LOSS', 'EF_S3_ELEC', 'India transmission and distribution loss - share of electricity entering the grid', 0.175, 'fraction', 'CEA General Review / Ministry of Power annual T&D loss statistics', 'User to enter edition', 'FY2024-25', 'India', 'Tier 2 - country average', true, null, 'Enter the national (or state, if available) T&D loss for the reporting year. Losses attributable to delivered consumption = consumption x L/(1-L).'),
('EF-ELEC-WTT-UPLIFT', 'EF_S3_ELEC', 'Upstream (well-to-tank) uplift on grid generation - fuel extraction, processing and transport', 0.08, 'fraction of combustion EF', 'Derived: DEFRA/DESNZ WTT-to-combustion ratio for coal and natural gas, weighted by CEA generation mix', 'Derived', 'FY2024-25', 'India', 'Tier 3 - derived proxy', true, null, 'DERIVATION: DEFRA WTT/combustion is approx 8% for coal and approx 18% for natural gas. India''s grid is coal-dominant (approx 75% of generation), giving approx 8%. This REPLACES the DEFRA UK-electricity WTT factor, which reflects the UK fuel mix and is not valid for India. Re-derive whenever the CEA generation mix is updated.'),
('EF-ELEC-UPSTREAM', 'EF_S3_ELEC', 'India grid electricity - upstream of generation (WTT)', 0.05816, 'kgCO2e / kWh', 'Derived = EF-ELEC-CEA-COMB x EF-ELEC-WTT-UPLIFT', 'Derived', 'FY2024-25', 'India', 'Tier 3 - derived proxy', true, null, 'Live formula - do not overwrite. Recalculates when either input factor changes.'),
('EF-DSL-COMB', 'EF_S3_FUEL', 'Diesel - combustion (tank-to-wheel)', 2.66, 'kgCO2e / litre', 'UK Government (DESNZ/DEFRA) GHG Conversion Factors, ''Fuels'' table, diesel average biofuel blend', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Used only for Cat 13 tenant fuel. Birla Estates'' own diesel combustion is Scope 1 and is not calculated here.'),
('EF-DSL-WTT', 'EF_S3_FUEL', 'Diesel - well-to-tank (upstream)', 0.6, 'kgCO2e / litre', 'UK Government (DESNZ/DEFRA) GHG Conversion Factors, ''WTT - fuels'' table, diesel average biofuel blend', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'No published Indian WTT dataset exists. DEFRA WTT is the standard proxy and should be disclosed as such.'),
('EF-PET-COMB', 'EF_S3_FUEL', 'Petrol - combustion (tank-to-wheel)', 2.3, 'kgCO2e / litre', 'UK Government (DESNZ/DEFRA) GHG Conversion Factors, ''Fuels'' table, petrol average biofuel blend', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-PET-WTT', 'EF_S3_FUEL', 'Petrol - well-to-tank (upstream)', 0.61, 'kgCO2e / litre', 'UK Government (DESNZ/DEFRA) GHG Conversion Factors, ''WTT - fuels'' table, petrol average biofuel blend', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-FRT-LCV', 'EF_FREIGHT', 'Light commercial vehicle (up to 3.5t GVW) - road freight, well-to-wheel', 0.5, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0 (complements GLEC Framework v3, ISO 14083)', 'v1.0', '2023', 'India', 'Tier 2 - country average', true, null, 'Well-to-wheel - includes the fuel WTT component, so do not add a separate WTT line.'),
('EF-FRT-HGV-RIGID', 'EF_FREIGHT', 'Rigid truck (7.5-16t GVW) - road freight, well-to-wheel', 0.18, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0', 'v1.0', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-FRT-HGV-HEAVY', 'EF_FREIGHT', 'Heavy rigid truck (16-25t GVW) - road freight, well-to-wheel', 0.12, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0', 'v1.0', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-FRT-HGV-ARTIC', 'EF_FREIGHT', 'Articulated truck / trailer (over 25t GVW) - road freight, well-to-wheel', 0.09, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0', 'v1.0', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-FRT-TRANSIT-MIXER', 'EF_FREIGHT', 'Transit mixer (ready-mix concrete delivery) - road freight, well-to-wheel', 0.25, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0, adjusted for mixer payload', 'v1.0', '2023', 'India', 'Tier 3 - adjusted proxy', true, null, 'Transit mixers run a low payload ratio and always return empty. Confirm the payload assumption.'),
('EF-FRT-RAIL', 'EF_FREIGHT', 'Rail freight - well-to-wheel', 0.02, 'kgCO2e / tonne-km', 'Smart Freight Centre - India Default GHG Emission Values v1.0', 'v1.0', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-FRT-SEA', 'EF_FREIGHT', 'Sea freight (container) - well-to-wheel', 0.016, 'kgCO2e / tonne-km', 'GLEC Framework v3 / IMO default', 'v3', '2023', 'Global', 'Tier 3 - global proxy', true, null, null),
('EF-FRT-AIR', 'EF_FREIGHT', 'Air freight (belly cargo) - well-to-wheel', 1, 'kgCO2e / tonne-km', 'GLEC Framework v3', 'v3', '2023', 'Global', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-CEM-OPC', 'EF_MATERIAL', 'Cement - Ordinary Portland Cement (OPC 43/53)', 900, 'kgCO2e / tonne', 'GCCA Getting the Numbers Right - India country report; cross-check ICE v4.0', 'User to enter', '2023', 'India', 'Tier 2 - country average', true, null, 'Replace with a supplier EPD wherever one exists - Indian cement makers publish them and the spread between producers is wide.'),
('EF-MAT-CEM-PPC', 'EF_MATERIAL', 'Cement - Portland Pozzolana Cement (PPC, fly ash blended)', 650, 'kgCO2e / tonne', 'GCCA Getting the Numbers Right - India country report', 'User to enter', '2023', 'India', 'Tier 2 - country average', true, null, 'Blended cements carry a materially lower factor - do not apply the OPC factor to PPC/PSC volumes.'),
('EF-MAT-CEM-PSC', 'EF_MATERIAL', 'Cement - Portland Slag Cement (PSC, GGBS blended)', 500, 'kgCO2e / tonne', 'GCCA Getting the Numbers Right - India country report', 'User to enter', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-MAT-RMC', 'EF_MATERIAL', 'Ready-mix concrete (M25 equivalent)', 130, 'kgCO2e / tonne', 'ICE Database v4.0 (Circular Ecology), concrete RC 25/30', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, 'Density approx 2.4 t/m3 - use the conversion column on the Materials input sheet if the site records m3.'),
('EF-MAT-STEEL-REBAR', 'EF_MATERIAL', 'Steel - reinforcement bar', 2400, 'kgCO2e / tonne', 'worldsteel LCI / Indian steel sector average', 'User to enter', '2023', 'India', 'Tier 2 - country average', true, null, 'India''s route mix is more coal/DRI-weighted than the global average, so the global worldsteel figure (approx 1,900) understates it. Use a supplier EPD where available.'),
('EF-MAT-STEEL-STRUCT', 'EF_MATERIAL', 'Steel - structural sections and plate', 2500, 'kgCO2e / tonne', 'worldsteel LCI / Indian steel sector average', 'User to enter', '2023', 'India', 'Tier 2 - country average', true, null, null),
('EF-MAT-BRICK-CLAY', 'EF_MATERIAL', 'Bricks - fired clay', 300, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, 'Indian clamp-kiln bricks are typically higher than the ICE figure. Flag for improvement.'),
('EF-MAT-AAC-BLOCK', 'EF_MATERIAL', 'Blocks - autoclaved aerated concrete (AAC)', 250, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-AGGREGATE', 'EF_MATERIAL', 'Aggregate, sand and crushed stone', 8, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, 'Low embodied factor but high tonnage - the freight leg usually dominates this material.'),
('EF-MAT-GLASS-FLOAT', 'EF_MATERIAL', 'Glass - float / architectural glazing', 1400, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-ALUMINIUM', 'EF_MATERIAL', 'Aluminium - extruded sections (facade, windows)', 12000, 'kgCO2e / tonne', 'ICE Database v4.0 / International Aluminium Institute', 'v4.0', '2024', 'Global', 'Tier 3 - global proxy', true, null, 'Very high factor - small tonnages still matter. Recycled-content share materially changes this; capture it if the supplier will disclose it.'),
('EF-MAT-TILES-CERAMIC', 'EF_MATERIAL', 'Ceramic and vitrified tiles', 700, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-GYPSUM', 'EF_MATERIAL', 'Gypsum board and plaster', 400, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-PAINT', 'EF_MATERIAL', 'Paints and coatings', 2500, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-PVC', 'EF_MATERIAL', 'PVC / uPVC pipes and conduit', 3100, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-COPPER', 'EF_MATERIAL', 'Copper - wire and cable conductor', 3500, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'Global', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-TIMBER', 'EF_MATERIAL', 'Timber, plywood and joinery', 800, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, 'Excludes biogenic carbon storage - report separately if claimed.'),
('EF-MAT-BITUMEN', 'EF_MATERIAL', 'Bitumen and waterproofing membrane', 550, 'kgCO2e / tonne', 'ICE Database v4.0', 'v4.0', '2024', 'UK/global proxy', 'Tier 3 - global proxy', true, null, null),
('EF-MAT-SUPPLIER-EPD', 'EF_MATERIAL', 'Supplier-specific factor from a verified EPD - entered per line on the Materials input sheet', 0, 'kgCO2e / tonne', 'Supplier EPD (ISO 14025 / EN 15804)', 'Per line', 'Per line', 'Per supplier', 'Tier 1 - supplier specific', false, null, 'Do not enter a value here. When column H on the Materials sheet is ''Y'', the calculator uses the per-line EPD factor in column I instead of the library factor.'),
('EF-SPD-CONSTRUCTION', 'EF_SPEND', 'Construction works and civil contracting', 0.6, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3 multi-regional EEIO, India (IN) region', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, 'EXIOBASE is denominated in EUR at basic prices for its reference year. Spend must be converted at the market FX rate and deflated to that reference year - both live on the CONTROL sheet. Do NOT use PPP-adjusted USD with US EEIO: it applies US production technology and the US grid to Indian supply chains.'),
('EF-SPD-CEMENT-LIME', 'EF_SPEND', 'Cement, lime and plaster', 3.5, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, 'Only for cement spend that is NOT captured by tonnage on the Materials sheet. Double counting risk - see the exclusion tag on the Procurement sheet.'),
('EF-SPD-METAL-PRODUCTS', 'EF_SPEND', 'Fabricated metal products', 1.8, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-MACHINERY', 'EF_SPEND', 'Machinery and mechanical equipment', 0.55, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-ELEC-EQUIP', 'EF_SPEND', 'Electrical machinery, cabling and equipment', 0.5, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-IT-EQUIP', 'EF_SPEND', 'Computers, IT hardware and office equipment', 0.45, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-FURNITURE', 'EF_SPEND', 'Furniture, fixtures and fit-out', 0.75, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-PROF-SERVICES', 'EF_SPEND', 'Professional services - design, legal, audit, consulting', 0.15, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-IT-SERVICES', 'EF_SPEND', 'IT and telecommunication services', 0.12, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-FIN-INSURANCE', 'EF_SPEND', 'Financial and insurance services', 0.1, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-MARKETING', 'EF_SPEND', 'Advertising, marketing and brokerage', 0.2, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-FACILITY-SVC', 'EF_SPEND', 'Facility management, security, housekeeping and manpower services', 0.25, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-TRANSPORT-SVC', 'EF_SPEND', 'Transport and logistics services purchased as a service', 0.9, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, 'Use only where freight is bought as a service and no tonne-km data exists. If it is also on the freight sheets, tag one of them EXCLUDE.'),
('EF-SPD-RENTAL-EQUIP', 'EF_SPEND', 'Plant and equipment hire', 0.3, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN)', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, null),
('EF-SPD-OTHER', 'EF_SPEND', 'Other goods and services - residual bucket', 0.5, 'kgCO2e / EUR (basic prices)', 'EXIOBASE v3, India (IN), weighted residual', 'User to enter release', 'User to enter', 'India', 'Tier 3 - EEIO', true, null, 'Keep this bucket small. If it exceeds 10% of spend, the HSN mapping needs extending.'),
('EF-WST-CD-LANDFILL', 'EF_WASTE', 'Construction and demolition waste - landfill', 1.26, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA) GHG Conversion Factors, ''Waste disposal'' table, Construction', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Inert C&D carries a very low landfill factor because it does not degrade. This is why 14,384 MT of C&D contributes far less than intuition suggests - do not substitute a mixed-waste factor.'),
('EF-WST-CD-RECYCLE', 'EF_WASTE', 'Construction and demolition waste - recycling / reuse', 1.26, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', Construction open-loop', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-MSW-LANDFILL', 'EF_WASTE', 'Municipal / commercial and industrial waste - landfill', 446.2, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', Commercial and industrial waste landfill', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Dominated by landfill methane. An Indian landfill-gas-capture assumption would lower this - document if you deviate.'),
('EF-WST-MSW-RECYCLE', 'EF_WASTE', 'Municipal / mixed recyclables - recycling', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', open-loop recycling', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Covers collection and reprocessing only - avoided virgin production is NOT credited under the GHG Protocol.'),
('EF-WST-MSW-INCIN', 'EF_WASTE', 'Municipal waste - combustion / incineration', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', combustion', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-ORG-COMPOST', 'EF_WASTE', 'Organic / food waste - composting', 8.9, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', organic food and drink composting', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Applies to the OWC-composted food waste stream reported by the sites.'),
('EF-WST-ORG-AD', 'EF_WASTE', 'Organic / food waste - anaerobic digestion', 8.9, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', anaerobic digestion', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-ORG-LANDFILL', 'EF_WASTE', 'Organic / food waste - landfill', 626.9, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', organic food and drink landfill', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-HAZ-INCIN', 'EF_WASTE', 'Hazardous waste - incineration by authorised handler', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), ''Waste disposal'', combustion (proxy)', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'DEFRA has no hazardous-waste route. Combustion is used as a proxy - disclose it. Covers used oil, oil-soaked cotton rags, paint containers, e-waste and battery streams.'),
('EF-WST-HAZ-RECOVERY', 'EF_WASTE', 'Hazardous waste - recovery / co-processing by authorised handler', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), open-loop recycling (proxy)', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-METAL-RECYCLE', 'EF_WASTE', 'Metal scrap - recycling', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), open-loop recycling', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-PLASTIC-RECYCLE', 'EF_WASTE', 'Plastic - recycling', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), open-loop recycling', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-PAPER-RECYCLE', 'EF_WASTE', 'Paper and cardboard - recycling', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), open-loop recycling', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-WOOD-RECYCLE', 'EF_WASTE', 'Wood scrap - recycling', 21.3, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), open-loop recycling', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-WST-STP-SLUDGE', 'EF_WASTE', 'STP sludge - land application / disposal', 8.9, 'kgCO2e / tonne', 'UK Government (DESNZ/DEFRA), organic composting (proxy)', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-DOM', 'EF_TRAVEL', 'Air travel - domestic, economy (with radiative forcing)', 0.2446, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''Business travel - air'', domestic, with RF', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Include radiative forcing and disclose that you do. Distances should be great-circle plus the DEFRA uplift for indirect routing.'),
('EF-TRV-AIR-DOM-WTT', 'EF_TRAVEL', 'Air travel - domestic, economy - well-to-tank', 0.046, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-SH-ECON', 'EF_TRAVEL', 'Air travel - short haul international, economy (with RF)', 0.151, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''Business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-SH-WTT', 'EF_TRAVEL', 'Air travel - short haul international, economy - well-to-tank', 0.029, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-LH-ECON', 'EF_TRAVEL', 'Air travel - long haul, economy (with RF)', 0.148, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''Business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-LH-BUS', 'EF_TRAVEL', 'Air travel - long haul, business class (with RF)', 0.429, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''Business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-AIR-LH-WTT', 'EF_TRAVEL', 'Air travel - long haul - well-to-tank', 0.029, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - air''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-RAIL', 'EF_TRAVEL', 'Rail travel - national rail', 0.035, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''Business travel - land'', national rail', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Indian Railways is more electrified and more densely loaded than UK rail, so this is likely conservative. Improve if CEA/IR data becomes available.'),
('EF-TRV-RAIL-WTT', 'EF_TRAVEL', 'Rail travel - well-to-tank', 0.006, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - land''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-CAR', 'EF_TRAVEL', 'Road travel - car, average size, unknown fuel', 0.17, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), ''Business travel - land'', average car', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Per VEHICLE-km, not passenger-km. Do not multiply by the number of occupants.'),
('EF-TRV-CAR-WTT', 'EF_TRAVEL', 'Road travel - car - well-to-tank', 0.043, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - land''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-TAXI', 'EF_TRAVEL', 'Road travel - taxi / cab hire', 0.15, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), ''Business travel - land'', regular taxi', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-TAXI-WTT', 'EF_TRAVEL', 'Road travel - taxi - well-to-tank', 0.038, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), ''WTT - business travel - land''', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-TRV-HOTEL-IN', 'EF_TRAVEL', 'Hotel stay - India', 27, 'kgCO2e / room-night', 'UK Government (DESNZ/DEFRA), ''Hotel stay'' table, India', 'User to enter year', '2025', 'India', 'Tier 2 - country average', true, null, 'MISSING FROM THE CURRENT METHODOLOGY. DEFRA publishes a country-specific India hotel factor - there is no reason to omit accommodation.'),
('EF-CMT-CAR', 'EF_COMMUTE', 'Commute - private car, average', 0.17, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), average car (incl. WTT where stated)', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Divide by occupancy where car-pooling is reported.'),
('EF-CMT-TWO-WHEELER', 'EF_COMMUTE', 'Commute - two-wheeler (motorcycle / scooter)', 0.0832, 'kgCO2e / vehicle-km', 'UK Government (DESNZ/DEFRA), motorbike small', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'The single most important commute mode in India by share - make sure the survey captures it separately.'),
('EF-CMT-AUTO-RICKSHAW', 'EF_COMMUTE', 'Commute - auto rickshaw / three-wheeler', 0.1, 'kgCO2e / vehicle-km', 'Proxy derived between DEFRA motorbike and small car', 'Derived', '2025', 'India proxy', 'Tier 3 - derived proxy', true, null, 'No DEFRA or CEA equivalent exists. Documented proxy - disclose it.'),
('EF-CMT-BUS-PUBLIC', 'EF_COMMUTE', 'Commute - public bus', 0.102, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), average local bus', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, null),
('EF-CMT-COMPANY-BUS', 'EF_COMMUTE', 'Commute - company-provided shuttle', 0.027, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), coach', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'If the shuttle fuel is bought by Birla Estates it is Scope 1, not Cat 7. Check before applying.'),
('EF-CMT-METRO', 'EF_COMMUTE', 'Commute - metro / suburban rail', 0.028, 'kgCO2e / passenger-km', 'UK Government (DESNZ/DEFRA), light rail and tram', 'User to enter year', '2025', 'UK factor used as proxy', 'Tier 3 - global proxy', true, null, 'Consider replacing with CEA grid EF x metro operator''s kWh per passenger-km where the operator publishes it.'),
('EF-CMT-WALK-CYCLE', 'EF_COMMUTE', 'Commute - walking or cycling', 0, 'kgCO2e / passenger-km', 'Zero by definition', 'n/a', 'n/a', 'n/a', 'Tier 1 - definitional', false, null, null),
('EF-CMT-WFH', 'EF_COMMUTE', 'Working from home - per employee working day', 0.4, 'kgCO2e / WFH day', 'EcoAct Homeworking Emissions Whitepaper methodology, adapted to the CEA grid factor', 'User to enter', '2025', 'India adapted', 'Tier 3 - derived proxy', true, null, 'Optional under the GHG Protocol but expected by most assurers post-2021. Recalculate with the CEA grid factor rather than the UK one.'),
('GWP-R22', 'GWP_AR6', 'HCFC-22 (R22) - 100-year global warming potential', 1760, 'kgCO2e / kg', 'IPCC AR6 WG1 Chapter 7, Table 7.SM.7', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', 'Confirm against AR6. R22 is being phased out under the Montreal Protocol - track the switch to R32/R410A.'),
('GWP-R32', 'GWP_AR6', 'HFC-32 (R32) - 100-year global warming potential', 771, 'kgCO2e / kg', 'IPCC AR6 WG1 Chapter 7, Table 7.SM.7', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', null),
('GWP-R410A', 'GWP_AR6', 'R410A blend - 100-year global warming potential', 2256, 'kgCO2e / kg', 'IPCC AR6, blend-weighted', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', null),
('GWP-R134A', 'GWP_AR6', 'HFC-134a - 100-year global warming potential', 1530, 'kgCO2e / kg', 'IPCC AR6 WG1 Chapter 7, Table 7.SM.7', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', null),
('GWP-R123', 'GWP_AR6', 'HCFC-123 - 100-year global warming potential', 79, 'kgCO2e / kg', 'IPCC AR6 WG1 Chapter 7, Table 7.SM.7', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', null),
('GWP-R404A', 'GWP_AR6', 'R404A blend - 100-year global warming potential', 4728, 'kgCO2e / kg', 'IPCC AR6, blend-weighted', 'AR6', '2021', 'Global', 'Tier 1 - published constant', true, 'AR6', null),
('GWP-CO2', 'GWP_AR6', 'Carbon dioxide (fire extinguisher refills) - 100-year GWP', 1, 'kgCO2e / kg', 'IPCC AR6, by definition', 'AR6', '2021', 'Global', 'Tier 1 - definitional', false, 'AR6', null),
('EF-ZERO', 'EF_UTILITY', 'Zero factor - used where a paired well-to-tank factor does not apply', 0, 'kgCO2e / unit', 'Definitional', 'n/a', 'n/a', 'n/a', 'Tier 1 - definitional', false, null, 'Do not change. Referenced by the hotel-stay travel row, which has no separate WTT factor.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- THE CONTROL SHEET, as constants.
--
-- The workbook keeps these on a sheet of their own and every calculation reads
-- them from there. They are seeded as ordinary constants so they inherit the
-- settings page, the audit trail, the blast radius and the confirm workflow
-- without a line of new UI — and because the FX rate and the deflator change
-- every year and are exactly the kind of edit that needs a recorded reason.
--
-- All of them are assumptions. Every one scales a category directly.
-- -----------------------------------------------------------------------------
insert into esg.constant
    (key, category, label, value, unit, source, reference_year, geography,
     data_quality_tier, is_assumption, notes)
values
('s3.fx_inr_per_eur', 'S3_CONTROL',
 'Market exchange rate - INR per EUR (FY average)', 92, 'INR/EUR',
 'RBI FY average reference rate', 'FY2025-26', 'India', 'Tier 2 - published rate', true,
 'MARKET rate, not PPP. EXIOBASE is denominated in EUR at basic prices. PPP would inflate the spend base while applying US production technology to Indian supply chains - the workbook is emphatic on this. Divides every procurement line, so an error here scales the whole of Category 1 and 2.'),

('s3.price_deflator', 'S3_CONTROL',
 'Price deflator - FY price level / EF reference-year price level', 1.2, 'ratio',
 'MoSPI WPI, or World Bank GDP deflator for India', 'FY2025-26', 'India', 'Tier 2 - published index', true,
 'Deflates reporting-year spend back to the price level of the EXIOBASE reference year (2019). MUST stay consistent with the reference_year recorded against every EF-SPD- factor: if those are re-based to a different EXIOBASE release, this moves too. Getting it wrong scales Category 1 with no visible symptom.'),

('s3.exiobase_reference_year', 'S3_CONTROL',
 'EXIOBASE reference year the spend factors are denominated in', 2019, 'year',
 'EXIOBASE v3 release documentation', null, 'India', 'Tier 3 - EEIO', true,
 'Held as a number so it can be checked against constant.reference_year on the EF-SPD- rows. The deflator above converts reporting-year spend to THIS year price level.'),

('s3.circuity_road', 'S3_CONTROL',
 'Default road circuity factor', 1.3, 'ratio',
 'GLEC Framework - road detour factor', '2023', 'Global', 'Tier 2 - framework default', true,
 'Converts great-circle distance between two pincodes into road distance. This is a DETOUR factor. It is NOT a correction for the curvature of the earth - great-circle distance already accounts for curvature. Applied only where a freight line does not carry its own circuity.'),

('s3.headcount', 'S3_CONTROL',
 'Total employees in the FY, for the Cat 7 commute gross-up', 462, 'employees',
 'HR headcount, CONTROL sheet', 'FY2025-26', 'India', 'Tier 1 - reported', true,
 'The commute survey is grossed up to this number. See s3.contract_workers_in_cat7 - the treatment of contract site workers can move Category 7 by an order of magnitude.'),

('s3.contract_workers_in_cat7', 'S3_CONTROL',
 'Contract site workers included in Cat 7? (1 = yes, 0 = no)', 0, 'boolean',
 'ESG team decision, recorded on the CONTROL sheet', 'FY2025-26', 'India', 'Tier 1 - policy decision', true,
 'UNRESOLVED CONTRADICTION IN THE SOURCE DATA: HR reports zero workers while Safety reports 15.6 million contract worker-hours. Seeded as 0 (excluded) to match the workbook default, but this single choice can move Category 7 by an order of magnitude and MUST be decided and disclosed explicitly rather than left at its default.'),

('s3.base_year_threshold', 'S3_CONTROL',
 'Base year recalculation threshold', 0.05, 'fraction',
 'GHG Protocol Corporate Standard', null, null, 'Tier 1 - policy decision', true,
 'Recalculate the base year if a change in structure, method or factor moves total Scope 3 by more than this share. Held here so the threshold is auditable rather than remembered.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- THE MAPPING LAYER — 111 rows across 8 blocks.
--
-- Turns a dropdown value someone typed on an input sheet into a factor key.
-- Extended by INSERT, not by deploy: a new material or spend category is a row.
--
-- The 'waste' block key is a COMPOSITE, 'stream | route', built with that exact
-- separator so it can be diffed against the workbook's own concatenation. C&D
-- to landfill and C&D to recycling are different factors, and Cat 5's whole
-- method is by disposal route rather than to a single generated tonnage.
--
-- The 'hsn' block does not resolve to a factor. It maps an HSN/SAC chapter to a
-- SUGGESTED spend category, to help a human classify the SAP extract - the
-- classification stays a human decision, because an HSN chapter is a tax code
-- and not a statement about emissions. Its factor_key is the sentinel
-- '__via_spend__' rather than null, so the column stays NOT NULL and a resolver
-- reading this block by mistake fails loudly instead of silently.
-- -----------------------------------------------------------------------------
insert into esg.s3_mapping (block, lookup_key, factor_key, factor_key_2, suggested_value)
values
('material', 'Cement - OPC', 'EF-MAT-CEM-OPC', null, null),
('material', 'Cement - PPC (fly ash blended)', 'EF-MAT-CEM-PPC', null, null),
('material', 'Cement - PSC (slag blended)', 'EF-MAT-CEM-PSC', null, null),
('material', 'Ready-mix concrete', 'EF-MAT-RMC', null, null),
('material', 'Steel - reinforcement bar', 'EF-MAT-STEEL-REBAR', null, null),
('material', 'Steel - structural sections', 'EF-MAT-STEEL-STRUCT', null, null),
('material', 'Bricks - fired clay', 'EF-MAT-BRICK-CLAY', null, null),
('material', 'Blocks - AAC', 'EF-MAT-AAC-BLOCK', null, null),
('material', 'Aggregate / sand / crushed stone', 'EF-MAT-AGGREGATE', null, null),
('material', 'Glass - float and glazing', 'EF-MAT-GLASS-FLOAT', null, null),
('material', 'Aluminium - extrusions and facade', 'EF-MAT-ALUMINIUM', null, null),
('material', 'Tiles - ceramic and vitrified', 'EF-MAT-TILES-CERAMIC', null, null),
('material', 'Gypsum board and plaster', 'EF-MAT-GYPSUM', null, null),
('material', 'Paint and coatings', 'EF-MAT-PAINT', null, null),
('material', 'PVC / uPVC pipes and conduit', 'EF-MAT-PVC', null, null),
('material', 'Copper wire and cable', 'EF-MAT-COPPER', null, null),
('material', 'Timber and plywood', 'EF-MAT-TIMBER', null, null),
('material', 'Bitumen and waterproofing', 'EF-MAT-BITUMEN', null, null),
('freight', 'LCV up to 3.5t', 'EF-FRT-LCV', null, null),
('freight', 'Rigid truck 7.5-16t', 'EF-FRT-HGV-RIGID', null, null),
('freight', 'Rigid truck 16-25t', 'EF-FRT-HGV-HEAVY', null, null),
('freight', 'Articulated truck over 25t', 'EF-FRT-HGV-ARTIC', null, null),
('freight', 'Transit mixer', 'EF-FRT-TRANSIT-MIXER', null, null),
('freight', 'Rail wagon', 'EF-FRT-RAIL', null, null),
('freight', 'Sea container', 'EF-FRT-SEA', null, null),
('freight', 'Air cargo', 'EF-FRT-AIR', null, null),
('spend', 'Construction and civil works', 'EF-SPD-CONSTRUCTION', null, null),
('spend', 'Cement lime and plaster', 'EF-SPD-CEMENT-LIME', null, null),
('spend', 'Fabricated metal products', 'EF-SPD-METAL-PRODUCTS', null, null),
('spend', 'Machinery and equipment', 'EF-SPD-MACHINERY', null, null),
('spend', 'Electrical equipment and cabling', 'EF-SPD-ELEC-EQUIP', null, null),
('spend', 'IT hardware and office equipment', 'EF-SPD-IT-EQUIP', null, null),
('spend', 'Furniture and fit-out', 'EF-SPD-FURNITURE', null, null),
('spend', 'Professional services', 'EF-SPD-PROF-SERVICES', null, null),
('spend', 'IT and telecom services', 'EF-SPD-IT-SERVICES', null, null),
('spend', 'Financial and insurance services', 'EF-SPD-FIN-INSURANCE', null, null),
('spend', 'Advertising marketing and brokerage', 'EF-SPD-MARKETING', null, null),
('spend', 'Facility management and manpower services', 'EF-SPD-FACILITY-SVC', null, null),
('spend', 'Transport and logistics services', 'EF-SPD-TRANSPORT-SVC', null, null),
('spend', 'Plant and equipment hire', 'EF-SPD-RENTAL-EQUIP', null, null),
('spend', 'Other goods and services', 'EF-SPD-OTHER', null, null),
('travel', 'Air - domestic - economy', 'EF-TRV-AIR-DOM', 'EF-TRV-AIR-DOM-WTT', null),
('travel', 'Air - short haul international - economy', 'EF-TRV-AIR-SH-ECON', 'EF-TRV-AIR-SH-WTT', null),
('travel', 'Air - long haul - economy', 'EF-TRV-AIR-LH-ECON', 'EF-TRV-AIR-LH-WTT', null),
('travel', 'Air - long haul - business', 'EF-TRV-AIR-LH-BUS', 'EF-TRV-AIR-LH-WTT', null),
('travel', 'Rail', 'EF-TRV-RAIL', 'EF-TRV-RAIL-WTT', null),
('travel', 'Road - own or company car', 'EF-TRV-CAR', 'EF-TRV-CAR-WTT', null),
('travel', 'Road - taxi or cab', 'EF-TRV-TAXI', 'EF-TRV-TAXI-WTT', null),
('travel', 'Hotel stay - India', 'EF-TRV-HOTEL-IN', 'EF-ZERO', null),
('commute', 'Car - private', 'EF-CMT-CAR', null, null),
('commute', 'Two-wheeler', 'EF-CMT-TWO-WHEELER', null, null),
('commute', 'Auto rickshaw', 'EF-CMT-AUTO-RICKSHAW', null, null),
('commute', 'Public bus', 'EF-CMT-BUS-PUBLIC', null, null),
('commute', 'Company shuttle', 'EF-CMT-COMPANY-BUS', null, null),
('commute', 'Metro or suburban rail', 'EF-CMT-METRO', null, null),
('commute', 'Walk or cycle', 'EF-CMT-WALK-CYCLE', null, null),
('refrigerant', 'R22', 'GWP-R22', null, null),
('refrigerant', 'R32', 'GWP-R32', null, null),
('refrigerant', 'R410A', 'GWP-R410A', null, null),
('refrigerant', 'R134A', 'GWP-R134A', null, null),
('refrigerant', 'R123', 'GWP-R123', null, null),
('refrigerant', 'R404A', 'GWP-R404A', null, null),
('refrigerant', 'CO2', 'GWP-CO2', null, null),
('waste', 'Construction and demolition | Landfill', 'EF-WST-CD-LANDFILL', null, null),
('waste', 'Construction and demolition | Recycling', 'EF-WST-CD-RECYCLE', null, null),
('waste', 'Construction and demolition | Reused on site', 'EF-WST-CD-RECYCLE', null, null),
('waste', 'Municipal / general | Landfill', 'EF-WST-MSW-LANDFILL', null, null),
('waste', 'Municipal / general | Recycling', 'EF-WST-MSW-RECYCLE', null, null),
('waste', 'Municipal / general | Incineration', 'EF-WST-MSW-INCIN', null, null),
('waste', 'Food / organic | Composting', 'EF-WST-ORG-COMPOST', null, null),
('waste', 'Food / organic | Anaerobic digestion', 'EF-WST-ORG-AD', null, null),
('waste', 'Food / organic | Landfill', 'EF-WST-ORG-LANDFILL', null, null),
('waste', 'Plastic | Recycling', 'EF-WST-PLASTIC-RECYCLE', null, null),
('waste', 'Plastic | Landfill', 'EF-WST-MSW-LANDFILL', null, null),
('waste', 'Paper and cardboard | Recycling', 'EF-WST-PAPER-RECYCLE', null, null),
('waste', 'Metal scrap | Recycling', 'EF-WST-METAL-RECYCLE', null, null),
('waste', 'Wood scrap | Recycling', 'EF-WST-WOOD-RECYCLE', null, null),
('waste', 'STP sludge | Composting', 'EF-WST-STP-SLUDGE', null, null),
('waste', 'Hazardous - used oil | Co-processing / recovery', 'EF-WST-HAZ-RECOVERY', null, null),
('waste', 'Hazardous - used oil | Incineration', 'EF-WST-HAZ-INCIN', null, null),
('waste', 'Hazardous - oil soaked cotton waste | Incineration', 'EF-WST-HAZ-INCIN', null, null),
('waste', 'Hazardous - paint and chemical containers | Incineration', 'EF-WST-HAZ-INCIN', null, null),
('waste', 'E-waste | Authorised handler', 'EF-WST-HAZ-RECOVERY', null, null),
('waste', 'Battery waste | Authorised handler', 'EF-WST-HAZ-RECOVERY', null, null),
('hsn', '25 - Salt, sulphur, earths, cement, lime', '__via_spend__', null, 'Cement lime and plaster'),
('hsn', '32 - Paints, varnishes, pigments', '__via_spend__', null, 'Other goods and services'),
('hsn', '38 - Chemical products, admixtures', '__via_spend__', null, 'Other goods and services'),
('hsn', '39 - Plastics and articles thereof', '__via_spend__', null, 'Other goods and services'),
('hsn', '44 - Wood and articles of wood', '__via_spend__', null, 'Other goods and services'),
('hsn', '68 - Articles of stone, plaster, cement', '__via_spend__', null, 'Cement lime and plaster'),
('hsn', '69 - Ceramic products and tiles', '__via_spend__', null, 'Other goods and services'),
('hsn', '70 - Glass and glassware', '__via_spend__', null, 'Other goods and services'),
('hsn', '72 - Iron and steel', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '73 - Articles of iron or steel', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '74 - Copper and articles thereof', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '76 - Aluminium and articles thereof', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '82 - Tools and implements', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '83 - Miscellaneous articles of base metal', '__via_spend__', null, 'Fabricated metal products'),
('hsn', '84 - Machinery and mechanical appliances', '__via_spend__', null, 'Machinery and equipment'),
('hsn', '85 - Electrical machinery and equipment', '__via_spend__', null, 'Electrical equipment and cabling'),
('hsn', '94 - Furniture, lighting, prefab buildings', '__via_spend__', null, 'Furniture and fit-out'),
('hsn', '9954 - Construction services (SAC)', '__via_spend__', null, 'Construction and civil works'),
('hsn', '9963 - Accommodation and food services (SAC)', '__via_spend__', null, 'Other goods and services'),
('hsn', '9965 - Goods transport services (SAC)', '__via_spend__', null, 'Transport and logistics services'),
('hsn', '9971 - Financial and related services (SAC)', '__via_spend__', null, 'Financial and insurance services'),
('hsn', '9973 - Leasing and rental services (SAC)', '__via_spend__', null, 'Plant and equipment hire'),
('hsn', '9983 - Other professional and technical (SAC)', '__via_spend__', null, 'Professional services'),
('hsn', '9984 - Telecom and IT services (SAC)', '__via_spend__', null, 'IT and telecom services'),
('hsn', '9985 - Support services incl. manpower (SAC)', '__via_spend__', null, 'Facility management and manpower services'),
('hsn', '9987 - Maintenance and repair services (SAC)', '__via_spend__', null, 'Facility management and manpower services'),
('hsn', '9995 - Services of membership organisations (SAC)', '__via_spend__', null, 'Other goods and services')
on conflict (block, lookup_key) do nothing;

-- -----------------------------------------------------------------------------
-- Integrity check: every mapping must point at a factor that exists.
--
-- Runs at apply time and RAISES. A mapping to a missing factor is exactly the
-- failure the workbook's '#UNMAPPED' guard exists to catch, and finding it here
-- costs a re-run of a seed file; finding it after a disclosure costs a restated
-- figure.
-- -----------------------------------------------------------------------------
do $$
declare
    orphan_count integer;
    orphan_list  text;
begin
    select count(*), string_agg(distinct m.block || ' -> ' || m.factor_key, ', ')
      into orphan_count, orphan_list
      from esg.s3_mapping m
     where m.factor_key <> '__via_spend__'
       and not exists (select 1 from esg.constant c where c.key = m.factor_key);
    if orphan_count > 0 then
        raise exception 'Scope 3 mappings reference % missing factor(s): %', orphan_count, orphan_list;
    end if;

    select count(*), string_agg(distinct m.block || ' -> ' || m.factor_key_2, ', ')
      into orphan_count, orphan_list
      from esg.s3_mapping m
     where m.factor_key_2 is not null
       and not exists (select 1 from esg.constant c where c.key = m.factor_key_2);
    if orphan_count > 0 then
        raise exception 'Scope 3 mappings reference % missing WTT factor(s): %', orphan_count, orphan_list;
    end if;

    -- The spend block is what the hsn block's suggested_value points into.
    -- A suggestion naming a category that does not exist would send someone
    -- looking for a dropdown entry that is not there.
    select count(*), string_agg(distinct m.suggested_value, ', ')
      into orphan_count, orphan_list
      from esg.s3_mapping m
     where m.block = 'hsn'
       and not exists (select 1 from esg.s3_mapping s
                        where s.block = 'spend' and s.lookup_key = m.suggested_value);
    if orphan_count > 0 then
        raise exception 'HSN block suggests % spend categor(ies) that do not exist: %', orphan_count, orphan_list;
    end if;
end $$;

notify pgrst, 'reload schema';
