import { HR_LAYOUT } from "./hrLayout";
import { PROC_LAYOUT } from "./procLayout";
import { normaliseLabel, type ReturnSheetLayout } from "./layoutTypes";

export const RETURN_LAYOUTS: ReturnSheetLayout[] = [HR_LAYOUT, PROC_LAYOUT];

export function layoutBySheetName(name: unknown): ReturnSheetLayout | null {
  const n = normaliseLabel(name);
  return RETURN_LAYOUTS.find((l) => normaliseLabel(l.sheetName) === n) ?? null;
}
