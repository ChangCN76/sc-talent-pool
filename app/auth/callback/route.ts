import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SafeRedirect = {
  pathname: string;
  search: string;
  hash: string;
};

function safeInternalRedirect(value: string | null): SafeRedirect {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return { pathname: "/admin", search: "", hash: "" };
  }

  try {
    const parsed = new URL(value, "https://studio-climb.local");
    return {
      pathname: parsed.pathname || "/admin",
      search: parsed.search,
      hash: parsed.hash,
    };
  } catch {
    return { pathname: "/admin", search: "", hash: "" };
  }
}

function loginRedirect(request: NextRequest, error: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = new URLSearchParams({ error }).toString();
  redirectUrl.hash = "";
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return loginRedirect(request, "Missing authentication code. Please request a new secure login link.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return loginRedirect(
      request,
      error?.message || "Could not verify the secure login link. Please request a fresh link.",
    );
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = next.pathname;
  redirectUrl.search = next.search;
  redirectUrl.hash = next.hash;
  return NextResponse.redirect(redirectUrl);
}
