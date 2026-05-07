// Qualitative report (e.g. CBAM MMD) — types for documents, requirements, and comments.
// A document is a flat ordered list of blocks; embeds (requirement-ref, data-ref) reference
// records held in the requirements / metrics arrays so updates flow bidirectionally.

export type BlockId = string;
export type RequirementId = string;
export type CommentId = string;
export type MetricId = string;

export type HeadingLevel = 1 | 2 | 3;

export interface BaseBlock {
  id: BlockId;
}

export interface HeadingBlock extends BaseBlock {
  kind: "heading";
  level: HeadingLevel;
  text: string;
  // Optional logical "section" tag — used by the Requirements table's
  // "Location in report" column to surface the nearest enclosing section.
  sectionTag?: string;
}

export interface ParagraphBlock extends BaseBlock {
  kind: "paragraph";
  // Plain text for v1. Inline marks (bold/italic/links/comment anchors) can
  // be layered on later by switching `text` to a richer representation.
  text: string;
}

export interface TableBlock extends BaseBlock {
  kind: "table";
  columns: string[];
  rows: string[][];
}

export interface RequirementRefBlock extends BaseBlock {
  kind: "requirement-ref";
  requirementId: RequirementId;
  // Snapshot of the response at the moment of insertion / last sync. Used to
  // detect drift between document and the canonical requirement record.
  snapshot: ResponseSnapshot;
  snapshotAt: string;
}

export interface DataRefBlock extends BaseBlock {
  kind: "data-ref";
  metricId: MetricId;
  snapshotValue: string | number;
  unit?: string;
  snapshotAt: string;
}

export interface SectionMarkerBlock extends BaseBlock {
  // A logical anchor used when the user invokes the "Section" toolbar button.
  // Visually rendered as a soft chip; doesn't change layout.
  kind: "section-marker";
  label: string;
}

// Text-source diagram block. Source-of-truth is the `source` string in the
// declared `format` syntax (Mermaid for v1). Renders to SVG client-side and
// to PNG in DOCX export. The optional caption is shown beneath the diagram
// and is the right place for citations like "Source: §6.4 (page 78)".
export interface DiagramBlock extends BaseBlock {
  kind: "diagram";
  format: "mermaid";
  source: string;
  caption?: string;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | RequirementRefBlock
  | DataRefBlock
  | SectionMarkerBlock
  | DiagramBlock;

export type ResponseKind = "text" | "number" | "table";

export type Response =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number; unit?: string }
  | { kind: "table"; columns: string[]; rows: string[][] };

export type ResponseSnapshot = Response | { kind: "empty" };

export interface RequirementAttachment {
  id: string;
  name: string;
  url?: string;
}

export interface RequirementActivityEntry {
  id: string;
  at: string;
  actor: string;
  message: string;
}

export interface Requirement {
  id: RequirementId; // human-readable identifier, e.g. "GRI 2-14"
  name: string;
  description: string;
  response: Response | null;
  attachments: RequirementAttachment[];
  activity: RequirementActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Metric {
  id: MetricId;
  name: string;
  unit?: string;
  value: string | number;
  source?: string;
  updatedAt: string;
}

export interface CommentReply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Comment {
  id: CommentId;
  blockId: BlockId;
  // Char range inside paragraph block when comment is anchored to a selection.
  range?: { start: number; end: number };
  // The text the comment is anchored to — kept so the chip can show context
  // even if the underlying block changes.
  anchorText?: string;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  replies: CommentReply[];
}

// AI-drafted insertion that hasn't been accepted into the document yet.
// Rendered inline at the insertion point with a highlight + Accept/Reject UI;
// also surfaced as a card in the assistant chat. Only insertion is supported
// in v1 — no replacements or deletions.
export type ProposalBlock =
  | Extract<Block, { kind: "heading" }>
  | Extract<Block, { kind: "paragraph" }>
  | Extract<Block, { kind: "table" }>
  | Extract<Block, { kind: "diagram" }>;

export interface Proposal {
  id: string;
  // Block id that the proposal sits AFTER. null means "prepend at top".
  afterBlockId: BlockId | null;
  blocks: ProposalBlock[];
  // Short rationale from the model — shown under the chat-side card.
  rationale: string;
  // Citations the model used (section + pages) so the user can audit.
  sources?: { section: string; title: string; pages: string }[];
  createdAt: string;
}

export interface QualitativeDoc {
  frameworkId: string;
  title: string;
  blocks: Block[];
  requirements: Requirement[];
  metrics: Metric[];
  comments: Comment[];
  proposals?: Proposal[];
  updatedAt: string;
}
