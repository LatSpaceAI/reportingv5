-- =============================================================================
-- ESG DATA TOOL — Dimension seeds: plants + periods
-- =============================================================================
set search_path = esg, public;

-- Plants (matches the Input Sheet tabs in the workbook)
insert into esg.plant (code, name, plant_type, is_group) values
    ('GROUP',       'Group (consolidated)', 'group',      true),
    ('MATTAMPALLY', 'Mattampally',          'integrated', false),
    ('GUDIPADU',    'Gudipadu',             'integrated', false),
    ('DACHEPALLI',  'Dachepalli',           'integrated', false),
    ('BAYYAVARAM',  'Bayyavaram',           'grinding',   false),
    ('JAJPUR',      'Jajpur',               'grinding',   false),
    ('JEERABAD',    'Jeerabad',             'integrated', false);

-- Periods for fiscal year 2024-25 (Apr 2024 .. Mar 2025) + YTD + baseline.
-- month_no 1=April ... 12=March (Indian fiscal convention used in the workbook).
insert into esg.period (fiscal_year, period_kind, month_no, month_label, period_start, period_end) values
    ('2024-25','month', 1,'April',    '2024-04-01','2024-04-30'),
    ('2024-25','month', 2,'May',      '2024-05-01','2024-05-31'),
    ('2024-25','month', 3,'June',     '2024-06-01','2024-06-30'),
    ('2024-25','month', 4,'July',     '2024-07-01','2024-07-31'),
    ('2024-25','month', 5,'August',   '2024-08-01','2024-08-31'),
    ('2024-25','month', 6,'September','2024-09-01','2024-09-30'),
    ('2024-25','month', 7,'October',  '2024-10-01','2024-10-31'),
    ('2024-25','month', 8,'November', '2024-11-01','2024-11-30'),
    ('2024-25','month', 9,'December', '2024-12-01','2024-12-31'),
    ('2024-25','month',10,'January',  '2025-01-01','2025-01-31'),
    ('2024-25','month',11,'February', '2025-02-01','2025-02-28'),
    ('2024-25','month',12,'March',    '2025-03-01','2025-03-31'),
    ('2024-25','ytd',  null,'YTD (YOD)', '2024-04-01','2025-03-31'),
    ('2023-24','baseline',null,'Baseline 2023-24','2023-04-01','2024-03-31');
