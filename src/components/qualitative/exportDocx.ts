// Word (.docx) export for qualitative reports. Walks the same block model
// as exportMarkdown.ts but emits docx-library elements. Styling matches the
// on-screen editor at a high level (Calibri-ish font, sized H1/H2/H3, bordered
// tables, requirement embeds as indented blockquotes). Refine later as needed.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, DiagramBlock, QualitativeDoc, ResponseSnapshot } from "@/lib/qualitative/types";

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

// ---------- Diagram → PNG ----------
//
// Mermaid renders to SVG client-side; the docx library wants PNG bytes (or
// a small set of other raster formats). We rasterize via the browser: write
// the SVG into a Blob URL, paint it onto a canvas at a higher pixel density
// (so it stays crisp inside Word), then read the PNG out of the canvas.

interface RenderedDiagram {
  png: Uint8Array;
  width: number; // CSS pixels, used for the docx layout dimensions
  height: number;
}

const DIAGRAM_RENDER_SCALE = 2; // 2x for retina-ish output in Word
const DIAGRAM_MAX_WIDTH = 600; // CSS px — keeps images inside 1-inch margins

async function svgFromMermaid(source: string): Promise<string> {
  const mod = await import("mermaid");
  const m = mod.default;
  m.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
  const id = `mmd-export-${Math.random().toString(36).slice(2, 8)}`;
  const { svg } = await m.render(id, source);
  return svg;
}

function svgIntrinsicSize(svg: string): { width: number; height: number } {
  // Try the explicit width/height first; fall back to viewBox.
  const widthMatch = svg.match(/<svg[^>]*\swidth="([\d.]+)(?:px)?"/);
  const heightMatch = svg.match(/<svg[^>]*\sheight="([\d.]+)(?:px)?"/);
  if (widthMatch && heightMatch) {
    return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
  }
  const viewBox = svg.match(/<svg[^>]*\sviewBox="([\d.\s-]+)"/);
  if (viewBox) {
    const parts = viewBox[1].split(/\s+/).map(parseFloat);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return { width: 600, height: 400 };
}

async function rasterizeSvgToPng(svg: string): Promise<RenderedDiagram> {
  const { width, height } = svgIntrinsicSize(svg);
  const cssWidth = Math.min(width, DIAGRAM_MAX_WIDTH);
  const scale = (cssWidth / width) * DIAGRAM_RENDER_SCALE;
  const canvasWidth = Math.max(1, Math.round(width * scale));
  const canvasHeight = Math.max(1, Math.round(height * scale));

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load SVG into <img> for export"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to acquire 2D canvas context for export");
    // White background so transparency doesn't render as black in some Word
    // versions.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!pngBlob) throw new Error("canvas.toBlob returned null");
    const ab = await pngBlob.arrayBuffer();
    return {
      png: new Uint8Array(ab),
      width: cssWidth,
      height: (cssWidth / width) * height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderDiagramsForExport(doc: QualitativeDoc): Promise<Map<string, RenderedDiagram | Error>> {
  const out = new Map<string, RenderedDiagram | Error>();
  const diagrams = doc.blocks.filter((b): b is DiagramBlock => b.kind === "diagram");
  // Render sequentially — Mermaid mutates a global config so concurrent
  // render() calls can stomp on each other, especially in JSDOM-style envs.
  for (const block of diagrams) {
    try {
      const svg = await svgFromMermaid(block.source);
      out.set(block.id, await rasterizeSvgToPng(svg));
    } catch (err) {
      out.set(block.id, err instanceof Error ? err : new Error(String(err)));
    }
  }
  return out;
}

function diagramElements(
  block: DiagramBlock,
  rendered: Map<string, RenderedDiagram | Error>
): (Paragraph | Table)[] {
  const result = rendered.get(block.id);
  const out: (Paragraph | Table)[] = [];
  if (result instanceof Error || !result) {
    out.push(
      bodyParagraph(
        `[Diagram could not be rendered: ${result instanceof Error ? result.message : "unknown error"}]`,
        { italic: true }
      )
    );
  } else {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new ImageRun({
            data: result.png,
            transformation: {
              width: Math.round(result.width),
              height: Math.round(result.height),
            },
            type: "png",
          }),
        ],
      })
    );
  }
  if (block.caption?.trim()) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: SPACING_AFTER_PARAGRAPH },
        children: [
          new TextRun({
            text: block.caption,
            italics: true,
            size: 20, // 10pt
            font: FONT,
            color: "555555",
          }),
        ],
      })
    );
  } else {
    out.push(new Paragraph({ children: [], spacing: { after: SPACING_AFTER_PARAGRAPH } }));
  }
  return out;
}

function blockToDocxElements(
  block: Block,
  doc: QualitativeDoc,
  diagrams: Map<string, RenderedDiagram | Error>
): (Paragraph | Table)[] {
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
  if (block.kind === "diagram") {
    return diagramElements(block, diagrams);
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

  // Render every diagram block to PNG up front — docx-library is sync-only,
  // and rendering each block lazily inside the loop would make ordering hard.
  const diagrams = await renderDiagramsForExport(doc);

  const body: (Paragraph | Table)[] = [titleParagraph];
  for (const block of doc.blocks) {
    body.push(...blockToDocxElements(block, doc, diagrams));
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
