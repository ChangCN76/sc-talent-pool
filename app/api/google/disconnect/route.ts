import { NextResponse } from "next/server";
import { disconnectGoogleConnection, requireAdmin } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  try {
    await disconnectGoogleConnection();
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json({ error: "Could not disconnect Google Workspace." }, { status: 500 });
  }
}
