-- Zwrot: przychod przypisany do konkretnego wydatku, ktory ten wydatek pomniejsza.
--
-- Ksiegowany jest w kategorii zwracanej platnosci (a nie w kategorii przychodowej),
-- bo to jedyny sposob, zeby budzet kategorii pokazal roznice miedzy wydatkiem a zwrotem:
-- Ramenownia 234,00 + zwrot Asi 147,00 to 87,00 wydane na Jedzenie na miescie.
--
-- Stad dwie kolumny zamiast jednej: is_refund mowi, czym wiersz jest (i przetrwa skasowanie
-- platnosci), refund_of_id mowi, do czego sie odnosi. Gdyby zwrot zalezal wylacznie od linku,
-- usuniecie platnosci zostawialoby przychod w kategorii wydatkowej — wiersz, ktorego trigger
-- ponizej nie umialby juz zapisac.

alter table transactions
  add column is_refund boolean not null default false,
  add column refund_of_id uuid references transactions (id) on delete set null;

alter table transactions
  add constraint transactions_refund_is_income check (not is_refund or kind = 'income'),
  add constraint transactions_refund_link_needs_flag check (refund_of_id is null or is_refund);

create index transactions_refund_of_id_idx
  on transactions (refund_of_id)
  where refund_of_id is not null;

-- kind transakcji musi zgadzac sie z kind jej kategorii — z wyjatkiem zwrotu,
-- ktory jako jedyny jest przychodem w kategorii wydatkowej.
create or replace function public.check_transaction_category_kind()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cat_kind text;
  target record;
begin
  select kind into cat_kind from categories where id = new.category_id;
  if cat_kind is null then
    raise exception 'category not found';
  end if;

  if new.is_refund then
    if cat_kind <> 'expense' then
      raise exception 'refund belongs in an expense category (got %)', cat_kind;
    end if;
  elsif cat_kind <> new.kind then
    raise exception 'transaction kind (%) does not match category kind (%)', new.kind, cat_kind;
  end if;

  if new.refund_of_id is not null then
    if new.refund_of_id = new.id then
      raise exception 'refund cannot point at itself';
    end if;

    select kind, is_refund, household_id, wallet_id
      into target
      from transactions
     where id = new.refund_of_id;

    if not found then
      raise exception 'refunded payment not found';
    end if;
    if target.kind <> 'expense' or target.is_refund then
      raise exception 'a refund can only point at an expense';
    end if;
    if target.household_id <> new.household_id or target.wallet_id <> new.wallet_id then
      raise exception 'refund must stay in the same wallet as the payment it returns';
    end if;
  end if;

  return new;
end;
$$;

-- Zwrot ma siedziec w tej samej kategorii co platnosc, wiec zmiana kategorii platnosci
-- przestawia tez jej zwroty — inaczej roznica rozjechalaby sie po dwoch kategoriach.
create or replace function public.sync_refund_categories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update transactions
     set category_id = new.category_id
   where refund_of_id = new.id
     and category_id <> new.category_id;
  return null;
end;
$$;

create trigger transactions_sync_refund_categories
after update of category_id on transactions
for each row
when (old.category_id is distinct from new.category_id)
execute function public.sync_refund_categories();
