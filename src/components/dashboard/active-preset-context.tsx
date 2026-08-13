"use client";

import { createContext, useContext } from "react";

/**
 * The preset currently open on the dashboard. Lets deeply nested components
 * (e.g. the omnibar's ChartMessage pin button) target the open preset without
 * threading props through the chat renderer. Null means the "All pins" view.
 */
export interface ActivePreset {
  activePresetId: string | null;
  activePresetName: string | null;
}

const ActivePresetContext = createContext<ActivePreset>({
  activePresetId: null,
  activePresetName: null,
});

export const ActivePresetProvider = ActivePresetContext.Provider;

export function useActivePreset(): ActivePreset {
  return useContext(ActivePresetContext);
}
