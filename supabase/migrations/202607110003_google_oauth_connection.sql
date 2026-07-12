create table if not exists public.google_oauth_connections (
  id uuid primary key,
  provider text not null default 'google' check (provider = 'google'),
  provider_account_email text not null,
  scopes text[] not null default '{}'::text[],
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_google_oauth_connection check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

alter table public.google_oauth_connections enable row level security;

revoke all on table public.google_oauth_connections from anon;
revoke all on table public.google_oauth_connections from authenticated;

-- No browser-readable policies: this table is service-role only from server routes/helpers.
drop policy if exists "No client access to Google OAuth connections" on public.google_oauth_connections;
create policy "No client access to Google OAuth connections" on public.google_oauth_connections
for all using (false) with check (false);

drop trigger if exists set_google_oauth_connections_updated_at on public.google_oauth_connections;
create trigger set_google_oauth_connections_updated_at
before update on public.google_oauth_connections
for each row execute function public.set_updated_at();

update public.admin_settings
set setting_value = jsonb_set(setting_value, '{oauth_connected}', 'false'::jsonb, true),
    updated_at = now()
where setting_key = 'recruitment_mailbox';
