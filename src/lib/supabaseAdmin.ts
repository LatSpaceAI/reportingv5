import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for the ESG database.
 *
 * Uses the service_role key (bypasses RLS) and is scoped to the `esg` schema,
 * so `.from("input_value")` etc. resolve to `esg.*` without a prefix.
 *
 * NEVER import this from a Client Component — the `server-only` package will
 * throw at build time if you do. The service_role key must never reach the
 * browser.
 *
 * The client is created LAZILY on first use rather than at module load. Next's
 * "Collecting page data" step imports every route at build time; eagerly
 * reading the env here would throw during the build on any host that doesn't
 * inject the Supabase env at build time (e.g. Vercel). Deferring to first
 * access means the env is only required when a request actually runs.
 */
function createEsgClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // NEXT PATCHES fetch AND CACHES GET REQUESTS BY DEFAULT.
      //
      // PostgREST reads are GETs, so without this a repeated query returns the
      // response Next cached the first time — and it does so INSIDE the client,
      // where no amount of `no-store` on our own route headers can reach it.
      //
      // The symptom is a read that silently disagrees with the database: a
      // constant edited a moment ago still reporting its old updated_at, so the
      // staleness banner never appears. BIRLA_ESTATES.md records the same root
      // cause biting the entry read routes; this is the same bug one layer down,
      // and `dynamic = "force-dynamic"` on a route does not fix it either.
      //
      // Every read here is of live operational data whose whole value is being
      // current, so there is no query in this app that wants the cache.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

// Inferred from createEsgClient so the schema generic stays "esg" — annotating
// with the bare SupabaseClient type would widen it to the default "public"
// schema and fail to type-check against esg.* tables.
type EsgClient = ReturnType<typeof createEsgClient>;

let client: EsgClient | null = null;

function getClient(): EsgClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.local.example)."
    );
  }

  client = createEsgClient(url, serviceRoleKey);
  return client;
}

/**
 * Proxy that forwards every access to the lazily-created client. Call sites use
 * `supabaseAdmin.from(...)` exactly as before; the real client is built on the
 * first property read, which only happens at request time.
 */
export const supabaseAdmin = new Proxy({} as EsgClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
