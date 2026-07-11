"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { writeAuditLog } from "@/lib/audit";

type SettingRow = {
  id: string;
  setting_key: string;
  setting_value: Record<string, string | boolean>;
  updated_at: string;
};

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [notice, setNotice] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [arrival, setArrival] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase.from("admin_settings").select("*").order("setting_key");
    if (error) {
      setNotice(error.message);
      return;
    }
    const rows = (data as SettingRow[]) ?? [];
    setSettings(rows);
    const location = rows.find((row) => row.setting_key === "interview_location")?.setting_value;
    setAddress(String(location?.address ?? ""));
    setUnit(String(location?.unit ?? ""));
    setArrival(String(location?.arrival_instructions ?? ""));
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    const value = { address, unit, arrival_instructions: arrival };
    const { error } = await supabase
      .from("admin_settings")
      .update({ setting_value: value, updated_by: userData.user?.email ?? "unknown-admin" })
      .eq("setting_key", "interview_location");

    if (error) {
      setNotice(error.message);
      return;
    }

    await writeAuditLog(supabase, "admin_settings.interview_location_updated", "admin_settings", "interview_location", value);
    setNotice("Interview location settings saved and audited.");
    await loadSettings();
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Admin settings</p>
        <h1 className="mt-3 text-3xl font-bold">Secure setup checklist</h1>
        <p className="mt-3 text-slate-300">
          Store OAuth client secrets and webhook tokens only in Supabase/Vercel environment variables. This page records setup state and non-secret operational settings only.
        </p>
        <div className="mt-5 grid gap-3">
          {settings.map((setting) => (
            <div key={setting.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="font-semibold">{setting.setting_key}</p>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify(setting.setting_value, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={saveLocation} className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold">Interview location</h2>
        <p className="mt-2 text-sm text-slate-400">Used later for physical interview invitations and Calendar events.</p>
        <div className="mt-5 grid gap-4">
          <textarea className="field min-h-28" value={address} onChange={(event) => setAddress(event.target.value)} />
          <input className="field" placeholder="Unit / floor" value={unit} onChange={(event) => setUnit(event.target.value)} />
          <textarea className="field min-h-28" placeholder="Arrival instructions" value={arrival} onChange={(event) => setArrival(event.target.value)} />
          <button className="primary" type="submit">Save settings</button>
        </div>
        {notice && <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{notice}</p>}
      </form>
    </section>
  );
}
