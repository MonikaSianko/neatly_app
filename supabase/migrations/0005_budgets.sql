-- Etap 4: budzety wydatkow i stan poczatkowy

create table category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  wallet_id uuid not null references wallets on delete cascade,
  category_id uuid not null references categories on delete cascade,
  month date not null,
  amount_cents int not null check (amount_cents > 0),
  unique (wallet_id, category_id, month)
);

create table month_openings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  wallet_id uuid not null references wallets on delete cascade,
  month date not null,
  amount_cents int not null default 0,
  unique (wallet_id, month)
);

create index on category_budgets (household_id, wallet_id, month);
create index on month_openings (household_id, wallet_id, month);

alter table category_budgets enable row level security;
alter table month_openings enable row level security;

create policy "select own household budgets"
on category_budgets for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household budgets"
on category_budgets for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household budgets"
on category_budgets for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));

create policy "delete own household budgets"
on category_budgets for delete
to authenticated
using (household_id in (select public.user_households()));

create policy "select own household openings"
on month_openings for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household openings"
on month_openings for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household openings"
on month_openings for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));
