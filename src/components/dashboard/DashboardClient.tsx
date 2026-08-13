"use client";

import { useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import { AiSearchBar } from "@/components/dashboard/AiSearchBar";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { DashboardExportButton } from "@/components/dashboard/DashboardExportButton";
import { DashboardGrid, useTilesQuery } from "@/components/dashboard/DashboardGrid";
import { PresetSwitcher } from "@/components/dashboard/PresetSwitcher";
import { ActivePresetProvider } from "@/components/dashboard/active-preset-context";
import type { PresetRow } from "@/lib/dashboard/presets-repo";

const ACTIVE_PRESET_KEY = "plato.dashboard.active-preset";

/**
 * Client island for the AI Dashboard: owns the React Query cache shared by the
 * omnibar's "pin" mutation and the tile grid, so pinning a chart immediately
 * refreshes the grid.
 */
export function DashboardClient() {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <DashboardInner />
    </QueryClientProvider>
  );
}

function DashboardInner() {
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the last-open preset in an effect (not the state initializer) to
  // avoid an SSR/client hydration mismatch.
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_PRESET_KEY);
    if (stored) setActivePresetId(stored);
  }, []);

  const presetsQ = useQuery<{ presets: PresetRow[] }>({
    queryKey: ["dashboard-presets"],
    queryFn: async () => {
      const res = await fetch("/api/esg/dashboard/presets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  const presets = presetsQ.data?.presets ?? [];

  // If the stored preset was deleted elsewhere, fall back to All pins.
  useEffect(() => {
    if (!presetsQ.data || !activePresetId) return;
    if (!presetsQ.data.presets.some((p) => p.id === activePresetId)) {
      setActivePresetId(null);
      localStorage.removeItem(ACTIVE_PRESET_KEY);
    }
  }, [presetsQ.data, activePresetId]);

  function selectPreset(id: string | null) {
    setActivePresetId(id);
    if (id) localStorage.setItem(ACTIVE_PRESET_KEY, id);
    else localStorage.removeItem(ACTIVE_PRESET_KEY);
  }

  const activePresetName = activePresetId
    ? presets.find((p) => p.id === activePresetId)?.name ?? null
    : null;

  // Same cache entry the grid uses — just here for the export disabled state.
  const tilesQ = useTilesQuery(activePresetId);
  const tileCount = tilesQ.data?.tiles.length ?? 0;

  return (
    <ActivePresetProvider value={{ activePresetId, activePresetName }}>
      <div className="px-8 py-6">
        <DashboardBanner />

        <div className="mb-4 flex items-center justify-between gap-3">
          <PresetSwitcher
            presets={presets}
            activePresetId={activePresetId}
            onSelect={selectPreset}
          />
          <DashboardExportButton
            targetRef={exportRef}
            presetName={activePresetName}
            disabled={tileCount === 0}
          />
        </div>

        <div className="mb-8 max-w-3xl">
          <AiSearchBar />
        </div>

        <DashboardGrid presetId={activePresetId} exportRef={exportRef} />
      </div>
    </ActivePresetProvider>
  );
}
