-- =============================================================================
-- BIRLA ESTATES — CONSTANT REVISIONS, RESOLVER RUNS, AND STALENESS
--
-- Makes esg.constant editable from the app, which it has never been. That is a
-- change in kind, not degree: the combustion factors are documented assumptions
-- (diesel 2.65 / petrol 2.30 give Scope 1 of 603.82 tCO2e against a published
-- 589.11, +2.5%), so the edit that finally resolves that gap MOVES A PUBLISHED
-- FIGURE. It has to be defensible in assurance a year later: who changed it,
-- from what, to what, and why.
--
-- WHY AN AUDIT TABLE AND NOT JUST constant.updated_at
--   updated_at answers "when". It never answers "from what" or "why", and a
--   factor that moved 2.65 -> 2.58 with no recorded reason is indistinguishable
--   from a typo.
--
-- WHY STALENESS IS DERIVED AND NOT A COLUMN ON output_value
--   scripts/resolve-birla.mjs writes with
--       .upsert(rows, { onConflict: 'site_id,period_id,parameter_id' })
--   and never deletes. Postgres leaves unmentioned columns untouched on
--   conflict, so an is_stale column would latch on permanently after the first
--   edit unless the resolver were taught to clear it. Rather than put the
--   correctness of a settings page inside the script that produces every
--   published figure, staleness is COMPUTED on read: the newest
--   constant.updated_at among constants that actually feed a formula, against
--   the newest successful resolver_run.finished_at.
--
-- Apply after 11_import_batch.sql. Then re-run APPLY_THIS_IN_SQL_EDITOR.sql if
-- PostgREST reports a missing table.
-- =============================================================================

set search_path = esg, public;

-- -----------------------------------------------------------------------------
-- constant.updated_at — the left side of the staleness comparison.
--
-- Backfilled from created_at so a database that predates this migration does
-- not read as "every constant edited just now" and mark everything stale on
-- first page load.
-- -----------------------------------------------------------------------------
alter table esg.constant
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists updated_by text;

-- ORDERING IS DELIBERATE: this backfill runs BEFORE constant_set_updated_at is
-- created below. With the trigger already in place it would be self-defeating —
-- the trigger fires BEFORE UPDATE and stamps updated_at = now(), so every row
-- would land on now() instead of created_at and every constant would read as
-- freshly edited. Do not move the trigger above this statement.
update esg.constant set updated_at = created_at where updated_at > created_at;

-- Reuses the shared fn from 10_dashboard_tiles.sql; re-declared (create or
-- replace, identical body) so this file can be applied standalone.
create or replace function esg.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists constant_set_updated_at on esg.constant;
create trigger constant_set_updated_at
    before update on esg.constant
    for each row execute function esg.set_updated_at();

-- -----------------------------------------------------------------------------
-- One row per edit. APPEND-ONLY: a revert writes a NEW row whose new_value is
-- the old one. An audit trail you can delete from is not an audit trail.
--
-- old_/new_ pairs cover is_assumption as well as the value, because "the ESG
-- team confirmed 2.65" is a change of the same consequence as changing the
-- number — it is what moves a figure from indicative to disclosable. Confirming
-- WITHOUT changing the value is therefore a legitimate edit, and writes a row
-- with old_value = new_value.
-- -----------------------------------------------------------------------------
create table if not exists esg.constant_revision (
    id              bigint generated always as identity primary key,
    constant_id     integer not null references esg.constant(id) on delete cascade,
    -- Denormalised so history survives a rename and the history view needs no
    -- join back to esg.constant.
    constant_key    text not null,

    old_value       numeric,
    new_value       numeric not null,
    old_is_assumption boolean,
    new_is_assumption boolean,
    old_source      text,
    new_source      text,
    old_source_date text,
    new_source_date text,

    -- Why. Enforced by the API (minimum 8 characters), not by the DDL, so a
    -- migration can still write a row.
    reason          text,

    change_kind     text not null default 'edit'
                    check (change_kind in ('edit','revert','seed')),
    reverted_revision_id bigint references esg.constant_revision(id),

    -- The blast radius AS COMPUTED AT THE MOMENT OF THE EDIT. Stored rather
    -- than recomputed for display: the formula registry can change, and what
    -- the user was shown and agreed to must stay recoverable even if EF.diesel
    -- later feeds a different set of outputs.
    affected_output_keys text[],
    affected_row_count   integer,

    changed_by      text,
    changed_at      timestamptz not null default now()
);

