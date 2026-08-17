# Birla Estates ESG platform — handover

Context for continuing work on the `birla-estates` branch. Written 11 Aug 2026,
after Phases 1–5 were built and verified against the live database.

---

## What this is

plato-v1 was an ESG reporting app built around a **Sagar Cements** carbon-
accounting model. It has been remodelled for **Birla Estates (BEPL)**, a real-
estate developer. The cement schema is gone.

The loop the app now closes:

```
monthly site returns  →  computation  →  dashboard  →  export the exact BRSR template
   (/data-collection/     (resolver)      (/dashboard)   (/data-collection/export)
    site-return)
```

**BRSR questionnaire / qualitative reporting is deliberately out of scope.** The
`/report/[id]` questionnaire, `brsrSections.ts`, `cdpSections.ts` and
`brsrSeed.ts` were not touched and still work as they did.

---

## The source material (`birla-estates/`, gitignored)

Nine Excel files, untracked because `*.gitignore` excludes `*.xlsx`. They are the
origin of every number in the seeds.

```
input/   4 monthly site returns as filed
output/  3 BRSR templates (the export target)
ESG Data FY 24-25 - Reconstructed (Middle Link).xlsx   ← the working engine
ESG Middle Link - Simplified.xlsx                      ← the explainer
```

The two "Middle Link" files are a **forensic reconstruction**: the consolidation
workbook that produced BEPL's published FY25 figures (`ESG Data FY 24-25.xlsx`)
is not in anyone's possession — it lives on a personal OneDrive and the template
only reaches it through external-link formulas. The reconstruction rebuilt that
missing link by hand from the same site returns.

**That reconstruction is our ground truth.** Several test suites assert our
computed figures equal numbers it derived independently. If you change a
classification rule, expect those tests to move — and read the failure before
"fixing" it (see *Corrections* below).

---

## Current state

All five phases are committed and verified against the live Supabase project
(`enfdtatlnykbamvfmjjh`, schema `esg`, exposed via Settings → API).

| Table | Rows |
|---|---|
| `site` | 12 (11 assets + GROUP) |
| `period` | 40 (FY24, FY25, FY26 months + YTD + baseline) |
| `constant` | 14 |
| `input_parameter` | 57 |
| `input_value` | **466** |
| `site_form` / `site_form_field` | 4 / 127 |
| `site_submission` | 20 |
| `data_flag` | 1 |
| `output_parameter` / `formula` | 60 / 60 |
| `output_value` | **2,652** |

Commits, newest first:

```
44ccc87  feat(export): populate the real BRSR template with computed values
dd982cb  feat(dashboard): rewire to the Birla Estates schema, surface coverage
2d2c7ec  feat(esg): resolver for the Birla Estates model
d252a74  fix(entry): no-store on read routes, and parse text server-side
bba4ac4  feat(data-collection): monthly site return entry
95c145f  feat(esg): load Aurora FY24 as prior-year comparatives
e37ff4a  feat(esg): remodel schema for Birla Estates real estate portfolio
```

---

## The one thing to understand before changing anything

**Coverage. Only 8 of 132 FY25 site-months have a filed return — about 6%.**

Four of eleven sites have ever filed: Aurora (Apr–Aug 24), Tisya (Apr 24),
Sangamwadi (Dec 24), Trimaya (Feb 25). Aurora also filed all twelve FY24 months,
so 20 site-months exist in total.

Everything in the design follows from this:

- **There is no derived-balance mechanism.** A total is the sum of what was
  filed. The reconstruction reached full-portfolio figures by balancing against
  the published template; this app deliberately does not, because going forward
  it *is* the source.
- **A site-month with no return produces no row at all.** Not a zero. Writing 0
  would turn "nobody filed" into "a return of zero" — the single most
  consequential lie this model could tell.
- **Every `output_value` row carries `sites_reporting` / `sites_expected`**, and
  the dashboard and export both surface it.

Exports are therefore legitimately sparse, and figures are *lower* than the
published workbook. April stationary diesel exports as 0.21 kL (Aurora + Tisya)
where the published figure was 8.401 kL (all sites). That is correct, not a bug.

---

## Architecture

### Schema (`supabase/esg/`)

Four layers, unchanged in shape from the cement model; every parameter,
constant and formula is new.

