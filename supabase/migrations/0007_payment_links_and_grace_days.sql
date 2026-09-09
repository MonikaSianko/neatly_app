-- Link do platnosci i dni karencji (od terminu do uznania platnosci za przeterminowana),
-- ustawiane osobno dla kazdej pozycji / reguly cyklicznej.

alter table transactions
  add column payment_url text,
  add column grace_days int not null default 0 check (grace_days >= 0);

alter table recurring_rules
  add column payment_url text,
  add column grace_days int not null default 0 check (grace_days >= 0);
