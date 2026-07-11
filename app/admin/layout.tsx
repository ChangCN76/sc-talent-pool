import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/login");
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", userData.user.email)
    .eq("is_active", true)
    .maybeSingle();

  if (!admin) {
    redirect("/login?error=not-authorized");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="font-bold text-white">Studio Climb Admin</Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="secondary" href="/admin">Dashboard</Link>
            <Link className="secondary" href="/admin/settings">Settings</Link>
            <Link className="secondary" href="/admin/audit">Audit log</Link>
          </div>
        </div>
      </nav>
      {children}
    </main>
  );
}