```
CONSTANTS ──┐
            ├──> FORMULAS (OUTPUT = f(INPUT, CONSTANT, OUTPUT)) ──> OUTPUT
INPUT ──────┘
```

Run in order `01` → `08b`, then `10_dashboard_tiles.sql` and
`APPLY_THIS_IN_SQL_EDITOR.sql` (grants + PostgREST reload). Later numbered
files are applied on top in order; `21_ai_context_profile.sql` is the most
recent and is required for the AI Context page to save (see below).

Key differences from the cement model:

- `plant` → **`site`**, with `asset_type` (commercial / residential), `city`,
  `water_stressed`. That last flag is load-bearing — BRSR stressed-area lines sum
  exactly those sites, via `formula.site_filter`.
- **Per-site form replicas** (`site_form` / `site_form_field`). Labels reproduce
  the printed forms verbatim, typos included (`"Grid Electricity consmuption"`,
  `"Scarp - Wood -MT"`, `"Collant Oil form HVAC"`). Correcting them would make
  the screen stop matching the paper the ESG team is typing from.
- `input_value` carries `provenance`, `raw_text`, `is_not_available` — so a
  reported zero is distinguishable from "NA", and every parsed number keeps the
  text it came from.
- `data_flag` records validation warnings that never block a save.

### Form variants (4)

| Code | Sites | Notes |
|---|---|---|
| `FORM.COMMERCIAL.FY24` | Aurora, to Jan-2024 | rainwater row; grid = **non-renewable** |
| `FORM.COMMERCIAL.V1` | Aurora (from Feb-24), Centurion, Century Bhavan | green energy = **renewable** |
| `FORM.RESIDENTIAL.V1` | Tisya, Sangamwadi + 5 others | treated water, C&D + scrap |
| `FORM.RESIDENTIAL.F17` | Trimaya | Ref BRT/EHS/ESG/F-17, different rows |

⚠️ **The FY24/FY25 electricity inversion is the subtlest thing in this codebase.**
The same row position means opposite things:

```
FY24 form:    "Grid Electricity consumption"                → elec.grid   (non-renewable)
current form: "Grid Electricity consmuption ( Green Energy)" → elec.green  (renewable)
```

Mapping by row number instead of by form version would put ten months of grid
draw into renewable. `site_form_assignment` is date-bounded so historic months
render in the form they were actually filed under. Three tests defend this.

### Entry (`/data-collection/site-return`)

Central ESG team enters returns received from site teams. Routes:
`/api/esg/entry/{form,save,sites}`.

- **NA is a distinct state from zero**, with its own toggle. An untouched row is
  written nowhere at all.
- **Free text is parsed with the working shown** — `"58 kg"` on an MT row
  previews as `0.058 MT`, and the *server* runs the same parser so the UI can
  never show one number while the database stores another.
- **Unit conversion and multi-row aggregation happen server-side** from the field
  definition (Ltrs→kL, kg→MT; Level 8 + Level 13; DG1–DG4 hours).
- **Validation never blocks.** Rules run server-side and persist as flags;
  acknowledged flags survive a re-save.

### Resolver (`scripts/resolve-birla.mjs`)

`npm run esg:resolve`. Evaluates the 60-formula DAG per site × month in
`eval_order`, then portfolio rollups, then YTD. Safe expression parser in
`scripts/lib/formula-eval.mjs` — **not** `eval`; expressions come from a database
table.

Portfolio figures are **sums of site results**, not the formula re-run on summed
inputs. Those diverge as soon as a filter or ratio is involved.

### Dashboard (`/dashboard`)

Reads pre-computed `output_value`. The AI picks from a catalogue and never writes
SQL.

⚠️ The **ChartSpec wire format still says `plant_codes` and `compare_by: "plant"`**
because that vocabulary is persisted in saved tiles and the model-facing tool
schema. Renaming it would invalidate every stored tile. The mapping to `site`
happens in `fetch-chart-data.ts`.

"Current period" means the latest fiscal year **with data** — periods are seeded a
year ahead, so the newest year is empty and the model would otherwise default to
a blank chart.

### AI Context (`/ai-context`)

The company identity — name, logo, website, reporting year, business-context
narrative — used by the sidebar, the dashboard banner, and the fill agents.

Stored **per signed-in account** in `esg.ai_context_profile` (one row keyed by
the account id from the session cookie), reached through `/api/ai-context`. It
used to live only in `localStorage`, which made it per-browser: the same
credentials on another machine showed an empty "Your Organization" shell.

