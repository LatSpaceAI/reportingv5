"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AiSearchBar } from "@/components/dashboard/AiSearchBar";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";

/**
 * Client island for the AI Dashboard: owns the React Query cache shared by the
 * omnibar's "pin" mutation and the tile grid, so pinning a chart immediately
 * refreshes the grid.
 */
export function DashboardClient() {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <div className="px-8 py-6">
        <DashboardBanner />

        <div className="mb-8 max-w-3xl">
          <AiSearchBar />
        </div>

        <DashboardGrid />
      </div>
    </QueryClientProvider>
  );
}
