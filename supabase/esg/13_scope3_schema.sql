-- =============================================================================
-- BIRLA ESTATES — SCOPE 3 SCHEMA (ledgers, mappings, factor provenance)
--
-- The existing esg schema models Scope 1 and Scope 2. Its shape is
-- (site, period, parameter) -> one number, which is exactly a monthly site
-- return. Scope 3 is not that shape, and the difference is the whole reason
-- this file exists rather than a handful of extra input_parameter rows.
--
-- WHY input_value CANNOT HOLD THESE
--
--   input_value is unique on (site_id, period_id, parameter_id): one value per
--   slot. Scope 3's inputs are LEDGERS — up to 300 purchase-order lines, 200
--   material deliveries — where a single row carries six correlated fields
--   (supplier, HSN code, quantity, value, Scope 3 tag, spend category). There
--   is no way to express one purchase order as (site, period, parameter) ->
--   number without inventing 300 parameters or destroying the correlation.
--
--   Relaxing that uniqueness was the alternative and was rejected. It is
--   load-bearing: commitValues archives to input_value_history and then deletes
--   so a new import owns the slot outright, and that is only correct because a
--   slot holds one row. Every read path — resolve-birla.mjs, the dashboard, the
--   export — assumes it too. The monthly-return model genuinely IS
--   one-value-per-slot and should stay that way.
--
-- WHY THE LEDGERS ARE ONE TABLE AND NOT NINE
--
--   The nine input sheets share a spine — a line number, a site, a period, a
--   quantity, a factor to look up, an emissions result — and differ only in
--   which descriptive fields they carry. Nine tables would duplicate that spine
--   nine times and force resolve-scope3.mjs to special-case its reader for each.
--   One table with a `ledger` discriminator and a jsonb `attrs` column keeps the
--   spine typed (so it can be indexed, summed and joined) and lets the
--   per-ledger fields vary without a migration every time a sheet gains a column.
--
--   attrs is deliberately NOT a dumping ground: everything the computation
--   reads is listed in the per-ledger key contract below, and
--   scripts/resolve-scope3.mjs fails loudly on a key it does not recognise
--   rather than treating a missing field as zero.
--
-- Source of every structure here: birla-estates/Birla Estates - Scope 3
-- Calculator (Template) v1.0.xlsx, 23 sheets, read on 12 Aug 2026.
--
-- Apply after 12_constant_revision.sql, then 14_scope3_constants.sql and
-- 15_scope3_outputs.sql. Re-run APPLY_THIS_IN_SQL_EDITOR.sql afterwards if
-- PostgREST reports a missing table.
-- =============================================================================

set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- The nine ledgers, as an enum-by-check so a typo in a loader is a constraint
-- violation rather than a silently orphaned set of rows.
--
-- Names mirror the workbook's own sheet numbering, because the ESG team will be
-- reading both side by side and "INPUT 3" has to mean the same thing in each.
-- -----------------------------------------------------------------------------
create table if not exists esg.s3_ledger (
    code          text primary key,
    sheet_name    text not null,          -- as printed in the workbook
    label         text not null,
    owner_team    text,                   -- who fills it in, per the sheet subtitle
    -- What one row means. This is the grain, and it is the thing most likely to
    -- be misunderstood by whoever loads the next year's data.
    grain         text not null,
    -- Whether a row carries a usable site and month. Four of the nine do not,
    -- and pretending otherwise is how a category ends up attributed to the
    -- wrong asset. resolve-scope3.mjs reads this rather than hardcoding it.
    has_site      boolean not null default false,
    has_period    boolean not null default false,
    sort_order    smallint not null default 0,
    notes         text
);

insert into esg.s3_ledger (code, sheet_name, label, owner_team, grain, has_site, has_period, sort_order, notes) values
('procurement', 'INPUT - 1 Procurement', 'Procurement ledger', 'Procurement / IT (SAP extract)',
 'one purchase-order line, or one aggregated supplier-category line', true, false, 10,
 'Feeds Cat 1 (spend) and Cat 2. Every line MUST carry a Scope 3 tag: an untagged line is silently excluded, which understates the category invisibly.'),
