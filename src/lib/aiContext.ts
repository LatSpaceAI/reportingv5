// AI Context — the structured profile that grounds the AI assistant in the
// org's reporting situation (company, reports, VSME scope, reporting year, and a
// free-text business-context narrative).
//
// Ported from vsmev1's onboarding profile. The server-side VSME checklist and
// the Sculptor web-research feature are intentionally omitted here.
//
// WHERE THIS LIVES
//   Source of truth: esg.ai_context_profile, one row per signed-in account,
//   reached through /api/ai-context (see lib/aiContextRepo.ts). Scoping it to
//   the account is what makes the company name and logo follow the LOGIN.
//   Cache: localStorage, written on every successful read/save. It exists so
//   the sidebar and dashboard banner can paint the company identity on the
//   first frame instead of flashing "Your Organization" while the fetch is in
//   flight, and so a dropped network doesn't blank the branding. It is never
//   authoritative — a server read always overwrites it.
//
// Callers that need the saved profile should use `loadAiContext()`, which does
// both. `readAiContext()` is the synchronous cache read, for the initial paint.

export const AI_CONTEXT_KEY = "reporting-app/ai-context/v1";

/**
 * Window event fired after the profile is saved, so other client components
 * (e.g. the sidebar's org label) can re-read the latest value within the same
 * tab. (The native `storage` event only fires across tabs, not the writer's.)
 */
export const AI_CONTEXT_UPDATED_EVENT = "ai-context:updated";

/** Report types the org intends to produce. */
export type ReportType = "vsme" | "cdp_sme";

/** VSME module scope. */
export type VsmeModules = "basic" | "basic_comprehensive";

export interface VsmeContext {
  /** Why the org is doing VSME (free text — e.g. bank request, customer ask). */
  purpose: string;
  /** Basic module only, or Basic + Comprehensive. */
  modules: VsmeModules;
}

export interface AiContextProfile {
  /** Company name. */
  companyName: string;
  /**
   * Company logo as a data URL (e.g. "data:image/png;base64,…"), or null.
   * Stored inline because plato-v1 has no upload backend; kept small (the
   * uploader downscales) so it fits comfortably in the localStorage quota.
   */
  logoDataUrl: string | null;
  /** Public website URL. */
  websiteUrl: string;
  /** Which reports the org is producing. */
  reports: ReportType[];
  /** VSME-specific answers. Present/meaningful only when reports includes "vsme". */
  vsme: VsmeContext | null;
  /** Reporting year, e.g. 2025. */
  reportingYear: number | null;
  /**
   * Free-text business context describing what the company does, its sector,
   * operations, and sustainability-relevant footprint. Grounds the AI assistant
   * in company-specific knowledge.
   */
  businessContext: string;
  /** ISO timestamp of the last edit. */
  updatedAt: string | null;
}

/** Max length of the businessContext narrative (generous cap). */
export const BUSINESS_CONTEXT_MAX = 8000;

export const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: "vsme",
    label: "VSME",
    description: "EFRAG Voluntary Sustainability Reporting Standard for non-listed SMEs.",
  },
  {
    value: "cdp_sme",
    label: "CDP SME",
    description: "CDP climate disclosure questionnaire for small and mid-sized enterprises.",
  },
];

export const VSME_MODULE_OPTIONS: { value: VsmeModules; label: string; description: string }[] = [
  {
    value: "basic",
    label: "Basic Module only",
    description: "Disclosures B1–B11.",
  },
  {
    value: "basic_comprehensive",
    label: "Basic + Comprehensive Module",
    description: "Disclosures B1–B11 plus C1–C9.",
  },
];

/** An empty profile seeded with a company name (used as an editor default). */
export function emptyAiContextProfile(companyName = ""): AiContextProfile {
  return {
    companyName,
    logoDataUrl: null,
    websiteUrl: "",
    reports: [],
    vsme: null,
    reportingYear: null,
    businessContext: "",
    updatedAt: null,
  };
}

/** Accepted logo image types and the max stored size (post-downscale). */
export const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp";
export const LOGO_MAX_BYTES = 512 * 1024; // 512 KB data URL ceiling

/**
 * Coerce a stored (possibly legacy/partial) profile blob into the full current
 * shape, filling defaults for any missing field. Never throws — it's for reading
 * data the app itself wrote, where an older blob may simply lack newer keys.
 */
export function normalizeStoredProfile(
  stored: Partial<AiContextProfile> | null | undefined,
  fallbackName = "",
): AiContextProfile {
  const base = emptyAiContextProfile(fallbackName);
  if (!stored || typeof stored !== "object") return base;

  const reports = Array.isArray(stored.reports)
    ? stored.reports.filter(
        (r): r is ReportType => r === "vsme" || r === "cdp_sme",
      )
    : base.reports;

  const vsme: VsmeContext | null = reports.includes("vsme")
    ? {
        purpose:
          typeof stored.vsme?.purpose === "string" ? stored.vsme.purpose : "",
        modules:
          stored.vsme?.modules === "basic_comprehensive"
            ? "basic_comprehensive"
            : "basic",
      }
    : null;

  return {
    companyName:
      typeof stored.companyName === "string" ? stored.companyName : fallbackName,
    logoDataUrl:
      typeof stored.logoDataUrl === "string" && stored.logoDataUrl.startsWith("data:")
        ? stored.logoDataUrl
        : null,
    websiteUrl: typeof stored.websiteUrl === "string" ? stored.websiteUrl : "",
    reports,
    vsme,
    reportingYear:
      typeof stored.reportingYear === "number" ? stored.reportingYear : null,
    businessContext:
      typeof stored.businessContext === "string" ? stored.businessContext : "",
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  };
}

