create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, display_name)
values ('sc.climbadm@gmail.com', 'Studio Climb Recruitment Admin')
on conflict (email) do update set display_name = excluded.display_name, is_active = true;

create or replace function public.is_recruitment_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users admins
    where lower(admins.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and admins.is_active = true
  );
$$;

create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.admin_settings (setting_key, setting_value)
values
  ('recruitment_mailbox', '{"email":"sc.climbadm@gmail.com","oauth_connected":false}'::jsonb),
  ('interview_location', '{"address":"Block B, Phileo Damansara 2\n46350 Petaling Jaya\nSelangor, Malaysia","unit":"","arrival_instructions":""}'::jsonb),
  ('google_setup_status', '{"gmail_oauth":false,"calendar_oauth":false,"form_sheet_webhook":false}'::jsonb)
on conflict (setting_key) do nothing;

alter table public.admin_users enable row level security;
alter table public.admin_settings enable row level security;
alter table public.audit_log enable row level security;

-- Remove Sprint 0 public demo access before real candidate data or Gmail integration.
drop policy if exists "Public demo read job applications" on public.job_applications;
drop policy if exists "Public demo insert job applications" on public.job_applications;
drop policy if exists "Public demo update job applications" on public.job_applications;
drop policy if exists "Public demo delete job applications" on public.job_applications;

drop policy if exists "Admins read job applications" on public.job_applications;
create policy "Admins read job applications" on public.job_applications
for select using (public.is_recruitment_admin());

drop policy if exists "Admins insert job applications" on public.job_applications;
create policy "Admins insert job applications" on public.job_applications
for insert with check (public.is_recruitment_admin());

drop policy if exists "Admins update job applications" on public.job_applications;
create policy "Admins update job applications" on public.job_applications
for update using (public.is_recruitment_admin()) with check (public.is_recruitment_admin());

drop policy if exists "Admins delete job applications" on public.job_applications;
create policy "Admins delete job applications" on public.job_applications
for delete using (public.is_recruitment_admin());

drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users" on public.admin_users
for select using (public.is_recruitment_admin());

drop policy if exists "Admins read settings" on public.admin_settings;
create policy "Admins read settings" on public.admin_settings
for select using (public.is_recruitment_admin());

drop policy if exists "Admins update settings" on public.admin_settings;
create policy "Admins update settings" on public.admin_settings
for update using (public.is_recruitment_admin()) with check (public.is_recruitment_admin());

drop policy if exists "Admins insert audit log" on public.audit_log;
create policy "Admins insert audit log" on public.audit_log
for insert with check (public.is_recruitment_admin());

drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log
for select using (public.is_recruitment_admin());
