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
  select * into candidate
  from public.import_candidates
  where id = p_candidate_id and user_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Import candidate is unavailable'; end if;

  select * into target_tracker
  from public.trackers
  where id = p_tracker_id and user_id = auth.uid() and archived_at is null;
  if not found then raise exception 'Destination tracker is unavailable'; end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_category_id
      and collection_id = target_tracker.collection_id
      and kind = candidate.kind
  ) then
    raise exception 'Category does not match this transaction';
  end if;

  insert into public.transactions (
    tracker_id, category_id, recurring_id, amount, kind, date, merchant, notes,
    receipt_path, import_candidate_id, source_provider, source_transaction_id, source_account_id
  ) values (
    target_tracker.id, p_category_id, null, candidate.amount, candidate.kind, candidate.date,
    candidate.merchant, case when candidate.pending then 'Imported while pending' else '' end,
    null, candidate.id, candidate.provider, candidate.external_id, candidate.account_id
  )
  on conflict do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.transactions where import_candidate_id = candidate.id;
  end if;

  update public.import_candidates
  set status = 'imported', imported_transaction_id = result.id, updated_at = now()
  where id = candidate.id;
  return result;
end;
$$;

grant execute on function public.commit_import_candidate(uuid, uuid, uuid) to authenticated;
