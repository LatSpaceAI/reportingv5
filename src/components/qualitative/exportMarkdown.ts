import type { Block, QualitativeDoc } from "@/lib/qualitative/types";

// Convert a single block to Markdown. Embed blocks render their snapshot so
// the export reflects what the user sees in the document, not the live
// requirement record.
function blockToMd(block: Block, doc: QualitativeDoc): string {
  if (block.kind === "heading") {
    return `${"#".repeat(block.level)} ${block.text}`;
  }
  if (block.kind === "paragraph") {
    return block.text;
  }
  if (block.kind === "table") {
    const head = `| ${block.columns.join(" | ")} |`;
    const sep = `| ${block.columns.map(() => "---").join(" | ")} |`;
    const body = block.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return `${head}\n${sep}\n${body}`;
  }
  if (block.kind === "requirement-ref") {
    const req = doc.requirements.find((r) => r.id === block.requirementId);
    const head = req
      ? `> **${req.id}: ${req.name}**`
      : `> **${block.requirementId}** _(missing)_`;
    let body = "_No response yet._";
    if (block.snapshot.kind === "text") body = block.snapshot.value;
    else if (block.snapshot.kind === "number")
      body = `${block.snapshot.value}${block.snapshot.unit ? " " + block.snapshot.unit : ""}`;
    else if (block.snapshot.kind === "table") {
      const head2 = `| ${block.snapshot.columns.join(" | ")} |`;
      const sep2 = `| ${block.snapshot.columns.map(() => "---").join(" | ")} |`;
      const body2 = block.snapshot.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
      body = `\n${head2}\n${sep2}\n${body2}\n`;
    }
    return `${head}\n>\n> ${body.replace(/\n/g, "\n> ")}`;
  }
  if (block.kind === "data-ref") {
    return `**${block.snapshotValue}${block.unit ? " " + block.unit : ""}**`;
  }
  if (block.kind === "section-marker") {
    return `<!-- section: ${block.label} -->`;
  }
  return "";
}

export function exportToMarkdown(doc: QualitativeDoc): string {
  const lines = doc.blocks.map((b) => blockToMd(b, doc)).filter(Boolean);
  return `${lines.join("\n\n")}\n`;
}

export function downloadMarkdown(doc: QualitativeDoc): void {
  const md = exportToMarkdown(doc);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "report"}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
