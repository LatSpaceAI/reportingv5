"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Block,
  Comment,
  HeadingLevel,
  Metric,
  QualitativeDoc,
  Requirement,
  RequirementRefBlock,
} from "@/lib/qualitative/types";
import { genId } from "@/lib/qualitative/storage";
import { EditorToolbar } from "./EditorToolbar";
import { PickerPopover } from "./PickerPopover";
import { SectionNavigator } from "./SectionNavigator";
import { CommentGutter } from "./CommentGutter";
import { isStale } from "./util";
import {
  Bookmark,
  Check,
  Comment as CommentIcon,
  DataIcon,
  RequirementIcon,
  Trash,
  X,
} from "./icons";

interface Props {
  doc: QualitativeDoc;
  setDoc: (updater: (prev: QualitativeDoc) => QualitativeDoc) => void;
  onOpenRequirement: (id: string) => void;
}

interface Selection {
  blockId: string;
  start: number;
  end: number;
  text: string;
}

const PARAGRAPH_PLACEHOLDER = "Start typing...";

export function DocumentEditor({ doc, setDoc, onOpenRequirement }: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [reqPickerPos, setReqPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [dataPickerPos, setDataPickerPos] = useState<{ top: number; left: number } | null>(null);

  const activeBlock = useMemo(
    () => doc.blocks.find((b) => b.id === activeBlockId) ?? null,
    [doc.blocks, activeBlockId]
  );

  // Selection tracking for selection-anchored comments and active-block detection.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const blockEl = (node.nodeType === 3 ? node.parentElement : (node as Element))?.closest(
        "[data-block-id]"
      ) as HTMLElement | null;
      if (!blockEl || !editorRef.current?.contains(blockEl)) return;
      const blockId = blockEl.dataset.blockId!;
      setActiveBlockId(blockId);

      // Compute char offsets within the block's text content.
      const block = doc.blocks.find((b) => b.id === blockId);
      if (!block || (block.kind !== "paragraph" && block.kind !== "heading")) {
        setSelection(null);
        return;
      }
      const fullText = block.kind === "heading" ? block.text : block.text;
      if (!sel.toString().trim()) {
        setSelection(null);
        return;
      }
      const before = blockEl.textContent ?? "";
      const start = before.indexOf(sel.toString());
      if (start < 0) {
        setSelection(null);
        return;
      }
      setSelection({
        blockId,
        start,
        end: start + sel.toString().length,
        text: sel.toString(),
      });
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [doc.blocks]);

  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>) => {
      setDoc((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
      }));
    },
    [setDoc]
  );

  const removeBlock = useCallback(
    (id: string) => {
      setDoc((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    },
    [setDoc]
  );

  const insertBlockAfter = useCallback(
    (afterId: string | null, block: Block) => {
      setDoc((prev) => {
        if (!afterId) return { ...prev, blocks: [...prev.blocks, block] };
        const idx = prev.blocks.findIndex((b) => b.id === afterId);
        if (idx < 0) return { ...prev, blocks: [...prev.blocks, block] };
        const next = prev.blocks.slice();
        next.splice(idx + 1, 0, block);
        return { ...prev, blocks: next };
      });
      setActiveBlockId(block.id);
    },
    [setDoc]
  );

  const setHeading = useCallback(
    (level: HeadingLevel) => {
      if (!activeBlock) return;
      const text =
        activeBlock.kind === "heading" || activeBlock.kind === "paragraph"
          ? activeBlock.text
          : "";
      updateBlock(activeBlock.id, { kind: "heading", level, text } as Partial<Block>);
    },
    [activeBlock, updateBlock]
  );

  const setParagraph = useCallback(() => {
    if (!activeBlock) return;
    const text =
      activeBlock.kind === "heading" || activeBlock.kind === "paragraph" ? activeBlock.text : "";
    updateBlock(activeBlock.id, { kind: "paragraph", text } as Partial<Block>);
  }, [activeBlock, updateBlock]);

  const insertTable = useCallback(() => {
    insertBlockAfter(activeBlockId, {
      id: genId("b"),
      kind: "table",
      columns: ["Description", "Value"],
      rows: [
        ["", ""],
        ["", ""],
      ],
    });
  }, [activeBlockId, insertBlockAfter]);

  const insertSectionMarker = useCallback(() => {
    insertBlockAfter(activeBlockId, {
      id: genId("b"),
      kind: "section-marker",
      label: "Section",
    });
  }, [activeBlockId, insertBlockAfter]);

  const openReqPicker = useCallback(() => {
    const rect = activeBlockRect();
    setReqPickerPos(rect ? { top: rect.bottom + 4, left: rect.left } : { top: 120, left: 320 });
  }, []);
  const openDataPicker = useCallback(() => {
    const rect = activeBlockRect();
    setDataPickerPos(rect ? { top: rect.bottom + 4, left: rect.left } : { top: 120, left: 320 });
  }, []);

  function activeBlockRect(): DOMRect | null {
    if (!activeBlockId) return null;
    const el = editorRef.current?.querySelector(`[data-block-id="${activeBlockId}"]`);
    return (el as HTMLElement | null)?.getBoundingClientRect() ?? null;
  }

  const insertRequirementRef = useCallback(
    (requirementId: string) => {
      const req = doc.requirements.find((r) => r.id === requirementId);
      const snapshot = req?.response ?? { kind: "empty" as const };
      insertBlockAfter(activeBlockId, {
        id: genId("b"),
        kind: "requirement-ref",
        requirementId,
        snapshot,
        snapshotAt: new Date().toISOString(),
      });
    },
    [activeBlockId, doc.requirements, insertBlockAfter]
  );

  const insertDataRef = useCallback(
    (metricId: string) => {
      const m = doc.metrics.find((x) => x.id === metricId);
      if (!m) return;
      insertBlockAfter(activeBlockId, {
        id: genId("b"),
        kind: "data-ref",
        metricId,
        snapshotValue: m.value,
        unit: m.unit,
        snapshotAt: new Date().toISOString(),
      });
    },
    [activeBlockId, doc.metrics, insertBlockAfter]
  );

  const createRequirementInline = useCallback(
    (label: string): string => {
      const id = `REQ-${Date.now().toString(36).toUpperCase()}`;
      setDoc((prev) => ({
        ...prev,
        requirements: [
          ...prev.requirements,
          {
            id,
            name: label,
            description: "",
            response: null,
            attachments: [],
            activity: [
              {
                id: genId("a"),
                at: new Date().toISOString(),
                actor: "you",
                message: `Requirement created inline from document.`,
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
      // Defer the insert so the new requirement is in state first.
      setTimeout(() => insertRequirementRef(id), 0);
      return id;
    },
    [setDoc, insertRequirementRef]
  );

  const syncDocumentSnapshots = useCallback(
    (requirementId: string) => {
      setDoc((prev) => {
        const req = prev.requirements.find((r) => r.id === requirementId);
        if (!req) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.kind === "requirement-ref" && b.requirementId === requirementId
              ? {
                  ...b,
                  snapshot: req.response ?? { kind: "empty" },
                  snapshotAt: new Date().toISOString(),
                }
              : b
          ),
        };
      });
    },
    [setDoc]
  );

  const addCommentForSelection = useCallback(() => {
    if (!selection) return;
    const id = genId("c");
    setDoc((prev) => ({
      ...prev,
      comments: [
        ...prev.comments,
        {
          id,
          blockId: selection.blockId,
          range: { start: selection.start, end: selection.end },
          anchorText: selection.text,
          author: "You",
          body: "",
          resolved: false,
          createdAt: new Date().toISOString(),
          replies: [],
        },
      ],
    }));
    return id;
  }, [selection, setDoc]);

  return (
    <div ref={editorRef} className="relative flex h-full overflow-hidden">
      <SectionNavigator
        blocks={doc.blocks}
        onPick={(id) => {
          const el = editorRef.current?.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveBlockId(id);
        }}
      />

      <div className="flex-1 overflow-y-auto bg-slate-50/40">
        <EditorToolbar
          activeBlock={activeBlock}
          onSetHeading={setHeading}
          onSetParagraph={setParagraph}
          onInsertTable={insertTable}
          onInsertRequirementRef={openReqPicker}
          onInsertDataRef={openDataPicker}
          onInsertSectionMarker={insertSectionMarker}
        />

        <div className="mx-auto my-8 max-w-3xl bg-white px-12 py-10 shadow-sm">
          <BlockList
            blocks={doc.blocks}
            requirements={doc.requirements}
            metrics={doc.metrics}
            comments={doc.comments}
            activeBlockId={activeBlockId}
            onActivate={setActiveBlockId}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onInsertAfter={insertBlockAfter}
            onOpenRequirement={onOpenRequirement}
            onSyncSnapshot={syncDocumentSnapshots}
          />
        </div>

        {selection && (
          <FloatingSelectionAction
            onComment={addCommentForSelection}
          />
        )}
      </div>

      <CommentGutter
        doc={doc}
        setDoc={setDoc}
        editorRoot={editorRef}
      />

      <PickerPopover
        open={reqPickerPos !== null}
        onClose={() => setReqPickerPos(null)}
        position={reqPickerPos ?? undefined}
        title="Insert requirement"
        items={doc.requirements.map((r) => ({
          id: r.id,
          primary: `${r.id}: ${r.name}`,
          secondary: r.description,
        }))}
        onPick={insertRequirementRef}
        onCreate={(label) => createRequirementInline(label)}
        createLabel="Create requirement"
        emptyLabel="No requirements yet."
      />
      <PickerPopover
        open={dataPickerPos !== null}
        onClose={() => setDataPickerPos(null)}
        position={dataPickerPos ?? undefined}
        title="Insert data point"
        items={doc.metrics.map((m) => ({
          id: m.id,
          primary: m.name,
          secondary: `${m.value}${m.unit ? ` ${m.unit}` : ""}${m.source ? ` · ${m.source}` : ""}`,
        }))}
        onPick={insertDataRef}
        emptyLabel="No data points configured."
      />
    </div>
  );
}

function FloatingSelectionAction({ onComment }: { onComment: () => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
      setPos(null);
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setPos({ top: r.top - 38, left: r.left });
  }, []);
  if (!pos) return null;
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onComment}
      style={{ top: pos.top, left: pos.left, position: "fixed" }}
      className="z-30 inline-flex items-center gap-1 border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow hover:bg-slate-50"
    >
      <CommentIcon className="h-3.5 w-3.5" />
      Comment
    </button>
  );
}

function BlockList({
  blocks,
  requirements,
  metrics,
  comments,
  activeBlockId,
  onActivate,
  onUpdate,
  onRemove,
  onInsertAfter,
  onOpenRequirement,
  onSyncSnapshot,
}: {
  blocks: Block[];
  requirements: Requirement[];
  metrics: Metric[];
  comments: Comment[];
  activeBlockId: string | null;
  onActivate: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onRemove: (id: string) => void;
  onInsertAfter: (afterId: string, block: Block) => void;
  onOpenRequirement: (id: string) => void;
  onSyncSnapshot: (requirementId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        const isActive = b.id === activeBlockId;
        const blockComments = comments.filter((c) => c.blockId === b.id && !c.resolved);
        return (
          <BlockShell
            key={b.id}
            block={b}
            isActive={isActive}
            onActivate={() => onActivate(b.id)}
            onRemove={() => onRemove(b.id)}
            commentCount={blockComments.length}
            isFirst={idx === 0}
          >
            <BlockBody
              block={b}
              requirements={requirements}
              metrics={metrics}
              onUpdate={(patch) => onUpdate(b.id, patch)}
              onEnterAfter={() =>
                onInsertAfter(b.id, { id: genId("b"), kind: "paragraph", text: "" })
              }
              onActivate={() => onActivate(b.id)}
              onOpenRequirement={onOpenRequirement}
              onSyncSnapshot={() => {
                if (b.kind === "requirement-ref") onSyncSnapshot(b.requirementId);
              }}
            />
          </BlockShell>
        );
      })}
    </div>
  );
}

function BlockShell({
  block,
  isActive,
  onActivate,
  onRemove,
  commentCount,
  isFirst,
  children,
}: {
  block: Block;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
  commentCount: number;
  isFirst: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-block-id={block.id}
      onClick={onActivate}
      className={`group relative -mx-3 rounded-none px-3 py-1 ${
        isActive ? "bg-brand/5" : ""
      }`}
    >
      {children}
      {/* Per-block hover actions */}
      {!isFirst && (
        <div className="pointer-events-none absolute right-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Delete block"
            className="border border-slate-200 bg-white p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {/* Comment chip on the right edge — handled in CommentGutter, but we also
          show inline pills for blocks that contain unresolved comments. */}
      {commentCount > 0 && (
        <div className="pointer-events-none absolute -right-12 top-1 flex items-center gap-1 text-[11px] text-slate-500">
          <CommentIcon className="h-3 w-3" />
          {commentCount}
        </div>
      )}
    </div>
  );
}

function BlockBody({
  block,
  requirements,
  metrics,
  onUpdate,
  onEnterAfter,
  onActivate,
  onOpenRequirement,
  onSyncSnapshot,
}: {
  block: Block;
  requirements: Requirement[];
  metrics: Metric[];
  onUpdate: (patch: Partial<Block>) => void;
  onEnterAfter: () => void;
  onActivate: () => void;
  onOpenRequirement: (id: string) => void;
  onSyncSnapshot: () => void;
}) {
  if (block.kind === "heading") {
    return (
      <HeadingBlockView
        block={block}
        onUpdate={onUpdate}
        onEnterAfter={onEnterAfter}
        onActivate={onActivate}
      />
    );
  }
  if (block.kind === "paragraph") {
    return (
      <ParagraphBlockView
        block={block}
        onUpdate={onUpdate}
        onEnterAfter={onEnterAfter}
        onActivate={onActivate}
      />
    );
  }
  if (block.kind === "table") {
    return <TableBlockView block={block} onUpdate={onUpdate} />;
  }
  if (block.kind === "requirement-ref") {
    return (
      <RequirementRefBlockView
        block={block}
        requirements={requirements}
        onOpenRequirement={onOpenRequirement}
        onSyncSnapshot={onSyncSnapshot}
      />
    );
  }
  if (block.kind === "data-ref") {
    return <DataRefBlockView block={block} metrics={metrics} />;
  }
  return <SectionMarkerBlockView block={block} onUpdate={onUpdate} />;
}

// React + contentEditable: if we render `{block.text}` as JSX children, every
// parent re-render re-writes the DOM and resets the cursor mid-typing. We use
// an uncontrolled pattern instead — set innerText via a layout effect *only*
// when the prop disagrees with what's already in the DOM, which only happens
// on external updates (initial mount, snapshot sync, etc.).
function useEditableText(text: string) {
  const ref = useRef<HTMLElement | null>(null);
  // useLayoutEffect would be ideal but we're keeping this simple — a regular
  // effect fires after paint, which is fine because we only sync on external
  // changes the user wasn't typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerText !== text) el.innerText = text;
  }, [text]);
  return ref;
}

