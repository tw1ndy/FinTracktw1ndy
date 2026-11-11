-- Run this whole file in Supabase → SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  name text not null,
  balance numeric(18,2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  title text not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  tx_date date not null default current_date,
  account_name text not null default 'Основной счёт',
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount_limit numeric(18,2) not null check (amount_limit > 0),
  currency text not null,
  created_at timestamptz not null default now(),
  unique(user_id, category, currency)
);
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  title text not null,
  target numeric(18,2) not null check (target > 0),
  saved numeric(18,2) not null default 0 check (saved >= 0),
  currency text not null,
  deadline date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

drop policy if exists "profile own row" on public.profiles;
create policy "profile own row" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "accounts own rows" on public.accounts;
create policy "accounts own rows" on public.accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "transactions own rows" on public.transactions;
create policy "transactions own rows" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budgets own rows" on public.budgets;
create policy "budgets own rows" on public.budgets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goals own rows" on public.goals;
create policy "goals own rows" on public.goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, tx_date desc);
create index if not exists accounts_user_idx on public.accounts(user_id);
