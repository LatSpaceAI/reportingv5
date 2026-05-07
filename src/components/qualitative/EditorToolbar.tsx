"use client";

import { useEffect, useRef, useState } from "react";
import type { Block, HeadingLevel } from "@/lib/qualitative/types";
import { ChevronDown, DataIcon, Diagram, Heading1, RequirementIcon, SectionIcon, TableIcon } from "./icons";

interface Props {
  activeBlock: Block | null;
  onSetHeading: (level: HeadingLevel) => void;
  onSetParagraph: () => void;
  onInsertTable: () => void;
  onInsertDiagram: () => void;
  onInsertRequirementRef: () => void;
  onInsertDataRef: () => void;
  onInsertSectionMarker: () => void;
}

type HeadingChoice =
  | { kind: "paragraph"; label: "Paragraph" }
  | { kind: "heading"; level: HeadingLevel; label: string };

const choices: HeadingChoice[] = [
  { kind: "heading", level: 1, label: "Heading 1" },
  { kind: "heading", level: 2, label: "Heading 2" },
  { kind: "heading", level: 3, label: "Heading 3" },
  { kind: "paragraph", label: "Paragraph" },
];

function currentLabel(block: Block | null): string {
  if (!block) return "Paragraph";
  if (block.kind === "heading") return `Heading ${block.level}`;
  if (block.kind === "paragraph") return "Paragraph";
  return "—";
}

export function EditorToolbar({
  activeBlock,
  onSetHeading,
  onSetParagraph,
  onInsertTable,
  onInsertDiagram,
  onInsertRequirementRef,
  onInsertDataRef,
  onInsertSectionMarker,
}: Props) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-center gap-2 border-b border-slate-200 bg-white/95 px-6 py-2 backdrop-blur">
      <HeadingDropdown
        activeBlock={activeBlock}
        onPick={(c) => {
          if (c.kind === "paragraph") onSetParagraph();
          else onSetHeading(c.level);
        }}
      />
      <Divider />
      <ToolbarButton onClick={onInsertTable} label="Table" icon={<TableIcon className="h-4 w-4" />} />
      <ToolbarButton onClick={onInsertDiagram} label="Diagram" icon={<Diagram className="h-4 w-4" />} />
      <Divider />
      <ToolbarButton
        onClick={onInsertRequirementRef}
        label="Requirement"
        icon={<RequirementIcon className="h-4 w-4" />}
      />
      <ToolbarButton
        onClick={onInsertDataRef}
        label="Data"
        icon={<DataIcon className="h-4 w-4" />}
      />
      <ToolbarButton
        onClick={onInsertSectionMarker}
        label="Section"
        icon={<SectionIcon className="h-4 w-4" />}
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />;
}

function ToolbarButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
    >
      <span className="text-slate-500">{icon}</span>
      {label}
    </button>
  );
}

function HeadingDropdown({
  activeBlock,
  onPick,
}: {
  activeBlock: Block | null;
  onPick: (c: HeadingChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
      >
        <Heading1 className="h-4 w-4 text-slate-500" />
        {currentLabel(activeBlock)}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-48 border border-slate-200 bg-white py-1 shadow-lg">
          {choices.map((c) => (
            <button
              key={c.kind === "heading" ? `h${c.level}` : "p"}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
