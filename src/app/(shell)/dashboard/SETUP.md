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

## Resolver / demo data

`esg.output_value` and `esg.input_value` start empty, so charts render "No data"
until populated. `scripts/resolve-esg.mjs` seeds plausible inputs for every
plant × period and evaluates the 62-formula DAG (safe expression parser — no
`eval`) into `esg.output_value`:

```
npm run esg:resolve         # seed inputs (if empty) + compute outputs
npm run esg:reseed          # overwrite inputs (new random demo data) + recompute
npm run esg:test-resolver   # unit-test the expression engine (18 cases)
```

The seed is **synthetic demo data**, but anchored to realistic per-plant clinker
tonnage so KPIs land in believable ranges (SHC ~820 kcal/kg, SEC ~100 kWh/t,
clinker factor ~0.67-0.76, TSR ~20%, grinding units correctly show 0 clinker).
Replace it with real `input_value` data and re-run `esg:resolve --resolve-only`
to compute outputs from actual inputs.
