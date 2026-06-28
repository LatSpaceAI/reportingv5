"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import type { ChartSpec, ChartData } from "@/lib/dashboard/chart-spec";
import { useToast } from "@/components/Toast";

interface ChartMessageProps {
  spec: ChartSpec;
  data: ChartData;
  pinned?: boolean;
  onPinned?: () => void;
}

// lucide: pin
function PinIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

// lucide: check
function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ChartMessage({ spec, data, pinned, onPinned }: ChartMessageProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const pin = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/esg/dashboard/tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.show("Pinned to dashboard");
      qc.invalidateQueries({ queryKey: ["dashboard-tiles"] });
      onPinned?.();
    },
    onError: (e) => toast.show(`Pin failed: ${(e as Error).message}`),
  });

  const isPinned = pinned || pin.isSuccess;

  return (
    <div className="border border-[#0A0A0A]/10 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#0A0A0A]/[0.06] px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium text-[#0A0A0A]">
            {spec.title}
          </h4>
          <p className="mt-0.5 text-[11px] text-[#0A0A0A]/50">
            {data.period_label} · {spec.granularity} · {data.series.length} series
          </p>
        </div>
        <button
          type="button"
          onClick={() => !isPinned && !pin.isPending && pin.mutate()}
          disabled={isPinned || pin.isPending}
          className="inline-flex flex-shrink-0 items-center gap-1.5 border border-[#0A0A0A]/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 transition-colors hover:border-[#074D47]/50 hover:text-[#074D47] disabled:cursor-default disabled:opacity-60"
        >
          {isPinned ? <CheckIcon /> : <PinIcon />}
          {isPinned ? "Pinned" : pin.isPending ? "Pinning…" : "Pin"}
        </button>
      </div>
      <div className="p-3">
        <ChartRenderer spec={spec} data={data} height={240} />
      </div>
    </div>
  );
}
