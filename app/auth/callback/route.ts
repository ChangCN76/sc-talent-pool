import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeInternalPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/admin";
  }

  try {
    const parsed = new URL(next, "http://internal.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

function loginRedirect(requestUrl: URL, error: string) {
  const redirectUrl = new URL("/login", requestUrl.origin);
  redirectUrl.searchParams.set("error", error);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return loginRedirect(requestUrl, "missing-code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return loginRedirect(requestUrl, "session-exchange-failed");
  }

  const redirectPath = safeInternalPath(requestUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
