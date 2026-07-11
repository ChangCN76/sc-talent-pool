import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Studio Climb recruitment</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">Secure candidate email workflow</h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">
          Candidate records, Gmail imports, form submissions, attachments and review decisions are protected. Administrators must sign in before viewing or changing recruitment data.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="primary" href="/login">Admin login</Link>
          <Link className="secondary" href="/admin">Open dashboard</Link>
        </div>
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-sm text-slate-300">
          <p className="font-semibold text-white">Security status</p>
          <ul className="mt-3 space-y-2">
            <li>• Public homepage does not expose applicant data.</li>
            <li>• Candidate workflow is preserved inside the protected /admin dashboard.</li>
            <li>• Gmail connection will use Google OAuth only; no mailbox password is requested or stored.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