function HeadingBlockView({
  block,
  onUpdate,
  onEnterAfter,
  onActivate,
}: {
  block: Extract<Block, { kind: "heading" }>;
  onUpdate: (patch: Partial<Block>) => void;
  onEnterAfter: () => void;
  onActivate: () => void;
}) {
  const cls =
    block.level === 1
      ? "text-3xl font-semibold text-slate-900 mt-2 mb-1 outline-none"
      : block.level === 2
      ? "text-xl font-semibold text-slate-900 mt-2 mb-0.5 outline-none"
      : "text-base font-semibold text-slate-800 outline-none";
  const ref = useEditableText(block.text);
  return (
    <h2
      ref={ref as React.RefObject<HTMLHeadingElement>}
      className={cls}
      contentEditable
      suppressContentEditableWarning
      onFocus={onActivate}
      onBlur={(e) => {
        const v = e.currentTarget.innerText;
        if (v !== block.text) onUpdate({ text: v });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
          onEnterAfter();
        }
      }}
    />
  );
}

function ParagraphBlockView({
  block,
  onUpdate,
  onEnterAfter,
  onActivate,
}: {
  block: Extract<Block, { kind: "paragraph" }>;
  onUpdate: (patch: Partial<Block>) => void;
  onEnterAfter: () => void;
  onActivate: () => void;
}) {
  const ref = useEditableText(block.text);
  return (
    <p
      ref={ref as React.RefObject<HTMLParagraphElement>}
      className="min-h-[1.5em] text-[15px] leading-relaxed text-slate-700 outline-none data-[empty=true]:text-slate-400"
      data-empty={block.text.length === 0 ? "true" : undefined}
      data-placeholder={PARAGRAPH_PLACEHOLDER}
      contentEditable
      suppressContentEditableWarning
      onFocus={onActivate}
      onBlur={(e) => {
        const v = e.currentTarget.innerText;
        if (v !== block.text) onUpdate({ text: v });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
          onEnterAfter();
        }
      }}
    />
  );
}

