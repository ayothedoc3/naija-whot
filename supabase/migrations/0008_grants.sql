-- Table-level GRANTs. RLS policies alone are not sufficient — Postgres (and
-- this Supabase image, matching the deprecated `auto_expose_new_tables`
-- default) requires an explicit GRANT before a role can touch a table at
-- all; the RLS policies above then narrow that access to specific rows.
--
-- Anonymous-sign-in users authenticate with the `authenticated` Postgres
-- role (the `anon` role is only for requests with no user session at all),
-- so every grant below targets `authenticated` and/or `service_role` —
-- never `anon`, since this app has no unauthenticated table access.
grant usage on schema public to authenticated, service_role;

-- profiles: clients read their own row and may rename themselves, but
-- cannot touch created_at/updated_at directly (updated_at is overwritten by
-- the set_updated_at trigger regardless). Inserts happen only via the
-- handle_new_auth_user trigger.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- rooms: clients only ever read (creation/settings/status are server-only).
grant select on public.rooms to authenticated;
grant select, insert, update, delete on public.rooms to service_role;

-- room_members: clients read fellow members. Update is deliberately NOT
-- granted broadly here — 0003_room_members.sql already grants a
-- column-scoped UPDATE (ready, last_seen_at only) to authenticated; granting
-- a full UPDATE here would silently widen that back out.
grant select on public.room_members to authenticated;
grant select, insert, update, delete on public.room_members to service_role;

-- games: clients only ever read the sanitized public_state.
grant select on public.games to authenticated;
grant select, insert, update, delete on public.games to service_role;

-- game_events: clients only ever read the sanitized event log.
grant select on public.game_events to authenticated;
grant select, insert, update, delete on public.game_events to service_role;

-- game_secret_states: no client access whatsoever, in either direction.
grant select, insert, update, delete on public.game_secret_states to service_role;

-- processed_game_actions: no client access whatsoever.
grant select, insert on public.processed_game_actions to service_role;

-- Helper functions are also usable by service_role (in addition to the
-- anon/authenticated grants already set where they were defined).
grant execute on function public.is_room_member(uuid, uuid) to service_role;
grant execute on function public.is_room_host(uuid, uuid) to service_role;
