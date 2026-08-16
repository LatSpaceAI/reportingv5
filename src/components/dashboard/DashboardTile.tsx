"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { useToast } from "@/components/Toast";
import type { ChartSpec, ChartData } from "@/lib/dashboard/chart-spec";
import { downloadNodeAsJpg } from "@/lib/dashboard/export-jpg";

interface DashboardTileProps {
  tileId: string;
  spec: ChartSpec;
  onRemove: (id: string) => void;
  removeLabel: string;
  onAddToPreset: (id: string, anchor: DOMRect) => void;
}

interface TileDataResponse {
  tile: { id: string; spec: ChartSpec };
  data: ChartData;
}

// lucide: grip-vertical
function GripIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <circle cx="9" cy="5" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="15" cy="5" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="19" r="1.4" />
    </svg>
  );
}

// lucide: folder-plus
function FolderPlusIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10v6" />
      <path d="M9 13h6" />
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

// lucide: download
function DownloadIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

// lucide: x
function XIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function DashboardTile({
  tileId,
  spec,
  onRemove,
  removeLabel,
  onAddToPreset,
}: DashboardTileProps) {
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const q = useQuery<TileDataResponse>({
    queryKey: ["dashboard-tile-data", tileId],
    queryFn: async () => {
      const res = await fetch(`/api/esg/dashboard/tiles/${tileId}/data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  async function downloadTile() {
    const node = cardRef.current;
    if (!node || exporting) return;
    setExporting(true);
    try {
      await downloadNodeAsJpg(node, spec.title);
    } catch (err) {
      toast.show(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className="flex h-full w-full flex-col border border-[#0A0A0A]/10 bg-white"
    >
      <div className="flex flex-shrink-0 items-start justify-between gap-2 border-b border-[#0A0A0A]/[0.06] px-3 py-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <span
            data-export-exclude
            className="tile-drag-handle mt-0.5 flex-shrink-0 cursor-move text-[#0A0A0A]/25"
          >
            <GripIcon />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-[13px] font-medium text-[#0A0A0A]">
              {spec.title}
            </h4>
            <p className="mt-0.5 text-[10px] text-[#0A0A0A]/45">
              {q.data?.data.period_label ?? spec.period_code} · {spec.granularity}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center">
          <button
            type="button"
            data-export-exclude
            onClick={downloadTile}
            disabled={exporting || !q.data}
            aria-label="Download chart as JPG"
            title="Download chart as JPG"
            className="p-1 text-[#0A0A0A]/40 transition-colors hover:bg-[#0A0A0A]/[0.04] hover:text-[#0A0A0A] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#0A0A0A]/40"
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            data-export-exclude
            onClick={(e) =>
              onAddToPreset(tileId, e.currentTarget.getBoundingClientRect())
            }
            aria-label="Add to preset"
            title="Add to preset"
            className="p-1 text-[#0A0A0A]/40 transition-colors hover:bg-[#0A0A0A]/[0.04] hover:text-[#0A0A0A]"
          >
            <FolderPlusIcon />
          </button>
          <button
            type="button"
            data-export-exclude
            onClick={() => onRemove(tileId)}
            aria-label={removeLabel}
            title={removeLabel}
            className="p-1 text-[#0A0A0A]/40 transition-colors hover:bg-[#0A0A0A]/[0.04] hover:text-[#0A0A0A]"
          >
            <XIcon />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-2">
        {q.isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-[#0A0A0A]/40">
            Loading…
          </div>
        ) : q.error ? (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-red-600/80">
            {(q.error as Error).message}
          </div>
        ) : q.data ? (
          <ChartRenderer
            spec={spec}
            data={q.data.data}
            height={undefined as unknown as number}
          />
        ) : null}
      </div>
    </div>
  );
}
