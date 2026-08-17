"use client";

// AI Context — the structured profile that grounds the AI assistant in the org's
// reporting situation (company, reporting year, business context). Editable
// here; saved against the signed-in account via /api/ai-context, so the company
// name and logo follow the login rather than the browser. Ported from vsmev1's
// AI Context page, minus the Sculptor web-research feature and the server-side
// VSME checklist.

import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/Toast";
import {
  emptyAiContextProfile,
  loadAiContext,
  readAiContext,
  saveAiContext,
  BUSINESS_CONTEXT_MAX,
  LOGO_ACCEPT,
  LOGO_MAX_BYTES,
  type AiContextProfile,
} from "@/lib/aiContext";
import UserDocsUpload from "./UserDocsUpload";

/**
 * Read an image File into a compact data URL. Raster images are downscaled to
 * fit within 256×256 (keeping aspect) and re-encoded as PNG so the stored blob
 * stays small enough for localStorage; SVGs are read as-is (already tiny/vector).
 */
async function fileToLogoDataUrl(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    return await readAsDataUrl(file);
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const MAX = 256;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

const labelClass =
  "block text-[11px] text-brand tracking-[0.15em] uppercase font-medium mb-2";
const inputClass =
  "w-full border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors hover:border-gray-300 focus:border-brand disabled:opacity-50";

// lucide: sparkles
function SparklesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

export default function AiContextPage() {
  const { show } = useToast();
  const [profile, setProfile] = useState<AiContextProfile | null>(null);
  const [original, setOriginal] = useState<AiContextProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Paint the cached profile immediately, then replace it with the account's
  // saved one. If the server read fails we keep the cache rather than wiping
  // the form — but the editor is then holding possibly-stale values, so the
  // banner below warns before the user saves over the stored profile.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const cached = readAiContext();
    if (cached) {
      setProfile(cached);
      setOriginal(cached);
    }
    void loadAiContext().then((server) => {
      if (cancelled) return;
      if (server) {
        setProfile(server);
        setOriginal(server);
      } else {
        setLoadFailed(true);
        // Nothing cached either — start from an empty form.
        setProfile((p) => p ?? emptyAiContextProfile());
        setOriginal((p) => p ?? emptyAiContextProfile());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<AiContextProfile>) =>
    setProfile((p) => (p ? { ...p, ...patch } : p));

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      if (dataUrl.length > LOGO_MAX_BYTES * 2) {
        show("That image is too large even after resizing. Try a simpler logo.");
        return;
      }
      update({ logoDataUrl: dataUrl });
    } catch {
      show("Could not read that image. Use a PNG, JPG, SVG, or WebP.");
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(original),
    [profile, original],
  );

  const handleSave = async () => {
    if (!profile || saving) return;
    if (!profile.companyName.trim()) {
      show("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAiContext({
        ...profile,
        companyName: profile.companyName.trim(),
        websiteUrl: profile.websiteUrl.trim(),
        businessContext: profile.businessContext.trim(),
        updatedAt: new Date().toISOString(),
      });
      setProfile(saved);
      setOriginal(saved);
      setLoadFailed(false);
      show("AI context saved.");
    } catch (err) {
      show((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex max-w-[820px] items-center justify-center px-6 py-20 text-slate-400">
          Loading AI context…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[820px] px-6 py-6">
        <header className="mb-8 flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center bg-brand/[0.06]">
            <SparklesIcon className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
              AI Context
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              The information the AI assistant uses to understand your
              organization and reporting goals. Edit it any time.
            </p>
          </div>
        </header>

        {loadFailed && (
          <div className="mb-6 border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
            Could not load the saved profile for your account. You are looking
            at this browser&rsquo;s last-known copy — saving will overwrite what
            is stored. Reload once you are back online to check first.
          </div>
        )}

        <div className="space-y-8">
          {/* Company */}
          <section className="border border-gray-200 p-6">
            <h2 className="mb-5 text-[13px] font-semibold text-[#0A0A0A]">
              Company
            </h2>

            {/* Logo */}
            <div className="mb-6">
              <span className={labelClass}>Company logo</span>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50">
                  {profile.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.logoDataUrl}
                      alt="Company logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">
                      No logo
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept={LOGO_ACCEPT}
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                    disabled={saving}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={saving}
                      className="border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A]/70 transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50"
                    >
                      {profile.logoDataUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    {profile.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => update({ logoDataUrl: null })}
                        disabled={saving}
                        className="px-2 py-1.5 text-[12px] text-gray-400 transition-colors hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    PNG, JPG, SVG or WebP. Shown on the AI Dashboard banner.
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="company-name" className={labelClass}>
                  Company name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  maxLength={120}
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="website-url" className={labelClass}>
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  value={profile.websiteUrl}
                  onChange={(e) => update({ websiteUrl: e.target.value })}
                  maxLength={300}
                  disabled={saving}
                  placeholder="https://acme.com"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Reporting year */}
          <section className="border border-gray-200 p-6">
            <h2 className="mb-5 text-[13px] font-semibold text-[#0A0A0A]">
              Reporting period
            </h2>
            <div className="max-w-[200px]">
              <label htmlFor="reporting-year" className={labelClass}>
                Reporting year
              </label>
              <input
                id="reporting-year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                value={profile.reportingYear ?? ""}
                onChange={(e) =>
                  update({
                    reportingYear:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                disabled={saving}
                placeholder="2025"
                className={inputClass}
              />
            </div>
          </section>

          {/* Business context */}
          <section className="border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
                Business context
              </h2>
              <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-gray-500">
                A description of what your company does and its
                sustainability-relevant footprint. The AI assistant uses this to
                give company-specific answers.
              </p>
            </div>

            <textarea
              id="business-context"
              value={profile.businessContext}
              onChange={(e) => update({ businessContext: e.target.value })}
              maxLength={BUSINESS_CONTEXT_MAX}
              rows={12}
              disabled={saving}
              placeholder="e.g. Acme Components manufactures precision metal parts for the automotive sector from two sites in Germany…"
              className={`${inputClass} resize-y font-[inherit] leading-relaxed`}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {profile.businessContext.length.toLocaleString()} /{" "}
                {BUSINESS_CONTEXT_MAX.toLocaleString()}
              </span>
            </div>
          </section>

          {/* Knowledge documents (uploaded PDFs → RAG) */}
          <UserDocsUpload />
        </div>

        {/* Save bar */}
        <div className="mt-8 flex items-center justify-between">
          <span className="text-[12px] text-slate-400">
            {profile.updatedAt
              ? `Last updated ${new Date(profile.updatedAt).toLocaleString()}`
              : "Not yet saved"}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="flex items-center justify-center gap-2 bg-brand px-6 py-3 text-[13px] font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-medium disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
