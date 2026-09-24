-- Rata usunieta z serii musi zostawic slad, inaczej wraca.
--
-- Materializacja dolicza brakujace wystapienia reguly przy kazdym otwarciu miesiaca i poznaje
-- je wylacznie po tym, ze na dany dzien nie ma wiersza. Usuniecie pojedynczej raty kasowalo
-- wiersz i nic wiecej, wiec najblizszy render tworzyl ja od nowa — to samo przy przeniesieniu
-- raty na inny dzien, bo zwolniony termin wygladal jak nigdy niezmaterializowany.
--
-- Osobna tabela zamiast tablicy dat w regule: wstawienie jest atomowe (unique + on conflict),
-- wiec dwie osoby kasujace rozne raty tej samej serii nie nadpisuja sobie nawzajem listy.

create table recurring_skips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  rule_id uuid not null references recurring_rules on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (rule_id, date)
);

create index recurring_skips_household_rule_idx on recurring_skips (household_id, rule_id);

alter table recurring_skips enable row level security;

create policy "select own household recurring_skips"
on recurring_skips for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household recurring_skips"
on recurring_skips for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "delete own household recurring_skips"
on recurring_skips for delete
to authenticated
using (household_id in (select public.user_households()));