/**
 * Validate and normalize an unknown value into an AiContextProfile. Returns
 * `{ profile }` on success or `{ error }` with a human-readable message.
 */
export function parseAiContextProfile(
  input: unknown,
): { profile: AiContextProfile } | { error: string } {
  if (typeof input !== "object" || input === null) {
    return { error: "Profile must be an object." };
  }
  const raw = input as Record<string, unknown>;

  const companyName = typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  if (!companyName) return { error: "Company name is required." };
  if (companyName.length > 120) {
    return { error: "Company name must be 120 characters or fewer." };
  }

  const logoDataUrl =
    typeof raw.logoDataUrl === "string" && raw.logoDataUrl.startsWith("data:")
      ? raw.logoDataUrl
      : null;
  if (logoDataUrl && logoDataUrl.length > LOGO_MAX_BYTES * 2) {
    // data URLs are ~33% larger than the bytes they encode; allow generous slack.
    return { error: "Logo image is too large. Use one under 512 KB." };
  }

  const websiteUrl = typeof raw.websiteUrl === "string" ? raw.websiteUrl.trim() : "";
  if (websiteUrl.length > 300) {
    return { error: "Website URL must be 300 characters or fewer." };
  }

  const reportsRaw = Array.isArray(raw.reports) ? raw.reports : [];
  const reports = reportsRaw.filter(
    (r): r is ReportType => r === "vsme" || r === "cdp_sme",
  );

  let vsme: VsmeContext | null = null;
  if (reports.includes("vsme")) {
    const v =
      typeof raw.vsme === "object" && raw.vsme !== null
        ? (raw.vsme as Record<string, unknown>)
        : {};
    const modules = v.modules === "basic_comprehensive" ? "basic_comprehensive" : "basic";
    const purpose = typeof v.purpose === "string" ? v.purpose.trim() : "";
    if (purpose.length > 1000) {
      return { error: "VSME purpose must be 1000 characters or fewer." };
    }
    vsme = { purpose, modules };
  }

  let reportingYear: number | null = null;
  if (raw.reportingYear !== null && raw.reportingYear !== undefined && raw.reportingYear !== "") {
    const year = Number(raw.reportingYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: "Reporting year must be a year between 2000 and 2100." };
    }
    reportingYear = year;
  }

  const businessContext =
    typeof raw.businessContext === "string" ? raw.businessContext.trim() : "";
  if (businessContext.length > BUSINESS_CONTEXT_MAX) {
    return {
      error: `Business context must be ${BUSINESS_CONTEXT_MAX} characters or fewer.`,
    };
  }

  return {
    profile: {
      companyName,
      logoDataUrl,
      websiteUrl,
      reports,
      vsme,
      reportingYear,
      businessContext,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    },
  };
}

/**
 * Read the cached profile from localStorage (null if nothing cached).
 *
 * Synchronous, so it's what the sidebar and banner paint with before the
 * server read lands. It can be stale — for the saved truth use loadAiContext().
 */
export function readAiContext(): AiContextProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const rawStr = localStorage.getItem(AI_CONTEXT_KEY);
    if (!rawStr) return null;
    return normalizeStoredProfile(JSON.parse(rawStr) as Partial<AiContextProfile>);
  } catch {
    return null;
  }
}

/** Write the local cache and tell same-tab listeners the profile changed. */
export function writeAiContext(profile: AiContextProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_CONTEXT_KEY, JSON.stringify(profile));
  } catch {}
  // The native `storage` event only fires in OTHER tabs, so the writer's own
  // sidebar/banner need this one.
  window.dispatchEvent(new Event(AI_CONTEXT_UPDATED_EVENT));
}

/** Drop the cached profile — used on sign-out so the next login starts clean. */
export function clearAiContextCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AI_CONTEXT_KEY);
  } catch {}
  window.dispatchEvent(new Event(AI_CONTEXT_UPDATED_EVENT));
}

/**
 * Fetch the signed-in account's saved profile from the server and refresh the
 * local cache with it.
 *
 * Returns null when the profile could not be fetched (offline, 401, server
 * error). Callers should keep showing whatever `readAiContext()` gave them in
 * that case rather than blanking the branding — a failed refresh is not
 * evidence that the profile is empty.
 */
export async function loadAiContext(): Promise<AiContextProfile | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/ai-context", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { profile?: Partial<AiContextProfile> };
    if (!body?.profile) return null;
    const profile = normalizeStoredProfile(body.profile);
    writeAiContext(profile);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Persist the profile for the signed-in account. The cache is updated only
 * after the server accepts the write, so a failed save can't leave the browser
 * showing a company name the account doesn't actually have.
 *
 * Throws with a human-readable message on failure.
 */
export async function saveAiContext(
  profile: AiContextProfile,
): Promise<AiContextProfile> {
  const res = await fetch("/api/ai-context", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });

  const body = (await res.json().catch(() => null)) as
    | { profile?: Partial<AiContextProfile>; error?: string }
    | null;

  if (!res.ok) {
    throw new Error(body?.error || `Could not save AI context (${res.status}).`);
  }
  // A signed-out PUT is redirected to the login page, which answers 200 with
  // HTML. Without this the save would look like it succeeded and the cache
  // would be updated with a profile the server never stored.
  if (!body?.profile) {
    throw new Error("Could not save AI context — you may have been signed out.");
  }

  const saved = normalizeStoredProfile(body.profile);
  writeAiContext(saved);
  return saved;
}