create index if not exists constant_revision_constant_idx
    on esg.constant_revision (constant_id, changed_at desc);
create index if not exists constant_revision_changed_idx
    on esg.constant_revision (changed_at desc);

-- -----------------------------------------------------------------------------
-- One row per resolver run — the right side of the staleness comparison, and
-- the only new thing the resolver itself has to do. Without it, "are the
-- computed figures current?" is unanswerable.
-- -----------------------------------------------------------------------------
create table if not exists esg.resolver_run (
    id              bigint generated always as identity primary key,
    trigger_source  text not null default 'cli'
                    check (trigger_source in ('cli','ui')),
    -- Null = every fiscal year. Set when --fy narrowed the run, which matters:
    -- a run narrowed to FY2024-25 does not refresh FY2023-24, so staleness must
    -- not be cleared for years it never touched.
    fiscal_year     text,
    status          text not null default 'running'
                    check (status in ('running','succeeded','failed')),
    rows_written    integer,
    dry_run         boolean not null default false,
    error_message   text,
    -- Provenance for rows the SYSTEM created rather than a real run (the
    -- baseline row below). Kept separate from error_message so a 'succeeded'
    -- row never carries text in an error field — that reads as a bug to
    -- whoever finds it in two years.
    note            text,
    triggered_by    text,
    started_at      timestamptz not null default now(),
    finished_at     timestamptz
);

create index if not exists resolver_run_finished_idx
    on esg.resolver_run (finished_at desc nulls last);

-- -----------------------------------------------------------------------------
-- Which outputs does a constant reach, directly or transitively?
--
-- Direct hits come from esg.formula_dependency, which is indexed on
-- (ref_kind, ref_key). The closure then walks esg.v_formula_dag_edges — the
-- output->output edge set 01_schema.sql already maintains for its acyclicity
-- check, which is exactly the right edge set for this.
--
-- depth is returned so the UI can show the directly-hit output before the
-- totals that roll it up: "EF.diesel changes ghg.scope1_diesel, which changes
-- ghg.total two hops later".
--
-- CYCLE PROTECTION IS NOT OPTIONAL. v_formula_dag_edges is asserted acyclic by
-- a commented-out validation query at the foot of 07_formulas_seed.sql — i.e.
-- by convention, not by a constraint. A settings page must not hang because
-- somebody wrote a circular formula.
--
-- CAVEAT, and the reason the application ALSO recomputes this from
-- formula.expression: formula_dependency has no trigger. Its only writer is the
-- manual DELETE+INSERT block at 07_formulas_seed.sql:284-293, whose own comment
-- says to regenerate it after any expression change. If an expression is edited
-- in the SQL editor without re-running that block, this function silently
-- UNDER-reports. See src/lib/esgConstants/blastRadius.ts.
-- -----------------------------------------------------------------------------
create or replace function esg.fn_constant_blast_radius(p_constant_key text)
returns table (output_key text, depth integer)
language sql stable as $$
    with recursive direct as (
        select f.output_key
        from   esg.formula_dependency d
        join   esg.formula f on f.id = d.formula_id
        where  d.ref_kind = 'constant'
          and  d.ref_key  = p_constant_key
          and  coalesce(f.is_active, true)
    ),
    closure as (
        select output_key, 0 as depth from direct
        union
        select e.to_output, c.depth + 1
        from   closure c
        join   esg.v_formula_dag_edges e on e.from_output = c.output_key
        -- Belt and braces alongside UNION's dedup: 60 formulas cannot
        -- legitimately nest 20 deep.
        where  c.depth < 20
    )
    select output_key, min(depth)::integer
    from   closure
    group  by output_key;
$$;

