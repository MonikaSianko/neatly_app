-- Etap 5: platnosci cykliczne

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  wallet_id uuid not null references wallets on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  title text not null,
  amount_cents int not null check (amount_cents > 0),
  category_id uuid not null references categories,
  freq text not null check (freq in ('day', 'week', 'month', 'year')),
  interval int not null default 1 check (interval >= 1),
  weekdays smallint[],
  start_date date not null,
  until_date date,
  created_at timestamptz not null default now()
);

create index on recurring_rules (household_id, wallet_id);

alter table recurring_rules enable row level security;

create policy "select own household recurring_rules"
on recurring_rules for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household recurring_rules"
on recurring_rules for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household recurring_rules"
on recurring_rules for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));

create policy "delete own household recurring_rules"
on recurring_rules for delete
to authenticated
using (household_id in (select public.user_households()));

create trigger recurring_rules_kind_matches_category
before insert or update on recurring_rules
for each row execute function public.check_transaction_category_kind();

-- teraz recurring_rules istnieje: dolacz FK z transactions
alter table transactions
  add constraint transactions_recurring_rule_id_fkey
  foreign key (recurring_rule_id) references recurring_rules on delete set null;
