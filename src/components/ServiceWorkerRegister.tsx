"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production builds. Next.js dev serves chunks on unpredictable
    // paths and caching them causes stale-asset headaches during development.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[sw] register failed", e);
    });
  }, []);
  return null;
}
