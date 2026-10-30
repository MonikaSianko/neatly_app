-- Indeksy na kluczach obcych, wskazane przez advisor wydajnosci Supabase.
--
-- Zastosowane bezposrednio na produkcji; ten plik zapisuje je w repo, zeby historia
-- migracji odwzorowywala baze. Istniejace indeksy zlozone zaczynaly sie od household_id,
-- wiec zadnego z ponizszych kluczy nie pokrywaly — Postgres uzywa indeksu tylko wtedy,
-- gdy szukana kolumna jest w nim pierwsza.

create index if not exists category_budgets_category_id_idx on public.category_budgets (category_id);
create index if not exists household_invites_accepted_by_idx on public.household_invites (accepted_by);
create index if not exists household_invites_created_by_idx on public.household_invites (created_by);
create index if not exists profiles_active_household_id_idx on public.profiles (active_household_id);
create index if not exists recurring_rules_category_id_idx on public.recurring_rules (category_id);
create index if not exists recurring_rules_wallet_id_idx on public.recurring_rules (wallet_id);
create index if not exists transactions_category_id_idx on public.transactions (category_id);

-- Pokrywa FK transactions.wallet_id i obsluguje domyslna date nowego wpisu:
-- szybkie pobranie daty ostatniej oplaconej pozycji w portfelu (app/page.tsx).
create index if not exists transactions_wallet_id_date_idx on public.transactions (wallet_id, date desc);
