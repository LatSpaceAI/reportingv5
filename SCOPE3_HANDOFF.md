# Getting Scope 3 into the output — handover

Written 12 Aug 2026, after the standard input template, standard output workbook
and constants settings page were built and verified.

**Read `BIRLA_ESTATES.md` first.** This document assumes it.

---

## Why this document exists

The four features just built (see *What already exists* below) all operate on the
`esg` schema as it stands, which models **Scope 1 and Scope 2 only**:

```
output_parameter WHERE scope IS NOT NULL   ->  5 × scope1, 1 × scope2, 0 × scope3
```

The client's `birla-estates/Birla Estates - Scope 3 Calculator (Template) v1.0.xlsx`
— 23 sheets, 9 GHG Protocol categories, 95 emission factors — has **no counterpart
in the platform**. Nothing in `src/` or `supabase/` references Scope 3 except
questionnaire *labels* in `brsrSections.ts` and `cdpSections.ts` (legacy, untouched).

So "add Scope 3 to the output" is not a reporting change. It is a second model of
roughly the size of the first, and it needs two schema changes that the existing
one cannot absorb. Those are in *The two blockers*, and they should be settled
before any seeding starts.

---

## What already exists and is reusable

Good news first: none of the recent work is scope-specific. Everything is keyed on
`input_parameter` / `output_parameter` / `constant` rows, not on what those rows
describe. Adding Scope 3 rows makes all of it work on Scope 3 with no code change:

| Component | Reuse |
|---|---|
| `src/lib/esgCommit/commitValues.ts` | The four persistence guarantees. Path-agnostic. |
| `src/lib/standardTemplate/` | Generates and parses the input template from `input_parameter`. A 58th parameter appears with no code change — and so would a 118th. |
| `src/lib/esgConstants/` | Settings page, blast radius, audit trail. Works for any `constant` row, so 95 Scope 3 factors get the confirm-and-audit workflow immediately. |
| `src/lib/standardOutput/` | The 9-sheet exporter. Sheet from `domain`, grain from `frequency`, sectioning from `scope`. |
| `scripts/resolve-birla.mjs` | The formula DAG evaluator — **for scalar formulas only**, see blocker 2. |

The constants settings page is the single biggest win. **90 of the workbook's 95
factors are marked `INDICATIVE`** and its own README says no figure may be
disclosed until each is confirmed against its cited source. That is exactly the
workflow the settings page implements — an audit trail, a mandatory reason, and an
`is_assumption` flag the ESG team can clear one factor at a time.

---

## The two blockers

Neither is hard to fix. Both are impossible to work around, and both are cheaper to
decide now than to discover halfway through seeding.

### Blocker 1 — `input_value` cannot hold a line-item ledger

```sql
-- 01_schema.sql:304
unique (site_id, period_id, parameter_id)
```

One value per parameter per site-month. That fits a monthly site return exactly,
which is what it was built for.

Scope 3 is not shaped like that. Its input sheets are **ledgers**:

| Sheet | Grain | Rows |
|---|---|---|
| INPUT 1 Procurement | one purchase-order line | up to 300 |
| INPUT 2 Materials | material × supplier × project | up to 200 |
| INPUT 3 Inbound Freight | one delivery | up to 200 |
| INPUT 6 Business Travel | one trip | up to 150 |
| INPUT 8 Sold Products | one project handover | up to 50 |
| INPUT 9 Leased Assets | property × month | up to 150 |

A single purchase order carries supplier, HSN code, quantity, value, a Scope 3 tag
and a spend category — six correlated fields on one row, with 300 such rows. There
is no way to express that as `(site, period, parameter) -> number`.

**Recommendation: a new table, not a change to `input_value`.**

```sql
create table esg.s3_line (
    id            bigint generated always as identity primary key,
    ledger        text not null,           -- 'procurement' | 'materials' | ...
    site_id       smallint references esg.site(id),
    period_id     integer  references esg.period(id),
    line_no       integer,                 -- the sheet's own Line ID
    -- The row's fields, as filed. Typed columns for what every ledger shares;
    -- jsonb for what only one of them has.
    attrs         jsonb not null,
    -- Resolved during computation, not entry.
    factor_key    text,
    quantity      numeric,
    emissions_t   numeric,
    import_batch_id bigint references esg.import_batch(id),
    unique (ledger, site_id, period_id, line_no)
);
```

Why a new table rather than relaxing the constraint on `input_value`:

- `input_value`'s uniqueness is load-bearing for supersession. `commitValues`
  archives to `input_value_history` and then deletes so the new import owns the
  slot outright — that logic is only correct because a slot holds one row.
- Every read path in the app (`resolve-birla.mjs`, the dashboard, the export)
  assumes one value per slot. Relaxing it would change all of them at once.
