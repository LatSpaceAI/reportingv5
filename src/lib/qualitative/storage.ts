import type { QualitativeDoc } from "./types";

export const QUALITATIVE_KEY_PREFIX = "qualitative-app/v1/";

export function storageKey(frameworkId: string): string {
  return `${QUALITATIVE_KEY_PREFIX}${frameworkId}`;
}

export function readDoc(frameworkId: string): QualitativeDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(frameworkId));
    return raw ? (JSON.parse(raw) as QualitativeDoc) : null;
  } catch {
    return null;
  }
}

export function writeDoc(doc: QualitativeDoc): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(doc.frameworkId), JSON.stringify(doc));
}

export function clearDoc(frameworkId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(frameworkId));
}

let counter = 0;
export function genId(prefix: string = "id"): string {
  counter += 1;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${counter.toString(36)}${r}`;
}
