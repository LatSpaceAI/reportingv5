import { DashboardClient } from "@/components/dashboard/DashboardClient";

// The dashboard is the app's front page — the first thing a user sees after
// signing in. The reporting/disclosures landing page it replaced now lives at
// /reporting. The older /dashboard path redirects here so existing links and
// bookmarks still resolve.
export default function HomePage() {
  return <DashboardClient />;
}
