create extension if not exists pgcrypto;

create table if not exists public.provisioning_sessions (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  status text not null default 'connecting',
  github_oauth_state text,
  github_token_encrypted text,
  github_connected_at timestamptz,
  github_login text,
  repository_full_name text,
  supabase_oauth_state text,
  supabase_pkce_verifier_encrypted text,
  supabase_token_encrypted text,
  supabase_refresh_token_encrypted text,
  supabase_connected_at timestamptz,
  supabase_project_ref text,
  vercel_oauth_state text,
  vercel_token_encrypted text,
  vercel_team_id text,
  vercel_connected_at timestamptz,
  vercel_project_id text,
  deployment_url text,
  supabase_publishable_key text,
  mobile_handoff_hash text,
  mobile_handoff_secret_encrypted text,
  mobile_claim_hash text,
  error_message text,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This is the control-plane directory. It intentionally contains no financial
-- data, Plaid credentials, or provider OAuth tokens.
create table if not exists public.private_apps (
  directory_user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  deployment_url text not null,
  supabase_project_ref text not null,
  supabase_publishable_key text not null,
  vercel_project_id text,
  repository_full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists private_apps_email_idx on public.private_apps (lower(email));
alter table public.private_apps add column if not exists supabase_publishable_key text;
alter table public.private_apps enable row level security;
-- There is intentionally no browser policy. The installer server verifies a
-- directory session before reading or writing this table with its service key.

alter table public.provisioning_sessions
  add column if not exists supabase_publishable_key text,
  add column if not exists directory_user_id uuid,
  add column if not exists directory_email text,
  add column if not exists mobile_handoff_hash text,
  add column if not exists mobile_handoff_secret_encrypted text,
  add column if not exists mobile_claim_hash text;

create unique index if not exists provisioning_sessions_github_state_idx on public.provisioning_sessions (github_oauth_state) where github_oauth_state is not null;
create unique index if not exists provisioning_sessions_supabase_state_idx on public.provisioning_sessions (supabase_oauth_state) where supabase_oauth_state is not null;
create unique index if not exists provisioning_sessions_vercel_state_idx on public.provisioning_sessions (vercel_oauth_state) where vercel_oauth_state is not null;
create index if not exists provisioning_sessions_expires_idx on public.provisioning_sessions (expires_at);
create unique index if not exists provisioning_sessions_mobile_handoff_idx on public.provisioning_sessions (mobile_handoff_hash) where mobile_handoff_hash is not null;
create unique index if not exists provisioning_sessions_mobile_claim_idx on public.provisioning_sessions (mobile_claim_hash) where mobile_claim_hash is not null;

alter table public.provisioning_sessions enable row level security;

-- No client policy is intentional. Only server functions use the service-role key.
-- Never expose that key through a VITE_* environment variable.
create or replace function public.delete_expired_provisioning_sessions()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare removed bigint;
begin
  delete from public.provisioning_sessions where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.delete_expired_provisioning_sessions() from public, anon, authenticated;