- The monthly-return model genuinely is one-value-per-slot and should stay that
  way. Scope 3 ledgers are a different shape and deserve their own table.

**Do NOT put the Scope 3 ledgers through `commitValues`.** It is built for
`Map<parameterKey, AccumulatedValue>` and would need to become something else.
Write a sibling — `s3Commit.ts` — reusing the same *guarantees* (no silent
overwrite, history before write, draft status, non-blocking validation) but its own
shape. Extract them only if the second implementation actually wants to share code;
a premature abstraction over two dissimilar ledgers will be worse than two clear
modules.

### Blocker 2 — the formula engine has no aggregation

`scripts/lib/formula-eval.mjs` is a safe scalar expression parser: numbers,
strings, comparison, arithmetic, and three token kinds (`in:`, `const:`, `out:`)
that each bind to **one number**. The resolver binds them per site × month
(`resolve-birla.mjs:225,243,296`).

Scope 3 needs set operations over the ledgers. Every category does:

```
Cat 1 spend      SUM over procurement lines WHERE tag='Cat 1'  of value/fx/deflator × EF(spend_category)
Cat 1 materials  SUM over material lines                       of tonnes × EF(material_type or supplier EPD)
Cat 4 freight    SUM over delivery lines                       of tonnes × km × circuity × EF(vehicle)
Cat 5 waste      SUM over waste lines                          of tonnes × EF(stream|route)
Cat 7 commute    SUM over survey modes of respondents × km × ... × EF(mode), then × headcount/respondents
Cat 11 sold       SUM over handovers                            of area × conversion × EPI × lifetime × grid EF
```

None of that is expressible as a scalar expression, and **`formula-eval.mjs` should
not be extended to do it.** It is deliberately not `eval`, its safety comes from a
tiny grammar, and adding SUMIFS-style aggregation over a joined ledger would make
it a query language — with the security property that matters (expressions come
from a database table) much harder to reason about.

**Recommendation: compute Scope 3 in a dedicated pass, not in the formula DAG.**

`scripts/resolve-scope3.mjs`, run after `resolve-birla.mjs`:

1. Read each ledger, resolve each line's factor via the mapping tables.
2. Compute per-line emissions in JS — plain arithmetic, no expression parser.
3. Sum to category totals and write them into `output_value` as ordinary rows
   against new `output_parameter` records.

The formula DAG then never sees a ledger, and the Scope 3 category totals appear in
`output_value` looking exactly like any other computed figure — which means the
standard output exporter, the dashboard and the BRSR export pick them up with no
change. Write the per-line results to `s3_line.emissions_t` so a disclosure can be
traced back to the purchase order that produced it, which is what an assurer will
ask for.

---

## What to build, in order

### 1. Decide the two blockers above

They are the only decisions that constrain everything downstream. Everything else
is data entry.

### 2. Seed the reference data — `13_scope3_constants.sql`

95 factors from `CONSTANTS - Emission Factors`. The `esg.constant` table already
has `source`, `source_date`, `is_assumption` and `notes`, so most of the workbook's
register maps straight across. Four columns are missing and matter for assurance:

```sql
alter table esg.constant
    add column if not exists version        text,   -- 'SFC India Defaults v1.0'
    add column if not exists reference_year text,   -- EXIOBASE 2019, DEFRA 2025
    add column if not exists geography      text,   -- IN / GB / global
    add column if not exists data_quality_tier text; -- 'Tier 2 - country average'
```

`reference_year` is not cosmetic: the spend method deflates reporting-year rupees
back to the EXIOBASE reference year, and getting that year wrong scales Category 1
silently.

**Seed all 90 indicative factors with `is_assumption = true`.** The settings page
then shows the ESG team a working list of 90 with a confirm action each, which is
precisely the workbook's own instruction ("open each cited source, enter the real
figure, change the status to Confirmed"). Do not seed them as confirmed to make a
validation pass go green.

New categories needed in `constant_category`:

```
EF_FREIGHT     tonne-km factors            (8 factors)
EF_MATERIAL    embodied carbon per tonne  (19)
EF_SPEND       EEIO per EUR               (15)
EF_WASTE       per tonne by route         (15)
EF_TRAVEL      per passenger-km           (14)
EF_COMMUTE     per passenger-km           (8)
```

`GWP_REFRIG` already exists but holds AR4 values; the Scope 3 workbook uses **AR6**
(R22 1760 vs 1810, R410A 2256 vs 2088). Two GWP sets cannot both be `GWP.r22`.
Either version the key (`GWP.r22.ar6`) or add an `assessment_report` column — the
CONTROL sheet discloses which set was used, so the model must be able to say.

### 3. Seed the mapping layer — `14_scope3_mappings.sql`

