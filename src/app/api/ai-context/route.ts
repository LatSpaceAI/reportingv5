// GET /api/ai-context → the signed-in account's saved profile
// PUT /api/ai-context → save it
//
// The profile (company name, logo, business context) is scoped to the account
// in the session cookie, so it follows the login rather than the browser.

import { NextResponse } from "next/server";

import { parseAiContextProfile } from "@/lib/aiContext";
import {
  getAiContextProfileOrDefault,
  saveAiContextProfile,
} from "@/lib/aiContextRepo";
import { accountFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const account = accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const profile = await getAiContextProfileOrDefault(
      account.id,
      account.organization,
    );
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const account = accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAiContextProfile(
    (body as { profile?: unknown } | null)?.profile ?? body,
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const profile = await saveAiContextProfile(account.id, parsed.profile);
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