⚠️ `localStorage` is still written, but only as a **cache** — it exists so the
sidebar and banner paint the branding on the first frame instead of flashing a
placeholder, and so a dropped network doesn't blank it. A server read always
overwrites it, and it is cleared on both login and logout so one account never
inherits another's branding on a shared browser. Never treat it as the truth.

The logo is a downscaled (256px) data URL in a text column — no bucket, and it
arrives with the profile in one read.

### Export (`/data-collection/export`)

`GET /api/esg/export/environment?fy=2024-25` → `.xlsx`; `&report=1` → JSON diff.

Opens the client's **own** workbook and writes into exact cells. All 9 sheets, 137
merged ranges, styling preserved. Cell map: `src/lib/brsrExport/environmentMap.ts`.

⚠️ **Shared formulas.** The template compresses repeated formulas into 19 groups
(master + clones). Writing into a master orphans its clones and ExcelJS then
refuses to serialise the workbook *at all*:

```
Error: Shared Formula master must exist above and or left of clone for cell F70
```

`normalizeSharedFormulas.ts` expands every group to standalone formulas first.
This MUST run before any write. There is a JS mirror at
`scripts/lib/normalize-shared.mjs` for the standalone test — **keep the two in
step**.

---

## Tests

```bash
npm run esg:check            # seed + model + engine + entry  (116 assertions)
npm run esg:verify-resolver  # resolver vs known-good figures (24)
npm run esg:test-charts      # dashboard data path            (9, needs dev server)
npm run esg:test-export      # template population            (13)
```

`esg:test-charts` needs a dev server running (it goes over HTTP because those
modules are `server-only`); pass a base URL as argv[2] if not on :3113.

Most of these assert against figures the Middle Link reconstruction derived
independently. They are the reason a classification change is visible rather than
silent.

---

## Corrections made during the build — read this before trusting a test

**Three times, a failing test was my expectation being wrong, not the code.**
Each is now documented in the test itself. If one of these fails again, check the
arithmetic before changing the resolver.

1. **Groundwater, ±1,396 KL** (Phase 3). I asserted the published template's
   reclassification of Tisya's April groundwater to third-party. Our model stores
   it *as filed* and flags the inconsistency. Total withdrawal is identical either
   way — only the label moves.
2. **Tisya water, 1,824.63 vs 2,437.51** (Phase 4). 1,824.63 is the site's own
   *"total fresh water"* memo row, which excludes treated water. BRSR total
   withdrawal includes treated water as source (v). Difference: exactly 612.88.
3. **Site vs portfolio figures** (Phase 5). I asserted Aurora-only values where
   the BRSR template is a company-wide disclosure and the export correctly writes
   portfolio totals.

Also worth knowing: two bugs were invisible to build, typecheck and unit tests,
and only appeared when running against the live database — **response caching**
on the entry read routes, and the **server not parsing text** the UI previewed.
Test against real data.

---

## Open items needing an ESG-team decision

These are surfaced in the app rather than silently resolved, because deciding
either way would move a published figure.

1. **The 197,838.76 kWh renewable deduction.** The published template books
   11–16%/month *less* renewable electricity than Aurora reported over Apr–Aug 24.
   Attribution is certain — the odd decimal `.9992` appears in both Aurora's July
   return and the template — but the *reason* is undocumented and lives in rows
   10–11 of the missing GRID sheet. Modelled as an explicit signed input
   (`elec.renewable_adjustment`) so it stays visible. **Must be resolved before
   assurance.**
2. **Groundwater classification.** Tisya's Apr-24 groundwater (1,396 KL) was
   published as third-party water while Trimaya's Feb-25 (52 KL) stayed
   groundwater. Both stored as filed; inconsistency flagged.
3. **Four waste lines cannot be computed.** `waste.used_oil` and
   `waste.coolant_oil` are filed in litres, `waste.oil_filters_no` and
   `waste.battery_no` as counts, against MT-denominated BRSR lines. Seeded as
   explicit `0` formulas with `is_assumption = true` — supply a density or average
   unit weight and each becomes a real expression.
4. **Combustion factors are assumptions.** Diesel 2.65 / petrol 2.30 kg CO₂e/L
   give Scope 1 of 603.82 tCO₂e against a published 589.11 (+2.5%). The grid
   factor (0.727) is *not* an assumption — it is back-derived and reproduces
   published Scope 2 to 0.005 t.