('materials', 'INPUT - 2 Materials', 'Building materials by tonnage', 'Site EHS / Planning',
 'one material per supplier per project', true, false, 20,
 'Feeds Cat 1 embodied carbon AND the Cat 4 delivery leg from the same row. A material counted here must be tagged EXCLUDE on the procurement ledger.'),
('inbound_freight', 'INPUT - 3 Inbound Freight', 'Inbound freight, non-material goods', 'Procurement / Logistics',
 'one delivery', true, false, 30,
 'Only for goods whose delivery is not already captured on the materials ledger.'),
('energy_fuel', 'INPUT - 4 Energy and Fuel', 'Energy and fuel', 'Site EHS',
 'one site per month', true, true, 40,
 'The SAME quantities used for Scope 1 and 2 — they must reconcile. Only the upstream portion is Cat 3.'),
('waste', 'INPUT - 5 Waste', 'Waste by disposal route', 'Site EHS',
 'one site per month per waste stream per disposal route', true, true, 50,
 'ONE ROW PER DISPOSAL ROUTE. A single "generated" tonnage cannot be costed — C&D to landfill and C&D to recycling carry different factors.'),
('business_travel', 'INPUT - 6 Business Travel', 'Business travel', 'HR / Admin (travel portal extract)',
 'one trip; hotel stays as room-nights with 1 traveller', false, false, 60,
 'Carries a month column but no site — travel is a company-level activity.'),
('commute', 'INPUT - 7 Employee Commute', 'Employee commute survey', 'HR / Sustainability',
 'one commute mode across the whole surveyed population', false, false, 70,
 'Not a ledger of people. One row per MODE, grossed up to headcount. Survey at least every two years.'),
('sold_products', 'INPUT - 8 Sold Products', 'Sold residential and commercial units', 'Sales + Design/MEP',
 'one project handed over in the fiscal year', true, false, 80,
 'Cat 11. The lifetime multiplier makes this the dominant category by construction — see the note on s3.cat11_sold.'),
('leased_assets', 'INPUT - 9 Leased Assets', 'Downstream leased assets', 'Commercial asset management',
 'one property per month', true, true, 90,
 'Cat 13. This is the tenant consumption that was REMOVED from the Scope 2 boundary — the two disclosures must be read together.')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- THE LEDGER TABLE
