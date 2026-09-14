-- Run this in the Supabase SQL editor (once per project).

create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  note text not null default '',
  color text not null default '#0f766e',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  name text not null,
  color text not null,
  kind text not null check (kind in ('expense', 'income')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null check (kind in ('expense', 'income')),
  merchant text not null default '',
  cadence text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

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

create index if not exists trackers_user_id_idx on public.trackers (user_id);
create index if not exists categories_tracker_id_idx on public.categories (tracker_id);
create index if not exists recurring_tracker_id_idx on public.recurring (tracker_id);
create index if not exists transactions_tracker_id_date_idx on public.transactions (tracker_id, date desc);

alter table public.trackers enable row level security;
alter table public.categories enable row level security;
alter table public.recurring enable row level security;
alter table public.transactions enable row level security;

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
