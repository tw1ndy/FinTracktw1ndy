-- FinTracktw1ndy security hardening migration.
-- Run after schema.sql in Supabase SQL Editor.
-- The public anon key is not a secret; RLS is the actual data boundary.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

alter table public.profiles force row level security;
alter table public.accounts force row level security;
alter table public.transactions force row level security;
alter table public.budgets force row level security;
alter table public.goals force row level security;

drop policy if exists "profile own row" on public.profiles;
drop policy if exists "accounts own rows" on public.accounts;
drop policy if exists "transactions own rows" on public.transactions;
drop policy if exists "budgets own rows" on public.budgets;
drop policy if exists "goals own rows" on public.goals;

create policy "profile own row" on public.profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "accounts own rows" on public.accounts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions own rows" on public.transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets own rows" on public.budgets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals own rows" on public.goals
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.profiles, public.accounts, public.transactions, public.budgets, public.goals from anon;
grant select, insert, update, delete on table public.profiles, public.accounts, public.transactions, public.budgets, public.goals to authenticated;

grant usage on schema public to authenticated;

create index if not exists transactions_user_date_idx on public.transactions(user_id, tx_date desc);
create index if not exists accounts_user_idx on public.accounts(user_id);
create index if not exists budgets_user_idx on public.budgets(user_id);
create index if not exists goals_user_idx on public.goals(user_id);
