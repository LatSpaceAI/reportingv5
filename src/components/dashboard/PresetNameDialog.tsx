"use client";

import { useEffect, useRef, useState } from "react";

interface PresetNameDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (name: string) => void;
}

// Minimal name-entry dialog following the export-dialog conventions (fixed
// overlay, Escape to close, backdrop mousedown-target check).
export function PresetNameDialog({
  open,
  onClose,
  title,
  initialName = "",
  submitLabel,
  pending,
  onSubmit,
}: PresetNameDialogProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, initialName, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-96 border border-[#0A0A0A]/10 bg-white shadow-xl"
      >
        <div className="border-b border-[#0A0A0A]/[0.06] px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/60">
          {title}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit(trimmed);
          }}
        >
          <div className="px-4 py-4">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Preset name, e.g. Water usage"
              className="w-full border border-[#0A0A0A]/15 px-3 py-2 text-sm outline-none focus:border-[#074D47]/50"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[#0A0A0A]/[0.06] px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#0A0A0A]/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 hover:border-[#0A0A0A]/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-brand px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
