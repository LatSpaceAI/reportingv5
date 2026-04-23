"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Questionnaire } from "@/components/Questionnaire";
import { getFramework } from "@/lib/frameworks";

export default function ReportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? undefined;
  const fw = getFramework(id);

  if (!fw || fw.status !== "active") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            {fw ? `${fw.shortName} is coming soon` : "Report not found"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {fw
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

  return <Questionnaire initialQuestionId={q} />;
}
