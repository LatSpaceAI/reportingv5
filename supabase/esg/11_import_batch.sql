-- =============================================================================
-- BIRLA ESTATES — SPREADSHEET IMPORT
--
-- Until now the only way a monthly site return reached the database was for the
-- central ESG team to retype it into /data-collection/site-return. The returns
-- arrive as Excel files, so this layer lets one be uploaded, parsed, reviewed
-- and committed — without giving up any of the guarantees the manual path has.
--
-- WHY A BATCH TABLE RATHER THAN JUST WRITING input_value
--
--   Auditability.  A disclosure that came out of a spreadsheet has to be
--   traceable back to the cell it came from. import_batch_row keeps one row per
--   parsed cell — its address, the label as printed, the text as typed, and
--   what we made of it — so "where did 0.058 MT come from?" is answerable
--   forever, not just until someone edits the sheet.
--
--   Supersession.  Re-uploading a month must not destroy what was there. The
--   previous input_value rows are stamped superseded_at and the new batch
--   points back at the one it replaced, so the logbook can show both.
--
--   Review before commit.  A preview parses and validates but writes nothing.
--   Only an explicit approve creates a batch in 'committed' state.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   Committing an import does NOT submit the return. status stays 'draft'
--   until a human submits it explicitly, because an uploaded file is evidence
--   that someone typed something, not evidence that anyone checked it. Only a
--   submitted return counts toward coverage and feeds the resolver.
-- =============================================================================

set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- One uploaded file, scoped to exactly one site-month.
--
-- The importer refuses workbooks containing more than one monthly sheet, so a
-- batch is always (file, sheet) -> (site, period). Aurora's historic 17-sheet
-- file was loaded by the seed scripts and is not re-importable through this
-- path by design.
-- -----------------------------------------------------------------------------
create table if not exists esg.import_batch (
    id            bigint generated always as identity primary key,
    site_id       smallint not null references esg.site(id),
    period_id     integer  not null references esg.period(id),

    filename      text not null,
    sheet_name    text,
    -- SHA-256 of the uploaded bytes. Lets the UI say "you already imported
    -- this exact file on 3 March" rather than silently making a second batch.
    file_hash     text,

    status        text not null default 'preview'
                  check (status in ('preview','committed','discarded')),

    -- Counts from the parse, kept so the logbook can summarise a batch without
    -- re-reading every row.
    row_count       integer not null default 0,
    matched_count   integer not null default 0,
    unmatched_count integer not null default 0,

    -- The batch this one replaced, when a month was re-uploaded. Null for a
    -- first import. Chains, so three uploads leave a walkable history.
    superseded_batch_id bigint references esg.import_batch(id),

    uploaded_by   text,
    uploaded_at   timestamptz not null default now(),
    committed_at  timestamptz,
    note          text
);

create index if not exists import_batch_site_period_idx
    on esg.import_batch (site_id, period_id);
create index if not exists import_batch_status_idx
    on esg.import_batch (status, uploaded_at desc);

-- -----------------------------------------------------------------------------
-- One row per cell the parser looked at — matched or not.
--
-- Unmatched rows are recorded too. A label the importer could not place is the
-- single most useful thing to see when a site quietly revises its form: the row
-- is preserved with match_confidence = 'unmatched' rather than dropped, so the
-- gap is visible instead of silently absent from the disclosure.
-- -----------------------------------------------------------------------------
create table if not exists esg.import_batch_row (
    id            bigint generated always as identity primary key,
    batch_id      bigint not null references esg.import_batch(id) on delete cascade,

    -- Where in the sheet this came from: 'F13', 'B27'.
    sheet_cell    text,
    -- The label exactly as printed in the file, typos included. This is what
    -- was matched against site_form_field.label.
    source_label  text,
    -- The cell's content as typed: '58 kg', 'Nil', '1345'.
    raw_text      text,

    -- Which form row it resolved to, and how confident that match was:
    --   'exact'      label matched character for character
    --   'normalised' matched after lowercasing and collapsing whitespace
    --   'fuzzy'      matched on a curated alias (see importWorkbook.ts)
    --   'unmatched'  no form row claims this label
    matched_field_id integer references esg.site_form_field(id),
    match_confidence text not null default 'unmatched'
                     check (match_confidence in ('exact','normalised','fuzzy','unmatched')),

    -- The number as it appeared on the form, before the field's unit factor.
    parsed_value     numeric,
    unit_factor      numeric,
    -- parsed_value * unit_factor: the value in the model's canonical unit.
    canonical_value  numeric,
    -- The file said 'NA' / 'Nil' — no figure exists, which is not a zero.
    is_not_available boolean not null default false,

    -- Set when the reviewer changed the parsed number before committing. Keeps
    -- the machine's reading and the human's correction side by side.
    edited_value     numeric,
    edited_by        text
);

create index if not exists import_batch_row_batch_idx
    on esg.import_batch_row (batch_id);

