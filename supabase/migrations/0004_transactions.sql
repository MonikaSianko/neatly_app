-- Etap 3: transakcje jednorazowe

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  wallet_id uuid not null references wallets on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  title text not null,
  amount_cents int not null check (amount_cents > 0),
  category_id uuid not null references categories,
  date date not null,
  is_paid boolean not null default false,
  paid_at timestamptz,
  -- FK do recurring_rules dodana w migracji etapu 5, gdy ta tabela powstanie.
  recurring_rule_id uuid,
  is_exception boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on transactions (household_id, wallet_id, date);
create unique index transactions_recurring_rule_date_key
  on transactions (recurring_rule_id, date) where recurring_rule_id is not null;

alter table transactions enable row level security;

create policy "select own household transactions"
on transactions for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household transactions"
on transactions for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household transactions"
on transactions for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));

create policy "delete own household transactions"
on transactions for delete
to authenticated
using (household_id in (select public.user_households()));

-- kind transakcji musi zgadzac sie z kind jej kategorii
create or replace function public.check_transaction_category_kind()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cat_kind text;
begin
  select kind into cat_kind from categories where id = new.category_id;
  if cat_kind is null then
    raise exception 'category not found';
  end if;
  if cat_kind <> new.kind then
    raise exception 'transaction kind (%) does not match category kind (%)', new.kind, cat_kind;
  end if;
  return new;
end;
$$;

create trigger transactions_kind_matches_category
before insert or update on transactions
for each row execute function public.check_transaction_category_kind();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
before update on transactions
for each row execute function public.set_updated_at();
