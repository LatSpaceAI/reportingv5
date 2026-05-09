// Shared types between runner.ts and the per-mode handlers. The chat and
// write request shapes mirror the dispatcher routes one-to-one — keeping the
// JSON contract stable means we don't have to coordinate two parsers when the
// frontend evolves.

export type EmitFn = (event: string, data: unknown) => void;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QuestionContext {
  kind: "question";
  question: {
    id: string;
    label: string;
    sectionId: string;
    sectionTitle: string;
    questionKind: "fields" | "table";
    description?: string;
  };
  answer?: {
    status: "not-started" | "in-progress" | "completed";
    filledCount: number;
    totalFields: number;
    preview?: string;
  };
}

export interface DocumentContext {
  kind: "document";
  title: string;
  outline: Array<{
    id: string;
    kind: string;
    level?: 1 | 2 | 3;
    heading?: string;
    preview?: string;
  }>;
}

export type ChatContext = QuestionContext | DocumentContext;

export interface ChatJob {
  mode: "chat";
  messages: ChatMessage[];
  framework?: string;
  context?: ChatContext | null;
}

export interface OutlineItem {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "table"
    | "requirement-ref"
    | "data-ref"
    | "section-marker"
    | "diagram";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string;
}

export interface WriteJob {
  mode: "write";
  instruction: string;
  outline: OutlineItem[];
  framework?: string;
}
