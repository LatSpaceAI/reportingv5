# AI Dashboard — setup

The `/dashboard` feature (natural-language → charts over the ESG database) is
built and compiles, but needs three one-time setup steps in your environment
before it runs end-to-end. These were surfaced while verifying against the live
Supabase project (`cylglbemupcdxcksjnqa`).

## 1. Add your OpenAI key

`.env.local` has Supabase configured but no OpenAI key. Add:

```
OPENAI_API_KEY=sk-...
```

The dashboard chat route (`/api/esg/dashboard/chat`) uses OpenAI (`gpt-4.1`) to
turn requests into chart specs. Without it, the omnibar returns a 500.

## 2. Expose + grant the `esg` schema to the API  (currently 403)

Right now the REST API returns `permission denied for schema esg` (HTTP 403) —
the existing `/api/esg/health` probe fails for the same reason, so this is a
pre-existing project-config gap, not specific to the dashboard.

a) **Supabase Dashboard → Settings → API → Exposed schemas**: add `esg` to the
   list (alongside `public`). Save.

b) Then run, in the SQL editor, the grants PostgREST's roles need:

```sql
grant usage on schema esg to anon, authenticated, service_role;
grant select, insert, update, delete
  on all tables in schema esg to service_role;
grant select on all tables in schema esg to anon, authenticated;
alter default privileges in schema esg
  grant select, insert, update, delete on tables to service_role;
```

Verify: `GET /api/esg/health` should return `ok: true` with row counts.

## 3. Apply the dashboard-tile migration

`esg.dashboard_tile` doesn't exist yet. Run the new migration once:

```
supabase/esg/09_dashboard_tiles.sql
```

(or paste its contents into the Supabase SQL editor). After step 2's grants,
the table will be reachable by the tiles routes.

## Then verify

1. `npm run dev`, open `/dashboard`.
2. Ask: "What's our total Scope 1 emissions?" → KPI card (GROUP, YTD).
3. "Show Scope 1 through the year for Mattampally" → 12-month line.
4. "Compare clinker factor across all plants" → bar across plants.
5. Pin a chart → reload → it persists and reloads live data; drag/resize → layout persists.

> Note: the data fetch reads pre-computed values from `esg.output_value` /
> `esg.input_value`.

## Resolver

`esg.output_value` starts empty, so charts render "No data" until the resolver
runs. `scripts/resolve-birla.mjs` evaluates the 60-formula DAG (safe expression
parser — no `eval`) over the entered site returns:

```
npm run esg:resolve           # compute output_value from input_value
npm run esg:resolve:dry       # compute + report, write nothing
npm run esg:verify-resolver   # check the output against known-good figures
npm run esg:check             # the whole suite (seed, model, engine, entry)
```

**There is no demo seeding.** Every figure traces to a monthly site return
entered through `/data-collection/site-return` or loaded by
`supabase/esg/08*_input_values_seed.sql`. A site-month with no return produces
no row at all — writing zeros would turn "nobody filed" into "a return of zero",
which is the one thing this model must never do.

That also means portfolio totals are **sums of what was filed, not estimates of
what occurred**. FY2024-25 currently has 8 of 77 site-months evidenced (~10%),
so every `output_value` row carries `sites_reporting` / `sites_expected` and the
dashboard should surface it wherever a portfolio figure is shown.

Re-run `esg:resolve` after entering new returns; it upserts, so it is safe to
run repeatedly.
