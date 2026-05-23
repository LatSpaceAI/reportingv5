"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Questionnaire, type QuestionnaireConfig } from "@/components/Questionnaire";
import { QualitativeReport } from "@/components/qualitative/QualitativeReport";
import { getFramework } from "@/lib/frameworks";

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
    version:
      fw.id === "cbam"
        ? "v2.1.1"
        : fw.id === "rco"
        ? "30-Sep-2025"
        : fw.id === "ccts"
        ? "BEE Aluminium Pro-Forma (FY 2023-24 v1.4)"
        : fw.id === "brsr"
        ? "SEBI Annexure I"
        : fw.id === "cdp"
        ? "CDP 2026"
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
        : fw.id === "brsr"
        ? async () => {
            const { exportBrsrFilled } = await import("@/lib/brsrExport/export");
            await exportBrsrFilled();
          }
        : fw.id === "cdp"
        ? async () => {
            const { exportCdpFilled } = await import("@/lib/cdpExport/export");
            await exportCdpFilled();
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
