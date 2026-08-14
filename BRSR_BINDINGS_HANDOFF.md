# BRSR bindings & drilldown — handover

Context for continuing the work on the `birla-estates` branch. Written
14 Aug 2026, after the binding layer and drilldown were built and verified
against the live Supabase project.

**Read `BIRLA_ESTATES.md` first.** This document assumes it, and in particular
assumes its coverage warning: only 8 of 132 FY25 site-months have a filed
return. Everything below is shaped by that.

---

## What was built

The loop this closes:

```
output_value  →  report_binding  →  Requirements tab  →  drilldown
 (the metric)    (which BRSR cell    (shows the number    (shows the monthly
                  it answers)         beside the manual    inputs, formula and
                          │           answer)              constants behind it)
                          │
                          └─────→  Sync  →  the Document tab
                                   (writes each figure into the
                                    disclosure line it answers)
```

Commits:

```
b98bc73  feat(esg): metrics the BRSR asks for and the model could not answer
16ab2b0  feat(reporting): bind BRSR cells to computed metrics, with drilldown
821d2fa  fix(reporting): show bound figures when the report has no year set
750288c  feat(reporting): Sync writes computed figures into the report
```

### Migrations — ALL FOUR ARE ALREADY APPLIED to the live database

| File | What it does |
|---|---|
| `17_brsr_gap_metrics.sql` | 4 output params, 7 constants, `FINANCIAL` category, 8 formula revisions |
| `18_intensity_per_crore.sql` | Fixes intensities that stored as exactly `0` (see below) |
| `19_report_binding.sql` | `esg.report_binding` + `esg.v_report_binding` |
| `20_brsr_bindings_seed.sql` | 38 BRSR cell bindings |

Do **not** re-run 17 or 18 blindly; 20 is idempotent (upserts on conflict).

### Code

```
src/lib/reportBindings/     read.ts (server) + 3 pure helpers
src/lib/drilldown/          expand.ts (pure walk), resolve.ts (server), formatFactor.ts
src/app/api/esg/bindings/   GET ?framework=brsr&fy=2024-25
src/app/api/esg/drilldown/  GET ?key=…&site=GROUP&fy=2024-25
src/components/DrilldownPanel.tsx, useBoundCells.ts
src/components/Questionnaire.tsx   Computed value column, "From metrics" filter
scripts/test-bindings.ts (26), scripts/test-drilldown.ts (24)
```

Both test scripts are in `npm run esg:check`.

---

## The six things to understand before changing any of this

### 1. "Not filed" is not zero, and the whole design turns on it

`resolve-birla.mjs:277-281` writes **no row at all** for a site-month nobody
filed. The binding layer and the drilldown both carry that refusal to the last
pixel:

- A bound cell with no `output_value` row reads **"Not computed"**, never `0`.
- The drilldown grid uses three states: a number (filed, including a filed
  zero), `NA` (site marked it unavailable), and `·` (no return).

On `en.energy_total_gj` that is **1,285 of 1,320 cells not filed**. A grid of
zeros would have shown a fully-reported portfolio that reported nothing.

If you touch any of this, keep the three states distinct.

### 2. Cell ids are POSITIONAL, and that is a live hazard

`C.P6.E6.r0.currentFY` means *row index 0* — an index into the `rowLabel` array
in `brsrSections.ts` (`quantitativeCells.ts:79`). **Reordering those rows
silently re-points every binding on that question**, turning Scope 1 into
Scope 2 with no error anywhere.

Mitigation: each binding stores `cell_label` as it read when bound;
`reportBindings/read.ts` recompares against the live schema and flags
`staleLabel`. The UI shows "Binding stale" in amber.

It does **not** auto-heal, deliberately — "the rows moved" and "the label was
reworded" produce identical mismatches and need opposite responses.

**If you edit a fixed table's `rowLabel` array, expect stale flags and re-check
those bindings by hand.**

### 3. Intensities are per CRORE, not per rupee

`18_intensity_per_crore.sql` exists because the first version got this wrong,
and the failure mode is worth remembering: both resolvers round stored values
to 4dp (`resolve-birla.mjs:111`), and an intensity per rupee is ~1e-7, so all
three intensity metrics stored as **exactly 0** — present, precise-looking and
wrong.

Widening `round4` was rejected: it is shared by all 78 metrics across both
resolvers and would silently change the precision of figures the Middle Link
reconstruction is asserted against.

The unit string carries the scale (`GJ/crore`). BRSR asks "per rupee of
turnover"; state the actual denominator in the report.

### 4. `formula_dependency` is a cache, not the truth

No trigger. Its only writer is the manual `DELETE+INSERT` at the foot of each
formulas migration. `formula.expression` is the source of truth — see
`esgConstants/graph.ts:8-20`.

