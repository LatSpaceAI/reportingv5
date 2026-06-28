// Server-side validation for user-doc refs forwarded from the client to the
// agent runner. Lives in lib/ (not a route file) so both /api/chat and
// /api/write can import it without exporting non-handler symbols from a route.

export interface UserDocRef {
  id: string;
  name: string;
  blobUrl: string;
}

// Only forward well-formed refs whose blobUrl is a Vercel Blob URL — the
// sandbox will fetch these, and its firewall only allows that host anyway, so
// anything else would just fail. This also keeps a malformed (or hostile)
// client payload from steering the runner's fetch elsewhere.
export function sanitizeUserDocs(input: unknown): UserDocRef[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (d): d is UserDocRef =>
        !!d &&
        typeof d === "object" &&
        typeof (d as UserDocRef).id === "string" &&
        typeof (d as UserDocRef).name === "string" &&
        typeof (d as UserDocRef).blobUrl === "string" &&
        /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(
          (d as UserDocRef).blobUrl
        )
    )
    .map((d) => ({ id: d.id, name: d.name, blobUrl: d.blobUrl }))
    .slice(0, 20);
}
