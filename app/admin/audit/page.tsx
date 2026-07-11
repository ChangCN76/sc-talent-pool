import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function AuditPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data as AuditRow[]) ?? [];

  return (
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Security audit</p>
        <h1 className="mt-3 text-3xl font-bold">Important recruitment actions</h1>
        {error && <p className="mt-4 rounded-2xl border border-red-300/30 bg-red-300/10 p-3 text-red-100">{error.message}</p>}
        <div className="mt-6 grid gap-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{row.action}</p>
                <time className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-sm text-slate-400">{row.actor_email} · {row.entity_type} · {row.entity_id}</p>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(row.metadata, null, 2)}</pre>
            </div>
          ))}
          {!rows.length && <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-slate-400">No audit events recorded yet.</p>}
        </div>
      </div>
    </section>
  );
}
