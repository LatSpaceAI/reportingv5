-- =============================================================================
-- BIRLA ESTATES — REPORT BINDINGS
--
-- A binding is one sentence: "this cell of the BRSR report is THAT computed
-- metric, at THAT grain." It is what turns the Requirements tab from a
-- checklist into a wiring diagram.
--
--   quant_cell_id  'C.P6.E6.r0.currentFY'   the cell, from quantitativeCells.ts
--   output_key     'ghg.scope1_total'       the metric, from output_parameter
--   site_code      'GROUP'                  which site
--   period_kind    'ytd'                    which period, resolved per fiscal year
--
-- WHY A TABLE AND NOT localStorage
--
-- BRSR answers live in localStorage today (src/lib/storage.ts:1) and that is
-- fine for answers — they are one user's drafting. A binding is not drafting:
-- it references esg.output_parameter by key, it is the same for every user of
-- the entity, and it must survive a cleared browser or the wiring is lost. The
-- FK below is the point of the table; a localStorage binding could name a
-- metric that no longer exists and nothing would say so.
--
-- WHY THE CELL ID IS TEXT AND NOT AN FK
--
-- quant_cell_id is derived from the questionnaire SCHEMA (a TypeScript literal
-- in brsrSections.ts), not from a database table. There is nothing to point a
-- foreign key at. That asymmetry is real and worth stating: the output_key side
-- is referentially safe, the cell side is not, and it is the cell side that can
-- rot. See the fingerprint column.
--
-- THE POSITIONAL-ID HAZARD, AND WHY fingerprint EXISTS
--
-- Fixed-shape table cells are addressed positionally — 'C.P6.E6.r0.currentFY'
-- means "row INDEX 0", which quantitativeCells.ts:79 builds by walking the
-- rowLabel array. Reordering that array in brsrSections.ts silently re-points
-- every binding on that question at a different disclosure line, with no error
-- anywhere. Scope 1 would quietly become Scope 2.
--
-- So each binding stores the row's LABEL as it read when the binding was made.
-- On load, the app recomputes the label from the current schema and compares.
-- A mismatch does not auto-heal and does not silently drop the binding: it
-- flags the binding as stale and asks a human, because both "the rows moved"
-- and "the label was reworded" produce the same mismatch and they need
-- opposite responses.
--
-- Apply after 18_intensity_per_crore.sql, then re-run
-- APPLY_THIS_IN_SQL_EDITOR.sql if PostgREST reports a missing table.
-- =============================================================================

set search_path = esg, public;

create table if not exists esg.report_binding (
    id             bigint generated always as identity primary key,

    -- Which report. 'brsr' / 'cdp' — matches FrameworkSummary.id in
    -- src/lib/frameworks.ts so the client can filter without a lookup table.
    framework_id   text not null,

    -- The cell, e.g. 'C.P6.E1.r3.currentFY'. Format is owned by
    -- src/lib/quantitativeCells.ts (quantCellId). Text by necessity — the
    -- questionnaire schema is TypeScript, not a table.
    quant_cell_id  text not null,

    -- The metric. FK, so a binding cannot outlive the metric it names.
    output_key     text not null references esg.output_parameter(key)
                   on update cascade on delete restrict,

    -- WHICH SITE. Almost always 'GROUP': BRSR is an entity-level disclosure and
    -- the export already writes portfolio figures (BIRLA_ESTATES.md:254-256).
    -- Per-site is permitted because a site annexure is a plausible future ask.
    site_code      text not null default 'GROUP' references esg.site(code)
                   on update cascade,

    -- WHICH PERIOD, as a SELECTOR rather than a period_id.
    --
    -- A binding outlives a fiscal year: the same cell means "this year's YTD"
    -- every year. Pinning period_id would freeze FY25 into the wiring and force
    -- re-binding all over again each April. The reader resolves
    -- (fiscal_year, period_kind) -> period at read time.
    --
    -- 'ytd' is the BRSR annual figure. 'month' is not offered: no BRSR cell
    -- asks for a single month, and allowing it without a month number would be
    -- ambiguous.
    period_kind    text not null default 'ytd'
                   check (period_kind in ('ytd', 'baseline')),

    -- Which year this cell wants relative to the report's own year. BRSR tables
    -- are almost always two columns, current FY and previous FY, and the cell
    -- id already distinguishes them ('.currentFY' / '.previousFY') — but the
    -- id is a naming convention, not a guarantee, so the offset is explicit.
    --   0  = the report's fiscal year
    --  -1  = the year before it
    year_offset    smallint not null default 0
                   check (year_offset between -5 and 0),

    -- The row label as it read WHEN BOUND. Staleness detection; see header.
    -- Null for cells that carry no row label (FieldsQuestion cells), where the
    -- id is not positional and cannot silently re-point.
    cell_label     text,

    -- Free-text note from whoever wired it — "per assurer, uses consumption not
    -- withdrawal". Survives into the drilldown.
    note           text,

    bound_by       text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    -- ONE metric per cell. A cell showing two numbers is not a disclosure.
    -- Deliberately NOT unique on output_key: one metric legitimately serves
    -- several cells (a total appears in its own row and inside a summary).
    unique (framework_id, quant_cell_id)
);