-- -----------------------------------------------------------------------------
-- Seed provenance: one 'seed' revision per existing constant, so every value
-- has a first row and the history view is never empty.
-- -----------------------------------------------------------------------------
insert into esg.constant_revision
    (constant_id, constant_key, old_value, new_value,
     old_is_assumption, new_is_assumption, new_source, new_source_date,
     reason, change_kind, changed_by, changed_at)
select c.id, c.key, null, c.value,
       null, c.is_assumption, c.source, c.source_date,
       'Initial seeded value (02_constants_seed.sql / 11_import_batch.sql).',
       'seed', 'seed', c.created_at
from   esg.constant c
where  not exists (select 1 from esg.constant_revision r where r.constant_id = c.id);

-- -----------------------------------------------------------------------------
-- A baseline run, so a database that was already resolved but predates this
-- table does not read as "never resolved" and mark every constant stale on
-- first load.
--
-- WHY now() AND NOT max(output_value.computed_at)
--   computed_at carries `default now()`, which fires on INSERT only. The
--   resolver upserts and — before this migration's companion change to
--   resolve-birla.mjs — never wrote the column at all, so on a pre-existing
--   database every row still holds the timestamp of its FIRST insert: the seed
--   date, not the last resolve. Using it here would backdate this row and read
--   as "everything stale". The true last-resolve time is genuinely
--   unrecoverable for such a database, so this records now() and says so.
--   Every run after this one is exact.
-- -----------------------------------------------------------------------------
insert into esg.resolver_run (trigger_source, status, rows_written, triggered_by,
                              started_at, finished_at, note)
select 'cli', 'succeeded', count(*), 'baseline', now(), now(),
       'Baseline row created by 12_constant_revision.sql. The time of the last '
       || 'resolver run before this migration is not recoverable: '
       || 'output_value.computed_at held first-insert timestamps only, because '
       || 'the resolver upserts and did not write the column until this change.'
from   esg.output_value
having count(*) > 0
   and not exists (select 1 from esg.resolver_run);

-- -----------------------------------------------------------------------------
-- v_constant_settings — one row per constant, ready to render.
-- -----------------------------------------------------------------------------
create or replace view esg.v_constant_settings as
select  c.id,
        c.key,
        c.category,
        cc.name as category_name,
        c.label,
        c.value,
        c.unit,
        c.source,
        c.source_date,
        c.is_assumption,
        c.notes,
        c.updated_at,
        c.updated_by,
        -- How many formulas name this constant DIRECTLY. Zero means an edit
        -- changes no computed figure: CONV.l_to_kl and CONV.kg_to_mt are
        -- referenced by no formula at all — the real Ltrs->kL conversion lives
        -- in site_form_field.unit_factor, applied at entry time. The UI must
        -- say so rather than imply the edit will take effect.
        (select count(*) from esg.formula_dependency d
          where d.ref_kind = 'constant' and d.ref_key = c.key)   as direct_ref_count,
        (select count(*) from esg.constant_revision r
          where r.constant_id = c.id and r.change_kind <> 'seed') as edit_count
from        esg.constant c
join        esg.constant_category cc on cc.code = c.category;

-- -----------------------------------------------------------------------------
-- Grants mirror APPLY_THIS_IN_SQL_EDITOR.sql. Re-run that file after this one
-- if PostgREST reports a missing table.
-- -----------------------------------------------------------------------------
grant usage on schema esg to anon, authenticated, service_role;
grant all on esg.constant_revision, esg.resolver_run
    to anon, authenticated, service_role;
grant all on all sequences in schema esg to anon, authenticated, service_role;
grant select on esg.v_constant_settings to anon, authenticated, service_role;
grant execute on function esg.fn_constant_blast_radius(text)
    to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- VALIDATION — both queries should return the expected shape.
-- =============================================================================
-- select key, direct_ref_count, edit_count from esg.v_constant_settings order by category, key;
-- select * from esg.fn_constant_blast_radius('EF.diesel');
--   expect: ghg.scope1_diesel (0), ghg.scope1_total (1), ghg.total (2)
-- select * from esg.fn_constant_blast_radius('CONV.l_to_kl');
--   expect: zero rows — inert, referenced by no formula
