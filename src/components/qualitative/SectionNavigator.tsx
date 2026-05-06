"use client";

import { useEffect, useRef, useState } from "react";
import type { Block, HeadingBlock } from "@/lib/qualitative/types";
import { List } from "./icons";

interface Props {
  blocks: Block[];
  onPick: (blockId: string) => void;
}

// Floats on the left margin of the editor. Click the rail icon to open the
// section list popover. List groups by H1/H2 and indents H3 underneath.
export function SectionNavigator({ blocks, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const headings = blocks.filter((b): b is HeadingBlock => b.kind === "heading");

  // Group by H1 (or H2 if no H1 precedes). Treat the first H1 as the doc title.
  const groups: { label: string | null; items: HeadingBlock[] }[] = [];
  let current: { label: string | null; items: HeadingBlock[] } = { label: null, items: [] };
  let seenFirstH1 = false;
  for (const h of headings) {
    if (h.level === 1) {
      if (!seenFirstH1) {
        seenFirstH1 = true;
        current = { label: "Introduction", items: [h] };
        groups.push(current);
        continue;
      }
      current = { label: h.text, items: [] };
      groups.push(current);
    } else {
      if (groups.length === 0) {
        current = { label: "Sections", items: [] };
        groups.push(current);
      }
      current.items.push(h);
    }
  }

  return (
    <aside ref={ref} className="relative w-12 shrink-0 border-r border-slate-200 bg-slate-50/40">
      <div className="sticky top-2 flex flex-col items-center gap-1.5 py-3 text-slate-300">
        <button
          onClick={() => setOpen((o) => !o)}
          title="Document outline"
          className={`p-1 ${open ? "bg-slate-200 text-slate-700" : "hover:bg-slate-100 hover:text-slate-700"}`}
        >
          <List className="h-4 w-4" />
        </button>
        {/* Mini ruler — visual cue from the screenshot */}
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="block h-px w-4 bg-slate-200" />
        ))}
      </div>

      {open && (
        <div className="absolute left-12 top-2 z-30 w-72 border border-slate-200 bg-white py-2 shadow-xl">
          <div className="border-b border-slate-200 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Outline
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {groups.map((g, gi) => (
              <div key={gi} className="mt-2 first:mt-0">
                {g.label && (
                  <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {g.label}
                  </div>
                )}
                <ul>
                  {g.items.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => {
                          onPick(h.id);
                          setOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                          h.level === 3 ? "pl-8 text-slate-600" : "pl-3 text-slate-800"
                        }`}
                      >
                        {h.text || "Untitled"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="px-3 py-3 text-xs italic text-slate-400">
                Add a heading to build the outline.
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
