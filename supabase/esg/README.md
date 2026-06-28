# ESG Data Tool — Supabase schema

Four-layer database modelling the **ESG DATA TOOL 1.0 Consolidated** workbook
(Sagar Cements multi-plant GCCA/GRI monthly carbon-accounting model).

```
CONSTANTS ──┐
            ├──> FORMULAS (OUTPUT = f(INPUT, CONSTANT, OUTPUT)) ──> OUTPUT
INPUT ──────┘
```

## Layers

| Layer | Tables | What it holds |
|-------|--------|---------------|
| **CONSTANTS** | `constant`, `constant_category` | Emission factors (IPCC / CSI-GCCA / CEA grid 0.716), GWPs, molecular weights, conversions. Keyed; versionable via `effective_from/to`. |
| **INPUT** | `input_parameter`, `input_value` | Dictionary of every Input-Sheet field + the entered values (long/EAV: one row per plant × period × parameter). |
| **OUTPUT** | `output_parameter`, `output_value` | Catalogue of every computed metric (Scope 1/2/3, energy KPIs, water, waste, biodiversity, air) + computed values. |
| **FORMULAS** | `formula`, `formula_dependency` | Data-driven registry. Each output has one parseable expression referencing `in:`/`const:`/`out:` keys. Dependencies auto-extracted for topo-sort & validation. |

Dimensions: `plant` (6 sites + GROUP), `period` (fiscal Apr–Mar months + YTD + baseline), `domain`.

## File order (run top to bottom)

1. `01_schema.sql` — all tables, indexes, FKs, `v_formula_catalogue` view
2. `02_constants_seed.sql` — emission factors, GWPs, mol. weights, constants
3. `03_dimensions_seed.sql` — plants + periods
4. `04_input_parameters_seed.sql` — input dictionary
5. `05_output_parameters_seed.sql` — output catalogue
6. `06_formulas_seed.sql` — formula registry
7. `07_formula_dependencies.sql` — auto-build dependency edges + validation views

## How the FORMULAS layer works

Each `formula.expression` is a string using namespaced tokens:

| Token | Reads from |
|-------|-----------|
| `in:<key>` | `input_value` (for the current plant+period) |
| `const:<key>` | `constant.value` |
| `out:<key>` | `output_value` (an already-computed output — enables chaining) |

Example (Scope 2):
```
(in:pwr.grid_total - in:pwr.onsite_export) * const:EF.grid_2023
```

`eval_order` (ascending) gives a safe evaluation sequence so every `out:`
reference is already computed before it is read. `formula_dependency` plus
`v_formula_dag_edges` let you re-derive / verify the topological order.

Allowed in expressions: `+ - * / ( )`, `IF(cond,a,b)`, `IFERROR(expr,fallback)`,
`MAX`, `MIN`. The evaluator lives in app/edge-function code (see
`08_resolver_notes.md`). Postgres only stores + validates; it does not eval.

## Validation (must be clean)

After loading all files:
```sql
select * from esg.v_formula_missing_refs;   -- expect 0 rows (every ref exists)
select * from esg.v_formula_dag_edges;      -- inspect output->output edges; must be acyclic
select * from esg.v_formula_catalogue;      -- browse every formula + its deps
```

## Scope notes / what to extend

The model is **structurally complete** and the core chains are faithful to the
workbook. Two areas are intentionally seeded with a *representative* subset and
should be expanded to 1:1 parity before production:

- **Fuel lists.** The workbook enumerates ~22 fossil + ~9 alternate + ~10
  biomass fuels for **each** of Kiln / CPP / HAG. Inputs and the fuel-energy /
  fuel-CO₂ formulas are seeded for the fuels that actually carry data in the
  sample month; add the remaining `fuel.<loc>.<fuel>.qty/.lhv` inputs and append
  their terms to `en.energy_*` and `emis.fuel_*` expressions (same pattern).
- **CPP / HAG fuel CO₂ & energy** outputs are seeded as `'0'` placeholders —
  wire them exactly like the kiln ones once their inputs are added.
- **Other-source GWPs** (`EF.other.*`) were **blank in the source workbook**;
  seeded as 0 placeholders. Supply the plant's chosen GWP100 values.

See `08_resolver_notes.md` for the fuel-CO₂ unit reconciliation and a reference
resolver algorithm.
