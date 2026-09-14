alter table public.categories
  add column if not exists budget numeric(12, 2) check (budget >= 0);
