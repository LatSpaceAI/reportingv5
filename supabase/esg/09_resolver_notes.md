# Resolver notes — Birla Estates ESG model

How `esg.formula` gets evaluated into `esg.output_value`, and the judgement
calls baked into the seed that someone should confirm before assurance.

## The evaluation algorithm

```
for each (site, period) with input data:
    for each formula ordered by eval_order asc:
        substitute  in:<key>     -> input_value.value_num   (0 if absent)
                    const:<key>  -> constant.value
                    out:<key>    -> output_value just computed for this site+period
        evaluate the arithmetic
        upsert into output_value
```

Then the portfolio (`GROUP`) rollup, which is a sum over sites rather than a
re-evaluation:

```
for each formula:
    sites = all in-scope sites, filtered by formula.site_filter
    GROUP value = Σ site values
    record sites_reporting / sites_expected alongside the number
```

`eval_order` ascending guarantees every `out:` reference is already computed
when it is read. `scripts/validate-esg-seed.mjs` proves this statically: it
walks the dependency graph, checks it is acyclic, and fails if any formula
reads an output with an equal or later `eval_order`.

### Absent inputs are zero, not null

A site that does not report plant-and-machinery diesel contributes 0 to mobile
combustion, not null. This matches Excel's behaviour for blank cells in
arithmetic and keeps sums well-defined when forms differ between sites.

It does mean **a zero in an output can mean either "genuinely zero" or "nobody
reported"** — which is exactly why `sites_reporting` / `sites_expected` travel
with every rollup, and why the coverage view exists. Read a portfolio total
without its coverage and you will over-read it.

## Rollups across time

Monthly inputs feed disclosures at four cadences (`output_parameter.frequency`):

| Frequency | Rolls up by | BRSR lines |
|---|---|---|
| `monthly` | sum of months | energy, water |
| `quarterly` | sum of the quarter's months (`period.quarter_no`) | waste |
| `half_yearly` | sum of the half (`period.half_no`) | air emissions |
| `annual` | sum of the fiscal year | refrigerants, extinguishers |

The YTD period row holds the fiscal-year total.

## Judgement calls in the seed

Everything below is marked `is_assumption = true` on the formula or constant, so
the app can list them. None is a definitional certainty; each reproduces what
the published FY25 consolidation did, so that changing one is a deliberate act
with a visible effect on the tie-out to prior-year disclosures.

### 1. Boundary — Aurora's tenant electricity

Excluded. Tenant consumption has been outside the entity boundary since FY24 per
the ESG Data Book footnote; Aurora's own floors (Level 8 + Level 13) are inside
and feed non-renewable electricity. Over Apr–Aug 24 this excludes 1,023,308 kWh.

If the boundary changes, edit `en.electricity_nonrenew` — the tenant figure is
already captured as `elec.tenant`, so nothing needs re-collecting.

### 2. Construction scrap → C&D waste

BRSR has no scrap category. Rebar, steel and wood scrap consolidate into C&D
waste (`wst.cnd_generated = in:waste.cnd + in:waste.scrap`). Scrap is stored as
its own parameter, so remapping it is a one-line formula change rather than a
data migration.

### 3. Diesel split — stationary vs mobile

DG-set diesel is stationary; plant, machinery and vehicle diesel is mobile.
Supported by Sangamwadi Dec-24: the site reported 2,000 L of DG diesel against a
published December stationary total of 2,043 kL-equivalent — 98% from one site.

### 4. Drinking water → third-party

Sangamwadi's "water for drinking" (3.2 KL) books to third-party water.

### 5. Extinguisher CO₂ in Scope 1

Refilled CO₂ mass is assumed released 1:1 and counted in Scope 1. Whether
extinguisher refills belong in Scope 1 at all is a boundary question.

### 6. Combustion factors

Diesel 2.65 kg CO₂e/L and petrol 2.30 kg CO₂e/L are mid-range IPCC / India GHG
Program values. They produce a Scope 1 of 603.82 tCO₂e against a published
589.11 — a **+2.5% gap** attributable to the factor set, not the activity data.
The authoritative factors live in the missing consolidation workbook.

### 7. R22 excluded from Scope 1

A Montreal Protocol gas, conventionally excluded from GHG inventories. Its refill
quantity is still disclosed on the BRSR refrigerant line. Including it would add
18.10 tCO₂e.

## What is *not* an assumption

**The grid emission factor, 0.727 kg CO₂/kWh.** Back-derived from the published
disclosure: 3,683,858.31 kWh × 0.727 ÷ 1000 = 2,678.165 tCO₂e against a published
2,678.16. Agreement to 0.005 t is print rounding. This also proves the template's
electricity row *is* the published Scope 2 base.

## Two open items the model surfaces rather than resolves

### The renewable electricity deduction

The published template books **197,838.76 kWh less renewable electricity** than
Aurora reported over Apr–Aug 24, 11–16% every month. Attribution is not in doubt
— the odd decimal `.9992` appears identically in Aurora's July return and the
template. The *reason* is undocumented and lives in rows 10–11 of the missing
file's GRID sheet.

Rather than bake this into a formula, it enters through an explicit input
parameter, `elec.renewable_adjustment`, which is signed and defaults to absent.
The FY25 deduction can be entered there, attributed and visible, and should go
to zero once the deduction is documented or withdrawn.

**This must be resolved before assurance.**

### Groundwater classification

Tisya's Apr-24 groundwater (1,396 KL) was consolidated as *third-party water*
while Trimaya's Feb-25 groundwater (52 KL) stayed *groundwater*. Both are stored
as filed; the inconsistency is raised as a data flag rather than silently
normalised, because picking either treatment unilaterally would change a
published figure.

## Lines that cannot be computed yet

Four inputs are collected but reach no disclosure, because the BRSR line is
denominated in MT and the form captures something else:

| Input | Filed as | Needs |
|---|---|---|
| `waste.used_oil` | litres | a density |
| `waste.coolant_oil` | litres | a density |
| `waste.oil_filters_no` | count of units | an average unit weight |
| `waste.battery_no` | count of units | an average unit weight |

Their formulas are seeded as explicit `0` with `is_assumption = true`, so the
BRSR line resolves and the gap is documented rather than silent. Supply the
conversion and each becomes a real expression.

Worth noting: the published template shows 0.03 MT of oil filters for Q3 with no
derivable basis — the only site-return evidence is Sangamwadi's "2 Nos".

## Validation

Both queries must return zero rows after loading:

```sql
select * from esg.v_formula_missing_refs;   -- every ref resolves
select * from esg.v_formula_dag_edges;      -- inspect: must be acyclic
```

Before touching the database, run the static checks:

```bash
node scripts/validate-esg-seed.mjs   -- references, DAG, eval_order, form mappings
node scripts/verify-esg-model.mjs    -- computes the seeded months, compares to known-good figures
```

The second is the one that matters. It evaluates the real formula graph over the
real seeded values and asserts 36 figures independently established by the
Middle Link reconstruction — including that tenant electricity stays out of the
boundary, that the water-stressed filter excludes Pune, and that consumption
never exceeds withdrawal (a relationship the published template got wrong twice).