function TableBlockView({
  block,
  onUpdate,
}: {
  block: Extract<Block, { kind: "table" }>;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  return (
    <div className="my-2 overflow-auto border border-slate-200 bg-slate-50/50">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            {block.columns.map((c, ci) => (
              <th
                key={ci}
                className="border-r border-slate-200 last:border-r-0"
              >
                <input
                  value={c}
                  onChange={(e) => {
                    const next = block.columns.slice();
                    next[ci] = e.target.value;
                    onUpdate({ columns: next });
                  }}
                  className="w-full bg-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 outline-none"
                />
              </th>
            ))}
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-slate-200 bg-white">
              {block.columns.map((_, ci) => (
                <td key={ci} className="border-r border-slate-200 last:border-r-0">
                  <input
                    value={row[ci] ?? ""}
                    onChange={(e) => {
                      const next = block.rows.map((r) => r.slice());
                      next[ri][ci] = e.target.value;
                      onUpdate({ rows: next });
                    }}
                    className="w-full bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                </td>
              ))}
              <td className="text-center">
                <button
                  onClick={() =>
                    onUpdate({ rows: block.rows.filter((_, i) => i !== ri) })
                  }
                  className="px-1 text-slate-300 hover:text-rose-600"
                  title="Delete row"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
        <button
          onClick={() =>
            onUpdate({ rows: [...block.rows, block.columns.map(() => "")] })
          }
          className="text-slate-600 hover:text-slate-900"
        >
          + Row
        </button>
        <button
          onClick={() =>
            onUpdate({
              columns: [...block.columns, `Column ${block.columns.length + 1}`],
              rows: block.rows.map((r) => [...r, ""]),
            })
          }
          className="text-slate-600 hover:text-slate-900"
        >
          + Column
        </button>
      </div>
    </div>
  );
}

function RequirementRefBlockView({
  block,
  requirements,
  onOpenRequirement,
  onSyncSnapshot,
}: {
  block: Extract<Block, { kind: "requirement-ref" }>;
  requirements: Requirement[];
  onOpenRequirement: (id: string) => void;
  onSyncSnapshot: () => void;
}) {
  const req = requirements.find((r) => r.id === block.requirementId);
  const stale = isStale(block, requirements);
  if (!req) {
    return (
      <div className="my-2 border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        Requirement {block.requirementId} no longer exists.
      </div>
    );
  }
  return (
    <div className="my-2 border border-slate-200 bg-white">
      <button
        onClick={() => onOpenRequirement(block.requirementId)}
        className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-[11px] uppercase tracking-wider text-slate-500 hover:bg-slate-50"
      >
        <RequirementIcon className="h-3.5 w-3.5 text-brand" />
        <span className="font-medium text-slate-700">{req.id}</span>
        <span className="truncate text-slate-500">· {req.name}</span>
        {stale && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            Older version
          </span>
        )}
      </button>
      <div className="px-3 py-2">
        <SnapshotView snapshot={block.snapshot} />
        {stale && (
          <div className="mt-2 flex items-center justify-between border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            <span>This embed shows an older response.</span>
            <button
              onClick={onSyncSnapshot}
              className="border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
            >
              Update from requirement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotView({ snapshot }: { snapshot: RequirementRefBlock["snapshot"] }) {
  if (snapshot.kind === "empty") {
    return <p className="text-sm italic text-slate-400">No response yet.</p>;
  }
  if (snapshot.kind === "text") {
    return <p className="text-[15px] leading-relaxed text-slate-700">{snapshot.value}</p>;
  }
  if (snapshot.kind === "number") {
    return (
      <p className="text-[15px] tabular-nums text-slate-800">
        <span className="font-semibold">{snapshot.value}</span>
        {snapshot.unit ? <span className="ml-1 text-slate-500">{snapshot.unit}</span> : null}
      </p>
    );
  }
  return (
    <div className="overflow-auto border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            {snapshot.columns.map((c, ci) => (
              <th key={ci} className="px-3 py-1.5 text-left">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((r, ri) => (
            <tr key={ri} className="border-t border-slate-100">
              {r.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-slate-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataRefBlockView({
  block,
  metrics,
}: {
  block: Extract<Block, { kind: "data-ref" }>;
  metrics: Metric[];
}) {
  const m = metrics.find((x) => x.id === block.metricId);
  if (!m) {
    return (
      <span className="inline-block bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
        Missing data: {block.metricId}
      </span>
    );
  }
  const stale = String(m.value) !== String(block.snapshotValue) || (m.unit ?? "") !== (block.unit ?? "");
  return (
    <span
      className={`inline-flex items-center gap-1 border bg-slate-50 px-2 py-0.5 text-[13px] tabular-nums ${
        stale ? "border-amber-300" : "border-slate-200"
      }`}
      title={`${m.name}${m.source ? ` · ${m.source}` : ""}`}
    >
      <DataIcon className="h-3 w-3 text-brand" />
      <span className="font-medium text-slate-800">{block.snapshotValue}</span>
      {block.unit && <span className="text-slate-500">{block.unit}</span>}
      {stale && <span className="ml-1 text-[10px] font-medium uppercase text-amber-700">stale</span>}
    </span>
  );
}

function SectionMarkerBlockView({
  block,
  onUpdate,
}: {
  block: Extract<Block, { kind: "section-marker" }>;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  return (
    <div className="my-2 inline-flex items-center gap-1 border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
      <Bookmark className="h-3 w-3 text-slate-500" />
      <input
        value={block.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        className="bg-transparent text-[11px] outline-none"
      />
    </div>
  );
}
