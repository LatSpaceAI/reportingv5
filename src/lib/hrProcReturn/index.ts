// Pure entry points for the Birla HR/Procurement monthly-return module.
// Everything importable from here is safe in tests and on the client;
// database access lives in returnService.ts (server-only).

export * from "./layoutTypes";
export { HR_LAYOUT } from "./hrLayout";
export { PROC_LAYOUT } from "./procLayout";
export { RETURN_LAYOUTS, layoutBySheetName } from "./layouts";
export * from "./parseReturn";
