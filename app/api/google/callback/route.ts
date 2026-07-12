import { NextResponse, type NextRequest } from "next/server";
import {
  assertAllowedGoogleEmail,
  exchangeCodeForTokens,
  getGoogleAccountEmail,
  requireAdmin,
  upsertGoogleConnection,
} from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "sc_google_oauth_state";

function redirectToAdmin(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin", request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return redirectToAdmin(request, { google: "error", reason: "admin-required" });
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const storedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code) {
    return redirectToAdmin(request, { google: "error", reason: "missing-code" });
  }

  if (!state || !storedState || state !== storedState) {
    return redirectToAdmin(request, { google: "error", reason: "invalid-state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getGoogleAccountEmail(tokens.access_token!);
    assertAllowedGoogleEmail(email);
    await upsertGoogleConnection({ providerAccountEmail: email, tokens });
    return redirectToAdmin(request, { google: "connected" });
  } catch {
    return redirectToAdmin(request, { google: "error", reason: "connection-failed" });
  }
}
