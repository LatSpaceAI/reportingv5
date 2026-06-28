-- =============================================================================
-- ESG DATA TOOL — Supabase schema
-- Four-layer model derived from "ESG DATA TOOL 1.0 Consolidated.xlsx"
-- (Sagar Cements multi-plant GCCA/GRI carbon-accounting workbook)
--
--   CONSTANTS  -> all fixed reference values (emission factors, GWPs, mol. wts)
--   INPUT      -> every value entered on the per-plant Input Sheets (long/EAV)
--   FORMULAS   -> registry: OUTPUT = f(INPUT, CONSTANT)  (data-driven, auditable)
--   OUTPUT     -> all computed results (Scope 1/2/3, energy, water, waste, biodiv)
--
-- Granularity: long/tidy. One row per (plant, period, parameter, [sub_source]).
-- Periods are Indian fiscal months (Apr..Mar) plus YTD ("YOD") and baseline.
-- =============================================================================

create schema if not exists esg;
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- 0. DIMENSIONS  (shared lookups)
-- -----------------------------------------------------------------------------

-- Plants (6 sites + GROUP rollup). Matches the Input Sheet tabs.
create table esg.plant (
    id            smallint generated always as identity primary key,
    code          text not null unique,           -- 'MATTAMPALLY', 'GROUP', ...
    name          text not null,
    plant_type    text not null
                  check (plant_type in ('integrated','grinding','group')),
    is_group      boolean not null default false,
    created_at    timestamptz not null default now()
);