--
-- One row per line on an input sheet, across all nine sheets.
--
-- THE SPINE (typed columns) is what every ledger shares and what the
-- computation, the drill-down and the assurance trail all need to be able to
-- filter and sum on.
--
-- THE ATTRS (jsonb) are the per-ledger descriptive fields. The contract:
--
--   procurement      project_code, doc_date, supplier, supplier_code,
--                    description, hsn_code, order_unit, quantity,
--                    order_value_inr, s3_tag, spend_category
--   materials        project, material_type, supplier, quantity_recorded, unit,
--                    tonnes_conversion, epd_available, epd_factor,
--                    supplier_pincode, site_pincode, distance_km,
--                    circuity, transport_mode, vehicle_type
--   inbound_freight  project, supplier, description, weight_tonnes,
--                    supplier_pincode, site_pincode, distance_km, circuity,
--                    transport_mode, vehicle_type
--   energy_fuel      site_name, month, grid_kwh, renewable_openaccess_kwh,
--                    renewable_onsite_kwh, diesel_stationary_l,
--                    diesel_mobile_l, petrol_l
--   waste            site_name, month, waste_stream, is_hazardous,
--                    quantity_tonnes, disposal_route, agency
--   business_travel  function, month, travel_mode, quantity, travellers
--   commute          commute_mode, respondents, one_way_km, days_per_week,
--                    weeks_per_year, occupancy, wfh_days
--   sold_products    project, handover_fy, area_sqm, area_basis,
--                    area_conversion, epi_kwh_sqm_yr, epi_source, lifetime_years
--   leased_assets    property, month, tenant_electricity_kwh, tenant_diesel_l,
--                    refrigerant_type, refrigerant_topup_kg
--
-- Anything not on that list is descriptive only and is never read by the
-- computation. resolve-scope3.mjs validates against this contract.
-- -----------------------------------------------------------------------------
create table if not exists esg.s3_line (
    id            bigint generated always as identity primary key,
    ledger        text not null references esg.s3_ledger(code),

    -- The fiscal year the line belongs to. Scope 3 is disclosed annually and
    -- several ledgers have no month at all, so the FY — not the period — is the
    -- unit that always exists. Text to match esg.period.fiscal_year ('2025-26').
    fiscal_year   text not null,

    -- Nullable BY DESIGN. Four of the nine ledgers carry no usable site, and
    -- three carry no month. A null here means "this activity is not attributable
    -- to one asset/month", which is a fact about the data, not a gap to fill.
    -- Writing a default would invent an attribution nobody reported.
    site_id       smallint references esg.site(id),
    period_id     integer  references esg.period(id),

    -- The sheet's own Line ID, so a row here can be pointed at the row it came
    -- from. Ledgers without a printed line number (energy_fuel, waste, commute,
    -- leased_assets) get a synthetic sequence assigned at load.
    line_no       integer not null,

    attrs         jsonb not null default '{}'::jsonb,

    -- ---- Resolved during computation, not entry -----------------------------
    -- Written by scripts/resolve-scope3.mjs. Null until it has run.
    --
    -- Keeping the per-line result HERE rather than only in the category total is
    -- what makes a disclosure defensible: an assurer asks "which purchase order
    -- produced this?", and the answer is a query rather than a re-run.

    -- Which esg.constant the line resolved to. Text, not an FK, because
    -- '#UNMAPPED' is a legitimate outcome that must be storable and countable —
    -- an FK would force the loader to either drop the line or invent a factor,
    -- and both hide the problem the VALIDATION sheet exists to surface.
    factor_key    text,
    factor_value  numeric,               -- the factor as applied, for the audit trail
    -- The second factor, where a line carries one: business travel modes have a
    -- well-to-tank factor alongside combustion, and materials carry a freight
    -- factor alongside embodied carbon.
    factor_key_2   text,
    factor_value_2 numeric,

    -- The quantity the factor was applied to, in the factor's denominator unit
    -- (tonnes, tonne-km, EUR, passenger-km, kg). Stored because the arithmetic
    -- from a filed figure to this number is where the traps live — road distance
    -- is straight-line x circuity, spend is INR / fx / deflator — and a reviewer
    -- needs to see the intermediate, not just the input and the answer.
    quantity      numeric,
    quantity_unit text,

    -- The line's contribution, in tonnes CO2e. Split where one row feeds two
    -- categories: materials produce embodied (emissions_t) and freight
    -- (emissions_t_2) from the same delivery.
    emissions_t   numeric,
    emissions_t_2 numeric,

    -- Which GHG Protocol category the line landed in: 'cat1_spend',
    -- 'cat2_capital', 'excluded', ... Set by the computation from the line's own
    -- tag, so "why is this line not in the total?" is answerable.
    category      text,
    -- Why a line contributed nothing: 'excluded_tag', 'unmapped_factor',
    -- 'no_quantity'. Null when the line computed normally. THIS IS THE COLUMN
    -- that turns a silent omission into a countable one.
    exclusion_reason text,

    -- ---- Provenance ---------------------------------------------------------
    import_batch_id bigint references esg.import_batch(id),
    source_doc    text,                  -- 'Scope3 FY26.xlsx › INPUT - 1 Procurement!A47'
    entered_by    text,
    entered_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    -- Supersession, mirroring input_value: a re-import stamps the old rows
    -- rather than deleting them, and every read filters on null.
    superseded_at timestamptz,
    note          text,

    -- A line number is unique within its ledger and year. Site is deliberately
    -- NOT in the key: the procurement ledger numbers its lines once across the
    -- whole company, and including a nullable column in a unique constraint
    -- would let duplicates through anyway (null is distinct from null).
    unique (ledger, fiscal_year, line_no)
);

