"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Comment, QualitativeDoc } from "@/lib/qualitative/types";
import { genId } from "@/lib/qualitative/storage";
import { Check, Comment as CommentIcon, Send, X } from "./icons";
import { formatDateTime } from "./util";

interface Props {
  doc: QualitativeDoc;
  setDoc: (updater: (prev: QualitativeDoc) => QualitativeDoc) => void;
  editorRoot: RefObject<HTMLDivElement>;
}

interface Anchor {
  comment: Comment;
  top: number;
}

// Right-side rail showing one chip per block that has comments. The chip's
// vertical position is computed from the block's bounding rect on every
// scroll/resize tick.
export function CommentGutter({ doc, setDoc, editorRoot }: Props) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const recompute = () => {
      if (!editorRoot.current) return;
      const rootRect = editorRoot.current.getBoundingClientRect();
      const next: Anchor[] = [];
      // Group comments by block; the chip lives at the block's top.
      const byBlock = new Map<string, Comment[]>();
      for (const c of doc.comments) {
        if (c.resolved) continue;
        const arr = byBlock.get(c.blockId) ?? [];
        arr.push(c);
        byBlock.set(c.blockId, arr);
      }
      for (const [blockId, comments] of byBlock) {
        const el = editorRoot.current.querySelector(
          `[data-block-id="${blockId}"]`
        ) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // Show a chip per comment, vertically stacked.
        comments.forEach((c, i) => {
          next.push({ comment: c, top: r.top - rootRect.top + i * 32 });
        });
      }
      setAnchors(next);
    };
    recompute();
    const editor = editorRoot.current;
    editor?.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    const id = window.setInterval(recompute, 500); // catch layout shifts
    return () => {
      editor?.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
      window.clearInterval(id);
    };
  }, [doc.comments, editorRoot]);

  const updateComment = (id: string, patch: Partial<Comment>) => {
    setDoc((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };
  const removeComment = (id: string) => {
    setDoc((prev) => ({ ...prev, comments: prev.comments.filter((c) => c.id !== id) }));
    setOpenId(null);
  };
  const addReply = (id: string, body: string) => {
    if (!body.trim()) return;
    setDoc((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === id
          ? {
              ...c,
              replies: [
                ...c.replies,
                {
                  id: genId("r"),
                  author: "You",
                  body: body.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c
      ),
    }));
  };

  return (
    <aside className="relative w-12 shrink-0 border-l border-slate-200 bg-slate-50/40">
      <div className="absolute inset-0">
        {anchors.map(({ comment, top }) => (
          <div
            key={comment.id}
            style={{ top }}
            className="absolute left-1 flex items-center gap-1"
          >
            <button
              onClick={() => setOpenId(openId === comment.id ? null : comment.id)}
              title={comment.body || "Comment"}
              className="inline-flex items-center gap-1 border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <CommentIcon className="h-3 w-3 text-slate-500" />
              {comment.replies.length + 1}
            </button>
            {openId === comment.id && (
              <CommentPopover
                comment={comment}
                onUpdate={(patch) => updateComment(comment.id, patch)}
                onResolve={() => updateComment(comment.id, { resolved: true })}
                onDelete={() => removeComment(comment.id)}
                onReply={(body) => addReply(comment.id, body)}
                onClose={() => setOpenId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

function CommentPopover({
  comment,
  onUpdate,
  onResolve,
  onDelete,
  onReply,
  onClose,
}: {
  comment: Comment;
  onUpdate: (patch: Partial<Comment>) => void;
  onResolve: () => void;
  onDelete: () => void;
  onReply: (body: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState(comment.body);

  return (
    <div className="absolute left-9 top-0 z-30 w-80 border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-[11px]">
        <CommentIcon className="h-3.5 w-3.5 text-slate-500" />
        <span className="font-medium text-slate-700">{comment.author}</span>
        <span className="text-slate-400">· {formatDateTime(comment.createdAt)}</span>
        <button
          onClick={onResolve}
          title="Resolve"
          className="ml-auto p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {comment.anchorText && (
        <div className="border-b border-slate-100 bg-amber-50 px-2 py-1 text-[11px] italic text-amber-900">
          “{comment.anchorText}”
        </div>
      )}
      <div className="border-b border-slate-100 px-2 py-2">
        <textarea
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          onBlur={() => bodyDraft !== comment.body && onUpdate({ body: bodyDraft })}
          rows={2}
          placeholder="Write your comment..."
          className="w-full resize-none bg-transparent text-sm text-slate-800 outline-none"
        />
      </div>
      <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto">
        {comment.replies.map((r) => (
          <li key={r.id} className="px-2 py-1.5 text-sm">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">{r.author}</span>
              <span>· {formatDateTime(r.createdAt)}</span>
            </div>
            <div className="text-slate-700">{r.body}</div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1 border-t border-slate-200 px-2 py-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onReply(draft);
              setDraft("");
            }
          }}
          placeholder="Write a reply..."
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          onClick={() => {
            onReply(draft);
            setDraft("");
          }}
          className="p-1 text-brand"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
