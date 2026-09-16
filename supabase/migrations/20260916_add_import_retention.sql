begin;

create table public.import_dedup_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('csv', 'plaid')),
  external_id text not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, provider, external_id)
);

alter table public.import_dedup_keys enable row level security;

insert into public.import_dedup_keys (user_id, provider, external_id, first_seen_at)
select user_id, provider, external_id, created_at
from public.import_candidates
on conflict (user_id, provider, external_id) do nothing;

create or replace function public.record_import_dedup_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.import_dedup_keys (user_id, provider, external_id)
  values (new.user_id, new.provider, new.external_id)
  on conflict (user_id, provider, external_id) do nothing;

  if not found then return null; end if;
  return new;
end;
$$;

create trigger import_candidates_dedup_before_insert
before insert on public.import_candidates
for each row execute function public.record_import_dedup_key();

create or replace function public.get_my_data_footprint()
returns table (
  transaction_count bigint,
  import_candidate_count bigint,
  dedup_key_count bigint,
  estimated_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  return query
  select
    (select count(*) from public.transactions t join public.trackers tr on tr.id = t.tracker_id where tr.user_id = current_user_id),
    (select count(*) from public.import_candidates where user_id = current_user_id),
    (select count(*) from public.import_dedup_keys where user_id = current_user_id),
    (
      (select count(*) from public.transactions t join public.trackers tr on tr.id = t.tracker_id where tr.user_id = current_user_id) * 1100 +
      (select count(*) from public.import_candidates where user_id = current_user_id) * 900 +
      (select count(*) from public.import_dedup_keys where user_id = current_user_id) * 110
    )::bigint;
end;
$$;

create or replace function public.purge_reviewed_import_candidates(p_retention_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_retention_days < 30 or p_retention_days > 3650 then
    raise exception 'Retention must be between 30 days and 10 years';
  end if;

  delete from public.import_candidates
  where user_id = current_user_id
    and status in ('imported', 'excluded', 'removed')
    and updated_at < now() - make_interval(days => p_retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.get_my_data_footprint() to authenticated;
grant execute on function public.purge_reviewed_import_candidates(integer) to authenticated;

commit;