create index if not exists s3_line_ledger_fy_idx  on esg.s3_line (ledger, fiscal_year) where superseded_at is null;
create index if not exists s3_line_site_idx       on esg.s3_line (site_id, period_id);
create index if not exists s3_line_category_idx   on esg.s3_line (fiscal_year, category);
create index if not exists s3_line_factor_idx     on esg.s3_line (factor_key);
create index if not exists s3_line_batch_idx      on esg.s3_line (import_batch_id);
-- Lines whose factor never resolved: the query the validation pass runs.
create index if not exists s3_line_unresolved_idx on esg.s3_line (fiscal_year)
    where exclusion_reason is not null and superseded_at is null;

drop trigger if exists s3_line_set_updated_at on esg.s3_line;
create trigger s3_line_set_updated_at
    before update on esg.s3_line
    for each row execute function esg.set_updated_at();

-- -----------------------------------------------------------------------------
-- History, mirroring input_value_history.
--
-- The unique constraint above has to survive a re-import, so a superseded line
-- moves here rather than sitting alongside the live one.
-- -----------------------------------------------------------------------------
create table if not exists esg.s3_line_history (
    id            bigint generated always as identity primary key,
    line_id       bigint,                -- the s3_line.id it was, before deletion
    ledger        text not null,
    fiscal_year   text not null,
    site_id       smallint,
    period_id     integer,
    line_no       integer,
    attrs         jsonb,
    factor_key    text,
    factor_value  numeric,
    quantity      numeric,
    emissions_t   numeric,
    emissions_t_2 numeric,
    category      text,
    exclusion_reason text,
    source_doc    text,
    entered_by    text,
    entered_at    timestamptz,
    superseded_by_batch_id bigint references esg.import_batch(id),
    superseded_at timestamptz not null default now()
);

create index if not exists s3_line_history_ledger_idx
    on esg.s3_line_history (ledger, fiscal_year);

-- -----------------------------------------------------------------------------
-- THE MAPPING LAYER
--
-- The workbook's 'CONSTANTS - Mappings' sheet, which has no equivalent anywhere
-- in the current schema. It is what turns a dropdown value a site typed
-- ('Cement - OPC', 'Air - domestic - economy') into a factor key.
--
-- WHY THIS IS A TABLE AND NOT A LOOKUP IN CODE
--   The ESG team extends these lists every year as new materials, modes and
--   spend categories appear. A new material must be addable without a deploy,
--   and — more importantly — an UNMAPPED value must be visible rather than
--   silently dropping the tonnage it carries.
--
-- THE WASTE BLOCK'S KEY IS A COMPOSITE: 'stream | route'. C&D to landfill and
-- C&D to recycling are different factors, and Cat 5's entire method is "by
-- disposal route, not to a single generated tonnage". The workbook builds this
-- key by concatenation with that exact separator; we store it the same way so
-- the two can be diffed.
-- -----------------------------------------------------------------------------
create table if not exists esg.s3_mapping (
    id            integer generated always as identity primary key,
    -- Which lookup block. Mirrors the workbook's column groups.
    block         text not null
                  check (block in ('material','freight','waste','spend','travel','commute','refrigerant','hsn')),
    -- The value as it appears in the dropdown / on the input sheet. Matched
    -- case-insensitively at resolve time, but stored as printed.
    lookup_key    text not null,
    -- The esg.constant this resolves to. Text FK by key rather than id, because
    -- the seed order (mappings may load before constants) and the workbook's own
    -- vocabulary both speak in keys.
    factor_key    text not null,
    -- The second factor, where the block carries one. Travel modes have a
    -- well-to-tank factor; everything else leaves this null. The hotel row
    -- points at EF-ZERO rather than null, because "no WTT applies" is a
    -- decision that should be visible, not an absence.
    factor_key_2  text,
    -- 'hsn' block only: the spend category an HSN/SAC chapter suggests. This
    -- block does not resolve to a factor directly — it helps a human classify
    -- the SAP extract, and its factor_key is the spend category's factor.
    suggested_value text,
    is_active     boolean not null default true,
    notes         text,
    created_at    timestamptz not null default now(),
    unique (block, lookup_key)
);

