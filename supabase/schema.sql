-- Run this in the Supabase SQL editor (once per project).

create table if not exists public.tracker_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  note text not null default '',
  color text not null default '#0f766e',
  kind text not null default 'custom' check (kind in ('monthly', 'custom')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid not null references public.tracker_collections (id) on delete cascade,
  name text not null,
  note text not null default '',
  color text not null default '#0f766e',
  period_start date,
  period_end date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  collection_id uuid not null references public.tracker_collections (id) on delete cascade,
  name text not null,
  color text not null,
  kind text not null check (kind in ('expense', 'income')),
  budget numeric(12, 2) check (budget >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories
  add column if not exists budget numeric(12, 2) check (budget >= 0);

create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  collection_id uuid not null references public.tracker_collections (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('expense', 'income')),
  merchant text not null default '',
  cadence text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recurring
  add column if not exists end_date date;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  recurring_id uuid references public.recurring (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('expense', 'income')),
  date date not null,
  merchant text not null default '',
  notes text not null default '',
  receipt_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.category_budgets (
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  primary key (tracker_id, category_id)
);

create table if not exists public.financial_connections (
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

create table if not exists public.financial_accounts (
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

create table if not exists public.import_candidates (
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

alter table public.transactions add column if not exists import_candidate_id uuid references public.import_candidates (id) on delete set null;
alter table public.transactions add column if not exists source_provider text;
alter table public.transactions add column if not exists source_transaction_id text;
alter table public.transactions add column if not exists source_account_id text;

create index if not exists tracker_collections_user_id_idx on public.tracker_collections (user_id);
create index if not exists trackers_user_id_idx on public.trackers (user_id);
create index if not exists trackers_collection_id_idx on public.trackers (collection_id);
create index if not exists categories_tracker_id_idx on public.categories (tracker_id);
create index if not exists categories_collection_id_idx on public.categories (collection_id);
create index if not exists recurring_tracker_id_idx on public.recurring (tracker_id);
create index if not exists recurring_collection_id_idx on public.recurring (collection_id);
create index if not exists transactions_tracker_id_date_idx on public.transactions (tracker_id, date desc);
create unique index if not exists transactions_import_candidate_id_idx on public.transactions (import_candidate_id) where import_candidate_id is not null;
create index if not exists financial_connections_user_id_idx on public.financial_connections (user_id);
create index if not exists financial_accounts_user_id_idx on public.financial_accounts (user_id);
create index if not exists import_candidates_user_status_idx on public.import_candidates (user_id, status, date desc);

alter table public.tracker_collections enable row level security;
alter table public.trackers enable row level security;
alter table public.categories enable row level security;
alter table public.recurring enable row level security;
alter table public.transactions enable row level security;
alter table public.category_budgets enable row level security;
alter table public.financial_connections enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.import_candidates enable row level security;

create policy "tracker_collections_select" on public.tracker_collections
  for select to authenticated using (user_id = auth.uid());
create policy "tracker_collections_insert" on public.tracker_collections
  for insert to authenticated with check (user_id = auth.uid());
create policy "tracker_collections_update" on public.tracker_collections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tracker_collections_delete" on public.tracker_collections
  for delete to authenticated using (user_id = auth.uid());

create policy "trackers_select" on public.trackers
  for select to authenticated using (user_id = auth.uid());
create policy "trackers_insert" on public.trackers
  for insert to authenticated with check (user_id = auth.uid());
create policy "trackers_update" on public.trackers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trackers_delete" on public.trackers
  for delete to authenticated using (user_id = auth.uid());

create policy "categories_select" on public.categories
  for select to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "categories_insert" on public.categories
  for insert to authenticated with check (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "categories_update" on public.categories
  for update to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "categories_delete" on public.categories
  for delete to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );

create policy "recurring_select" on public.recurring
  for select to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "recurring_insert" on public.recurring
  for insert to authenticated with check (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "recurring_update" on public.recurring
  for update to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "recurring_delete" on public.recurring
  for delete to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );

create policy "transactions_select" on public.transactions
  for select to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "transactions_insert" on public.transactions
  for insert to authenticated with check (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "transactions_update" on public.transactions
  for update to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "transactions_delete" on public.transactions
  for delete to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );

create policy "category_budgets_select" on public.category_budgets
  for select to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "category_budgets_insert" on public.category_budgets
  for insert to authenticated with check (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "category_budgets_update" on public.category_budgets
  for update to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );
create policy "category_budgets_delete" on public.category_budgets
  for delete to authenticated using (
    exists (select 1 from public.trackers t where t.id = tracker_id and t.user_id = auth.uid())
  );

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

create or replace function public.commit_import_candidate(
  p_candidate_id uuid,
  p_tracker_id uuid,
  p_category_id uuid default null
)
returns public.transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate public.import_candidates;
  target_tracker public.trackers;
  result public.transactions;
begin
  select * into candidate from public.import_candidates
  where id = p_candidate_id and user_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Import candidate is unavailable'; end if;
  select * into target_tracker from public.trackers
  where id = p_tracker_id and user_id = auth.uid() and archived_at is null;
  if not found then raise exception 'Destination tracker is unavailable'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id
      and collection_id = target_tracker.collection_id and kind = candidate.kind
  ) then raise exception 'Category does not match this transaction'; end if;
  insert into public.transactions (
    tracker_id, category_id, recurring_id, amount, kind, date, merchant, notes,
    receipt_path, import_candidate_id, source_provider, source_transaction_id, source_account_id
  ) values (
    target_tracker.id, p_category_id, null, candidate.amount, candidate.kind, candidate.date,
    candidate.merchant, case when candidate.pending then 'Imported while pending' else '' end,
    null, candidate.id, candidate.provider, candidate.external_id, candidate.account_id
  ) on conflict do nothing returning * into result;
  if result.id is null then select * into result from public.transactions where import_candidate_id = candidate.id; end if;
  update public.import_candidates set status = 'imported', imported_transaction_id = result.id, updated_at = now() where id = candidate.id;
  return result;
end;
$$;

grant execute on function public.commit_import_candidate(uuid, uuid, uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "receipts_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
