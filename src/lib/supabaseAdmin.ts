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
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.local.example)."
  );
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  db: { schema: "esg" },
  auth: { persistSession: false, autoRefreshToken: false },
});
