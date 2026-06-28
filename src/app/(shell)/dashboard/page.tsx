import { DashboardClient } from "@/components/dashboard/DashboardClient";

// The AI Dashboard: natural-language → charts over the ESG database, with
// pin-to-dashboard persistence. All data access happens server-side via the
// /api/esg/dashboard/* routes.
export default function DashboardPage() {
  return <DashboardClient />;
}
