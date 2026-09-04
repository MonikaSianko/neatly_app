-- Etap 2: portfele i kategorie

create table wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  emoji text,
  position int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  emoji text not null,
  color text not null,
  kind text not null check (kind in ('income', 'expense')),
  position int not null default 0,
  is_archived boolean not null default false
);

create index on wallets (household_id);
create index on categories (household_id);

alter table wallets enable row level security;
alter table categories enable row level security;

create policy "select own household wallets"
on wallets for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household wallets"
on wallets for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household wallets"
on wallets for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));

create policy "select own household categories"
on categories for select
to authenticated
using (household_id in (select public.user_households()));

create policy "insert own household categories"
on categories for insert
to authenticated
with check (household_id in (select public.user_households()));

create policy "update own household categories"
on categories for update
to authenticated
using (household_id in (select public.user_households()))
with check (household_id in (select public.user_households()));

create policy "delete own household categories"
on categories for delete
to authenticated
using (household_id in (select public.user_households()));

-- ============================================================
-- Pierwsze logowanie: dodatkowo portfel "Platnosci miesieczne"
-- i pelen komplet 25 kategorii (kolory ze specyfikacji/prototypu).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.profiles (user_id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.households (name)
  values ('Gospodarstwo domowe')
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  update public.profiles
  set active_household_id = new_household_id
  where user_id = new.id;

  insert into public.wallets (household_id, name, emoji, position)
  values (new_household_id, 'Płatności miesięczne', '💵', 0);

  insert into public.categories (household_id, name, emoji, color, kind, position) values
    (new_household_id, 'Zakupy spożywcze', '🛒', '#36A467', 'expense', 0),
    (new_household_id, 'Jedzenie na mieście', '🍔', '#C9732F', 'expense', 1),
    (new_household_id, 'Dom', '🏠', '#BF7B0F', 'expense', 2),
    (new_household_id, 'Rachunki', '💡', '#AE8600', 'expense', 3),
    (new_household_id, 'Samochód', '🚗', '#4390DA', 'expense', 4),
    (new_household_id, 'Transport', '🚌', '#0099CF', 'expense', 5),
    (new_household_id, 'Subskrypcje', '📺', '#9977D1', 'expense', 6),
    (new_household_id, 'Prezenty i darowizny', '🎁', '#D06676', 'expense', 7),
    (new_household_id, 'Rozrywka', '🎉', '#B96CB3', 'expense', 8),
    (new_household_id, 'Zdrowie', '💊', '#00A68C', 'expense', 9),
    (new_household_id, 'Higiena i uroda', '💄', '#C6679A', 'expense', 10),
    (new_household_id, 'Zwierzęta', '🐾', '#CF6D45', 'expense', 11),
    (new_household_id, 'Dziecko', '👶', '#009EC4', 'expense', 12),
    (new_household_id, 'Edukacja', '📚', '#6389DE', 'expense', 13),
    (new_household_id, 'Sport', '⚽', '#58A051', 'expense', 14),
    (new_household_id, 'Kredyt / raty', '💳', '#D16766', 'expense', 15),
    (new_household_id, 'Oszczędności', '🐖', '#00A577', 'expense', 16),
    (new_household_id, 'Inne', '📦', '#867EDA', 'expense', 17),
    (new_household_id, 'Wynagrodzenie', '💼', '#36A467', 'income', 0),
    (new_household_id, 'Premia', '🌟', '#AA8800', 'income', 1),
    (new_household_id, 'Zwrot', '↩️', '#00A3AC', 'income', 2),
    (new_household_id, 'Odsetki', '📈', '#00A683', 'income', 3),
    (new_household_id, 'Prezent', '🎁', '#B06FBF', 'income', 4),
    (new_household_id, 'Sprzedaż', '🏷️', '#749B38', 'income', 5),
    (new_household_id, 'Inne', '📦', '#867EDA', 'income', 6);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================
-- Backfill: gospodarstwa zalozone przed ta migracja (etap 1) nie maja
-- jeszcze portfela ani kategorii.
-- ============================================================
do $$
declare
  h record;
begin
  for h in select id from households where id not in (select household_id from wallets) loop
    insert into wallets (household_id, name, emoji, position)
    values (h.id, 'Płatności miesięczne', '💵', 0);

    insert into categories (household_id, name, emoji, color, kind, position) values
      (h.id, 'Zakupy spożywcze', '🛒', '#36A467', 'expense', 0),
      (h.id, 'Jedzenie na mieście', '🍔', '#C9732F', 'expense', 1),
      (h.id, 'Dom', '🏠', '#BF7B0F', 'expense', 2),
      (h.id, 'Rachunki', '💡', '#AE8600', 'expense', 3),
      (h.id, 'Samochód', '🚗', '#4390DA', 'expense', 4),
      (h.id, 'Transport', '🚌', '#0099CF', 'expense', 5),
      (h.id, 'Subskrypcje', '📺', '#9977D1', 'expense', 6),
      (h.id, 'Prezenty i darowizny', '🎁', '#D06676', 'expense', 7),
      (h.id, 'Rozrywka', '🎉', '#B96CB3', 'expense', 8),
      (h.id, 'Zdrowie', '💊', '#00A68C', 'expense', 9),
      (h.id, 'Higiena i uroda', '💄', '#C6679A', 'expense', 10),
      (h.id, 'Zwierzęta', '🐾', '#CF6D45', 'expense', 11),
      (h.id, 'Dziecko', '👶', '#009EC4', 'expense', 12),
      (h.id, 'Edukacja', '📚', '#6389DE', 'expense', 13),
      (h.id, 'Sport', '⚽', '#58A051', 'expense', 14),
      (h.id, 'Kredyt / raty', '💳', '#D16766', 'expense', 15),
      (h.id, 'Oszczędności', '🐖', '#00A577', 'expense', 16),
      (h.id, 'Inne', '📦', '#867EDA', 'expense', 17),
      (h.id, 'Wynagrodzenie', '💼', '#36A467', 'income', 0),
      (h.id, 'Premia', '🌟', '#AA8800', 'income', 1),
      (h.id, 'Zwrot', '↩️', '#00A3AC', 'income', 2),
      (h.id, 'Odsetki', '📈', '#00A683', 'income', 3),
      (h.id, 'Prezent', '🎁', '#B06FBF', 'income', 4),
      (h.id, 'Sprzedaż', '🏷️', '#749B38', 'income', 5),
      (h.id, 'Inne', '📦', '#867EDA', 'income', 6);
  end loop;
end;
$$;
