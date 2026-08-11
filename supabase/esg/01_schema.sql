-- =============================================================================
-- BIRLA ESTATES — ESG DATA PLATFORM · Supabase schema
--
-- Four-layer model derived from the monthly site ESG returns filed by Birla
-- Estates Private Limited (BEPL) sites, and the BRSR Environment disclosures
-- they roll up into. Replaces the earlier Sagar Cements (GCCA/GRI) model.
--
--   CONSTANTS  -> fixed reference values (grid EF, fuel EFs, refrigerant GWPs)
--   INPUT      -> every value on the monthly site return (long/EAV)
--   FORMULAS   -> registry: OUTPUT = f(INPUT, CONSTANT, OUTPUT) (data-driven)
--   OUTPUT     -> computed BRSR Environment metrics (energy, water, waste,
--                 air, refrigerants, Scope 1/2)
--
-- Granularity: long/tidy. One row per (site, period, parameter).
-- Periods are Indian fiscal months (Apr..Mar) plus YTD and baseline.
--
-- WHAT IS DIFFERENT FROM THE CEMENT MODEL
--   * `plant` -> `site`, carrying the attributes real estate actually reports
--     on: asset type (commercial vs residential-construction), city, and the
--     water-stressed flag that drives the BRSR stressed-area rollups.
--   * Per-site FORM REPLICAS (`site_form` / `site_form_field`). Each site files
--     a differently-shaped paper form; rather than force one superset layout on
--     everyone, each site's form is stored as data and its rows are MAPPED onto
--     shared canonical input parameters. Adding a site = inserting rows.
--   * Provenance + data quality on `input_value`: 'NA' is distinguishable from
--     zero, the original text is retained where a number had to be parsed out
--     of it, and implausible values raise non-blocking flags (`data_flag`).
--
-- Source of the model: birla-estates/ESG Data FY 24-25 - Reconstructed
-- (Middle Link).xlsx and ESG Middle Link - Simplified.xlsx, which reconstruct
-- the site-return -> BRSR-template chain.
-- =============================================================================

create schema if not exists esg;
set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- 0. DIMENSIONS  (shared lookups)
-- -----------------------------------------------------------------------------

-- Sites in the BEPL reporting boundary, plus the GROUP rollup.
--
-- asset_type drives which form variant a site files and how it is treated in
-- rollups: 'commercial' assets are operating buildings (tenant electricity,
-- cooling towers, no construction waste); 'residential' sites are projects
-- under construction (plant & machinery diesel, C&D waste, treated water).
--
-- water_stressed marks the sites inside the template's declared stressed area
-- ("Bangalore & NCR"). The BRSR water-stressed rollups sum exactly these sites,
-- so the flag is load-bearing, not decorative.
create table esg.site (
    id            smallint generated always as identity primary key,
    code          text not null unique,           -- 'AURORA', 'TISYA', 'GROUP', ...
    name          text not null,
    asset_type    text not null
                  check (asset_type in ('commercial','residential','group')),
    city          text,
    region        text,                            -- 'Mumbai','Bengaluru','NCR','Pune'
    water_stressed boolean not null default false,
    is_group      boolean not null default false,
    -- Sites energise/commission mid-year; a null start means "in scope for all
    -- periods". Used by coverage reporting so a site is not counted as "missing"
    -- for months before it existed.
    in_scope_from date,
    in_scope_to   date,
    notes         text,
    created_at    timestamptz not null default now()
);

create index on esg.site (asset_type);
create index on esg.site (water_stressed);

-- Reporting periods. Fiscal-year aware.
-- period_kind: 'month' (Apr..Mar), 'ytd' (full-year rollup), 'baseline'.
create table esg.period (
    id            integer generated always as identity primary key,
    fiscal_year   text not null,                  -- e.g. '2024-25'
    period_kind   text not null
                  check (period_kind in ('month','ytd','baseline')),
    month_no      smallint check (month_no between 1 and 12),  -- 1=April..12=March
    month_label   text,                           -- 'April','May',... null for ytd/baseline
    -- BRSR reports waste quarterly and air emissions half-yearly, so every
    -- month carries the bucket it rolls into. Q1 = Apr-Jun, H1 = Apr-Sep.
    quarter_no    smallint check (quarter_no between 1 and 4),
    half_no       smallint check (half_no between 1 and 2),
    period_start  date,
    period_end    date,
    unique (fiscal_year, period_kind, month_no)
);

