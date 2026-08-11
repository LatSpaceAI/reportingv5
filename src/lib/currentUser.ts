// The signed-in user.
//
// There is no authentication in this build. The central ESG team shares one
// workstation and the entry model assumes a single operator, so rather than
// scatter "esg-team" string literals across routes and screens, the identity
// lives here — one place to change when auth arrives.
//
// The logbook credits whoever entered a value, so this name is what appears
// against every row. It is written into input_value.entered_by at save time,
// which means historic rows keep the identity they were saved under even after
// this constant changes.

export interface CurrentUser {
  /** Stored in input_value.entered_by / import_batch.uploaded_by. */
  id: string;
  name: string;
  role: string;
}

export const CURRENT_USER: CurrentUser = {
  id: "esg-team",
  name: "ESG Team",
  role: "Central ESG",
};

/** Initials for the logbook's avatar chip. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
