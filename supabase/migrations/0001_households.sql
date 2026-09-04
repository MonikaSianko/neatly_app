-- Etap 1: logowanie i gospodarstwo domowe
-- profiles, households, household_members, household_invites
-- RLS + user_households() (zapobiega rekursji na household_members)
-- Trigger: pierwsze logowanie tworzy gospodarstwo, uzytkownik zostaje ownerem.

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  active_household_id uuid,
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_active_household_id_fkey
  foreign key (active_household_id) references households on delete set null;

create table household_members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users
);

create index on household_members (user_id);
create index on household_invites (household_id);

-- ============================================================
-- Zapobiega rekursji w politykach RLS na households / household_members.
-- ============================================================
create or replace function public.user_households()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

-- ============================================================
-- Krotki, czytelny kod zaproszenia (bez znakow mylacych sie: 0/O, 1/I).
-- ============================================================
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 32)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

alter table household_invites
  alter column code set default public.generate_invite_code();

-- ============================================================
-- Pierwsze logowanie: profil + wlasne gospodarstwo jako owner.
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Dolaczenie do gospodarstwa kodem zaproszenia.
-- ============================================================
create or replace function public.redeem_household_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite household_invites%rowtype;
begin
  select * into v_invite
  from household_invites
  where code = invite_code
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_invite.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  update household_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  update profiles
  set active_household_id = v_invite.household_id
  where user_id = auth.uid();

  return v_invite.household_id;
end;
$$;

grant execute on function public.redeem_household_invite(text) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;

-- profiles: wlasny profil, plus profile wspollokatorow (do listy czlonkow)
create policy "select own or household co-member profiles"
on profiles for select
to authenticated
using (
  user_id = auth.uid()
  or user_id in (
    select user_id from household_members
    where household_id in (select public.user_households())
  )
);

create policy "update own profile"
on profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- households: widoczne i edytowalne przez czlonkow
create policy "select own households"
on households for select
to authenticated
using (id in (select public.user_households()));

create policy "members can rename household"
on households for update
to authenticated
using (id in (select public.user_households()))
with check (id in (select public.user_households()));

-- household_members: widoczne dla czlonkow tego samego gospodarstwa
create policy "select members of own households"
on household_members for select
to authenticated
using (household_id in (select public.user_households()));

-- household_invites: czlonkowie gospodarstwa zarzadzaja zaproszeniami
create policy "select invites of own households"
on household_invites for select
to authenticated
using (household_id in (select public.user_households()));

create policy "members can create invites"
on household_invites for insert
to authenticated
with check (
  household_id in (select public.user_households())
  and created_by = auth.uid()
);
