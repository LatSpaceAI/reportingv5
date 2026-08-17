-- =============================================================================
-- ESG DATA TOOL — AI Context profile (per signed-in account)
--
-- The company identity shown across the app (name + logo) and the narrative
-- that grounds the AI assistant. This used to live only in the browser's
-- localStorage, which meant it was per-BROWSER rather than per-LOGIN: the same
-- credentials on another machine — or after clearing site data — landed on an
-- empty "Your Organization" shell. One row per account fixes that.
--
-- account_id is the demo account id from lib/auth.ts (the value carried in the
-- session cookie), not a uuid, so the row survives the switch to real auth as
-- long as the identifier is carried across. See [[auth]].
--
-- The logo is stored inline as a data URL. It is capped client-side (the
-- uploader downscales to 256px and rejects anything over ~512 KB), so a text
-- column is the whole storage story — no bucket, no signed URLs, and the logo
-- arrives with the profile in a single read.
-- =============================================================================
set search_path = esg, public;

create table if not exists esg.ai_context_profile (
    account_id        text primary key,
    company_name      text not null default '',
    logo_data_url     text,
    website_url       text not null default '',
    reports           jsonb not null default '[]'::jsonb,
    vsme              jsonb,
    reporting_year    integer,
    business_context  text not null default '',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

drop trigger if exists ai_context_profile_set_updated_at on esg.ai_context_profile;
create trigger ai_context_profile_set_updated_at
    before update on esg.ai_context_profile
    for each row execute function esg.set_updated_at();

grant select, insert, update, delete on esg.ai_context_profile to service_role;

notify pgrst, 'reload schema';
