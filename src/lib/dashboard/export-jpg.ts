/** Renders a DOM node to a JPG and triggers a browser download.
 *  Shared by the whole-dashboard export button and the per-tile one. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").trim() || "dashboard";
}

export async function downloadNodeAsJpg(
  node: HTMLElement,
  filename: string
): Promise<void> {
  // Dynamic import keeps html-to-image off the initial bundle.
  const { toJpeg } = await import("html-to-image");
  const dataUrl = await toJpeg(node, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    quality: 0.95,
    filter: (n) =>
      !(n instanceof HTMLElement && n.dataset.exportExclude !== undefined),
  });
  const a = document.createElement("a");
  a.download = `${sanitizeFilename(filename)}.jpg`;
  a.href = dataUrl;
  a.click();
}
