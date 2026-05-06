import type { Block, HeadingBlock, QualitativeDoc, Requirement } from "@/lib/qualitative/types";

// Walk the block list and return the location string ("<section> / <heading>")
// for the first occurrence of a requirement-ref pointing at the given id.
export function locationFor(blocks: Block[], requirementId: string): string {
  let currentSection: string | undefined;
  let currentHeading: string | undefined;
  for (const b of blocks) {
    if (b.kind === "heading") {
      if (b.level <= 2) currentSection = b.text;
      currentHeading = b.text;
    }
    if (b.kind === "requirement-ref" && b.requirementId === requirementId) {
      if (currentSection && currentHeading && currentSection !== currentHeading) {
        return `${currentSection} / ${currentHeading}`;
      }
      return currentHeading ?? currentSection ?? "—";
    }
  }
  return "Not tagged yet";
}

// Returns true when a block is a requirement-ref whose snapshot has drifted
// from the canonical requirement.response.
export function isStale(block: Block, requirements: Requirement[]): boolean {
  if (block.kind !== "requirement-ref") return false;
  const req = requirements.find((r) => r.id === block.requirementId);
  if (!req) return false;
  if (!req.response) {
    return block.snapshot.kind !== "empty";
  }
  if (block.snapshot.kind === "empty") return true;
  if (block.snapshot.kind !== req.response.kind) return true;
  return JSON.stringify(block.snapshot) !== JSON.stringify(req.response);
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatResponse(req: Requirement): string {
  if (!req.response) return "";
  if (req.response.kind === "text") {
    const v = req.response.value.trim();
    return v.length > 80 ? v.slice(0, 80) + "…" : v;
  }
  if (req.response.kind === "number") {
    const u = req.response.unit ? ` ${req.response.unit}` : "";
    return `${req.response.value}${u}`;
  }
  return `Table (${req.response.rows.length} rows)`;
}

export function headingsOf(doc: QualitativeDoc): HeadingBlock[] {
  return doc.blocks.filter((b): b is HeadingBlock => b.kind === "heading");
}
