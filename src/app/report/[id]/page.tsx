"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Questionnaire, type QuestionnaireConfig } from "@/components/Questionnaire";
import { QualitativeReport } from "@/components/qualitative/QualitativeReport";
import { getFramework } from "@/lib/frameworks";
import { CCTS_SEED, CCTS_SEED_VERSION } from "@/lib/cctsSeed";
import { CBAM_SEED, CBAM_SEED_VERSION } from "@/lib/cbamSeed";

export default function ReportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? undefined;
  const fw = getFramework(id);

  if (!fw || fw.status !== "active") {
    return <NotAvailable name={fw?.shortName} />;
  }

  if (fw.variant === "qualitative") {
    return <QualitativeReport frameworkId={fw.id} frameworkName={fw.shortName} />;
  }

  if (!fw.sections || !fw.storageKey) {
    return <NotAvailable name={fw.shortName} />;
  }

  const config: QuestionnaireConfig = {
    sections: fw.sections,
    storageKey: fw.storageKey,
    frameworkId: fw.id,
    frameworkName: fw.shortName,
    // Demo-mode seed:
    //   - CCTS Aluminium → BEE Aluminium Pro-Forma baseline values
    //     (Hindalco, FY 2023-24).
    //   - CBAM → Hindalco Renukoot CY'25 Communication workbook values.
    //     CBAM also has a hand-curated SOT pre-fill (52 calculated cells)
    //     which takes priority; the seed only fills the rest.
    // The seed only writes on first open (or after the seed version bumps);
    // user edits persist.
    seed:
      fw.id === "ccts"
        ? CCTS_SEED
        : fw.id === "cbam"
        ? CBAM_SEED
        : undefined,
    seedVersion:
      fw.id === "ccts"
        ? CCTS_SEED_VERSION
        : fw.id === "cbam"
        ? CBAM_SEED_VERSION
        : undefined,
    version:
      fw.id === "cbam"
        ? "v2.1.1"
        : fw.id === "rco"
        ? "30-Sep-2025"
        : fw.id === "ccts"
        ? "BEE Aluminium Pro-Forma (FY 2023-24 v1.4)"
        : undefined,
    exportNeedsPeriod: fw.id === "cbam",
    onExport:
      fw.id === "cbam"
        ? async (opts) => {
            const { exportCbamFilled } = await import("@/lib/cbamExport/export");
            await exportCbamFilled(opts?.period);
          }
        : fw.id === "rco"
        ? async () => {
            const { exportRcoFilled } = await import("@/lib/rcoExport/export");
            await exportRcoFilled();
          }
        : fw.id === "ccts"
        ? async () => {
            const { exportCctsFilled } = await import("@/lib/cctsExport/export");
            await exportCctsFilled();
          }
        : undefined,
  };

  return <Questionnaire config={config} initialQuestionId={q} />;
}

function NotAvailable({ name }: { name?: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {name ? `${name} is coming soon` : "Report not found"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {name
            ? "This framework hasn't been enabled yet. Check back soon."
            : "We couldn't find a report with that id."}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          ← Back to Disclosures &amp; Reports
        </Link>
      </div>
    </div>
  );
}