**This has no equivalent in the current schema and is the largest new piece.** The
workbook has 16 mapping blocks; 7 are factor lookups and 9 are dropdown lists.

```sql
create table esg.s3_mapping (
    id         integer generated always as identity primary key,
    block      text not null,   -- 'material' | 'freight' | 'waste' | 'spend' |
                                -- 'travel' | 'commute' | 'refrigerant'
    lookup_key text not null,   -- 'Cement - OPC', 'Construction and demolition | Landfill'
    factor_key text not null references esg.constant(key),
    wtt_factor_key text,        -- travel modes carry a second, WTT factor
    unique (block, lookup_key)
);
```

Note the waste block's key is a **composite**: `stream | route`. C&D to landfill and
C&D to recycling are different factors, and the workbook's whole Cat 5 method is
"by disposal route, not to a single generated tonnage".

The 9 dropdown lists (waste stream, disposal route, material unit, transport mode,
area basis, EPI source, procurement tag, Y/N) belong in the standard input template
generator as data validation — reuse the `dataValidation` mechanism already in
`src/lib/standardTemplate/generateTemplate.ts`.

### 4. Seed output parameters — `15_scope3_outputs.sql`

11 category lines plus a total. All `scope = 'scope3'`, which is a new value for
that column — check the constraint permits it:

```sql
-- 01_schema.sql:374
scope text check (scope in ('scope1','scope2','scope3',null))   -- already allows it
```

Good: no change needed. Suggested rows, `domain = 'SCOPE3'`, `frequency = 'annual'`:

```
s3.cat1_spend         Category 1 - Purchased goods and services   tCO2e
s3.cat1_materials     Category 1 - Building materials (embodied)  tCO2e
s3.cat2_capital       Category 2 - Capital goods                  tCO2e
s3.cat3_fera          Category 3 - Fuel and energy related        tCO2e
s3.cat4_freight       Category 4 - Transport of purchased goods    tCO2e
s3.cat4_materials     Category 4 - Transport of materials          tCO2e
s3.cat5_waste         Category 5 - Waste generated in operations   tCO2e
s3.cat6_travel        Category 6 - Business travel                 tCO2e
s3.cat7_commute       Category 7 - Employee commuting              tCO2e
s3.cat11_sold         Category 11 - Use of sold products           tCO2e
s3.cat13_leased       Category 13 - Downstream leased assets       tCO2e
s3.total              Total Scope 3                                tCO2e
```

