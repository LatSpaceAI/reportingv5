"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readDoc, writeDoc } from "@/lib/qualitative/storage";
import type { QualitativeDoc } from "@/lib/qualitative/types";

// Loads the doc from localStorage (or seeds from the MMD template the first
// time) and returns a [doc, setDoc] pair. Writes are debounced by a microtask
// queue to avoid quadratic localStorage writes on rapid edits.
export function useQualitativeDoc(frameworkId: string) {
  const [doc, setDocState] = useState<QualitativeDoc | null>(null);
  const pending = useRef<QualitativeDoc | null>(null);
  const flushScheduled = useRef(false);

  useEffect(() => {
    const existing = readDoc(frameworkId);
    if (existing) {
      // Migrate older docs that pre-date the proposals field.
      setDocState({ ...existing, proposals: existing.proposals ?? [] });
      return;
    }
    // Seed first-load with an empty skeleton so the editor can mount.
    const seeded = {
      frameworkId,
      title: "Untitled report",
      blocks: [
        { id: "b_root_h", kind: "heading", level: 1, text: "Untitled report" },
      ],
      requirements: [],
      metrics: [],
      comments: [],
      proposals: [],
      updatedAt: new Date().toISOString(),
    } satisfies QualitativeDoc;
    setDocState(seeded);
    writeDoc(seeded);
  }, [frameworkId]);

  const setDoc = useCallback(
    (updater: (prev: QualitativeDoc) => QualitativeDoc) => {
      setDocState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        const stamped = { ...next, updatedAt: new Date().toISOString() };
        pending.current = stamped;
        if (!flushScheduled.current) {
          flushScheduled.current = true;
          queueMicrotask(() => {
            if (pending.current) writeDoc(pending.current);
            pending.current = null;
            flushScheduled.current = false;
          });
        }
        return stamped;
      });
    },
    []
  );

  return { doc, setDoc };
}
