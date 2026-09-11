-- Poprawka do 0012: reguly cykliczne maja wlasne sprawdzenie kategorii.
--
-- recurring_rules dzielilo trigger z transactions, a ten po dodaniu zwrotow siega do
-- new.is_refund — kolumny, ktorej reguly nie maja. Zapis reguly konczyl sie wtedy bledem
-- "record new has no field is_refund". Reguly nie bywaja zwrotami (zwrot dotyczy jednej
-- platnosci), wiec zamiast rozgalezienia po TG_TABLE_NAME dostaja wlasna, prostsza funkcje.

create or replace function public.check_recurring_rule_category_kind()
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
    raise exception 'recurring rule kind (%) does not match category kind (%)', new.kind, cat_kind;
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_rules_kind_matches_category on recurring_rules;

create trigger recurring_rules_kind_matches_category
before insert or update on recurring_rules
for each row execute function public.check_recurring_rule_category_kind();
