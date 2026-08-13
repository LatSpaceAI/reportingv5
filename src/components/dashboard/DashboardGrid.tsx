"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { DashboardTile } from "@/components/dashboard/DashboardTile";
import { PickerPopover } from "@/components/qualitative/PickerPopover";
import { useToast } from "@/components/Toast";
import type { ChartSpec } from "@/lib/dashboard/chart-spec";
import type { TileRow, TileLayout } from "@/lib/dashboard/tiles-repo";
import type { PresetRow } from "@/lib/dashboard/presets-repo";

const COLS = 12;
const ROW_HEIGHT = 56;
const MARGIN: [number, number] = [12, 12];

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

function minHFor(kind: ChartSpec["kind"]): number {
  return kind === "kpi" ? 2 : 4;
}

/** Tiles for the open view: all pins (null) or one preset. Shared with the
 *  export button's disabled state via the query cache. */
export function useTilesQuery(presetId: string | null) {
  return useQuery<{ tiles: TileRow[] }>({
    queryKey: ["dashboard-tiles", presetId ?? "all"],
    queryFn: async () => {
      const url = presetId
        ? `/api/esg/dashboard/presets/${presetId}/tiles`
        : "/api/esg/dashboard/tiles";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

interface DashboardGridProps {
  presetId: string | null;
  exportRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function DashboardGrid({ presetId, exportRef }: DashboardGridProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  // Tile whose "add to preset" picker is open, plus the picker's anchor.
  const [pickerState, setPickerState] = useState<{
    tileId: string;
    position: { top: number; left: number };
  } | null>(null);

  const tilesKey = ["dashboard-tiles", presetId ?? "all"];

  // Callback ref: measures the container whenever it mounts (which may be AFTER
  // the tiles query resolves, since the container only renders in some states).
  // A plain useEffect+ref deadlocks — the ref'd node isn't mounted while the
  // query is still loading, so the observer never attaches and width stays 0.
  const measureRef = useCallback(
    (el: HTMLDivElement | null) => {
      roRef.current?.disconnect();
      exportRef.current = el;
      if (!el) return;
      const measure = () => setWidth(el.clientWidth);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      roRef.current = ro;
    },
    [exportRef]
  );

  useEffect(() => () => roRef.current?.disconnect(), []);

  const q = useTilesQuery(presetId);

  const presetsQ = useQuery<{ presets: PresetRow[] }>({
    queryKey: ["dashboard-presets"],
    queryFn: async () => {
      const res = await fetch("/api/esg/dashboard/presets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  const presets = presetsQ.data?.presets ?? [];

  const tiles = useMemo(() => q.data?.tiles ?? [], [q.data]);

  const layouts: LayoutItem[] = useMemo(
    () =>
      tiles.map((t) => ({
        i: t.id,
        x: t.layout.x ?? 0,
        y: t.layout.y ?? 0,
        w: t.layout.w ?? (t.spec.kind === "kpi" ? 4 : 6),
        h: t.layout.h ?? (t.spec.kind === "kpi" ? 3 : 6),
        minW: t.spec.kind === "kpi" ? 2 : 3,
        minH: minHFor(t.spec.kind),
      })),
    [tiles]
  );

  const patchLayout = useMutation({
    mutationFn: async (args: { id: string; layout: TileLayout }) => {
      const url = presetId
        ? `/api/esg/dashboard/presets/${presetId}/tiles/${args.id}`
        : `/api/esg/dashboard/tiles/${args.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: args.layout }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: tilesKey });
      const prev = qc.getQueryData<{ tiles: TileRow[] }>(tilesKey);
      if (prev) {
        qc.setQueryData<{ tiles: TileRow[] }>(tilesKey, {
          tiles: prev.tiles.map((t) =>
            t.id === args.id ? { ...t, layout: args.layout } : t
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(tilesKey, ctx.prev);
    },
  });

  // In a preset, removing only drops the membership; in All pins it deletes
  // the tile everywhere (DB cascades the preset memberships).
  const removeTile = useMutation({
    mutationFn: async (id: string) => {
      const url = presetId
        ? `/api/esg/dashboard/presets/${presetId}/tiles/${id}`
        : `/api/esg/dashboard/tiles/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-tiles"] }),
  });

  const addToPreset = useMutation({
    mutationFn: async (args: { presetId: string; tileId: string }) => {
      const res = await fetch(
        `/api/esg/dashboard/presets/${args.presetId}/tiles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileId: args.tileId }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_d, args) => {
      const name = presets.find((p) => p.id === args.presetId)?.name;
      toast.show(name ? `Added to "${name}"` : "Added to preset");
      qc.invalidateQueries({ queryKey: ["dashboard-tiles", args.presetId] });
    },
    onError: (e) => toast.show(`Add failed: ${(e as Error).message}`),
  });

  function onLayoutChange(next: LayoutItem[]) {
    const byId = new Map(layouts.map((l) => [l.i, l]));
    for (const item of next) {
      const prev = byId.get(item.i);
      if (!prev) continue;
      if (
        prev.x !== item.x ||
        prev.y !== item.y ||
        prev.w !== item.w ||
        prev.h !== item.h
      ) {
        patchLayout.mutate({
          id: item.i,
          layout: { x: item.x, y: item.y, w: item.w, h: item.h },
        });
      }
    }
  }

  function openPresetPicker(tileId: string, anchor: DOMRect) {
    setPickerState({
      tileId,
      position: {
        top: anchor.bottom + 6,
        left: Math.max(8, anchor.right - 320),
      },
    });
  }

  // Presets the picker offers: everything except the currently open one.
  const pickerItems = presets
    .filter((p) => p.id !== presetId)
    .map((p) => ({ id: p.id, primary: p.name }));

  // The measured container is ALWAYS rendered so the ResizeObserver attaches
  // regardless of query state; the state-specific UI lives inside it.
  return (
    <div ref={measureRef} className="w-full">
      {q.isLoading ? (
        <div className="py-12 text-center text-sm text-[#0A0A0A]/40">
          Loading dashboard…
        </div>
      ) : q.error ? (
        <div className="py-12 text-center text-sm text-red-600/80">
          {(q.error as Error).message}
        </div>
      ) : tiles.length === 0 ? (
        <div className="border border-dashed border-[#0A0A0A]/15 py-16 text-center text-sm text-[#0A0A0A]/45">
          {presetId
            ? "This preset is empty. Pin a chart from the search bar above, or add an existing tile from All pins."
            : "No pinned charts yet. Ask for a chart above and pin it to build your dashboard."}
        </div>
      ) : width > 0 ? (
        <GridLayout
          className="layout"
          layout={layouts}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          margin={MARGIN}
          draggableHandle=".tile-drag-handle"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms
        >
          {tiles.map((t) => (
            <div key={t.id}>
              <DashboardTile
                tileId={t.id}
                spec={t.spec}
                onRemove={(id) => removeTile.mutate(id)}
                removeLabel={presetId ? "Remove from preset" : "Delete tile"}
                onAddToPreset={openPresetPicker}
              />
            </div>
          ))}
        </GridLayout>
      ) : (
        // width not measured yet (first paint after tiles load) — placeholder
        // keeps the container mounted so measureRef can fire.
        <div className="py-12 text-center text-sm text-[#0A0A0A]/40">
          Preparing layout…
        </div>
      )}

      <PickerPopover
        open={pickerState !== null}
        onClose={() => setPickerState(null)}
        title="Add to preset"
        items={pickerItems}
        position={pickerState?.position}
        emptyLabel="No other presets. Create one from the preset menu above."
        onPick={(id) => {
          if (pickerState)
            addToPreset.mutate({ presetId: id, tileId: pickerState.tileId });
        }}
      />
    </div>
  );
}