-- -----------------------------------------------------------------------------
-- Link input_value back to the import it came from, and mark superseded rows.
--
-- superseded_at is how a re-upload keeps history: rather than deleting the old
-- figure, it is stamped and left in place. Every read path filters on
-- superseded_at is null, so the current value is unambiguous while the previous
-- one stays available to the logbook.
-- -----------------------------------------------------------------------------
alter table esg.input_value
    add column if not exists import_batch_id bigint references esg.import_batch(id),
    add column if not exists superseded_at   timestamptz;

create index if not exists input_value_batch_idx
    on esg.input_value (import_batch_id);

-- The (site, period, parameter) uniqueness constraint has to survive
-- supersession. Superseded rows are moved into a history table rather than
-- kept alongside the live one, so the original unique constraint still holds.
create table if not exists esg.input_value_history (
    id              bigint generated always as identity primary key,
    site_id         smallint not null references esg.site(id),
    period_id       integer  not null references esg.period(id),
    parameter_id    integer  not null references esg.input_parameter(id),
    value_num       numeric,
    is_not_available boolean not null default false,
    provenance      text,
    raw_text        text,
    comment         text,
    source_doc      text,
    entered_by      text,
    entered_at      timestamptz,
    -- The batch that REPLACED this value (null when a manual edit replaced it).
    superseded_by_batch_id bigint references esg.import_batch(id),
    superseded_at   timestamptz not null default now()
);

create index if not exists input_value_history_site_period_idx
    on esg.input_value_history (site_id, period_id);

-- -----------------------------------------------------------------------------
-- Logbook feed: one row per site-month that has data, newest first.
--
-- The logbook needs "who entered what, for which site, when, and from where"
-- in one query. Joining input_value per row in the page would be N+1; this
-- view aggregates the counts and leaves the detail to an on-demand fetch when
-- a row is expanded.
-- -----------------------------------------------------------------------------
create or replace view esg.v_logbook_entries as
select
    s.id                         as site_id,
    s.code                       as site_code,
    s.name                       as site_name,
    p.id                         as period_id,
    p.fiscal_year,
    p.month_no,
    p.month_label,
    coalesce(sub.status, 'draft') as status,
    count(iv.id)                 as value_count,
    count(*) filter (where iv.provenance = 'imported')  as imported_count,
    count(*) filter (where iv.provenance = 'parsed')    as parsed_count,
    count(*) filter (where iv.is_not_available)         as na_count,
    max(iv.updated_at)           as last_updated_at,
    -- Whoever touched it most recently is who the logbook credits.
    (array_agg(iv.entered_by order by iv.updated_at desc nulls last))[1] as last_entered_by,
    (array_agg(iv.source_doc  order by iv.updated_at desc nulls last)
        filter (where iv.source_doc is not null))[1]    as source_doc,
    max(iv.import_batch_id)      as import_batch_id,
    (select count(*) from esg.data_flag df
      where df.site_id = s.id and df.period_id = p.id
        and df.acknowledged_at is null)                 as open_flag_count
from        esg.input_value iv
join        esg.site   s   on s.id = iv.site_id
join        esg.period p   on p.id = iv.period_id
left join   esg.site_submission sub
       on   sub.site_id = iv.site_id and sub.period_id = iv.period_id
where       iv.superseded_at is null
group by    s.id, s.code, s.name, p.id, p.fiscal_year, p.month_no, p.month_label, sub.status;

-- -----------------------------------------------------------------------------
-- The anomaly tolerance, as a constant rather than a literal in the code.
--
-- ±20% is a starting point, not a finding. Once the ESG team has seen a few
-- months of flags they will want it moved, and moving it should be an UPDATE
-- rather than a deploy. loadAnomalyTolerance() falls back to 0.2 if this row
-- is missing, so the check still works on a database that predates it.
-- -----------------------------------------------------------------------------
insert into esg.constant_category (code, name) values
    ('DATA_QUALITY', 'Data-quality thresholds')
on conflict (code) do nothing;

insert into esg.constant (key, category, label, value, unit, source, is_assumption, notes) values
('qa.anomaly_tolerance', 'DATA_QUALITY',
 'Anomaly tolerance vs the prior period', 0.20, 'fraction',
 'Set with the ESG team at build time', true,
 'An uploaded value more than this far from the same month last year is flagged for review. Compared against the same month of the previous fiscal year where one exists, otherwise the most recent month filed; the flag always states which. Never blocks a save.')
on conflict (key) do nothing;

-- Grants mirror APPLY_THIS_IN_SQL_EDITOR.sql. Re-run that file after this one
-- if PostgREST reports a missing table.
grant usage on schema esg to anon, authenticated, service_role;
grant all on esg.import_batch, esg.import_batch_row, esg.input_value_history
    to anon, authenticated, service_role;
grant all on all sequences in schema esg to anon, authenticated, service_role;
grant select on esg.v_logbook_entries to anon, authenticated, service_role;

notify pgrst, 'reload schema';
