-- display_name is snapshotted at join time so fellow room members can be
-- shown without ever granting cross-user access to public.profiles.
create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat_number int not null check (seat_number >= 0),
  display_name text not null check (char_length(display_name) between 1 and 20),
  is_host boolean not null default false,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat_number)
);

create index room_members_room_id_idx on public.room_members (room_id);
create index room_members_user_id_idx on public.room_members (user_id);

-- SECURITY DEFINER so RLS policies on rooms/room_members/games/game_events
-- can check membership without recursively re-evaluating room_members' own
-- RLS policy (a classic self-referencing-policy footgun).
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to anon, authenticated;

create or replace function public.is_room_host(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and host_user_id = p_user_id
  );
$$;

revoke all on function public.is_room_host(uuid, uuid) from public;
grant execute on function public.is_room_host(uuid, uuid) to anon, authenticated;

alter table public.room_members enable row level security;

create policy "room_members_select_fellow_members" on public.room_members
  for select
  using (public.is_room_member(room_id, auth.uid()));

-- Clients may directly toggle only their own readiness/heartbeat — every
-- other mutation (join, kick, host transfer, seat assignment) goes through
-- a server route handler using the service-role client. Column-level grants
-- below make this a hard boundary, not just an application convention: an
-- UPDATE statement touching any other column is rejected before RLS even
-- runs.
create policy "room_members_update_own_presence" on public.room_members
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.room_members from authenticated;
grant update (ready, last_seen_at) on public.room_members to authenticated;

-- No insert/delete client policies: joining and kicking are server-only.

create policy "rooms_select_members" on public.rooms
  for select
  using (public.is_room_member(id, auth.uid()));

-- No insert/update/delete client policies on rooms: creation, settings
-- changes, and status transitions are all server-only.