-- The ESG domains used to bucket parameters and outputs.
create table esg.domain (
    code          text primary key,
    name          text not null,
    sort_order    smallint not null default 0
);

insert into esg.domain (code, name, sort_order) values
    ('ENERGY',      'Energy & Electricity',        10),
    ('FUEL',        'Fuel Consumption',            20),
    ('EMISSIONS',   'GHG Emissions',               30),
    ('WATER',       'Water',                       40),
    ('WASTE',       'Waste & Circular Economy',    50),
    ('AIR',         'Air Emissions (non-GHG)',     60),
    ('REFRIGERANT', 'Refrigerants & Extinguishers',70),
    ('OPERATIONS',  'Operations (DG hours, area)', 80);

-- =============================================================================
-- 1. CONSTANTS LAYER
-- =============================================================================

create table esg.constant_category (
    code          text primary key,
    name          text not null
);

insert into esg.constant_category (code, name) values
    ('EF_GRID',      'Emission factor - grid electricity (kg CO2/kWh)'),
    ('EF_FUEL',      'Emission factor - liquid fuel (kg CO2e/L)'),
    ('GWP_REFRIG',   'Global warming potential - refrigerant (kg CO2e/kg)'),
    ('CONVERSION',   'Unit conversion factor');

-- The constants themselves. `key` is referenced by the FORMULAS layer.
create table esg.constant (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- machine key, e.g. 'EF.grid'
    category      text not null references esg.constant_category(code),
    label         text not null,
    value         numeric not null,
    unit          text,
    source        text,                           -- CEA / IPCC / AR4 ...
    source_date   text,
    effective_from date,
    effective_to   date,
    -- Marks a value the ESG team still has to confirm. The Emissions Check
    -- sheet of the Middle Link reconstruction left several factors as editable
    -- assumptions because the authoritative recipe lives in a file we do not
    -- have; those carry is_assumption = true so the UI can surface them.
    is_assumption boolean not null default false,
    notes         text,
    created_at    timestamptz not null default now()
);

create index on esg.constant (category);

-- =============================================================================
-- 2. INPUT LAYER
-- =============================================================================

-- The canonical dictionary of input parameters. This is deliberately SMALLER
-- than the union of all site form rows: several differently-worded rows across
-- site forms ("From Tanker (offsite)", "Water for drinking") map onto the same
-- canonical parameter. The per-site wording lives in site_form_field.
create table esg.input_parameter (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- 'water.tanker', referenced by formulas
    domain        text not null references esg.domain(code),
    section       text,                           -- 'Water','Electricity','Fuel','Waste',...
    subsection    text,
    label         text not null,                  -- canonical label
    unit          text,                           -- canonical unit (see note below)
    value_type    text not null default 'number'
                  check (value_type in ('number','text','boolean')),
    -- Memo parameters are captured for validation and completeness but do NOT
    -- feed any BRSR output (tenant electricity, STP flows, DG hours). Keeping
    -- them in the same table preserves the full site return; the flag stops
    -- them being double-counted into disclosures.
    is_memo       boolean not null default false,
    is_active     boolean not null default true,
    sort_order    integer,
    notes         text
);

create index on esg.input_parameter (domain);
create index on esg.input_parameter (section);

