"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "sc.climbadm@gmail.com";

export default function LoginPage() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (email.toLowerCase() !== ADMIN_EMAIL) {
      setLoading(false);
      setMessage("Only the Studio Climb recruitment administrator account is allowed for this workspace.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    setLoading(false);
    setMessage(error ? error.message : "Secure login link sent. Check the recruitment admin email inbox.");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <Link className="text-sm text-cyan-300" href="/">← Back to public security page</Link>
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Admin access</p>
          <h1 className="mt-3 text-3xl font-bold">Sign in securely</h1>
          <p className="mt-3 text-slate-300">
            Use Supabase magic-link authentication for the Studio Climb recruitment administrator. Do not enter or share the Gmail password.
          </p>
          <form onSubmit={sendMagicLink} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Administrator email
              <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="primary" type="submit" disabled={loading}>{loading ? "Sending..." : "Send secure login link"}</button>
          </form>
          {message && <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{message}</p>}
        </div>
      </section>
    </main>
  );
}
