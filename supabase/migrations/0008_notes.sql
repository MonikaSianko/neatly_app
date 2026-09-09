-- Notatka do pozycji / reguly cyklicznej (pokazywana pod ikona info w wierszu).

alter table transactions add column note text;
alter table recurring_rules add column note text;