-- ---------------------------------------------------------------------------
-- PER-SITE FORM REPLICAS
--
-- Each site files its own paper form. Aurora's has tenant + floor-wise
-- electricity and no C&D row; Tisya/Sangamwadi share a residential layout;
-- Trimaya uses form Ref BRT/EHS/ESG/F-17 with entirely different row numbers
-- and no site/period header at all.
--
-- `site_form` is one versioned form definition; `site_form_field` is its rows
-- in display order, each pointing at the canonical input_parameter it feeds.
-- A field with a null parameter_id is captured verbatim but not consolidated
-- (e.g. "Name of Agency", free-text remarks).
--
-- Versioning: when a site revises its form, insert a NEW site_form row with a
-- later effective_from rather than editing the old one, so historic entries
-- keep rendering in the layout they were filed under.
-- ---------------------------------------------------------------------------
create table esg.site_form (
    id             integer generated always as identity primary key,
    code           text not null unique,          -- 'FORM.COMMERCIAL.V1', ...
    name           text not null,
    description    text,
    -- The form's own reference number where it prints one (Trimaya's F-17).
    form_ref       text,
    version        smallint not null default 1,
    effective_from date,
    effective_to   date,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now()
);

-- Which form each site files. A site can change form over time, so this is a
-- table rather than a column on `site`.
create table esg.site_form_assignment (
    id             integer generated always as identity primary key,
    site_id        smallint not null references esg.site(id) on delete cascade,
    form_id        integer  not null references esg.site_form(id),
    effective_from date,
    effective_to   date,
    unique (site_id, form_id, effective_from)
);

create index on esg.site_form_assignment (site_id);

-- One row per line on the printed form, in the order it appears.
create table esg.site_form_field (
    id             integer generated always as identity primary key,
    form_id        integer not null references esg.site_form(id) on delete cascade,
    -- Where this row sits on the form: a group heading plus display order.
    -- `group_label` reproduces the form's own section headers verbatim
    -- ("Water Consumption", "Waste Management", "DG Details").
    group_label    text,
    row_order      integer not null,
    -- The label EXACTLY as printed on the site's form, typos and all
    -- ("Grid Electricity consmuption", "Scarp - Wood -MT"). Site teams
    -- recognise their own form; silently correcting it loses that.
    label          text not null,
    -- The unit as printed on the form. May differ from the canonical unit of
    -- the parameter it maps to (form says Ltrs, canonical is kL) — the
    -- conversion is declared below rather than expected of the user.
    form_unit      text,
    -- Canonical parameter this row feeds. Null = captured but not consolidated.
    parameter_id   integer references esg.input_parameter(id),
    -- Multiplier applied to the entered number to reach the canonical unit.
    -- 0.001 for Ltrs->kL and kg->MT; 1 where units already agree.
    unit_factor    numeric not null default 1,
    -- Which column of the form this is. Site waste blocks have several columns
    -- per row (generated / reused on site / disposed outside / agency) and each
    -- needs its own field row.
    column_kind    text not null default 'quantity'
                   check (column_kind in ('quantity','reused_onsite','disposed_offsite','agency','comment')),
    -- Several forms ask for the same figure split across rows that are summed
    -- (Aurora Level 8 + Level 13 -> non-renewable electricity; DG1..DG4 hours).
    -- Fields sharing an aggregate_key are summed into the parameter.
    aggregate_key  text,
    -- True where the form's own row is a total the site computes by hand
    -- (Aurora "Total fresh water consumption"). Captured for the cross-check on
    -- the Validation view, never consolidated.
    is_form_total  boolean not null default false,
    is_required    boolean not null default false,
    help_text      text,
    notes          text,
    unique (form_id, row_order, column_kind)
);

create index on esg.site_form_field (form_id);
create index on esg.site_form_field (parameter_id);

