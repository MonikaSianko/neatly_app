-- Platnosc pobierana automatycznie (polecenie zaplaty / subskrypcja z karty).

alter table transactions add column is_automatic boolean not null default false;
alter table recurring_rules add column is_automatic boolean not null default false;
