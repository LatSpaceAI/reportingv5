"use client";

import { useEffect, useState } from "react";

import {
  AI_CONTEXT_UPDATED_EVENT,
  loadAiContext,
  readAiContext,
} from "@/lib/aiContext";

/**
 * Banner at the top of the AI Dashboard: the company logo + "{company} ESG
 * Dashboard". The name and logo come from the AI Context profile saved against
 * the signed-in account. The cached copy paints first (no flash of "Your
 * Company"), then the account's stored profile replaces it; edits made on the
 * AI Context page arrive via AI_CONTEXT_UPDATED_EVENT, edits in another tab via
 * the native `storage` event.
 */
export function DashboardBanner() {
  const [company, setCompany] = useState<string>("");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const p = readAiContext();
      setCompany(p?.companyName?.trim() ?? "");
      setLogo(p?.logoDataUrl ?? null);
    };
    sync();
    // Refresh from the server; loadAiContext writes the cache and fires
    // AI_CONTEXT_UPDATED_EVENT, so `sync` picks the result up.
    void loadAiContext();
    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
    // also pick up edits made in another tab
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const title = `${company || "Your Company"} ESG Dashboard`;

  return (
    <div className="mb-8 flex items-center gap-4 border-b border-[#0A0A0A]/[0.08] pb-5">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden border border-[#0A0A0A]/10 bg-white">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${company || "Company"} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-[9px] uppercase tracking-wider text-[#0A0A0A]/35">
            Logo
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-[#0A0A0A]">
          {title}
        </h1>
        <p className="text-sm text-[#0A0A0A]/55">
          Ask for any metric and pin the charts you want to keep.
        </p>
      </div>
    </div>
  );
}
