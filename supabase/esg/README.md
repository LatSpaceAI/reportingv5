# Birla Estates — ESG schema

Four-layer database modelling the monthly ESG returns filed by Birla Estates
(BEPL) sites, and the BRSR Environment disclosures they roll up into.

```
CONSTANTS ──┐
            ├──> FORMULAS (OUTPUT = f(INPUT, CONSTANT, OUTPUT)) ──> OUTPUT
INPUT ──────┘
```

Replaces the earlier Sagar Cements (GCCA/GRI) model. The table design carried
over; every parameter, constant and formula is new.

## Layers

| Layer | Tables | What it holds |
|---|---|---|
| **CONSTANTS** | `constant`, `constant_category` | Grid emission factor, fuel EFs, refrigerant GWPs, unit conversions. |
| **INPUT** | `input_parameter`, `input_value`, `site_form*` | The canonical field dictionary, the entered values, and each site's own form layout. |
| **OUTPUT** | `output_parameter`, `output_value` | Every computed BRSR Environment metric + computed values. |
| **FORMULAS** | `formula`, `formula_dependency` | Data-driven registry; dependencies auto-extracted for topo-sort. |

Dimensions: `site` (11 assets + GROUP), `period` (fiscal Apr–Mar months + YTD +
baseline, carrying quarter and half buckets), `domain`.

## What differs from the cement model

**`plant` → `site`**, with the attributes real estate reports on: `asset_type`
(commercial vs residential-construction), `city`, and `water_stressed`. That
last flag is load-bearing — the BRSR stressed-area lines sum exactly the flagged
sites, via `formula.site_filter`.

**Per-site form replicas.** Three form variants are in use and they genuinely
differ: Aurora has tenant and floor-wise electricity but no C&D row; Tisya and
Sangamwadi share a residential layout; Trimaya's F-17 variant has different row
numbers, waste-water rows instead of STP, and no site/period header at all.
Rather than force one superset form on every site, each form is stored as data
(`site_form` / `site_form_field`) with its rows mapped onto shared canonical
parameters. Labels are reproduced verbatim, typos included — site teams
recognise their own sheet. Adding a site is an insert, not a deploy.

**Provenance and data quality.** `input_value` distinguishes a reported zero from
"not available", keeps the original text wherever a number was parsed out of it
(`"58 kg"` → 0.058 MT), and records who entered what and when. `data_flag`
carries validation warnings that do *not* block saving — the real returns contain
physically impossible values, and refusing them would simply stop sites filing.

**Coverage travels with every number.** `output_value` records
`sites_reporting` / `sites_expected`; `v_period_coverage` reports it per month.
There is no derived-balance mechanism: a total is the sum of what was filed, and
the gap shows as a gap.

## File order (run top to bottom)

1. `01_schema.sql` — tables, indexes, FKs, views
2. `02_constants_seed.sql` — emission factors, GWPs, conversions
3. `03_dimensions_seed.sql` — sites + periods
4. `04_input_parameters_seed.sql` — canonical field dictionary
5. `05_site_forms_seed.sql` — the three form replicas + site assignments
6. `06_output_parameters_seed.sql` — BRSR Environment metric catalogue
7. `07_formulas_seed.sql` — formula registry + auto-built dependency edges
8. `08_input_values_seed.sql` — the eight evidenced site-months
9. `09_resolver_notes.md` — evaluation algorithm and the assumptions register
10. `10_dashboard_tiles.sql` — AI Dashboard tile persistence
11. `11_import_batch.sql` — spreadsheet import, batches, supersession, logbook view
12. `12_constant_revision.sql` — editable constants, audit trail, resolver runs
13. `13_scope3_schema.sql` — Scope 3 ledgers (`s3_line`) and mappings (`s3_mapping`)
14. `14_scope3_constants.sql` — 95 emission factors + CONTROL assumptions + 111 mappings
15. `15_scope3_outputs.sql` — 11 Scope 3 category parameters + total + all-scopes total

`APPLY_THIS_IN_SQL_EDITOR.sql` handles the PostgREST grants; run it once — and
again after 13–15, since PostgREST will not see the new tables until it does.

## Scope 3 (files 13–15)

Scope 3 is a **second model**, not an extension of the Scope 1/2 one, and the two
meet only in `output_value`.

