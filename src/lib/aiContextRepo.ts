// AI Context profile storage — server side.
//
// One row per signed-in account in esg.ai_context_profile, so the company name
// and logo follow the credentials rather than the browser. The client mirrors
// the profile into localStorage as a cache (see lib/aiContext.ts), but this is
// the source of truth.

import "server-only";

import {
  emptyAiContextProfile,
  normalizeStoredProfile,
  type AiContextProfile,
} from "@/lib/aiContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = "ai_context_profile";

/** The row shape as stored (snake_case columns). */
interface ProfileRow {
  account_id: string;
  company_name: string | null;
  logo_data_url: string | null;
  website_url: string | null;
  reports: unknown;
  vsme: unknown;
  reporting_year: number | null;
  business_context: string | null;
  updated_at: string | null;
}

function rowToProfile(row: ProfileRow): AiContextProfile {
  // normalizeStoredProfile does the validation/defaulting for the JSON-ish
  // fields (reports, vsme), so the row only has to be renamed into its shape.
  return normalizeStoredProfile({
    companyName: row.company_name ?? "",
    logoDataUrl: row.logo_data_url ?? null,
    websiteUrl: row.website_url ?? "",
    reports: row.reports as AiContextProfile["reports"],
    vsme: row.vsme as AiContextProfile["vsme"],
    reportingYear: row.reporting_year ?? null,
    businessContext: row.business_context ?? "",
    updatedAt: row.updated_at ?? null,
  });
}

/**
 * The profile saved for an account, or null when the account has never saved
 * one (so the caller can tell "nothing stored yet" from "stored but empty").
 */
export async function getAiContextProfile(
  accountId: string,
): Promise<AiContextProfile | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(
      "account_id, company_name, logo_data_url, website_url, reports, vsme, reporting_year, business_context, updated_at",
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error(`Could not read AI context: ${error.message}`);
  if (!data) return null;
  return rowToProfile(data as ProfileRow);
}

/** Insert or replace the account's profile; returns what was stored. */
export async function saveAiContextProfile(
  accountId: string,
  profile: AiContextProfile,
): Promise<AiContextProfile> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      {
        account_id: accountId,
        company_name: profile.companyName,
        logo_data_url: profile.logoDataUrl,
        website_url: profile.websiteUrl,
        reports: profile.reports,
        vsme: profile.vsme,
        reporting_year: profile.reportingYear,
        business_context: profile.businessContext,
      },
      { onConflict: "account_id" },
    )
    .select(
      "account_id, company_name, logo_data_url, website_url, reports, vsme, reporting_year, business_context, updated_at",
    )
    .single();

  if (error) throw new Error(`Could not save AI context: ${error.message}`);
  return rowToProfile(data as ProfileRow);
}

/**
 * The profile to render for an account, falling back to a profile seeded with
 * the account's organization name. A brand-new account should show "Birla
 * Estates" in the sidebar rather than "Your Organization", since we already
 * know the org from the credentials.
 */
export async function getAiContextProfileOrDefault(
  accountId: string,
  organization: string,
): Promise<AiContextProfile> {
  const stored = await getAiContextProfile(accountId);
  return stored ?? emptyAiContextProfile(organization);
}