⚠ **`ghg.total` currently means Scope 1 + 2** (`07_formulas_seed.sql`: "Total gross
GHG emissions, Scope 1 plus Scope 2"). Adding Scope 3 must NOT silently change what
that key means — a dashboard tile or export cell reading `ghg.total` would jump by
three orders of magnitude with no visible cause. Add a *new* `ghg.total_all_scopes`
and leave `ghg.total` alone.

### 5. The computation pass — `scripts/resolve-scope3.mjs`

Per blocker 2. Points where the workbook's arithmetic is deliberately non-obvious,
each of which is a real trap:

- **T&D gross-up.** Losses are `basis × L/(1-L)`, not `basis × L`. Multiplying
  delivered consumption by the loss share understates it. The workbook says so
  explicitly on its C3 sheet.
- **Onsite renewables excluded from the T&D basis.** Behind-the-meter generation
  never enters the grid. Its VALIDATION check 11 enforces this.
- **Circuity is a detour factor, not a curvature correction.** Great-circle
  distance already accounts for curvature; 1.3 is the GLEC road-detour multiplier.
- **Spend deflation.** `INR / fx_rate / deflator`, using a **market** exchange rate,
  not PPP. The workbook is emphatic: PPP inflates the spend base while applying US
  production technology to Indian supply chains.
- **Cat 7 gross-up.** Survey emissions × (headcount / respondents). The CONTROL
  sheet records whether contract site workers are in scope — and notes HR reports
  zero workers while Safety reports 15.6M worker-hours, which can move the category
  by an order of magnitude.
- **Cat 11 lifetime multiplier.** `area × conversion × EPI × lifetime × grid EF`.
  This makes Cat 11 ~99.5% of the workbook's total. Correct per the GHG Protocol,
  but it means the total is insensitive to improvement anywhere else — decide how to
  present that before anyone reads it as a modelling artefact.

### 6. Validation rules — the double-counting guard

**The single most important new rule, and nothing like it exists today.**

`validation.ts` currently checks one site-month's values against each other and
against the prior year. The Scope 3 rule is different in kind: *a rupee of spend
belongs to exactly one method.* If a material is counted by tonnage on INPUT 2, its
purchase order must be tagged `EXCLUDE` on INPUT 1.

The workbook enforces this by requiring every procurement line to carry a tag, and
its VALIDATION check 2 counts untagged lines. Port that as a blocking-at-export
check rather than a per-row entry flag — an untagged line is silently excluded, so
the failure is invisible at entry time and only shows as an understated total.

Also port: every mapping resolves (checks 3–7), every sold project has a lifetime
(check 8), the commute survey has respondents (check 9), and — the one that
matters most — **no factor is still `INDICATIVE`** (check 1).

### 7. Output — mostly free

Once category totals are `output_value` rows, `src/lib/standardOutput/` picks them
up automatically: `domain = 'SCOPE3'` gets its own sheet via `DOMAIN_SHEET`,
`frequency = 'annual'` reads the `ytd` period, and `scope = 'scope3'` sections the
emissions sheet.

Three things do need code:

1. **`DOMAIN_SHEET`** needs a `SCOPE3: "SCOPE3"` entry (`outputLayout.ts`).
2. **`is_intensity` throws today.** `outputData.ts` deliberately throws on an
   intensity parameter because none existed and summing a ratio is invalid. Scope 3
   intensity (per rupee of turnover, per sq m) is a real disclosure, so that throw
   must become a re-derivation rule before seeding one. The comment in that file
   tells the next reader exactly this.
3. **A `SCOPE3 METHOD` sheet.** The workbook's methodological disclosure — which
   source, which tier, which categories are excluded and why — has nowhere to live
   in the current 9 sheets, and the GHG Protocol requires all 15 categories to be
   either quantified or explicitly excluded with justification. Categories 8, 9, 10,
   12, 14, 15 are out of scope; **12 (end-of-life of sold buildings) and 15 (JV /
   joint-development) are the two a reviewer is most likely to challenge**, per the
   workbook's own note.

---

## Verified figures, for whoever seeds this

Counted from the workbook on 12 Aug 2026, not remembered:

```
Sheets                    23
Emission factors          95   (90 INDICATIVE, 5 Confirmed)
  Electricity 4 · Fuel 4 · Freight 8 · Material 19 · Spend 15
  Waste 15 · Travel 14 · Commute 8 · GWP 7 · Utility 1
Mapping blocks            16   (7 factor lookups, 9 dropdown lists)
Input sheets               9   (89 columns in total)
Output category lines     11   + total
Categories calculated      1, 2, 3, 4, 5, 6, 7, 11, 13
Categories NOT calculated  8, 9, 10, 12, 14, 15
```

The five already-confirmed factors are `EF-ELEC-CEA-COMB` (0.727, the CEA grid
average — the same value this platform back-derived independently),
`EF-MAT-SUPPLIER-EPD` (per-line, Tier 1), `EF-CMT-WALK-CYCLE` (zero by definition),
`GWP-CO2` (1), and `EF-ZERO`.

That the workbook's grid factor and this platform's back-derived one agree to three
decimals is a useful cross-check that both models describe the same portfolio.

---

## Rough shape of the work

| Piece | Nature |
|---|---|
| Decide blockers 1 and 2 | Design decision, needs a human |
| `s3_line` table + `s3_mapping` table | One migration, mechanical |
| 95 factors + 6 categories + 4 columns | One migration, mechanical but must be transcribed carefully |
| 11 output parameters | One migration, small |
| `resolve-scope3.mjs` | The real work. Six category methods, each with a documented trap. |
| `s3Commit.ts` + ledger parser | Sibling of the existing template path; reuses its patterns |
| Double-counting validation | Small but load-bearing |
| Exporter changes | Three small changes listed above |
| `SCOPE3 METHOD` sheet | New, and needed for assurance |

The seeding is mechanical. The two blockers and `resolve-scope3.mjs` are where the
judgement is, and the double-counting rule is where a mistake would be invisible.

---

## What must not be assumed

1. **Scope 3 is not an extension of Scope 1+2 — it is a second model.** Its inputs
   are ledgers, not monthly meter readings, and its methods are set operations, not
   scalar formulas. Trying to fit it into `input_value` and the formula DAG is the
   one approach that will not work.
2. **`ghg.total` means Scope 1 + 2 today.** Do not redefine it.
3. **90 factors are placeholders.** The workbook's README is unambiguous: they are
   "of the right order of magnitude so the model runs end to end" and are NOT the
   published values. Any Scope 3 figure produced before they are confirmed is a
   test fixture, not a disclosure — and the settings page's `is_assumption` flag is
   how that stays visible.
4. **Test against the live database.** Two bugs in this codebase were invisible to
   build, typecheck and unit tests: response caching on read routes, and the server
   not parsing text the UI previewed. A third was found during this session's work
   — Next caching every Supabase GET — for the same reason. `BIRLA_ESTATES.md` says
   it; it keeps being true.
