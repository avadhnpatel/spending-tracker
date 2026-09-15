alter table public.recurring
  add column if not exists end_date date;