create index if not exists s3_mapping_block_idx on esg.s3_mapping (block) where is_active;

-- -----------------------------------------------------------------------------
-- FACTOR PROVENANCE
--
-- Four columns the workbook's register carries and esg.constant does not. All
-- four are assurance-relevant, and reference_year is not cosmetic: the spend
-- method deflates reporting-year rupees back to the EXIOBASE reference year, so
-- getting that year wrong scales Category 1 silently.
-- -----------------------------------------------------------------------------
alter table esg.constant
    add column if not exists version           text,   -- 'SFC India Defaults v1.0'
    add column if not exists reference_year    text,   -- EXIOBASE 2019, DEFRA 2025
    add column if not exists geography         text,   -- 'India', 'UK factor used as proxy'
    add column if not exists data_quality_tier text,   -- 'Tier 2 - country average'
    -- Which IPCC assessment report a GWP comes from. The existing GWP_REFRIG
    -- constants are AR4; the Scope 3 workbook uses AR6, and R22 is 1810 in one
    -- and 1760 in the other. Two GWP sets cannot both be 'GWP.r22' — the keys
    -- are suffixed (.ar6) AND this column records the set, because the CONTROL
    -- sheet discloses which was used and the model has to be able to say.
    add column if not exists assessment_report text;

comment on column esg.constant.reference_year is
    'The year the factor''s underlying data describes. For EF-SPD-* this MUST match the EXIOBASE reference year on the CONTROL sheet — the spend deflator converts reporting-year rupees to this year''s price level, and a mismatch scales Category 1 with no visible symptom.';

-- -----------------------------------------------------------------------------
-- Drill-down view: a line, with its site, period and factor resolved.
--
-- The question this answers is the assurance question — "show me the purchase
-- orders behind Category 1" — and it is a join every caller would otherwise
-- write by hand.
-- -----------------------------------------------------------------------------
create or replace view esg.v_s3_line_detail as
select
    l.id,
    l.ledger,
    lg.label            as ledger_label,
    lg.sheet_name,
    l.fiscal_year,
    l.line_no,
    s.code              as site_code,
    s.name              as site_name,
    p.month_label,
    l.category,
    l.exclusion_reason,
    l.quantity,
    l.quantity_unit,
    l.factor_key,
    l.factor_value,
    c.label             as factor_label,
    c.is_assumption     as factor_is_assumption,
    c.data_quality_tier,
    l.emissions_t,
    l.emissions_t_2,
    l.attrs,
    l.source_doc,
    l.entered_by,
    l.entered_at
from        esg.s3_line l
join        esg.s3_ledger lg on lg.code = l.ledger
left join   esg.site    s on s.id = l.site_id
left join   esg.period  p on p.id = l.period_id
left join   esg.constant c on c.key = l.factor_key
where       l.superseded_at is null;

-- Grants mirror APPLY_THIS_IN_SQL_EDITOR.sql.
grant usage on schema esg to anon, authenticated, service_role;
grant all on esg.s3_ledger, esg.s3_line, esg.s3_line_history, esg.s3_mapping
    to anon, authenticated, service_role;
grant all on all sequences in schema esg to anon, authenticated, service_role;
grant select on esg.v_s3_line_detail to anon, authenticated, service_role;

notify pgrst, 'reload schema';
