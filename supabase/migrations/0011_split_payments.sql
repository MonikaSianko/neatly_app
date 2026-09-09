-- Platnosc dzielona na kategorie: jedna platnosc w banku, kilka pozycji budzetowych.
--
-- Swiadomie bez wiersza-rodzica z kwota laczna: kwota bankowa to suma czesci, wiec
-- sumowania po kategoriach, budzety i podsumowanie dzialaja bez zmian, a nic nie liczy sie dwa razy.
-- Czesci jednej platnosci lacza sie przez split_group_id i dziela tytul, date oraz status oplacenia.
-- split_label doprecyzowuje pojedyncza czesc ("pieluchy"), tytul zostaje nazwa platnosci ("Rossman").

alter table transactions
  add column split_group_id uuid,
  add column split_label text;

create index transactions_split_group_id_idx
  on transactions (split_group_id)
  where split_group_id is not null;