-- ---------------------------------------------------------------------------
-- ENTERED VALUES
--
-- One row per (site, period, parameter). Everything needed to defend the number
-- in assurance travels with it: who entered it, when, what was originally
-- written if it had to be parsed, and whether it is real data or an estimate.
-- ---------------------------------------------------------------------------
create table esg.input_value (
    id            bigint generated always as identity primary key,
    site_id       smallint not null references esg.site(id),
    period_id     integer  not null references esg.period(id),
    parameter_id  integer  not null references esg.input_parameter(id),
    value_num     numeric,
    value_text    text,
    value_bool    boolean,

    -- 'NA' / 'Nil' on a paper form means NO DATA, which is categorically not
    -- the same as a reported zero — the Middle Link treats them differently and
    -- so must we. is_not_available = true means the site explicitly marked the
    -- row unavailable; a null value_num with is_not_available = false means the
    -- row was simply never filled.
    is_not_available boolean not null default false,

    -- Where the number came from:
    --   'entered'  - typed by a site/ESG user against the form
    --   'imported' - loaded from a historic site-return spreadsheet
    --   'parsed'   - extracted from free text ("58 kg" -> 0.058 MT); raw_text
    --                keeps the original so the parse can always be audited
    --   'estimated'- no return filed; a documented estimate stands in
    provenance    text not null default 'entered'
                  check (provenance in ('entered','imported','parsed','estimated')),
    -- The text exactly as filed, whenever value_num was derived from it.
    raw_text      text,
    -- Free-text note from the site (the forms have a remarks column).
    comment       text,
    source_doc    text,                            -- 'BA_ESG_Monthly_Aug_24.xlsx › Aug 24!F13'
    entered_by    text,
    entered_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (site_id, period_id, parameter_id)
);

create index on esg.input_value (site_id, period_id);
create index on esg.input_value (parameter_id);
create index on esg.input_value (provenance);

-- ---------------------------------------------------------------------------
-- SUBMISSION STATE
--
-- A site's monthly return as a unit of work: drafted, submitted, reviewed.
-- Coverage reporting reads this to answer "who has filed for December?".
-- ---------------------------------------------------------------------------
create table esg.site_submission (
    id            bigint generated always as identity primary key,
    site_id       smallint not null references esg.site(id),
    period_id     integer  not null references esg.period(id),
    status        text not null default 'draft'
                  check (status in ('draft','submitted','under_review','approved','returned')),
    submitted_by  text,
    submitted_at  timestamptz,
    reviewed_by   text,
    reviewed_at   timestamptz,
    review_note   text,
    unique (site_id, period_id)
);

create index on esg.site_submission (period_id, status);

-- ---------------------------------------------------------------------------
-- DATA QUALITY FLAGS
--
-- Validation warnings that do NOT block saving. The real returns contain
-- physically impossible values (Aurora's STP outlet exceeds its inlet in four
-- consecutive months) and implausible ones (Sangamwadi's DG at 2.7 L/h over
-- 741 hours). Blocking submission would simply stop sites filing; instead the
-- value is stored and the problem is raised for review.
-- ---------------------------------------------------------------------------
create table esg.data_flag (
    id            bigint generated always as identity primary key,
    site_id       smallint not null references esg.site(id),
    period_id     integer  not null references esg.period(id),
    -- Null where the flag is about a relationship between rows rather than one
    -- row (STP inlet vs outlet, form total vs sum of its parts).
    parameter_id  integer references esg.input_parameter(id),
    rule_code     text not null,                  -- 'STP_OUTLET_GT_INLET', 'DG_LPH_LOW', ...
    severity      text not null default 'warning'
                  check (severity in ('info','warning','error')),
    message       text not null,
    -- Set when someone has looked at it and decided it is fine as filed.
    acknowledged_by text,
    acknowledged_at timestamptz,
    acknowledge_note text,
    created_at    timestamptz not null default now(),
    unique (site_id, period_id, rule_code, parameter_id)
);

create index on esg.data_flag (site_id, period_id);
create index on esg.data_flag (severity) where acknowledged_at is null;

-- =============================================================================
-- 3. OUTPUT LAYER
-- =============================================================================

-- Catalogue of every computed metric. Keys mirror the BRSR Environment
-- disclosure lines so the export can address them directly.
create table esg.output_parameter (
    id            integer generated always as identity primary key,
    key           text not null unique,           -- 'en.electricity_nonrenew'
    domain        text not null references esg.domain(code),
    scope         text check (scope in ('scope1','scope2','scope3',null)),
    label         text not null,
    unit          text,
    is_intensity  boolean not null default false,
    -- Reporting frequency of the underlying disclosure. Waste is quarterly and
    -- air emissions half-yearly in BRSR even though the inputs arrive monthly;
    -- the resolver and the export both need to know which bucket to fill.
    frequency     text not null default 'monthly'
                  check (frequency in ('monthly','quarterly','half_yearly','annual')),
    sort_order    integer,
    notes         text
);

