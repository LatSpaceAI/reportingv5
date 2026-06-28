# Resolver notes

How to evaluate the FORMULAS layer and the unit conventions behind the
emission expressions.

## Reference resolver algorithm

```
for each (plant, period):
    ctx = {}                                  # key -> numeric value
    # 1. load inputs
    ctx["in:" + k]    = input_value(plant, period, k)     for all input keys
    # 2. load constants
    ctx["const:" + k] = constant.value(k)                 for all constant keys
    # 3. evaluate outputs in eval_order ASC (DAG-safe)
    for f in formulas order by eval_order, output_key:
        val = eval_expr(f.expression, ctx)    # supports + - * / () IF IFERROR MAX MIN
        ctx["out:" + f.output_key] = val
        upsert output_value(plant, period, f.output_key, val, f.id)
```

`eval_order` is a coarse layering. For a strict order, topologically sort using
`formula_dependency` (ref_kind='output') / `v_formula_dag_edges`. The seed is a
DAG (verified — no output→output cycles).

Implement `eval_expr` as a small safe expression parser (shunting-yard or a
sandboxed AST). **Do not** use raw `eval()`. A Supabase Edge Function (Deno) or
a Postgres `plpgsql`/`plv8` function are both fine; keep it pure (no I/O) so it
is deterministic and testable.

## Unit reconciliation — fuel combustion CO₂

Input units: fuel **qty in tonnes**, **LHV in kcal/kg**, EF in **kg CO₂/GJ**.

```
energy (GJ) = qty_t * 1000 (kg/t) * LHV_kcal_per_kg * 4.184e-3 (kJ/kcal -> kJ) / 1e6 (kJ->GJ)
            = qty_t * LHV * 4.184e-3
CO2 (kg)    = energy_GJ * EF_kgCO2_per_GJ
CO2 (t)     = CO2_kg / 1000
            = qty_t * LHV * 4.184e-3 * EF / 1000
            = qty_t * LHV * EF * 4.184e-6
```

So each fuel term in `emis.fuel_*` is `qty * lhv * EF * 4.184e-6` (tonnes CO₂),
and each energy term in `en.energy_*_tj` is `qty * lhv * 4.184e-6` (TJ, since
1 GJ = 1e-3 TJ and the same `4.184e-3` GJ factor × `1e-3` = `4.184e-6`).

> The Excel engine folds these conversions into intermediate rows
> (`= qty * LHV / 1000` for energy, then `* EF` columns). The single-line
> `* 4.184e-6` form here is algebraically identical and easier to audit.
> **Validate** the resolver output for one month against the workbook's
> `Derived!N644` (gross Scope 1) before trusting it.

## Electricity → TJ

`TJ = MWh * 0.0036` (1 MWh = 3.6 GJ = 0.0036 TJ). Used in `en.consumption_total_tj`.

## Scope 2

`(grid_total_MWh − onsite_export_MWh) * 0.716 t/MWh`. The workbook stores the EF
as 716 kg/MWh and divides by 1000; we store 0.716 t/MWh directly, so no `/1000`.

## Calcination (GCCA B2)

```
uncorrected = (CaO_amt/MW_CaO + MgO_amt/MW_MgO) * MW_CO2
   where CaO_amt = clinker_t * CaO%/100 ,  MgO_amt = clinker_t * MgO%/100
correction  = (ash_CaO_amt/MW_CaO + ash_MgO_amt/MW_MgO) * MW_CO2
   where ash_*_amt come from coal-ash consumption × ash CaO/MgO %
corrected   = uncorrected − correction        # = emis.calcination
```
The seeded `emis.calcination` includes the correction term for the
**representative ash-bearing fuels seeded in INPUT**. Extend the non-carbonate
term with every ash-bearing fuel (petcoke, all coal grades, lignite, rice husk,
tyres) to match `GCCA calcination B2!N21` exactly.

## Group rollup

The workbook keeps a separate GROUP input/derived set. Two valid options:
1. Treat GROUP as its own `plant` row fed by group-level inputs (as the workbook
   does), or
2. Make GROUP outputs a SUM across the 6 plant `output_value` rows for absolute
   metrics, and recompute intensities from summed absolutes (do **not** average
   intensities). Pick one and document it; the seed assumes option 1.
```
