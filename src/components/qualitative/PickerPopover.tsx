"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "./icons";

interface Item {
  id: string;
  primary: string;
  secondary?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  items: Item[];
  onPick: (id: string) => void;
  onCreate?: (label: string) => string; // returns the new id
  position?: { top: number; left: number };
  emptyLabel?: string;
  createLabel?: string;
}

// A floating searchable list anchored at `position` (viewport coords). Closes
// on outside-click and Escape. If onCreate is provided and search has no
// matches, a "Create new" action is shown.
export function PickerPopover({
  open,
  onClose,
  title,
  items,
  onPick,
  onCreate,
  position,
  emptyLabel = "No matches.",
  createLabel = "Create new",
}: Props) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        it.primary.toLowerCase().includes(needle) ||
        (it.secondary?.toLowerCase().includes(needle) ?? false)
    );
  }, [items, search]);

  if (!open) return null;

  const style: React.CSSProperties = position
    ? { top: position.top, left: position.left, position: "fixed" }
    : { position: "fixed", top: 96, left: "50%", transform: "translateX(-50%)" };

  const showCreate =
    onCreate && search.trim().length > 0 && !filtered.some((it) => it.primary.toLowerCase() === search.trim().toLowerCase());

  return (
    <div
      ref={ref}
      style={style}
      className="z-50 w-80 border border-slate-200 bg-white shadow-xl"
    >
      <div className="border-b border-slate-200 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="relative border-b border-slate-200">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (filtered.length > 0) {
                onPick(filtered[0].id);
                onClose();
              } else if (showCreate && onCreate) {
                onCreate(search.trim());
                onClose();
              }
            }
          }}
        />
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {filtered.map((it) => (
          <li key={it.id}>
            <button
              onClick={() => {
                onPick(it.id);
                onClose();
              }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <div className="text-slate-800">{it.primary}</div>
              {it.secondary && (
                <div className="truncate text-[11px] text-slate-500">{it.secondary}</div>
              )}
            </button>
          </li>
        ))}
        {filtered.length === 0 && !showCreate && (
          <li className="px-3 py-3 text-sm italic text-slate-400">{emptyLabel}</li>
        )}
        {showCreate && onCreate && (
          <li className="border-t border-slate-100">
            <button
              onClick={() => {
                onCreate(search.trim());
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand hover:bg-brand/5"
            >
              <Plus className="h-3.5 w-3.5" />
              {createLabel}: <span className="font-medium">{search.trim()}</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