create index on esg.output_parameter (domain);
create index on esg.output_parameter (scope);

-- Computed values, one row per (site, period, output parameter).
create table esg.output_value (
    id            bigint generated always as identity primary key,
    site_id       smallint not null references esg.site(id),
    period_id     integer  not null references esg.period(id),
    parameter_id  integer  not null references esg.output_parameter(id),
    value_num     numeric,
    formula_id    integer,                        -- FK added after esg.formula exists
    -- How much of this figure rests on data actually filed. A GROUP rollup for
    -- a month where 4 of 11 sites reported is arithmetically fine and
    -- evidentially thin; carrying the ratio with the number keeps that visible
    -- instead of burying it.
    sites_reporting  smallint,
    sites_expected   smallint,
    computed_at   timestamptz not null default now(),
    unique (site_id, period_id, parameter_id)
);

create index on esg.output_value (site_id, period_id);
create index on esg.output_value (parameter_id);

-- =============================================================================
-- 4. FORMULAS LAYER  (data-driven registry: OUTPUT = f(INPUT, CONSTANT, OUTPUT))
-- =============================================================================
--
-- Each formula targets exactly one output_parameter and stores a parseable
-- expression referencing other parameters by `key`, namespaced so the resolver
-- knows which table to read:
--
--     in:<input_parameter.key>      -> esg.input_value
--     const:<constant.key>          -> esg.constant.value
--     out:<output_parameter.key>    -> esg.output_value  (intermediate chaining)
--
-- Example (Scope 2):
--     "out:en.electricity_nonrenew * const:EF.grid / 1000"
--
-- Supported operators: + - * / ( ) and functions IF(cond, a, b),
-- IFERROR(expr, fallback), MAX, MIN. Evaluated in topological order by the
-- resolver (scripts/resolve-birla.mjs); Postgres stores and validates only.
--
-- `site_filter` restricts which sites contribute to a GROUP rollup. The BRSR
-- water-stressed lines sum only sites inside the declared stressed area, so
-- those formulas carry site_filter = 'water_stressed'.
-- -----------------------------------------------------------------------------

create table esg.formula (
    id              integer generated always as identity primary key,
    output_key      text not null references esg.output_parameter(key),
    expression      text not null,
    description     text,
    -- Where this rule comes from in the reconstructed consolidation, so a
    -- reviewer can trace it back (e.g. "Middle Link FORMULAS!C9").
    source_ref      text,
    site_filter     text
                    check (site_filter in ('all','water_stressed','commercial','residential',null)),
    eval_order      integer not null default 100,
    is_active       boolean not null default true,
    -- Set where the rule encodes a judgement the ESG team should confirm rather
    -- than a definitional certainty (see 08_resolver_notes.md).
    is_assumption   boolean not null default false,
    created_at      timestamptz not null default now(),
    unique (output_key)
);

-- Explicit dependency edges (denormalised from expression) for topo-sort,
-- impact analysis, and validation that every referenced key exists.
create table esg.formula_dependency (
    id              bigint generated always as identity primary key,
    formula_id      integer not null references esg.formula(id) on delete cascade,
    ref_kind        text not null check (ref_kind in ('input','constant','output')),
    ref_key         text not null,
    unique (formula_id, ref_kind, ref_key)
);

create index on esg.formula_dependency (ref_kind, ref_key);

alter table esg.output_value
    add constraint output_value_formula_fk
    foreign key (formula_id) references esg.formula(id);

-- =============================================================================
-- 5. VIEWS
-- =============================================================================

-- Flat, human-readable formula catalogue with its dependencies.
create or replace view esg.v_formula_catalogue as
select  op.key            as output_key,
        op.label          as output_label,
        op.unit,
        op.scope,
        op.frequency,
        f.expression,
        f.description,
        f.source_ref,
        f.site_filter,
        f.eval_order,
        f.is_assumption,
        array_agg(distinct d.ref_kind || ':' || d.ref_key
                  order by d.ref_kind || ':' || d.ref_key)
            filter (where d.id is not null) as dependencies
