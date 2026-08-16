"use client";

import { useState } from "react";

import { useToast } from "@/components/Toast";
import { downloadNodeAsJpg } from "@/lib/dashboard/export-jpg";

interface DashboardExportButtonProps {
  targetRef: React.MutableRefObject<HTMLDivElement | null>;
  presetName: string | null;
  disabled?: boolean;
}

// lucide: download
function DownloadIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

/** Downloads the current dashboard grid as a JPG. */
export function DashboardExportButton({
  targetRef,
  presetName,
  disabled,
}: DashboardExportButtonProps) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  async function download() {
    const node = targetRef.current;
    if (!node || exporting) return;
    setExporting(true);
    try {
      await downloadNodeAsJpg(node, presetName ?? "All pins");
    } catch (err) {
      toast.show(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || exporting}
      className="inline-flex flex-shrink-0 items-center gap-1.5 border border-[#0A0A0A]/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 transition-colors hover:border-[#074D47]/50 hover:text-[#074D47] disabled:cursor-default disabled:opacity-40"
    >
      <DownloadIcon />
      {exporting ? "Exporting…" : "Download JPG"}
    </button>
  );
}
