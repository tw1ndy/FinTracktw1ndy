-- Migrate existing installations from account_name to a stable account_id.
-- Run once in Supabase SQL Editor before deploying code that requires account_id.
begin;

alter table public.accounts
  add constraint accounts_id_user_id_key unique (id, user_id);

alter table public.transactions add column account_id uuid;

-- Backfill only when exactly one account belongs to this user with the legacy name.
update public.transactions t
set account_id = a.id
from public.accounts a
where a.user_id = t.user_id
  and a.name = t.account_name
  and (
    select count(*)
    from public.accounts a2
    where a2.user_id = t.user_id and a2.name = t.account_name
  ) = 1;

do $$
declare unresolved_count bigint;
begin
  select count(*) into unresolved_count
  from public.transactions
  where account_id is null;
  if unresolved_count > 0 then
    raise exception 'Migration stopped: % transactions have no unique matching account. Resolve unmatched/ambiguous account_name values, then rerun.', unresolved_count;
  end if;
end $$;

alter table public.transactions alter column account_id set not null;
alter table public.transactions
  add constraint transactions_account_id_user_id_fkey
  foreign key (account_id, user_id)
  references public.accounts(id, user_id)
  on delete restrict;

create index if not exists transactions_account_user_idx
  on public.transactions(account_id, user_id);

alter table public.transactions drop column account_name;

commit;