5. **Sangamwadi appears in none of the template's site lists** despite filing a
   return that demonstrably reaches the December figures.
6. **Nov-23 water is byte-identical to Sept-23** in Aurora's FY24 file while
   electricity differs — almost certainly a copy-paste error in the source.
   Loaded as filed and raised as a `data_flag`.

---

## Known gaps / not done

- **The entry screen has never been clicked through by a human.** API verified
  end-to-end; the rendering has not been eyeballed. Worth doing first.
- **Safety exports.** No feed, no cell map. (HR and Procurement are DONE:
  Data Collection → HR & Procurement Return ingests the two monthly workbooks
  into GROUP-booked `input_value` rows — sheets are cumulative, so latest month
  = YTD — and the template export fills the `HR` and `Proc,Supply Chain, MKt`
  tabs from them. Layouts in `src/lib/hrProcReturn/`, seed in
  `supabase/esg/17_hr_procurement_inputs.sql`. The files' own contradictions
  remain the client's: HR reports 0 workers while Safety reports 15.59M
  contract man-hours; Procurement has two incompatible total-input bases
  differing 2.5×.)
- **Century Bhavan sheet** (energy + water only) is not exported.
- **Air emissions and refrigerants** come from half-yearly monitoring reports, not
  the monthly forms. The cell map handles them; no data has been entered.
- **No auth.** Hardcoded user in `Sidenav.tsx`, stub logout. Fine for now given
  the central-team entry model, but it means no per-site access control.
- **Legacy pages still exist:** `/data-collection/manual`, `/bulk`, `/document`,
  `/logbook` are cement-era and untouched. `plantTemplate.ts` and `logbook/data.ts`
  still contain cement vocabulary (`plantTemplate.ts` is generated from the
  Mattampally input sheet and its rows are clinker/OPC/PPC/GGBS — regenerating
  or retiring it is still open).
- **The Sagar site dropdown is gone.** `shared.tsx` hard-coded the seven Sagar
  Cements plants in a `SITES` const that fed the `ReportingPeriodCard` picker on
  those three legacy pages. `SITES`, the `Site` type and the `<select>` were
  removed; the card is now month/year only and `TemplateMeta` no longer carries
  a site (the generated workbook titles and filenames dropped it too). Real
  sites live in `esg.site` and are read per request — never hard-coded.
- **Auth is a real gate now.** Auto sign-in used to default ON, so any visit
  without a session silently minted one and the app appeared never to log
  anyone out. `AUTO_SIGN_IN_ENABLED` now requires an explicit
  `DEMO_AUTO_SIGN_IN=on`, and the session cookie carries no `maxAge`, making it
  a browser-session cookie that ends when the browser closes. The signed-out
  marker uses the new `PERSISTENT_COOKIE_OPTIONS` (7 days) so it survives a
  restart and an explicit logout still beats auto sign-in when that is on.
- The sandbox had **no network access** during Phase 1–2, so schema application
  and live verification happened later. `agent-runner/`'s `esgTool.ts` has since
  been repointed at `site` / `site_id` (`esg_list_plants` → `esg_list_sites`,
  `plantCode` → `siteCode`) and verified against the live database. Before that
  fix every ESG-database call from "Fill with AI" failed with *"Could not find
  the table 'esg.plant'"*, and the agent — left with only web search and a
  stale `'MATTAMPALLY'` example in its own tool description — filled BRSR
  fields from **Sagar Cements'** published report instead.
- The dashboard chart tool (`src/lib/ai/tools.ts`) still names its argument
  `plant_codes`. That is a wire contract shared with `chart-spec.ts`,
  `validate-spec.ts`, `fetch-chart-data.ts` and the dashboard chat route, so
  only the misleading cement example was replaced; the rename is still open.

---

## Environment

- Supabase project `enfdtatlnykbamvfmjjh`, schema `esg` **must be exposed** in
  Settings → API, and `APPLY_THIS_IN_SQL_EDITOR.sql` run for grants.
- `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, `VOYAGE_API_KEY`.
- Windows + Git Bash. Beware: `/tmp` paths do not resolve for `curl` or for Node
  module imports — write scratch files inside the project instead.
- `npx tsc --noEmit` and `npx next build` both pass.