The drilldown parses expressions with `REF_RE` (imported, never redeclared).
**If you add or edit a formula, re-run the regeneration block** or the blast
radius under-reports.

### 5. The fiscal year is inferred when the report does not name one

Bound metrics resolve against Section A item 9, *"Financial year for which
reporting is being done"* — free text, and blank on any report nobody has
filled in. When it is blank, `/api/esg/bindings/fiscalYears` supplies a
fallback and the UI labels it **"(assumed)"** in amber.

That endpoint ranks by **distinct sites filed, then site-months** — not by
recency, and not by `sum(sites_reporting)`. Both were tried and both picked the
wrong year: recency gives FY2025-26 (a two-month fragment, because periods are
seeded ahead and a YTD row appears after one filed month), and site-months
alone gives FY2023-24 (Aurora filing twelve months, alone, beating FY2024-25's
nine across five sites). BRSR is entity-level, so breadth of sites wins. The
endpoint returns its `evidence` so the ordering is inspectable.

### 6. Scope 3 is a different shape

`s3.*` outputs have **`formula_id = null`** — they are written directly by
`resolve-scope3.mjs` from the `s3_line` ledger, not the formula DAG
(`15_scope3_outputs.sql:14-25`). A formula walk returns nothing for them.

`expandProvenance` flags this as `hasNoFormula` and the panel explains it,
rather than rendering an empty tree as "rests on nothing". **A Scope 3
drilldown still needs building** — see below.

---

## What remains, in priority order

### 1. Confirm the seven placeholder constants — BLOCKS EVERYTHING ELSE

Nothing bound is a disclosure until these are real. All seven are
`is_assumption = true` and visible at `/data-collection/constants`.

| Constant | Shipped as | Who owns it |
|---|---|---|
| `FIN.turnover` | 50,000,000,000 (set in session, still flagged) | Finance — **untick "assumption" once confirmed** |
| `NCV.diesel` | 38.6 GJ/kL | ESG / assurance |
| `NCV.petrol` | 32.2 GJ/kL | ESG / assurance |
| `DENS.used_oil` | 0.9 MT/kL | Site EHS |
| `WT.oil_filter` | 0.0015 MT/unit | Site EHS |
| `WT.battery` | 0.025 MT/unit | Site EHS |
| `DENS.coolant_oil` | 0.9 MT/kL | **unwired — see item 4** |

Two are worth a second look:

- **`WT.battery` may not be answerable as a single number.** Battery mass varies
  ~10× by type. If sites discard mixed types, the honest fix is a weight column
  on the form, not an average.
- **`WT.oil_filter` has a coincidence to check.** The published FY25 template
  shows 0.03 MT for Q3 with no derivable basis; 20 filters at 1.5 kg reproduces
  it exactly. That may mean someone already used 1.5 kg, or it may be
  meaningless. Finding out settles the factor properly.

### 2. The waste aggregates — ~10 more bindable cells

BRSR C.P6.E8 asks by **its own categories**; we compute per stream. Three
metrics do not exist and block the most-scrutinised block in P6:

| Proposed | Sums | Serves |
|---|---|---|
| `wst.other_hazardous_total` | used oil + oil filters + cotton rags + other-haz (+ coolant?) | `C.P6.E8.r6` |
| `wst.other_nonhazardous_total` | municipal + food (+ cotton rags?) | `C.P6.E8.r7` |
| `wst.recovered_total` / `disposed_*` | portfolio-wide recycled / re-used / incinerated / landfilled | `C.P6.E8.r9`–`r15` |

**`C.P6.E8.r8` (the grand total) must wait for r6/r7.** `wst.total_generated`
is close but not that sum, and binding a total that disagrees with the visible
rows above it is the error a reviewer always catches.

Note the membership question is a **classification call for the ESG team**, not
arithmetic: cotton rags could sit in either bucket.

### 3. `en.electricity_gj` — 4 more cells

`C.P6.E1.r0` and the `C.P6.L1` renewable/non-renewable rows are denominated in
**joules**; `en.electricity_total` is **kWh**. Binding it would print kWh under
a GJ heading. A one-line formula (`out:en.electricity_total *
const:CONV.kwh_to_gj`) unblocks r0 plus the L1 split.

### 4. `waste.coolant_oil` goes nowhere

Collected by the forms, consumed by no output. `DENS.coolant_oil` is seeded but
unwired pending a decision on whether HVAC coolant belongs in other-hazardous.
One-line formula once decided.

### 5. Scope 3 drilldown — a second provenance path

`s3.total` and the 11 category outputs are deliberately **unbound** because
their provenance cannot yet be shown. Binding a number whose working the UI
cannot display inverts the point of the feature.

