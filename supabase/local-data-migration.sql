-- Run in Supabase SQL Editor after schema.sql and security-hardening.sql.
-- Idempotent client IDs make local-to-cloud imports safe to retry.
alter table public.transactions add column if not exists client_id text;
alter table public.accounts add column if not exists client_id text;
alter table public.goals add column if not exists client_id text;

create unique index if not exists transactions_user_client_id_uidx
  on public.transactions(user_id, client_id);
create unique index if not exists accounts_user_client_id_uidx
  on public.accounts(user_id, client_id);
create unique index if not exists goals_user_client_id_uidx
  on public.goals(user_id, client_id);

-- Keep access limited to authenticated users; existing RLS policies remain in force.
grant select, insert, update, delete on public.transactions, public.accounts, public.goals to authenticated;