- Its inputs are **ledgers**, not monthly meter readings: up to 300 purchase-order
  lines, each carrying six correlated fields. `input_value` is unique on
  `(site, period, parameter)` — one value per slot — so they live in `esg.s3_line`
  instead. That uniqueness is load-bearing for how `commitValues` supersedes, and
  relaxing it would change every read path in the app at once.
- Its methods are **set operations** (sum over lines where tag = X), which
  `formula-eval.mjs` cannot express — it binds three token kinds each to one
  number. So Scope 3 has **no `formula` rows at all**. `scripts/resolve-scope3.mjs`
  computes it in plain JavaScript and writes category totals into `output_value`
  directly, where they are indistinguishable from any other computed figure.

```bash
npm run esg:resolve            # Scope 1 + 2, the formula DAG (unchanged)
npm run esg:resolve-scope3     # Scope 3, the ledger pass — run AFTER the above
npm run esg:test-scope3        # seed validation + 59 method unit tests, no database
```

Run order matters: `resolve-scope3.mjs` reads `ghg.total` out of `output_value` to
derive `ghg.total_all_scopes`, and skips it with a warning if the first pass has
not run.

⚠ **`ghg.total` means Scope 1 + 2 and keeps meaning that.** Every dashboard tile
and export cell reads it. The all-scopes figure is a separate key,
`ghg.total_all_scopes`.

⚠ **90 of the 95 factors are seeded `is_assumption = true`**, because the
workbook's own README says they are placeholders of the right order of magnitude
and not the published values. Any Scope 3 figure produced before they are
confirmed at `/settings/constants` is a test fixture, not a disclosure.

## How the FORMULAS layer works

Each `formula.expression` uses namespaced tokens:

| Token | Reads from |
|---|---|
| `in:<key>` | `input_value` (current site + period) |
| `const:<key>` | `constant.value` |
| `out:<key>` | `output_value` (already-computed output — enables chaining) |

Example (Scope 2):
```
out:en.electricity_nonrenew * const:EF.grid / 1000
```

`eval_order` ascending gives a safe evaluation sequence. `site_filter` restricts
which sites contribute to a GROUP rollup (`all` or `water_stressed`).

Allowed in expressions: `+ - * / ( )`, `IF(cond,a,b)`, `IFERROR(expr,fallback)`,
`MAX`, `MIN`. The evaluator lives in app code; Postgres stores and validates.

## Validation

```bash
node scripts/validate-esg-seed.mjs   # references resolve, DAG acyclic, eval_order sane
node scripts/verify-esg-model.mjs    # evaluates the seeded months vs known-good figures
```

After loading, both of these must return zero rows:

```sql
select * from esg.v_formula_missing_refs;
select * from esg.v_formula_dag_edges;   -- inspect; must be acyclic
```

## Data coverage — read this before trusting a total

The seed contains **8 evidenced site-months** out of roughly 132 in FY25 (~6%).
Four of eleven sites have ever filed a return:

| Site | Months filed |
|---|---|
| Birla Aurora | Apr–Aug 2024 |
| Birla Tisya | Apr 2024 |
| Birla Sangamwadi | Dec 2024 |
| Birla Trimaya | Feb 2025 |

The published FY25 figures cover the whole portfolio. The reconstruction reached
them by balancing against the template; this app does not, because going forward
it *is* the source. Portfolio totals here are sums of what was filed.

## Open items before assurance

Both are surfaced by the model rather than resolved in it — see
`09_resolver_notes.md`:

1. **Renewable electricity deduction.** The published template books 197,838.76
   kWh less renewable electricity than Aurora reported over Apr–Aug 24 (11–16%
   per month), for reasons that live in a file we do not have. Modelled as an
   explicit, signed `elec.renewable_adjustment` input so it stays visible and
   attributable.
2. **Groundwater classification.** Tisya's groundwater was published as
   third-party water while Trimaya's stayed groundwater. Stored as filed and
   flagged; picking either treatment unilaterally would move a published number.

Also unresolved: four hazardous-waste lines are collected as counts or litres
against MT-denominated disclosures and need a unit weight or density before they
can be computed. They are seeded as explicit zeros, not fabricated tonnages.
