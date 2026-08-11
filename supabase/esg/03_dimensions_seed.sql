-- =============================================================================
-- BIRLA ESTATES — Dimension seeds: sites + periods
-- =============================================================================
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- Sites in the BEPL FY25 reporting boundary.
--
-- water_stressed follows the BRSR template's own designation of the stressed
-- area as "Bangalore & NCR" (Environment sheet rows 58-59), so Bengaluru and
-- Gurugram sites carry the flag and Mumbai/Pune do not. The stressed-area
-- disclosure lines sum exactly the flagged sites.
--
-- Sangamwadi is included even though it appears in NONE of the template's site
-- lists (air emissions, refrigerants, water-stress naming) — it files a monthly
-- return and its December figures demonstrably reach the template, so excluding
-- it from the master would lose real data. Flagged in notes for the ESG team.
-- -----------------------------------------------------------------------------
insert into esg.site (code, name, asset_type, city, region, water_stressed, is_group, notes) values
('GROUP',      'Birla Estates (consolidated)', 'group',       null,        null,        false, true,
 'Portfolio rollup. Water-stressed rollups sum only sites where water_stressed = true.'),

-- Commercial (operating) assets
('AURORA',     'Birla Aurora',      'commercial',  'Mumbai',    'Mumbai',    false, false,
 'Worli. Operating commercial asset. Tenant electricity excluded from the entity boundary since FY24; Level 8 and Level 13 are BEPL-occupied and counted.'),
('CENTURION',  'Birla Centurion',   'commercial',  'Mumbai',    'Mumbai',    false, false,
 'Worli. Named in the template air-emission and refrigerant blocks; no monthly return collected yet.'),
('CENTURY_BHAVAN','Century Bhavan', 'commercial',  'Mumbai',    'Mumbai',    false, false,
 'Worli. Has its own sheet in the BRSR template covering energy and water only.'),

-- Residential (under construction)
('TISYA',      'Birla Tisya',       'residential', 'Bengaluru', 'Bengaluru', true,  false, null),
('TRIMAYA',    'Birla Trimaya',     'residential', 'Bengaluru', 'Bengaluru', true,  false,
 'Files its own form variant, Ref BRT/EHS/ESG/F-17.'),
('EVARA',      'Birla Evara',       'residential', 'Bengaluru', 'Bengaluru', true,  false,
 'EC dated 14-Nov-24 (template row 111).'),
('OJASVI',     'Birla Ojasvi',      'residential', 'Bengaluru', 'Bengaluru', true,  false,
 'EC dated 16-Aug-24 (template row 112).'),
('NAVYA',      'Birla Navya',       'residential', 'Gurugram',  'NCR',       true,  false,
 'Dominates FY25 air emissions (NOx 324.5 kg of 333.1 kg total).'),
('ARIKA',      'Birla Arika',       'residential', 'Gurugram',  'NCR',       true,  false,
 'EC dated 13-Nov-24 (template row 110).'),
('NIYAARA',    'Birla Niyaara',     'residential', 'Mumbai',    'Mumbai',    false, false,
 'Worli. LCA boundary project (template row 5).'),
('SANGAMWADI', 'Birla Sangamwadi',  'residential', 'Pune',      'Pune',      false, false,
 'Files a monthly return but is named in none of the BRSR template site lists — raise with the ESG team.');

-- -----------------------------------------------------------------------------
-- Periods — FY2024-25 (Apr 2024 .. Mar 2025) plus YTD, and the FY2023-24
-- baseline.
--
-- month_no follows the Indian fiscal convention: 1 = April .. 12 = March.
-- quarter_no / half_no carry the BRSR reporting buckets, because waste is
-- disclosed quarterly and air emissions half-yearly while the inputs arrive
-- monthly.
-- -----------------------------------------------------------------------------
insert into esg.period (fiscal_year, period_kind, month_no, month_label, quarter_no, half_no, period_start, period_end) values
    ('2024-25','month', 1,'April',    1, 1, '2024-04-01','2024-04-30'),
    ('2024-25','month', 2,'May',      1, 1, '2024-05-01','2024-05-31'),
    ('2024-25','month', 3,'June',     1, 1, '2024-06-01','2024-06-30'),
    ('2024-25','month', 4,'July',     2, 1, '2024-07-01','2024-07-31'),
    ('2024-25','month', 5,'August',   2, 1, '2024-08-01','2024-08-31'),
    ('2024-25','month', 6,'September',2, 1, '2024-09-01','2024-09-30'),
    ('2024-25','month', 7,'October',  3, 2, '2024-10-01','2024-10-31'),
    ('2024-25','month', 8,'November', 3, 2, '2024-11-01','2024-11-30'),
    ('2024-25','month', 9,'December', 3, 2, '2024-12-01','2024-12-31'),
    ('2024-25','month',10,'January',  4, 2, '2025-01-01','2025-01-31'),
    ('2024-25','month',11,'February', 4, 2, '2025-02-01','2025-02-28'),
    ('2024-25','month',12,'March',    4, 2, '2025-03-01','2025-03-31'),
    ('2024-25','ytd',  null,'FY 2024-25 (YTD)', null, null, '2024-04-01','2025-03-31'),
    ('2023-24','baseline', null,'Baseline FY 2023-24', null, null, '2023-04-01','2024-03-31');

-- FY2025-26 months, so the app can accept the current year's returns as they
-- are filed rather than needing a migration each April.
insert into esg.period (fiscal_year, period_kind, month_no, month_label, quarter_no, half_no, period_start, period_end) values
    ('2025-26','month', 1,'April',    1, 1, '2025-04-01','2025-04-30'),
    ('2025-26','month', 2,'May',      1, 1, '2025-05-01','2025-05-31'),
    ('2025-26','month', 3,'June',     1, 1, '2025-06-01','2025-06-30'),
    ('2025-26','month', 4,'July',     2, 1, '2025-07-01','2025-07-31'),
    ('2025-26','month', 5,'August',   2, 1, '2025-08-01','2025-08-31'),
    ('2025-26','month', 6,'September',2, 1, '2025-09-01','2025-09-30'),
    ('2025-26','month', 7,'October',  3, 2, '2025-10-01','2025-10-31'),
    ('2025-26','month', 8,'November', 3, 2, '2025-11-01','2025-11-30'),
    ('2025-26','month', 9,'December', 3, 2, '2025-12-01','2025-12-31'),
    ('2025-26','month',10,'January',  4, 2, '2026-01-01','2026-01-31'),
    ('2025-26','month',11,'February', 4, 2, '2026-02-01','2026-02-28'),
    ('2025-26','month',12,'March',    4, 2, '2026-03-01','2026-03-31'),
    ('2025-26','ytd',  null,'FY 2025-26 (YTD)', null, null, '2025-04-01','2026-03-31');
