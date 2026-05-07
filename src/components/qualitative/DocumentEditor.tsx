"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Block,
  Comment,
  HeadingLevel,
  Metric,
  Proposal,
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
  Diagram,
  RequirementIcon,
  Trash,
  X,
} from "./icons";
import { MermaidRenderer } from "./MermaidRenderer";

interface Props {
  doc: QualitativeDoc;
  setDoc: (updater: (prev: QualitativeDoc) => QualitativeDoc) => void;
  onOpenRequirement: (id: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
}

interface Selection {
  blockId: string;
  start: number;
  end: number;
  text: string;
}

const PARAGRAPH_PLACEHOLDER = "Start typing...";

export function DocumentEditor({
  doc,
  setDoc,
  onOpenRequirement,
  onAcceptProposal,
  onRejectProposal,
}: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // ID of a freshly-inserted block that should grab focus on mount. We can't
  // call .focus() inside insertBlockAfter because the new <p> doesn't exist
  // until React renders the next frame. The paragraph view checks this on
  // mount and focuses itself + clears the request.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

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

  // Append a new empty paragraph at the end of the document and request focus
  // on it. Used for the "click below the last block" affordance and as the
  // common-case keystroke target when the doc is empty.
  const appendParagraph = useCallback(() => {
    const id = genId("b");
    insertBlockAfter(null, { id, kind: "paragraph", text: "" });
    setPendingFocusId(id);
  }, [insertBlockAfter]);

  // Insert a paragraph immediately after the given block. Used by Enter key
  // handlers in heading/paragraph views so pressing Enter creates a new
  // editable paragraph and focuses it.
  const insertParagraphAfter = useCallback(
    (afterId: string) => {
      const id = genId("b");
      insertBlockAfter(afterId, { id, kind: "paragraph", text: "" });
      setPendingFocusId(id);
    },
    [insertBlockAfter]
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

  const insertDiagram = useCallback(() => {
    insertBlockAfter(activeBlockId, {
      id: genId("b"),
      kind: "diagram",
      format: "mermaid",
      // Starter flow that works without edits — encourages the user to tweak.
      source: `flowchart TD
  A[Raw materials] --> B[Production process]
  B --> C[CBAM goods]
  B --> D[Direct emissions]`,
      caption: "",
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
          onInsertDiagram={insertDiagram}
          onInsertRequirementRef={openReqPicker}
          onInsertDataRef={openDataPicker}
          onInsertSectionMarker={insertSectionMarker}
        />

        <div
          className="mx-auto my-8 max-w-3xl bg-white px-12 py-10 shadow-sm"
          // Click on the page surface (but not on an existing block) appends a
          // new paragraph at the end. This is the natural "type below the last
          // block" gesture that's missing from the bare contentEditable model.
          onClick={(e) => {
            if (e.target === e.currentTarget) appendParagraph();
          }}
        >
          <BlockList
            blocks={doc.blocks}
            proposals={doc.proposals ?? []}
            requirements={doc.requirements}
            metrics={doc.metrics}
            comments={doc.comments}
            activeBlockId={activeBlockId}
            pendingFocusId={pendingFocusId}
            onConsumeFocus={() => setPendingFocusId(null)}
            onActivate={setActiveBlockId}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onInsertAfter={insertBlockAfter}
            onInsertParagraphAfter={insertParagraphAfter}
            onOpenRequirement={onOpenRequirement}
            onSyncSnapshot={syncDocumentSnapshots}
            onAcceptProposal={onAcceptProposal}
            onRejectProposal={onRejectProposal}
          />
          {/* Always-visible bottom affordance — clicking adds a new paragraph
              and focuses it. Also visible when the doc is empty. */}
          <button
            type="button"
            onClick={appendParagraph}
            className="mt-6 block w-full select-none border border-dashed border-slate-200 px-4 py-3 text-left text-sm text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
          >
            + Click here to add a new paragraph
          </button>
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
  proposals,
  requirements,
  metrics,
  comments,
  activeBlockId,
  pendingFocusId,
  onConsumeFocus,
  onActivate,
  onUpdate,
  onRemove,
  onInsertAfter,
  onInsertParagraphAfter,
  onOpenRequirement,
  onSyncSnapshot,
  onAcceptProposal,
  onRejectProposal,
}: {
  blocks: Block[];
  proposals: Proposal[];
  requirements: Requirement[];
  metrics: Metric[];
  comments: Comment[];
  activeBlockId: string | null;
  pendingFocusId: string | null;
  onConsumeFocus: () => void;
  onActivate: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onRemove: (id: string) => void;
  onInsertAfter: (afterId: string, block: Block) => void;
  onInsertParagraphAfter: (afterId: string) => void;
  onOpenRequirement: (id: string) => void;
  onSyncSnapshot: (requirementId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
}) {
  // Group proposals by their afterBlockId for O(1) lookup during render.
  const proposalsAfter = useMemo(() => {
    const map = new Map<string | null, Proposal[]>();
    for (const p of proposals) {
      const key = p.afterBlockId;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [proposals]);

  const prependProposals = proposalsAfter.get(null) ?? [];

  return (
    <div className="space-y-3">
      {prependProposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          onAccept={() => onAcceptProposal(p.id)}
          onReject={() => onRejectProposal(p.id)}
        />
      ))}
      {blocks.map((b, idx) => {
        const isActive = b.id === activeBlockId;
        const blockComments = comments.filter((c) => c.blockId === b.id && !c.resolved);
        const trailingProposals = proposalsAfter.get(b.id) ?? [];
        return (
          <Fragment key={b.id}>
            <BlockShell
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
                shouldFocus={pendingFocusId === b.id}
                onConsumeFocus={onConsumeFocus}
                onUpdate={(patch) => onUpdate(b.id, patch)}
                onEnterAfter={() => onInsertParagraphAfter(b.id)}
                onActivate={() => onActivate(b.id)}
                onOpenRequirement={onOpenRequirement}
                onSyncSnapshot={() => {
                  if (b.kind === "requirement-ref") onSyncSnapshot(b.requirementId);
                }}
              />
            </BlockShell>
            {trailingProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onAccept={() => onAcceptProposal(p.id)}
                onReject={() => onRejectProposal(p.id)}
              />
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

// Cursor-style proposed-edit card: renders the model's drafted blocks with a
// green-tinted highlight and dashed border, plus inline Accept / Reject.
function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: Proposal;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      data-proposal-id={proposal.id}
      className="relative my-3 border-2 border-dashed border-emerald-400 bg-emerald-50/50 px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-emerald-200 pb-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
            AI
          </span>
          Proposed insertion
          <span className="font-normal normal-case tracking-normal text-emerald-700/70">
            · {proposal.blocks.length} block{proposal.blocks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            title="Reject"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1 border border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            title="Accept"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {proposal.blocks.map((b) => (
          <ProposalBlockPreview key={b.id} block={b} />
        ))}
      </div>
      {proposal.rationale && (
        <p className="mt-2 border-t border-emerald-200 pt-2 text-[11px] italic text-emerald-700/80">
          {proposal.rationale}
        </p>
      )}
    </div>
  );
}

// Read-only render of a single proposed block. Reuses the look of the live
// editor but without the contentEditable / interactive behavior.
function ProposalBlockPreview({ block }: { block: Proposal["blocks"][number] }) {
  if (block.kind === "heading") {
    const cls =
      block.level === 1
        ? "text-3xl font-semibold text-slate-900"
        : block.level === 2
        ? "text-xl font-semibold text-slate-900"
        : "text-base font-semibold text-slate-800";
    return <div className={cls}>{block.text}</div>;
  }
  if (block.kind === "paragraph") {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
        {block.text}
      </p>
    );
  }
  if (block.kind === "diagram") {
    return (
      <div className="border border-emerald-200 bg-white p-2">
        <MermaidRenderer source={block.source} cacheKey={block.id} />
        {block.caption && (
          <p className="mt-1 text-[11px] italic text-slate-500">{block.caption}</p>
        )}
      </div>
    );
  }
  // table
  return (
    <div className="overflow-auto border border-emerald-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-emerald-50">
          <tr>
            {block.columns.map((c, ci) => (
              <th
                key={ci}
                className="border-r border-emerald-200 px-3 py-1.5 text-left text-[12px] font-semibold text-slate-700 last:border-r-0"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-emerald-100">
              {block.columns.map((_, ci) => (
                <td
                  key={ci}
                  className="border-r border-emerald-100 px-3 py-1.5 text-sm text-slate-700 last:border-r-0"
                >
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  shouldFocus,
  onConsumeFocus,
  onUpdate,
  onEnterAfter,
  onActivate,
  onOpenRequirement,
  onSyncSnapshot,
}: {
  block: Block;
  requirements: Requirement[];
  metrics: Metric[];
  shouldFocus: boolean;
  onConsumeFocus: () => void;
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
        shouldFocus={shouldFocus}
        onConsumeFocus={onConsumeFocus}
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
  if (block.kind === "diagram") {
    return <DiagramBlockView block={block} onUpdate={onUpdate} />;
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
  shouldFocus,
  onConsumeFocus,
  onUpdate,
  onEnterAfter,
  onActivate,
}: {
  block: Extract<Block, { kind: "paragraph" }>;
  shouldFocus: boolean;
  onConsumeFocus: () => void;
  onUpdate: (patch: Partial<Block>) => void;
  onEnterAfter: () => void;
  onActivate: () => void;
}) {
  const ref = useEditableText(block.text);
  // When the parent flagged this paragraph as needing focus (just inserted via
  // append/Enter), grab the cursor here on next paint and clear the request.
  useEffect(() => {
    if (!shouldFocus) return;
    const el = ref.current;
    if (el) {
      (el as HTMLElement).focus();
      // Place caret at end if there's any content; otherwise plain focus is fine.
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    onConsumeFocus();
  }, [shouldFocus, onConsumeFocus, ref]);
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

// Mermaid diagram block. Defaults to rendered SVG; toggle "Edit source" to
// reveal a textarea for hand-tuning the underlying Mermaid syntax. The
// caption sits below in either mode.
function DiagramBlockView({
  block,
  onUpdate,
}: {
  block: Extract<Block, { kind: "diagram" }>;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Local source while editing — we commit on blur to avoid re-rendering the
  // SVG on every keystroke (mermaid's render is async + non-trivial).
  const [draft, setDraft] = useState(block.source);
  useEffect(() => {
    if (!editing) setDraft(block.source);
  }, [block.source, editing]);

  return (
    <div className="my-3 border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-2">
          <Diagram className="h-3.5 w-3.5 text-brand" />
          <span className="font-medium text-slate-700">Diagram</span>
          <span className="text-slate-400">· Mermaid</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (editing) onUpdate({ source: draft });
              setEditing((e) => !e);
            }}
            className="border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {editing ? "Done" : "Edit source"}
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== block.source) onUpdate({ source: draft });
          }}
          spellCheck={false}
          className="h-48 w-full resize-y bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none"
        />
      ) : (
        <div className="p-3">
          <MermaidRenderer source={block.source} cacheKey={block.id} />
        </div>
      )}
      <div className="border-t border-slate-100 px-3 py-1.5">
        <input
          value={block.caption ?? ""}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="Caption (optional — good place for citations)"
          className="w-full bg-transparent text-[12px] italic text-slate-600 outline-none placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}
