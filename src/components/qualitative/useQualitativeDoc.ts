"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildMmdSeed } from "@/lib/qualitative/mmdSeed";
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
      setDocState(existing);
      return;
    }
    // Seed first-load. For frameworks other than cbam-mmd we still produce a
    // skeleton so the editor can mount, but with empty requirements/metrics.
    const seeded =
      frameworkId === "cbam-mmd"
        ? buildMmdSeed(frameworkId)
        : ({
            frameworkId,
            title: "Untitled report",
            blocks: [
              { id: "b_root_h", kind: "heading", level: 1, text: "Untitled report" },
            ],
            requirements: [],
            metrics: [],
            comments: [],
            updatedAt: new Date().toISOString(),
          } satisfies QualitativeDoc);
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
