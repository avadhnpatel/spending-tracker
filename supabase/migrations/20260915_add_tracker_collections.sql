begin;

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

alter table public.trackers add column if not exists collection_id uuid references public.tracker_collections (id) on delete cascade;
alter table public.trackers add column if not exists period_start date;
alter table public.trackers add column if not exists period_end date;

insert into public.tracker_collections (id, user_id, name, note, color, kind, archived_at, created_at)
select id, user_id, name, note, color, 'custom', archived_at, created_at
from public.trackers
where collection_id is null
on conflict (id) do nothing;

update public.trackers set collection_id = id where collection_id is null;
alter table public.trackers alter column collection_id set not null;

alter table public.categories add column if not exists collection_id uuid references public.tracker_collections (id) on delete cascade;
update public.categories c
set collection_id = t.collection_id
from public.trackers t
where c.tracker_id = t.id and c.collection_id is null;
alter table public.categories alter column collection_id set not null;

alter table public.recurring add column if not exists collection_id uuid references public.tracker_collections (id) on delete cascade;
update public.recurring r
set collection_id = t.collection_id
from public.trackers t
where r.tracker_id = t.id and r.collection_id is null;
alter table public.recurring alter column collection_id set not null;

create table if not exists public.category_budgets (
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  primary key (tracker_id, category_id)
);

insert into public.category_budgets (tracker_id, category_id, amount)
select tracker_id, id, budget
from public.categories
where budget is not null
on conflict (tracker_id, category_id) do nothing;

create index if not exists tracker_collections_user_id_idx on public.tracker_collections (user_id);
create index if not exists trackers_collection_id_idx on public.trackers (collection_id);
create index if not exists categories_collection_id_idx on public.categories (collection_id);
create index if not exists recurring_collection_id_idx on public.recurring (collection_id);

alter table public.tracker_collections enable row level security;
alter table public.category_budgets enable row level security;

create policy "tracker_collections_select" on public.tracker_collections
  for select to authenticated using (user_id = auth.uid());
create policy "tracker_collections_insert" on public.tracker_collections
  for insert to authenticated with check (user_id = auth.uid());
create policy "tracker_collections_update" on public.tracker_collections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tracker_collections_delete" on public.tracker_collections
  for delete to authenticated using (user_id = auth.uid());

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

commit;
