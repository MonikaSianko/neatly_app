-- Domyka uwagi security advisora po migracji 0001:
-- - generate_invite_code: ustaw staly search_path
-- - handle_new_user: to funkcja triggera, nie powinna byc wywolywalna przez RPC
-- - redeem_household_invite / user_households: dostepne tylko dla authenticated

alter function public.generate_invite_code() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.redeem_household_invite(text) from public, anon;
grant execute on function public.redeem_household_invite(text) to authenticated;

revoke execute on function public.user_households() from public, anon;
grant execute on function public.user_households() to authenticated;

revoke execute on function public.generate_invite_code() from public, anon;
grant execute on function public.generate_invite_code() to authenticated;
