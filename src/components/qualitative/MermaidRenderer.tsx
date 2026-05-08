"use client";

import { useEffect, useRef, useState } from "react";

// Lazy-imports mermaid only when the first diagram is rendered so the ~400KB
// chunk doesn't load for users who never open a report with a diagram.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        // Render labels as native SVG <text> instead of HTML in <foreignObject>.
        // foreignObject doesn't survive raster-to-PNG (used by the DOCX
        // exporter), so disabling htmlLabels everywhere keeps on-screen and
        // exported diagrams visually identical.
        flowchart: { htmlLabels: false },
        class: { htmlLabels: false },
      });
      return m;
    });
  }
  return mermaidPromise;
}

let counter = 0;
function nextId() {
  counter += 1;
  return `mmd-${Date.now().toString(36)}-${counter}`;
}

interface Props {
  source: string;
  // Stable id for the rendered SVG node — useful so consumers can locate it
  // (e.g. the DOCX exporter walks the DOM for `data-mermaid-source`).
  cacheKey?: string;
  className?: string;
}

// Renders a Mermaid source string to inline SVG. Errors fall back to a small
// red banner with the raw source so the user can fix it.
export function MermaidRenderer({ source, cacheKey, className }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string>(nextId());

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvg(null);

    if (!source.trim()) {
      setSvg("");
      return;
    }

    loadMermaid()
      .then(async (m) => {
        try {
          // Mermaid 10+ exposes `render(id, src)` returning { svg, bindFunctions }.
          const { svg: out } = await m.render(idRef.current, source);
          if (!cancelled) setSvg(out);
        } catch (err) {
          if (!cancelled) {
            const message = err instanceof Error ? err.message : "Render failed";
            setError(message);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Mermaid");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <div className={className}>
        <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <div className="font-medium">Diagram syntax error</div>
          <div className="mt-1 whitespace-pre-wrap text-[11px] text-rose-700/80">{error}</div>
        </div>
        <pre className="mt-1 overflow-x-auto bg-slate-100 p-2 font-mono text-[11px] text-slate-700">
          {source}
        </pre>
      </div>
    );
  }

  if (svg === null) {
    return (
      <div className={className}>
        <div className="grid place-items-center bg-slate-50 px-3 py-6 text-xs text-slate-400">
          Rendering diagram…
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      data-mermaid-source={source}
      data-cache-key={cacheKey}
      // Mermaid output is sanitized at securityLevel: "strict" — labels are
      // HTML-escaped and arbitrary script tags are not emitted.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
