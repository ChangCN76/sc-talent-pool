import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthorizationUrl, createOAuthState, requireAdmin } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "sc_google_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.redirect(new URL("/login?error=admin-required", request.url));
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return response;
}
