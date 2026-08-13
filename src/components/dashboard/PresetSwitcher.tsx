"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PresetNameDialog } from "@/components/dashboard/PresetNameDialog";
import { useToast } from "@/components/Toast";
import type { PresetRow } from "@/lib/dashboard/presets-repo";

interface PresetSwitcherProps {
  presets: PresetRow[];
  activePresetId: string | null;
  onSelect: (id: string | null) => void;
}

// lucide: chevron-down
function ChevronDownIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// lucide: search
function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// lucide: plus
function PlusIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

// lucide: more-vertical
function KebabIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

/**
 * Dropdown that switches the open preset ("All pins" plus user presets),
 * with search, create-from-search, and rename/delete for the active preset.
 * Popover mechanics adapted from qualitative/PickerPopover.
 */
export function PresetSwitcher({
  presets,
  activePresetId,
  onSelect,
}: PresetSwitcherProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");

  const popRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = activePresetId
    ? presets.find((p) => p.id === activePresetId) ?? null
    : null;

  useEffect(() => {
    if (!open && !menuOpen) return;
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuOpen]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!menuOpen) setConfirmDelete(false);
  }, [menuOpen]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(needle));
  }, [presets, search]);

  const create = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/esg/dashboard/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json.preset as PresetRow;
    },
    onSuccess: (preset) => {
      qc.invalidateQueries({ queryKey: ["dashboard-presets"] });
      onSelect(preset.id);
      setOpen(false);
      toast.show(`Preset "${preset.name}" created — pin charts to fill it`);
    },
    onError: (e) => toast.show((e as Error).message),
  });

  const rename = useMutation({
    mutationFn: async (args: { id: string; name: string }) => {
      const res = await fetch(`/api/esg/dashboard/presets/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-presets"] });
      setRenameOpen(false);
      toast.show("Preset renamed");
    },
    onError: (e) => toast.show((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/esg/dashboard/presets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-presets"] });
      setMenuOpen(false);
      onSelect(null);
      toast.show("Preset deleted — its charts remain in All pins");
    },
    onError: (e) => toast.show(`Delete failed: ${(e as Error).message}`),
  });

  const trimmed = search.trim();
  const showCreate =
    trimmed.length > 0 &&
    !filtered.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  function pick(id: string | null) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 border border-[#0A0A0A]/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/70 transition-colors hover:border-[#074D47]/50 hover:text-[#074D47]"
      >
        {active ? active.name : "All pins"}
        <ChevronDownIcon className="h-3 w-3" />
      </button>

      {active && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Preset options"
            className="p-1.5 text-[#0A0A0A]/40 transition-colors hover:bg-[#0A0A0A]/[0.04] hover:text-[#0A0A0A]"
          >
            <KebabIcon />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute left-0 top-full z-50 mt-1 w-44 border border-[#0A0A0A]/10 bg-white py-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setRenameOpen(true);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-[#0A0A0A]/80 hover:bg-[#0A0A0A]/[0.04]"
              >
                Rename…
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  remove.mutate(active.id);
                }}
                disabled={remove.isPending}
                className="block w-full px-3 py-1.5 text-left text-sm text-red-700/80 hover:bg-red-50 disabled:opacity-50"
              >
                {remove.isPending
                  ? "Deleting…"
                  : confirmDelete
                    ? "Confirm delete?"
                    : "Delete preset"}
              </button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div
          ref={popRef}
          className="absolute left-0 top-full z-50 mt-1 w-80 border border-[#0A0A0A]/10 bg-white shadow-xl"
        >
          <div className="border-b border-[#0A0A0A]/[0.06] px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A]/50">
            Presets
          </div>
          <div className="relative border-b border-[#0A0A0A]/[0.06]">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or create…"
              className="w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (filtered.length > 0) pick(filtered[0].id);
                else if (showCreate && !create.isPending)
                  create.mutate(trimmed);
              }}
            />
            <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0A0A0A]/35" />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {!trimmed && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[#0A0A0A]/[0.04] ${
                    !activePresetId ? "font-medium text-[#074D47]" : "text-[#0A0A0A]/80"
                  }`}
                >
                  All pins
                </button>
              </li>
            )}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[#0A0A0A]/[0.04] ${
                    p.id === activePresetId
                      ? "font-medium text-[#074D47]"
                      : "text-[#0A0A0A]/80"
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-3 text-sm italic text-[#0A0A0A]/40">
                No presets yet. Type a name to create one.
              </li>
            )}
            {showCreate && (
              <li className="border-t border-[#0A0A0A]/[0.06]">
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={() => create.mutate(trimmed)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#074D47] hover:bg-[#074D47]/5 disabled:opacity-50"
                >
                  <PlusIcon />
                  {create.isPending ? "Creating…" : "Create preset:"}{" "}
                  <span className="font-medium">{trimmed}</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <PresetNameDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename preset"
        initialName={active?.name ?? ""}
        submitLabel="Rename"
        pending={rename.isPending}
        onSubmit={(name) => active && rename.mutate({ id: active.id, name })}
      />
    </div>
  );
}