-- Reporting periods. Fiscal-year aware.
-- period_kind: 'month' (Apr..Mar), 'ytd' (the workbook's "YOD"), 'baseline'.
create table esg.period (
    id            integer generated always as identity primary key,
    fiscal_year   text not null,                  -- e.g. '2024-25'
    period_kind   text not null
                  check (period_kind in ('month','ytd','baseline')),
    month_no      smallint check (month_no between 1 and 12),  -- 1=April..12=March
    month_label   text,                           -- 'April','May',... null for ytd/baseline
    period_start  date,
    period_end    date,
    unique (fiscal_year, period_kind, month_no)
);

-- The ESG domains used to bucket parameters and outputs.
create table esg.domain (
    code          text primary key,               -- 'EMISSIONS','ENERGY','WATER',...
    name          text not null,
    sort_order    smallint not null default 0
);

insert into esg.domain (code, name, sort_order) values
    ('PRODUCTION',  'Production',                 10),
    ('ENERGY',      'Energy & Power',             20),
    ('EMISSIONS',   'GHG Emissions',              30),
    ('FUEL',        'Fuel Consumption',           40),
    ('RESOURCES',   'Resources / Materials',      50),
    ('WATER',       'Water',                      60),
    ('WASTE',       'Waste & Circular Economy',   70),
    ('BIODIVERSITY','Biodiversity',               80),
    ('AIR',         'Air Emissions (non-GHG)',    90),
    ('SCOPE3',      'Scope 3',                    100),
    ('SOCIAL',      'Social / Stoppage / Other',  110);

-- =============================================================================
-- 1. CONSTANTS LAYER
-- =============================================================================

-- Categories of constants (emission factors, GWP, molecular weights, ...).
create table esg.constant_category (
    code          text primary key,
    name          text not null
);

insert into esg.constant_category (code, name) values
    ('EF_FUEL_FOSSIL',  'Emission factor - fossil fuel (kg CO2/GJ)'),
    ('EF_FUEL_ALT',     'Emission factor - alternate fuel (kg CO2/GJ)'),
    ('EF_FUEL_BIOMASS', 'Emission factor - biomass fuel (kg CO2/GJ)'),
    ('EF_TRANSPORT',    'Emission factor - internal transport (kg/L)'),
    ('EF_OTHER_GWP',    'GWP / emission factor - other sources (refrigerants etc.)'),
    ('EF_SCOPE2',       'Emission factor - grid electricity (t CO2/MWh)'),
    ('EF_SCOPE3',       'Emission factor - Scope 3 transport (kg CO2/km, /t-km)'),
    ('EF_COMMUTE',      'Emission factor - employee commuting (kg CO2/km, /pax-km)'),
    ('MOL_WEIGHT',      'Molecular weight (g/mol)'),
    ('PHYS_CONST',      'Physical / conversion constant');

-- The constants themselves. `key` is referenced by the FORMULAS layer.
create table esg.constant (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- machine key, e.g. 'EF.coal'
    category      text not null references esg.constant_category(code),
    label         text not null,                  -- human label from the sheet
    value         numeric not null,
    unit          text,
    source        text,                           -- IPCC / CSI Task Force / CEA ...
    source_date   text,                           -- as recorded in the sheet
    effective_from date,                          -- when a versioned EF takes effect
    effective_to   date,                          -- null = current
    notes         text,
    created_at    timestamptz not null default now()
);

create index on esg.constant (category);

-- =============================================================================
-- 2. INPUT LAYER
-- =============================================================================

-- The catalogue of every input parameter on the Input Sheet (~1300 rows).
-- This is the dictionary; the actual numbers live in input_value.
create table esg.input_parameter (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- 'prod.clinker_production', referenced by formulas
    domain        text not null references esg.domain(code),
    section       text,                            -- 'PRODUCTION','FUEL/Kiln', etc.
    subsection    text,                            -- 'Alternate fuels consumption', ...
    label         text not null,                   -- exact label from the sheet
    unit          text,
    sheet_row     integer,                         -- original Input Sheet row (traceability)
    value_type    text not null default 'number'
                  check (value_type in ('number','text','boolean')),
    is_active     boolean not null default true,
    sort_order    integer,
    notes         text
);

create index on esg.input_parameter (domain);
create index on esg.input_parameter (section);

-- Actual entered values, one row per (plant, period, parameter).
create table esg.input_value (
    id            bigint generated always as identity primary key,
    plant_id      smallint not null references esg.plant(id),
    period_id     integer  not null references esg.period(id),
    parameter_id  integer  not null references esg.input_parameter(id),
    value_num     numeric,
    value_text    text,
    value_bool    boolean,
    comment       text,                            -- "reason for abrupt change" per Instructions
    source_doc    text,
    entered_by    text,
    entered_at    timestamptz not null default now(),
    unique (plant_id, period_id, parameter_id)
);

create index on esg.input_value (plant_id, period_id);
create index on esg.input_value (parameter_id);

-- =============================================================================
-- 3. OUTPUT LAYER
-- =============================================================================

-- Catalogue of every computed output metric.
create table esg.output_parameter (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- 'emis.scope1_total', referenced by formulas
    domain        text not null references esg.domain(code),
    scope         text check (scope in ('scope1','scope2','scope3',null)),
    label         text not null,
    unit          text,
    is_intensity  boolean not null default false,  -- per-ton metric vs absolute
    sort_order    integer,
    notes         text
);

create index on esg.output_parameter (domain);
create index on esg.output_parameter (scope);

-- Computed values, one row per (plant, period, output parameter).
-- Filled by the resolver that evaluates esg.formula.
create table esg.output_value (
    id            bigint generated always as identity primary key,
    plant_id      smallint not null references esg.plant(id),
    period_id     integer  not null references esg.period(id),
    parameter_id  integer  not null references esg.output_parameter(id),
    value_num     numeric,
    formula_id    integer,                         -- which formula produced it (set below via FK)
    computed_at   timestamptz not null default now(),
    unique (plant_id, period_id, parameter_id)
);

create index on esg.output_value (plant_id, period_id);
create index on esg.output_value (parameter_id);

-- =============================================================================
-- 4. FORMULAS LAYER  (data-driven registry: OUTPUT = f(INPUT, CONSTANT, OUTPUT))
-- =============================================================================
--
-- Each formula targets exactly one output_parameter and stores a parseable
-- expression that references other parameters by their `key`, using namespaced
-- tokens so the resolver knows which table to read:
--
--     in:<input_parameter.key>      -> esg.input_value
--     const:<constant.key>          -> esg.constant.value
--     out:<output_parameter.key>    -> esg.output_value  (intermediate chaining)
--
-- Example expression (Scope 2):
--     "(in:pwr.grid_total - in:pwr.onsite_export) * const:EF.grid_2023"
--
-- Supported operators: + - * / ( ) and functions SUM(), IF(cond, a, b),
-- IFERROR(expr, fallback), MAX, MIN.  Evaluated by the app/edge-function
-- resolver in topological order (see formula_dependency).
-- -----------------------------------------------------------------------------

create table esg.formula (
    id              integer generated always as identity primary key,
    output_key      text not null references esg.output_parameter(key),
    expression      text not null,                 -- parseable, uses in:/const:/out: tokens
    description     text,                          -- plain-English description
    excel_origin    text,                          -- e.g. "Derived Sheet!N644 <- N606"
    eval_order      integer not null default 100,  -- lower evaluates first (chaining)
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    unique (output_key)                            -- one canonical formula per output
);

-- Explicit dependency edges (denormalised from expression) for topo-sort,
-- impact analysis, and validation that every referenced key exists.
create table esg.formula_dependency (
    id              bigint generated always as identity primary key,
    formula_id      integer not null references esg.formula(id) on delete cascade,
    ref_kind        text not null check (ref_kind in ('input','constant','output')),
    ref_key         text not null,                 -- the referenced parameter/constant key
    unique (formula_id, ref_kind, ref_key)
);

create index on esg.formula_dependency (ref_kind, ref_key);

-- now wire output_value.formula_id -> formula.id
alter table esg.output_value
    add constraint output_value_formula_fk
    foreign key (formula_id) references esg.formula(id);

-- -----------------------------------------------------------------------------
-- Convenience view: a flat, human-readable formula catalogue with its inputs.
-- -----------------------------------------------------------------------------
create or replace view esg.v_formula_catalogue as
select  op.key            as output_key,
        op.label          as output_label,
        op.unit,
        op.scope,
        f.expression,
        f.description,
        f.excel_origin,
        f.eval_order,
        array_agg(distinct d.ref_kind || ':' || d.ref_key
                  order by d.ref_kind || ':' || d.ref_key)
            filter (where d.id is not null) as dependencies
from        esg.output_parameter op
join        esg.formula f          on f.output_key = op.key
left join   esg.formula_dependency d on d.formula_id = f.id
group by    op.key, op.label, op.unit, op.scope,
            f.expression, f.description, f.excel_origin, f.eval_order;
