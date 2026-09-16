begin;

create table public.financial_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('plaid')),
  provider_item_id text not null,
  access_token text not null,
  institution_name text not null default '',
  cursor text,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  error_code text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_item_id)
);

comment on table public.financial_connections is
  'Server-only financial access tokens. RLS is enabled with no client policies.';

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.financial_connections (id) on delete cascade,
  provider_account_id text not null,
  name text not null,
  mask text,
  type text not null default '',
  subtype text not null default '',
  created_at timestamptz not null default now(),
  unique (connection_id, provider_account_id)
);

create table public.import_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('csv', 'plaid')),
  external_id text not null,
  connection_id uuid references public.financial_connections (id) on delete cascade,
  account_id text,
  account_name text not null default '',
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('expense', 'income')),
  merchant text not null default '',
  category_hint text not null default '',
  pending boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'imported', 'excluded', 'removed')),
  imported_transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

alter table public.transactions add column import_candidate_id uuid references public.import_candidates (id) on delete set null;
alter table public.transactions add column source_provider text;
alter table public.transactions add column source_transaction_id text;
alter table public.transactions add column source_account_id text;

create unique index transactions_import_candidate_id_idx
  on public.transactions (import_candidate_id) where import_candidate_id is not null;
create index financial_connections_user_id_idx on public.financial_connections (user_id);
create index financial_accounts_user_id_idx on public.financial_accounts (user_id);
create index import_candidates_user_status_idx on public.import_candidates (user_id, status, date desc);

alter table public.financial_connections enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.import_candidates enable row level security;

create policy "financial_accounts_select" on public.financial_accounts
  for select to authenticated using (user_id = auth.uid());
create policy "financial_accounts_delete" on public.financial_accounts
  for delete to authenticated using (user_id = auth.uid());

create policy "import_candidates_select" on public.import_candidates
  for select to authenticated using (user_id = auth.uid());
create policy "import_candidates_insert" on public.import_candidates
  for insert to authenticated with check (
    user_id = auth.uid() and provider = 'csv' and connection_id is null
  );
create policy "import_candidates_update" on public.import_candidates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "import_candidates_delete" on public.import_candidates
  for delete to authenticated using (user_id = auth.uid());

commit;
