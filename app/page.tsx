"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  Application,
  ApplicationInput,
  decisions,
  positions,
  RecruitmentStatus,
  statusForTemplate,
  statuses,
  templates,
} from "@/lib/recruitment";

const emptyForm: ApplicationInput = {
  applicant_name: "",
  applicant_email: "",
  position: "Position Not Clear",
  status: "New Application",
  subject: "",
  message: "",
  has_resume: false,
  has_portfolio: false,
  first_reply_sent: false,
  applicant_replied: false,
  assigned_to: "",
  review_decision: "",
  internal_comments: "",
  last_email_subject: "",
  last_email_body: "",
};

const demoRows: Application[] = [
  {
    id: "demo-1",
    applicant_name: "Maya Chen",
    applicant_email: "maya.chen@example.com",
    position: "Animation",
    status: "Applicant Replied",
    subject: "Animator application - Maya Chen",
    message: "I am applying for the animation role and attached my reel.",
    has_resume: true,
    has_portfolio: true,
    first_reply_sent: true,
    applicant_replied: true,
    assigned_to: "Animation Lead",
    review_decision: "Proceed",
    internal_comments: "Strong reel; ask team to review timing samples.",
    last_email_subject: "Thank you for your application",
    last_email_body: "Thank you for applying. We have received your application and will review it carefully.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<ApplicationInput>(emptyForm);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0].id);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const selected = applications.find((application) => application.id === selectedId) ?? applications[0];

  const metrics = useMemo(
    () => ({
      total: applications.length,
      newItems: applications.filter((item) => item.status === "New Application").length,
      needsFirstReply: applications.filter((item) => !item.first_reply_sent).length,
      applicantReplies: applications.filter((item) => item.applicant_replied).length,
      teamReview: applications.filter((item) => item.status === "Waiting for Team Review").length,
      interviews: applications.filter((item) => item.status === "Interview").length,
    }),
    [applications],
  );

  useEffect(() => {
    void loadApplications();
  }, []);

  async function loadApplications() {
    setLoading(true);
    if (!supabase) {
      setApplications(demoRows);
      setSelectedId(demoRows[0]?.id ?? "");
      setNotice("Supabase env is not available locally, so the UI is showing a demo row. Pull Vercel env to persist changes.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      setNotice(`Could not load database rows: ${error.message}`);
      setApplications(demoRows);
    } else {
      setApplications((data as Application[]) ?? []);
      setSelectedId(data?.[0]?.id ?? "");
      setNotice("Recruitment dashboard synced with Supabase.");
    }
    setLoading(false);
  }

  async function persistUpdate(id: string, patch: Partial<ApplicationInput>, message: string) {
    if (!supabase || id.startsWith("demo-")) {
      setApplications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item,
        ),
      );
      setNotice(`${message} Demo-only until Supabase env is pulled.`);
      return;
    }

    const { data, error } = await supabase
      .from("job_applications")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setApplications((items) => items.map((item) => (item.id === id ? (data as Application) : item)));
    setNotice(message);
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.applicant_name || !form.applicant_email || !form.subject) {
      setNotice("Applicant name, email, and subject are required.");
      return;
    }

    if (!supabase) {
      const row: Application = {
        ...form,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setApplications((items) => [row, ...items]);
      setSelectedId(row.id);
      setForm(emptyForm);
      setNotice("Application created in demo mode. Pull Vercel env to persist it to Supabase.");
      return;
    }

    const { data, error } = await supabase.from("job_applications").insert(form).select().single();
    if (error) {
      setNotice(error.message);
      return;
    }
    setApplications((items) => [data as Application, ...items]);
    setSelectedId((data as Application).id);
    setForm(emptyForm);
    setNotice("New application captured, categorized, and saved.");
  }

  async function deleteApplication(id: string) {
    if (!supabase || id.startsWith("demo-")) {
      setApplications((items) => items.filter((item) => item.id !== id));
      setNotice("Application removed from the current demo view.");
      return;
    }

    const { error } = await supabase.from("job_applications").delete().eq("id", id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setApplications((items) => items.filter((item) => item.id !== id));
    setNotice("Application deleted from Supabase.");
  }

  function chooseTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    const template = templates.find((item) => item.id === templateId)!;
    void persistUpdate(
      selected.id,
      {
        last_email_subject: template.subject,
        last_email_body: template.body,
      },
      `Loaded ${template.name} template for editing.`,
    );
  }

  async function sendTemplate() {
    const template = templates.find((item) => item.id === selectedTemplate)!;
    const nextStatus = statusForTemplate(template.id);
    await persistUpdate(
      selected.id,
      {
        status: nextStatus,
        first_reply_sent: selected.first_reply_sent || template.id === "acknowledgement",
        applicant_replied: nextStatus === "Additional Information Requested" ? false : selected.applicant_replied,
        last_email_subject: selected.last_email_subject || template.subject,
        last_email_body: selected.last_email_body || template.body,
      },
      `${template.name} recorded and application moved to ${nextStatus}.`,
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Recruitment inbox control room</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Job application email management</h1>
              <p className="mt-4 max-w-3xl text-slate-300">
                Capture incoming application emails, categorize them by role, send standard replies, track applicant responses,
                assign team review, and move every applicant through the right status from one database-backed dashboard.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
              {isSupabaseConfigured ? "Live Supabase mode: every form and action persists." : "Local demo mode: Supabase env was not pulled in this shell."}
            </div>
          </div>
        </header>

        {notice && <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">{notice}</div>}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Total", metrics.total],
            ["New", metrics.newItems],
            ["Needs first reply", metrics.needsFirstReply],
            ["Applicant replies", metrics.applicantReplies],
            ["Team review", metrics.teamReview],
            ["Interviews", metrics.interviews],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createApplication} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-semibold">Capture incoming email</h2>
            <div className="mt-5 grid gap-4">
              <input className="field" placeholder="Applicant name" value={form.applicant_name} onChange={(event) => setForm({ ...form, applicant_name: event.target.value })} />
              <input className="field" placeholder="Applicant email" type="email" value={form.applicant_email} onChange={(event) => setForm({ ...form, applicant_email: event.target.value })} />
              <select className="field" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })}>
                {positions.map((position) => <option key={position}>{position}</option>)}
              </select>
              <input className="field" placeholder="Email subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
              <textarea className="field min-h-28" placeholder="Email message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="check"><input type="checkbox" checked={form.has_resume} onChange={(event) => setForm({ ...form, has_resume: event.target.checked })} /> Resume attached</label>
                <label className="check"><input type="checkbox" checked={form.has_portfolio} onChange={(event) => setForm({ ...form, has_portfolio: event.target.checked })} /> Portfolio attached</label>
              </div>
              <button className="primary" type="submit">Save application</button>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Application queue</h2>
              <button className="secondary" onClick={loadApplications} disabled={loading}>{loading ? "Syncing..." : "Refresh"}</button>
            </div>
            <div className="mt-5 grid gap-3">
              {applications.map((application) => (
                <button key={application.id} onClick={() => setSelectedId(application.id)} className={`rounded-2xl border p-4 text-left transition ${selected?.id === application.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-slate-900/70 hover:border-white/30"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{application.applicant_name}</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{application.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{application.position} · {application.subject}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {selected && (
          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-2xl font-semibold">Manage selected applicant</h2>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-xl font-semibold">{selected.applicant_name}</p>
                  <p className="text-slate-400">{selected.applicant_email}</p>
                  <p className="mt-3 text-sm text-slate-300">{selected.message}</p>
                </div>
                <select className="field" value={selected.status} onChange={(event) => persistUpdate(selected.id, { status: event.target.value as RecruitmentStatus }, "Status updated.")}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
                <input className="field" placeholder="Assign to team member" value={selected.assigned_to} onChange={(event) => persistUpdate(selected.id, { assigned_to: event.target.value, status: "Waiting for Team Review" }, "Application assigned for team review.")} />
                <select className="field" value={selected.review_decision} onChange={(event) => persistUpdate(selected.id, { review_decision: event.target.value }, "Review decision saved.")}>
                  <option value="">Select review decision</option>
                  {decisions.map((decision) => <option key={decision}>{decision}</option>)}
                </select>
                <textarea className="field min-h-24" placeholder="Internal team comments" value={selected.internal_comments} onChange={(event) => persistUpdate(selected.id, { internal_comments: event.target.value }, "Internal comment saved.")} />
                <div className="grid gap-3 md:grid-cols-3">
                  <button className="secondary" onClick={() => persistUpdate(selected.id, { first_reply_sent: true, status: "First Reply Sent" }, "First reply marked as sent.")}>Mark first reply sent</button>
                  <button className="secondary" onClick={() => persistUpdate(selected.id, { applicant_replied: true, status: "Applicant Replied" }, "Applicant reply tracked.")}>Log applicant reply</button>
                  <button className="danger" onClick={() => deleteApplication(selected.id)}>Delete</button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-2xl font-semibold">Standard replies</h2>
              <div className="mt-4 grid gap-4">
                <select className="field" value={selectedTemplate} onChange={(event) => chooseTemplate(event.target.value)}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <input className="field" value={selected.last_email_subject} placeholder="Reply subject" onChange={(event) => persistUpdate(selected.id, { last_email_subject: event.target.value }, "Reply subject saved.")} />
                <textarea className="field min-h-40" value={selected.last_email_body} placeholder="Reply body" onChange={(event) => persistUpdate(selected.id, { last_email_body: event.target.value }, "Reply body saved.")} />
                <button className="primary" onClick={sendTemplate}>Record sent email and update status</button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
