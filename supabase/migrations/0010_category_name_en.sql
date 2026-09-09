-- Nazwa kategorii po angielsku jako osobna kolumna.
-- Wczesniej angielski byl podmieniany w kodzie po polskiej nazwie, wiec zmiana nazwy po polsku
-- gubila tlumaczenie. Teraz kazdy jezyk ma wlasna nazwe i edytuje sie tylko ten aktywny.

alter table categories add column name_en text;

-- Kategorie startowe dostaja tlumaczenia, ktore do tej pory zylo w slowniku CAT_EN.
update categories c set name_en = t.en
from (values
  ('Zakupy spożywcze', 'Groceries'),
  ('Jedzenie na mieście', 'Eating out'),
  ('Dom', 'House'),
  ('Rachunki', 'Utilities'),
  ('Samochód', 'Car'),
  ('Transport', 'Transport'),
  ('Subskrypcje', 'Subscriptions'),
  ('Prezenty i darowizny', 'Gifts & donations'),
  ('Rozrywka', 'Entertainment'),
  ('Zdrowie', 'Health'),
  ('Higiena i uroda', 'Personal care'),
  ('Zwierzęta', 'Pets'),
  ('Dziecko', 'Kids'),
  ('Edukacja', 'Education'),
  ('Sport', 'Sports'),
  ('Kredyt / raty', 'Loans'),
  ('Oszczędności', 'Savings'),
  ('Inne', 'Other'),
  ('Wynagrodzenie', 'Salary'),
  ('Premia', 'Bonus'),
  ('Zwrot', 'Refund'),
  ('Odsetki', 'Interest'),
  ('Prezent', 'Gift'),
  ('Sprzedaż', 'Sale')
) as t(pl, en)
where c.name = t.pl and c.name_en is null;

-- Seed nowych gospodarstw od razu z obiema nazwami.
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

  insert into public.categories (household_id, name, name_en, emoji, color, kind, position) values
    (new_household_id, 'Zakupy spożywcze', 'Groceries', '🛒', '#36A467', 'expense', 0),
    (new_household_id, 'Jedzenie na mieście', 'Eating out', '🍔', '#C9732F', 'expense', 1),
    (new_household_id, 'Dom', 'House', '🏠', '#BF7B0F', 'expense', 2),
    (new_household_id, 'Rachunki', 'Utilities', '💡', '#AE8600', 'expense', 3),
    (new_household_id, 'Samochód', 'Car', '🚗', '#4390DA', 'expense', 4),
    (new_household_id, 'Transport', 'Transport', '🚌', '#0099CF', 'expense', 5),
    (new_household_id, 'Subskrypcje', 'Subscriptions', '📺', '#9977D1', 'expense', 6),
    (new_household_id, 'Prezenty i darowizny', 'Gifts & donations', '🎁', '#D06676', 'expense', 7),
    (new_household_id, 'Rozrywka', 'Entertainment', '🎉', '#B96CB3', 'expense', 8),
    (new_household_id, 'Zdrowie', 'Health', '💊', '#00A68C', 'expense', 9),
    (new_household_id, 'Higiena i uroda', 'Personal care', '💄', '#C6679A', 'expense', 10),
    (new_household_id, 'Zwierzęta', 'Pets', '🐾', '#CF6D45', 'expense', 11),
    (new_household_id, 'Dziecko', 'Kids', '👶', '#009EC4', 'expense', 12),
    (new_household_id, 'Edukacja', 'Education', '📚', '#6389DE', 'expense', 13),
    (new_household_id, 'Sport', 'Sports', '⚽', '#58A051', 'expense', 14),
    (new_household_id, 'Kredyt / raty', 'Loans', '💳', '#D16766', 'expense', 15),
    (new_household_id, 'Oszczędności', 'Savings', '🐖', '#00A577', 'expense', 16),
    (new_household_id, 'Inne', 'Other', '📦', '#867EDA', 'expense', 17),
    (new_household_id, 'Wynagrodzenie', 'Salary', '💼', '#36A467', 'income', 0),
    (new_household_id, 'Premia', 'Bonus', '🌟', '#AA8800', 'income', 1),
    (new_household_id, 'Zwrot', 'Refund', '↩️', '#00A3AC', 'income', 2),
    (new_household_id, 'Odsetki', 'Interest', '📈', '#00A683', 'income', 3),
    (new_household_id, 'Prezent', 'Gift', '🎁', '#B06FBF', 'income', 4),
    (new_household_id, 'Sprzedaż', 'Sale', '🏷️', '#749B38', 'income', 5),
    (new_household_id, 'Inne', 'Other', '📦', '#867EDA', 'income', 6);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