create index if not exists report_binding_framework_idx
    on esg.report_binding (framework_id);
create index if not exists report_binding_output_idx
    on esg.report_binding (output_key);

-- esg.set_updated_at() is created by APPLY_THIS_IN_SQL_EDITOR.sql. Created here
-- too so this file applies standalone on a fresh database.
create or replace function esg.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists report_binding_updated_at on esg.report_binding;
create trigger report_binding_updated_at
    before update on esg.report_binding
    for each row execute function esg.set_updated_at();

-- -----------------------------------------------------------------------------
-- Read view — a binding with everything the Requirements tab needs to render it
-- WITHOUT a value: the metric's label, unit, whether it is an assumption, and
-- whether its formula is one.
--
-- The VALUE is deliberately not here. It depends on the report's fiscal year,
-- which the view cannot know, so joining output_value would either force a
-- fiscal year into the view or return one row per year per binding. The reader
-- resolves the period and fetches values in a second query.
-- -----------------------------------------------------------------------------
create or replace view esg.v_report_binding as
select  b.id,
        b.framework_id,
        b.quant_cell_id,
        b.output_key,
        b.site_code,
        b.period_kind,
        b.year_offset,
        b.cell_label,
        b.note,
        b.bound_by,
        b.created_at,
        b.updated_at,
        op.label          as output_label,
        op.unit           as output_unit,
        op.scope          as output_scope,
        op.frequency      as output_frequency,
        op.is_intensity,
        f.expression      as formula_expression,
        -- True when the metric rests on a rule the ESG team has not confirmed,
        -- or on a constant that is still a placeholder. Either way the figure
        -- is arithmetic rather than a disclosure, and the cell should say so.
        coalesce(f.is_assumption, false) as formula_is_assumption,
        exists (
            select 1
            from   esg.formula_dependency d
            join   esg.constant           c on c.key = d.ref_key
            where  d.formula_id = f.id
              and  d.ref_kind   = 'constant'
              and  c.is_assumption
        ) as rests_on_assumed_constant
from        esg.report_binding   b
join        esg.output_parameter op on op.key = b.output_key
left join   esg.formula          f  on f.output_key = b.output_key;

-- =============================================================================
-- Grants, mirroring APPLY_THIS_IN_SQL_EDITOR.sql. The default privileges set
-- there cover tables created afterwards, but the view needs an explicit grant.
-- =============================================================================
grant select, insert, update, delete on esg.report_binding to service_role;
grant select on esg.report_binding to anon, authenticated;
grant select on esg.v_report_binding to service_role, anon, authenticated;
grant usage, select on all sequences in schema esg to service_role;

notify pgrst, 'reload schema';