from        esg.output_parameter op
join        esg.formula f            on f.output_key = op.key
left join   esg.formula_dependency d on d.formula_id = f.id
group by    op.key, op.label, op.unit, op.scope, op.frequency,
            f.expression, f.description, f.source_ref, f.site_filter,
            f.eval_order, f.is_assumption;

-- A site's form, ready to render: every field in order with the canonical
-- parameter it feeds. The entry UI reads this one view.
create or replace view esg.v_site_form_layout as
select  s.id            as site_id,
        s.code          as site_code,
        s.name          as site_name,
        sf.id           as form_id,
        sf.code         as form_code,
        sf.name         as form_name,
        sf.form_ref,
        ff.id           as field_id,
        ff.group_label,
        ff.row_order,
        ff.label,
        ff.form_unit,
        ff.column_kind,
        ff.aggregate_key,
        ff.is_form_total,
        ff.is_required,
        ff.unit_factor,
        ff.help_text,
        ip.key          as parameter_key,
        ip.label        as parameter_label,
        ip.unit         as parameter_unit,
        ip.is_memo
from        esg.site s
join        esg.site_form_assignment sa on sa.site_id = s.id
join        esg.site_form sf            on sf.id = sa.form_id and sf.is_active
join        esg.site_form_field ff      on ff.form_id = sf.id
left join   esg.input_parameter ip      on ip.id = ff.parameter_id;

-- Coverage: which sites filed for each period. Drives the honest "4 of 11
-- sites reported" indicator instead of silently presenting a partial total as
-- if it were complete. Sites are only expected once they are in scope.
create or replace view esg.v_period_coverage as
select  p.id                          as period_id,
        p.fiscal_year,
        p.period_kind,
        p.month_no,
        p.month_label,
        count(*) filter (where sub.status in ('submitted','under_review','approved'))
                                      as sites_reporting,
        count(*)                      as sites_expected,
        round(
            100.0 * count(*) filter (where sub.status in ('submitted','under_review','approved'))
            / nullif(count(*), 0)
        , 1)                          as pct_reporting
from        esg.period p
cross join  esg.site s
left join   esg.site_submission sub on sub.site_id = s.id and sub.period_id = p.id
where       p.period_kind = 'month'
  and       not s.is_group
  and       (s.in_scope_from is null or p.period_start >= s.in_scope_from)
  and       (s.in_scope_to   is null or p.period_end   <= s.in_scope_to)
group by    p.id, p.fiscal_year, p.period_kind, p.month_no, p.month_label;

-- Open (unacknowledged) data-quality flags, newest first — the review queue.
create or replace view esg.v_open_flags as
select  df.id,
        s.code   as site_code,
        s.name   as site_name,
        p.fiscal_year,
        p.month_label,
        ip.key   as parameter_key,
        ip.label as parameter_label,
        df.rule_code,
        df.severity,
        df.message,
        df.created_at
from        esg.data_flag df
join        esg.site s          on s.id = df.site_id
join        esg.period p        on p.id = df.period_id
left join   esg.input_parameter ip on ip.id = df.parameter_id
where       df.acknowledged_at is null
order by    case df.severity when 'error' then 1 when 'warning' then 2 else 3 end,
            df.created_at desc;

-- Every formula reference that does not resolve to a real key. Must return
-- zero rows after seeding.
create or replace view esg.v_formula_missing_refs as
select  f.output_key,
        d.ref_kind,
        d.ref_key
from        esg.formula f
join        esg.formula_dependency d on d.formula_id = f.id
where       (d.ref_kind = 'input'    and not exists (select 1 from esg.input_parameter  x where x.key = d.ref_key))
   or       (d.ref_kind = 'constant' and not exists (select 1 from esg.constant         x where x.key = d.ref_key))
   or       (d.ref_kind = 'output'   and not exists (select 1 from esg.output_parameter x where x.key = d.ref_key));

-- output -> output edges, for verifying the evaluation DAG is acyclic.
create or replace view esg.v_formula_dag_edges as
select  d.ref_key   as from_output,
        f.output_key as to_output
from        esg.formula f
join        esg.formula_dependency d on d.formula_id = f.id
where       d.ref_kind = 'output';