Needs: a ledger branch in `resolveDrilldown` querying `s3_line` grouped by
category, returning contributing transactions with factor, FX rate and
deflator. Arguably the *more* valuable drilldown — it can show actual purchase
orders. `SCOPE3_HANDOFF.md` notes Cat 11 is ~99.4% of the total.
`checkDoubleCounting` (`scope3-methods.mjs:646`) results belong here too.

### 6. ~~The write path~~ — BUILT (Sync)

The header's **Sync** button now writes bound figures into the answers. It was
a 900ms placeholder; it fetches the bindings and places each value at the
address its QuantCell id names — `values[fieldId]`, or
`rows[rowIndex][fieldId]` for a fixed table. No mapping table: the function
that generates a requirement row generates its destination.

Three rules it will not break:

- **Never overwrites a typed answer** — reported as "kept as typed", so a
  human/computed disagreement surfaces instead of being settled by click order.
- **Never writes a cell with no computed figure** — not-filed is not zero.
- **Completed is earned**, gated on the same `canComplete()` the manual control
  uses. Of the four questions a sync touches, only water (16/16) finishes.

Still open here: the **`computed` FieldKind** remains fully built
(`Fields.tsx:42-68` — grey read-only cell with the formula beneath) and used by
zero questions. Sync writes plain values, so a synced figure is
indistinguishable from a typed one once written. Rendering bound cells as
`computed` would make provenance visible in the Document tab itself and stop
anyone editing a figure that the next sync would not overwrite. `compute` is
synchronous, so values must be fetched into a cache it reads.

### 7. Smaller things

- **`scripts/validate-esg-seed.mjs` is stale.** It still lists the four waste
  inputs as "needs a unit conversion" — untrue since 17. It reads seed files,
  not the database.
- **The constants dialog's typed-confirmation is exact and case-sensitive**
  (`page.tsx:474`) with no hint when it fails, and the disabled Save button
  reads as absent at 40% opacity. Trimming + case-insensitive comparison and a
  "doesn't match" hint would save the next person the same wall.
- **`esg:verify-resolver` passes 24/24** after all four migrations — checked, no
  action needed. Its fixtures assert per-source and per-site figures that the
  revisions did not move; nothing in it pins `en.energy_total_gj` or
  `wst.total_generated`. Worth *adding* a fixture for the fuel-inclusive energy
  total, which is currently asserted nowhere.
- **Previous-FY bindings will mostly read "Not computed"** — FY24 has Aurora
  only. Correct, but looks sparse.

---

## Scope reality check

The Requirements tab holds **708 quantitative cells** (measured, not estimated
— run `quantitativeCells(sections)`).

| Section | Cells |
|---|---|
| P3 — Employee & Worker Well-being | 226 |
| P5 — Human Rights | 136 |
| P6 — Environment | 133 |
| A.IV — Employees | 64 |
| everything else | 149 |

**Only P6 has a data source.** P3 + P5 + A.IV are 426 cells — 60% of the report
— and per `BIRLA_ESTATES.md:302-304` there is no feed for any of them (HR and
Safety are separate departments whose files openly contradict each other).

So the ceiling for this feature is roughly **133 cells, ~19% of the report**,
of which 38 are bound today and ~15 more are unblocked by items 2 and 3. The
other ~575 stay manual. Worth building; should not be sold as "the report fills
itself".

---

## Verification

```bash
npm run esg:check              # includes test-bindings (26) and test-drilldown (24)
npx tsc --noEmit               # clean
npx next build                 # compiles
```

Live spot-check (needs the dev server and a session):

```
/api/esg/bindings?framework=brsr&fy=2024-25
/api/esg/drilldown?key=en.energy_total_gj&site=GROUP&fy=2024-25
```

Expected at GROUP / FY2024-25 YTD:

```
en.fuel_energy_gj         338.2132  GJ
en.energy_total_gj       5925.3529  GJ
en.intensity_turnover       1.1851  GJ/crore
wtr.intensity_turnover      2.8563  KL/crore
ghg.intensity_turnover      0.0237  tCO2e/crore
wst.total_generated       218.125   MT
wst.oil_filters_generated   0.003   MT     (2 filters, the only such return filed)
```

All carry coverage `8/77`.

UI spot-check: open the BRSR report, press **Sync**. Expect a dialog reading
*"Metrics filled · FY 2024-25 (assumed)"* with **38 filled** and **1 question
completed**. Then in the Document tab, C.P6.E3 should be fully populated and
C.P6.E1 should show 338.2132 / 5925.3529 / 1.185 on rows 1, 3 and 4 with rows
0, 2 and 5 blank. Pressing Sync a second time should write 0 and report 38
"kept as typed" — nothing is overwritten.

Overall progress reaches **2%** after a sync. That is correct, not a bug: the
four questions metrics can answer are 3% of a 134-question report.
