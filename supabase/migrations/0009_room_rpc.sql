-- Atomic room lifecycle operations, mirroring the same pattern as
-- commit_game_transition: business logic + concurrency-safety lives in one
-- SECURITY DEFINER function per operation, called only by server route
-- handlers via the service-role client.

create or replace function public.create_room_with_host(
  p_code text,
  p_host_user_id uuid,
  p_display_name text,
  p_max_players int,
  p_settings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  insert into public.rooms (code, host_user_id, max_players, settings)
  values (p_code, p_host_user_id, p_max_players, p_settings)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, seat_number, display_name, is_host)
  values (v_room_id, p_host_user_id, 0, p_display_name, true);

  return v_room_id;
end;
$$;

revoke all on function public.create_room_with_host(text, uuid, text, int, jsonb) from public, anon, authenticated;
grant execute on function public.create_room_with_host(text, uuid, text, int, jsonb) to service_role;

-- Idempotent for reconnects: if p_user_id is already a member, returns their
-- existing seat instead of erroring or double-joining.
create or replace function public.join_room(
  p_code text,
  p_user_id uuid,
  p_display_name text
)
returns table (room_id uuid, seat_number int, max_players int, settings jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_existing_seat int;
  v_member_count int;
  v_next_seat int;
begin
  select * into v_room from public.rooms where code = p_code for update;
  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.expires_at < now() then
    raise exception 'ROOM_EXPIRED';
  end if;

  select rm.seat_number into v_existing_seat
  from public.room_members rm
  where rm.room_id = v_room.id and rm.user_id = p_user_id;

  if v_existing_seat is not null then
    -- Reconnecting member: let them back in regardless of room status.
    update public.room_members rm
    set last_seen_at = now()
    where rm.room_id = v_room.id and rm.user_id = p_user_id;
    return query select v_room.id, v_existing_seat, v_room.max_players, v_room.settings;
    return;
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED';
  end if;

  select count(*) into v_member_count from public.room_members rm where rm.room_id = v_room.id;
  if v_member_count >= v_room.max_players then
    raise exception 'ROOM_FULL';
  end if;

  select coalesce(max(rm.seat_number), -1) + 1 into v_next_seat
  from public.room_members rm
  where rm.room_id = v_room.id;

  insert into public.room_members (room_id, user_id, seat_number, display_name, is_host)
  values (v_room.id, p_user_id, v_next_seat, p_display_name, false);

  return query select v_room.id, v_next_seat, v_room.max_players, v_room.settings;
end;
$$;

revoke all on function public.join_room(text, uuid, text) from public, anon, authenticated;
grant execute on function public.join_room(text, uuid, text) to service_role;

-- Host-departure transfer: promotes the earliest-joined remaining member
-- whenever the current host's membership row disappears (self-leave via the
-- client-side DELETE policy below, or a server-side kick/cleanup).
create or replace function public.handle_room_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_host uuid;
begin
  if old.is_host then
    select rm.user_id into v_next_host
    from public.room_members rm
    where rm.room_id = old.room_id
    order by rm.joined_at asc
    limit 1;

    if v_next_host is not null then
      update public.room_members set is_host = true where room_id = old.room_id and user_id = v_next_host;
      update public.rooms set host_user_id = v_next_host where id = old.room_id;
    end if;
  end if;
  return old;
end;
$$;

create trigger on_room_member_delete
  after delete on public.room_members
  for each row
  execute function public.handle_room_member_delete();

-- Clients may leave a room themselves, or (if host) kick another member,
-- directly via a DELETE — RLS scopes exactly those two cases.
create policy "room_members_delete_self_or_as_host" on public.room_members
  for delete
  using (auth.uid() = user_id or public.is_room_host(room_id, auth.uid()));

grant delete on public.room_members to authenticated;
