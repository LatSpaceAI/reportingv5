// Word (.docx) export for qualitative reports. Walks the same block model
// as exportMarkdown.ts but emits docx-library elements. Styling matches the
// on-screen editor at a high level (Calibri-ish font, sized H1/H2/H3, bordered
// tables, requirement embeds as indented blockquotes). Refine later as needed.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, QualitativeDoc, ResponseSnapshot } from "@/lib/qualitative/types";

// ---------- Style constants ----------

const FONT = "Calibri";

// Twips: 1 inch = 1440 twips; 1 pt = 20 twips. Used for spacing/margins.
const SPACING_AFTER_PARAGRAPH = 120;
const SPACING_AFTER_HEADING = 200;

const HEADING_SIZE = {
  1: 32, // 16pt (docx uses half-points)
  2: 28, // 14pt
  3: 24, // 12pt
} as const;

const BODY_SIZE = 22; // 11pt

const BORDER_GREY = "BFBFBF";
const HEADER_FILL = "F2F2F2";
const QUOTE_FILL = "F8F8F8";

// ---------- Block converters ----------

function headingParagraph(text: string, level: 1 | 2 | 3): Paragraph {
  return new Paragraph({
    heading:
      level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { after: SPACING_AFTER_HEADING },
    children: [
      new TextRun({
        text,
        bold: true,
        size: HEADING_SIZE[level],
        font: FONT,
      }),
    ],
  });
}

function bodyParagraph(text: string, opts: { italic?: boolean; bold?: boolean; indent?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: SPACING_AFTER_PARAGRAPH },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [
      new TextRun({
        text,
        size: BODY_SIZE,
        font: FONT,
        italics: opts.italic,
        bold: opts.bold,
      }),
    ],
  });
}

function tableElement(columns: string[], rows: string[][]): Table {
  const cellBorder = {
    style: BorderStyle.SINGLE,
    size: 4, // eighths of a point — 4 = 0.5pt
    color: BORDER_GREY,
  };
  const allBorders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map(
          (col) =>
            new TableCell({
              shading: { type: ShadingType.SOLID, color: HEADER_FILL, fill: HEADER_FILL },
              borders: allBorders,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: col || "", bold: true, size: BODY_SIZE, font: FONT }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: columns.map((_, ci) => {
              const cellText = row[ci] ?? "";
              return new TableCell({
                borders: allBorders,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cellText, size: BODY_SIZE, font: FONT })],
                  }),
                ],
              });
            }),
          })
      ),
    ],
  });
}

// Render a requirement-embed as an indented "quote" block: a small bordered
// box with a header line and the snapshot value beneath. We use a single-cell
// 1x1 table to get the box, so the visual matches a typical "callout" look
// without relying on Word styles the user might not have installed.
function requirementEmbed(headerText: string, snapshot: ResponseSnapshot): Table {
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: BORDER_GREY,
  };

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: headerText, bold: true, size: BODY_SIZE, font: FONT }),
      ],
    }),
  ];

  if (snapshot.kind === "empty") {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "No response yet.", italics: true, size: BODY_SIZE, font: FONT, color: "808080" }),
        ],
      })
    );
  } else if (snapshot.kind === "text") {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: snapshot.value, size: BODY_SIZE, font: FONT })],
      })
    );
  } else if (snapshot.kind === "number") {
    const v = `${snapshot.value}${snapshot.unit ? " " + snapshot.unit : ""}`;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: v, bold: true, size: BODY_SIZE, font: FONT })],
      })
    );
  } else if (snapshot.kind === "table") {
    children.push(tableElement(snapshot.columns, snapshot.rows));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: QUOTE_FILL, fill: QUOTE_FILL },
            borders: { top: border, bottom: border, left: border, right: border },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children,
          }),
        ],
      }),
    ],
  });
}

function blockToDocxElements(block: Block, doc: QualitativeDoc): (Paragraph | Table)[] {
  if (block.kind === "heading") {
    return [headingParagraph(block.text || "(untitled)", block.level)];
  }
  if (block.kind === "paragraph") {
    return [bodyParagraph(block.text || "")];
  }
  if (block.kind === "table") {
    return [
      tableElement(block.columns, block.rows),
      // Spacer so the next block isn't glued to the table
      new Paragraph({ children: [], spacing: { after: 120 } }),
    ];
  }
  if (block.kind === "requirement-ref") {
    const req = doc.requirements.find((r) => r.id === block.requirementId);
    const header = req
      ? `${req.id}: ${req.name}`
      : `${block.requirementId} (missing)`;
    return [
      requirementEmbed(header, block.snapshot),
      new Paragraph({ children: [], spacing: { after: 120 } }),
    ];
  }
  if (block.kind === "data-ref") {
    const text = `${block.snapshotValue}${block.unit ? " " + block.unit : ""}`;
    return [bodyParagraph(text, { bold: true })];
  }
  if (block.kind === "section-marker") {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [
          new TextRun({
            text: `— ${block.label} —`,
            italics: true,
            size: BODY_SIZE,
            font: FONT,
            color: "808080",
          }),
        ],
      }),
    ];
  }
  return [];
}

// ---------- Public API ----------

export async function buildDocx(doc: QualitativeDoc): Promise<Blob> {
  const titleParagraph = new Paragraph({
    spacing: { after: 240 },
    children: [
      new TextRun({
        text: doc.title || "Untitled report",
        bold: true,
        size: 36, // 18pt
        font: FONT,
      }),
    ],
  });

  const body: (Paragraph | Table)[] = [titleParagraph];
  for (const block of doc.blocks) {
    body.push(...blockToDocxElements(block, doc));
  }

  const document = new Document({
    creator: "CBAM Reporting",
    title: doc.title,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              // 1 inch margins
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(document);
}

export async function downloadDocx(doc: QualitativeDoc): Promise<void> {
  const blob = await buildDocx(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "report"}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
