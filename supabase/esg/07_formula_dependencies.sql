-- =============================================================================
-- ESG DATA TOOL — auto-populate formula_dependency from expression tokens,
-- and validate that every referenced key exists in its layer.
-- Run AFTER 04/05/06 seeds.
-- =============================================================================
set search_path = esg, public;

-- Rebuild dependency edges by extracting in:/const:/out: tokens from each
-- formula expression. Tokens are [a-z0-9._]+ following the namespace prefix.
truncate esg.formula_dependency;

-- NB: tokens are matched as  prefix : key  where key is a dotted lowercase
-- identifier with at least one '.', so prose fragments like "in:qty" or a
-- bare "EF." cannot create spurious edges. Expressions hold no -- comments.
insert into esg.formula_dependency (formula_id, ref_kind, ref_key)
select distinct
       f.id,
       case m[1] when 'in' then 'input'
                 when 'const' then 'constant'
                 when 'out' then 'output' end,
       m[2]
from   esg.formula f,
       lateral regexp_matches(f.expression, '(in|const|out):([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)', 'g') as m;

-- ---------------------------------------------------------------------------
-- VALIDATION: surface any dependency whose key is missing from its layer.
-- Should return zero rows for a complete seed.
-- ---------------------------------------------------------------------------
create or replace view esg.v_formula_missing_refs as
select  d.formula_id,
        f.output_key,
        d.ref_kind,
        d.ref_key
from        esg.formula_dependency d
join        esg.formula f on f.id = d.formula_id
left join   esg.input_parameter  ip on d.ref_kind='input'    and ip.key = d.ref_key
left join   esg.constant         c  on d.ref_kind='constant' and c.key  = d.ref_key
left join   esg.output_parameter op on d.ref_kind='output'   and op.key = d.ref_key
where   (d.ref_kind='input'    and ip.key is null)
   or   (d.ref_kind='constant' and c.key  is null)
   or   (d.ref_kind='output'   and op.key is null);

-- ---------------------------------------------------------------------------
-- VALIDATION: detect output->output dependency cycles (none expected).
-- A correct DAG lets the resolver evaluate in eval_order safely.
-- ---------------------------------------------------------------------------
create or replace view esg.v_formula_dag_edges as
select  f.output_key as target,
        d.ref_key    as source
from    esg.formula f
join    esg.formula_dependency d on d.formula_id = f.id
where   d.ref_kind = 'output';
