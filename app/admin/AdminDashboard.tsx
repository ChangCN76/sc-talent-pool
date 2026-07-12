"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { writeAuditLog } from "@/lib/audit";
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

export default function AdminDashboard() {
  const supabase = createClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<ApplicationInput>(emptyForm);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0].id);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    email: string | null;
    scopes: string[];
    expiresAt: string | null;
    updatedAt: string | null;
  }>({ connected: false, email: null, scopes: [], expiresAt: null, updatedAt: null });
  const [googleLoading, setGoogleLoading] = useState(true);

  const selected = applications.find((application) => application.id === selectedId) ?? applications[0];
  const currentYear = new Date().getFullYear();

  const metrics = useMemo(
    () => ({
      newNotContacted: applications.filter((item) => item.status === "New Application").length,
      prepared: applications.filter((item) => item.last_email_subject && !item.first_reply_sent).length,
      waitingForm: applications.filter((item) => item.status === "Waiting for Applicant Reply").length,
      formSubmitted: applications.filter((item) => item.status === "Applicant Replied").length,
      manualMatch: 0,
      readyReview: applications.filter((item) => item.status === "Waiting for Team Review").length,
      interviewPending: applications.filter((item) => item.status === "Interview").length,
      interviewBooked: 0,
      finalPending: applications.filter((item) => ["Rejected", "Keep for Future"].includes(item.status)).length,
      archived: applications.filter((item) => item.status === "Closed").length,
    }),
    [applications],
  );

  useEffect(() => {
    void loadApplications();
    void loadGoogleStatus();
  }, []);

  async function loadGoogleStatus() {
    setGoogleLoading(true);
    try {
      const response = await fetch("/api/google/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.error || "Could not load Google Workspace status.");
        return;
      }
      setGoogleStatus(data);
    } catch {
      setNotice("Could not load Google Workspace status.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function disconnectGoogleWorkspace() {
    setGoogleLoading(true);
    try {
      const response = await fetch("/api/google/disconnect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.error || "Could not disconnect Google Workspace.");
        return;
      }
      setGoogleStatus({ connected: false, email: null, scopes: [], expiresAt: null, updatedAt: null });
      setNotice("Google Workspace disconnected and stored OAuth tokens removed.");
    } catch {
      setNotice("Could not disconnect Google Workspace.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function loadApplications() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      setNotice(`Could not load protected candidate rows: ${error.message}`);
    } else {
      setApplications((data as Application[]) ?? []);
      setSelectedId(data?.[0]?.id ?? "");
      setNotice("Protected recruitment dashboard synced with Supabase.");
    }
    setLoading(false);
  }

  async function persistUpdate(id: string, patch: Partial<ApplicationInput>, message: string, action = "candidate.updated") {
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

    await writeAuditLog(supabase, action, "job_application", id, { patch });
    setApplications((items) => items.map((item) => (item.id === id ? (data as Application) : item)));
    setNotice(message);
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.applicant_name || !form.applicant_email || !form.subject) {
      setNotice("Applicant name, email, and subject are required for anonymised test records.");
      return;
    }

    const { data, error } = await supabase.from("job_applications").insert(form).select().single();
    if (error) {
      setNotice(error.message);
      return;
    }
    await writeAuditLog(supabase, "candidate.created", "job_application", (data as Application).id, {
      anonymised_test_record: true,
    });
    setApplications((items) => [data as Application, ...items]);
    setSelectedId((data as Application).id);
    setForm(emptyForm);
    setNotice("Anonymised test application saved to the protected database.");
  }

  async function deleteApplication(id: string) {
    const { error } = await supabase.from("job_applications").delete().eq("id", id);
    if (error) {
      setNotice(error.message);
      return;
    }
    await writeAuditLog(supabase, "candidate.deleted", "job_application", id);
    setApplications((items) => items.filter((item) => item.id !== id));
    setSelectedId("");
    setNotice("Candidate record deleted and audit event recorded.");
  }

  function chooseTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    const template = templates.find((item) => item.id === templateId)!;
    void persistUpdate(
      selected.id,
      { last_email_subject: template.subject, last_email_body: template.body },
      `Prepared ${template.name} for administrator review. Email is not sent automatically.`,
      "email_template.prepared",
    );
  }

  async function approvePreparedEmail() {
    const template = templates.find((item) => item.id === selectedTemplate)!;
    const nextStatus = statusForTemplate(template.id);
    await persistUpdate(
      selected.id,
      {
        status: nextStatus,
        first_reply_sent: selected.first_reply_sent || template.id === "acknowledgement",
        last_email_subject: selected.last_email_subject || template.subject,
        last_email_body: selected.last_email_body || template.body,
      },
      `Administrator approved the prepared ${template.name} record. Gmail sending waits for OAuth authorization.`,
      "email_template.approved_pending_google_oauth",
    );
  }

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8">
      <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Protected recruitment control room</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Studio Climb candidate workflow</h1>
            <p className="mt-4 max-w-3xl text-slate-300">
              Admin-only candidate records. Gmail OAuth is not connected yet, so use anonymised test records only until Google authorization is completed.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
            Current Gmail labels will be generated as {currentYear} Talent, {currentYear} Talent Sent, and {currentYear} Talent Archived after OAuth setup.
          </div>
        </div>
      </header>

      {notice && <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">{notice}</div>}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Admin-only setup</p>
            <h2 className="mt-2 text-2xl font-semibold">Google Workspace Connection</h2>
            <p className="mt-2 text-sm text-slate-400">
              OAuth tokens are exchanged, encrypted, refreshed, and revoked only by server routes. Gmail, Calendar, and Sheets automation is not enabled in this sprint.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className={`rounded-full px-3 py-1 ${googleStatus.connected ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>
                {googleLoading ? "Checking..." : googleStatus.connected ? "Connected" : "Disconnected"}
              </span>
              {googleStatus.email && <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{googleStatus.email}</span>}
              {googleStatus.expiresAt && <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">Access expires {new Date(googleStatus.expiresAt).toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="secondary" onClick={loadGoogleStatus} disabled={googleLoading}>Refresh status</button>
            {googleStatus.connected ? (
              <button className="danger" onClick={disconnectGoogleWorkspace} disabled={googleLoading}>Disconnect Google Workspace</button>
            ) : (
              <a className="primary text-center" href="/api/google/connect">Connect Google Workspace</a>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["New not contacted", metrics.newNotContacted],
          ["First email prepared", metrics.prepared],
          ["Waiting for form", metrics.waitingForm],
          ["Form submitted", metrics.formSubmitted],
          ["Manual match", metrics.manualMatch],
          ["Ready for review", metrics.readyReview],
          ["Interview pending", metrics.interviewPending],
          ["Interview booked", metrics.interviewBooked],
          ["Final pending", metrics.finalPending],
          ["Archived", metrics.archived],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={createApplication} className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-semibold">Create anonymised test record</h2>
          <p className="mt-2 text-sm text-slate-400">Real applicant import is blocked until Google OAuth and RLS verification are complete.</p>
          <div className="mt-5 grid gap-4">
            <input className="field" placeholder="Test candidate name" value={form.applicant_name} onChange={(event) => setForm({ ...form, applicant_name: event.target.value })} />
            <input className="field" placeholder="test.candidate@example.com" type="email" value={form.applicant_email} onChange={(event) => setForm({ ...form, applicant_email: event.target.value })} />
            <select className="field" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })}>
              {positions.map((position) => <option key={position}>{position}</option>)}
            </select>
            <input className="field" placeholder="Anonymised email subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            <textarea className="field min-h-28" placeholder="Anonymised email body" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="check"><input type="checkbox" checked={form.has_resume} onChange={(event) => setForm({ ...form, has_resume: event.target.checked })} /> Résumé referenced</label>
              <label className="check"><input type="checkbox" checked={form.has_portfolio} onChange={(event) => setForm({ ...form, has_portfolio: event.target.checked })} /> Portfolio referenced</label>
            </div>
            <button className="primary" type="submit">Save protected test record</button>
          </div>
        </form>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Protected candidate queue</h2>
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
            {!applications.length && <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-slate-400">No protected candidate records are visible to this admin yet.</p>}
          </div>
        </div>
      </section>

      {selected && (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-semibold">Review selected candidate</h2>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl bg-slate-900/70 p-4">
                <p className="text-xl font-semibold">{selected.applicant_name}</p>
                <p className="text-slate-400">{selected.applicant_email}</p>
                <p className="mt-3 text-sm text-slate-300">{selected.message}</p>
              </div>
              <select className="field" value={selected.status} onChange={(event) => persistUpdate(selected.id, { status: event.target.value as RecruitmentStatus }, "Status updated and audited.", "candidate.status_updated")}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <input className="field" placeholder="Assign to team member" value={selected.assigned_to} onChange={(event) => persistUpdate(selected.id, { assigned_to: event.target.value, status: "Waiting for Team Review" }, "Assigned for team review and audited.", "candidate.assigned")}/>
              <select className="field" value={selected.review_decision} onChange={(event) => persistUpdate(selected.id, { review_decision: event.target.value }, "Review decision saved and audited.", "candidate.review_decision") }>
                <option value="">Select review decision</option>
                {decisions.map((decision) => <option key={decision}>{decision}</option>)}
              </select>
              <textarea className="field min-h-24" placeholder="Internal team comments" value={selected.internal_comments} onChange={(event) => persistUpdate(selected.id, { internal_comments: event.target.value }, "Internal comment saved and audited.", "candidate.internal_comment")}/>
              <div className="grid gap-3 md:grid-cols-3">
                <button className="secondary" onClick={() => persistUpdate(selected.id, { first_reply_sent: true, status: "First Reply Sent" }, "First reply state updated. Gmail send still requires OAuth.", "candidate.first_reply_marked")}>Mark first reply reviewed</button>
                <button className="secondary" onClick={() => persistUpdate(selected.id, { applicant_replied: true, status: "Applicant Replied" }, "Applicant reply tracked and audited.", "candidate.reply_logged")}>Log applicant reply</button>
                <button className="danger" onClick={() => deleteApplication(selected.id)}>Delete</button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-2xl font-semibold">Prepared email approval</h2>
            <p className="mt-2 text-sm text-slate-400">No email is sent automatically. Gmail sending will be enabled only after Google OAuth authorization.</p>
            <div className="mt-4 grid gap-4">
              <select className="field" value={selectedTemplate} onChange={(event) => chooseTemplate(event.target.value)}>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <input className="field" value={selected.last_email_subject} placeholder="Reply subject" onChange={(event) => persistUpdate(selected.id, { last_email_subject: event.target.value }, "Reply subject saved and audited.", "email.subject_updated")}/>
              <textarea className="field min-h-40" value={selected.last_email_body} placeholder="Reply body" onChange={(event) => persistUpdate(selected.id, { last_email_body: event.target.value }, "Reply body saved and audited.", "email.body_updated")}/>
              <button className="primary" onClick={approvePreparedEmail}>Approve prepared email record</button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
