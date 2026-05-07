// Inline SVG icons used across the qualitative report UI. Kept as named
// exports so consumers tree-shake nicely and prop overrides (className,
// strokeWidth) stay obvious at the call site.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>
);
export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>
);
export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const Download = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);
export const Comment = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
);
export const Check = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 13 4 4L19 7" /></svg>
);
export const Plus = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const Trash = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" /></svg>
);
export const TableIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="0" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
);
export const Heading1 = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6v12M12 6v12M4 12h8M17 18V6l-2 2" /></svg>
);
export const Heading2 = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6v12M12 6v12M4 12h8M16 18h6l-3-4a2 2 0 1 0-3-2" /></svg>
);
export const Heading3 = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6v12M12 6v12M4 12h8M16 8a2 2 0 1 1 2 4h-1a2 2 0 1 1-2 4" /></svg>
);
export const Bookmark = (p: IconProps) => (
  <svg {...base(p)}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
);
export const RequirementIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
);
export const DataIcon = (p: IconProps) => (
  <svg {...base(p)}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></svg>
);
export const SectionIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h10M4 18h16" /></svg>
);
export const List = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
export const Send = (p: IconProps) => (
  <svg {...base(p)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
);
export const Pencil = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
export const X = (p: IconProps) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const PanelClose = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="0" /><path d="M15 3v18" /></svg>
);
export const Paperclip = (p: IconProps) => (
  <svg {...base(p)}><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
);
export const Search = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const Connected = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12l4 4L19 6" /></svg>
);
export const Diagram = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="6" height="4" />
    <rect x="15" y="3" width="6" height="4" />
    <rect x="9" y="17" width="6" height="4" />
    <path d="M6 7v3h12V7" />
    <path d="M12 10v7" />
  </svg>
);
