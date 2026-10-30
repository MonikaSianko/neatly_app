-- auth.uid() w politykach RLS opakowane w (select ...), wskazane przez advisor wydajnosci.
--
-- Bez tego Postgres wola auth.uid() dla kazdego sprawdzanego wiersza; w podzapytaniu
-- liczy je raz na zapytanie (initplan). Logika dostepu jest nietknieta — zmienia sie
-- wylacznie to, ile razy funkcja sie wykonuje.
--
-- Zastosowane bezposrednio na produkcji; ten plik zapisuje zmiane w repo, zeby historia
-- migracji odwzorowywala baze.

drop policy "members can create invites" on public.household_invites;
create policy "members can create invites" on public.household_invites
  for insert to authenticated
  with check (
    household_id in (select public.user_households())
    and created_by = (select auth.uid())
  );

drop policy "select own or household co-member profiles" on public.profiles;
create policy "select own or household co-member profiles" on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (
      select hm.user_id from public.household_members hm
      where hm.household_id in (select public.user_households())
    )
  );

drop policy "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
