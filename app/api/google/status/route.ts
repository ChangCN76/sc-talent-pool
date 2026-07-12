import { NextResponse } from "next/server";
import { getGoogleConnectionStatus, requireAdmin } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  try {
    return NextResponse.json(await getGoogleConnectionStatus());
  } catch {
    return NextResponse.json({ error: "Could not load Google Workspace status." }, { status: 500 });
  }
}
