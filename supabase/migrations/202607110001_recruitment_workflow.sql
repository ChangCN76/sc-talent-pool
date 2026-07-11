create extension if not exists pgcrypto;

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_name text not null,
  applicant_email text not null,
  position text not null default 'Position Not Clear',
  status text not null default 'New Application',
  subject text not null,
  message text not null default '',
  has_resume boolean not null default false,
  has_portfolio boolean not null default false,
  first_reply_sent boolean not null default false,
  applicant_replied boolean not null default false,
  assigned_to text not null default '',
  review_decision text not null default '',
  internal_comments text not null default '',
  last_email_subject text not null default '',
  last_email_body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at
before update on public.job_applications
for each row execute function public.set_updated_at();

alter table public.job_applications enable row level security;

drop policy if exists "Public demo read job applications" on public.job_applications;
create policy "Public demo read job applications" on public.job_applications for select using (true);

drop policy if exists "Public demo insert job applications" on public.job_applications;
create policy "Public demo insert job applications" on public.job_applications for insert with check (true);

drop policy if exists "Public demo update job applications" on public.job_applications;
create policy "Public demo update job applications" on public.job_applications for update using (true) with check (true);

drop policy if exists "Public demo delete job applications" on public.job_applications;
create policy "Public demo delete job applications" on public.job_applications for delete using (true);

insert into public.job_applications (
  applicant_name, applicant_email, position, status, subject, message,
  has_resume, has_portfolio, first_reply_sent, applicant_replied, assigned_to,
  review_decision, internal_comments, last_email_subject, last_email_body
) values
('Maya Chen', 'maya.chen@example.com', 'Animation', 'Applicant Replied', 'Animator application - Maya Chen', 'I am applying for the animation role and attached my reel.', true, true, true, true, 'Animation Lead', 'Proceed', 'Strong reel; ask team to review timing samples.', 'Thank you for your application', 'Thank you for applying. We have received your application and will review it carefully.'),
('Leo Park', 'leo.park@example.com', 'Position Not Clear', 'New Application', 'Job application', 'Hello, I would like to work with your creative team.', true, false, false, false, '', '', '', '', ''),
('Sofia Rivera', 'sofia.rivera@example.com', 'Design', 'Waiting for Team Review', 'Designer portfolio submission', 'Please find my CV and portfolio for the design opening.', true, true, true, false, 'Design Team', 'Request more information', 'Need availability and salary expectations.', 'Your application is under review', 'Your application has been shared with the relevant team for review.')
on conflict do nothing;
