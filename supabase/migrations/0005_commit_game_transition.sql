-- The single, atomic write path for all authoritative game state. Called
-- only from server code (src/lib/supabase/service-role.ts client) after the
-- pure game engine (src/lib/game-engine/reducer.ts) has already validated
-- and computed the new state — this function's job is to persist that
-- result atomically and re-check the version/action-id race conditions at
-- the database layer as a second, authoritative line of defense.
create or replace function public.commit_game_transition(
  p_game_id uuid,
  p_expected_version int,
  p_new_state_version int,
  p_new_canonical_state jsonb,
  p_new_public_state jsonb,
  p_action_id text,
  p_actor_user_id uuid,
  p_events jsonb default '[]'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_version int;
  v_next_sequence int;
  v_status text;
  v_turn_deadline_ms numeric;
  v_turn_deadline timestamptz;
  v_winner uuid;
  v_round_number int;
begin
  select state_version into v_current_version
  from public.games
  where id = p_game_id
  for update;

  if v_current_version is null then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.processed_game_actions
    where game_id = p_game_id and action_id = p_action_id
  ) then
    raise exception 'DUPLICATE_ACTION' using errcode = 'P0001';
  end if;

  v_status := p_new_public_state ->> 'status';
  v_winner := nullif(p_new_public_state ->> 'matchWinnerUserId', '')::uuid;
  v_turn_deadline_ms := (p_new_public_state ->> 'turnDeadline')::numeric;
  v_turn_deadline := case
    when v_turn_deadline_ms is null then null
    else to_timestamp(v_turn_deadline_ms / 1000.0)
  end;
  v_round_number := (p_new_public_state ->> 'roundNumber')::int;

  update public.games
  set public_state = p_new_public_state,
      state_version = p_new_state_version,
      status = coalesce(v_status, status),
      round_number = coalesce(v_round_number, round_number),
      turn_deadline = v_turn_deadline,
      winner_user_id = v_winner,
      updated_at = now()
  where id = p_game_id;

  insert into public.game_secret_states (game_id, canonical_state, updated_at)
  values (p_game_id, p_new_canonical_state, now())
  on conflict (game_id) do update
    set canonical_state = excluded.canonical_state,
        updated_at = now();

  select coalesce(max(sequence_number), 0) into v_next_sequence
  from public.game_events
  where game_id = p_game_id;

  insert into public.game_events (game_id, sequence_number, action_id, actor_user_id, event_type, public_payload)
  select
    p_game_id,
    v_next_sequence + row_number() over (),
    p_action_id,
    p_actor_user_id,
    elem ->> 'type',
    elem - 'type'
  from jsonb_array_elements(p_events) as elem;

  insert into public.processed_game_actions (game_id, action_id, actor_user_id, resulting_version)
  values (p_game_id, p_action_id, p_actor_user_id, p_new_state_version);

  return p_new_state_version;
end;
$$;

-- Only the service-role client may ever call this. Direct execution from
-- the browser (anon/authenticated) is structurally impossible.
revoke all on function public.commit_game_transition(
  uuid, int, int, jsonb, jsonb, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_game_transition(
  uuid, int, int, jsonb, jsonb, text, uuid, jsonb
) to service_role;

-- Used by server code to atomically create a brand-new game row + its
-- initial secret state for a room (the "start_game" bootstrap, which has no
-- prior game_id/version to check against).
create or replace function public.create_game(
  p_room_id uuid,
  p_public_state jsonb,
  p_canonical_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  insert into public.games (room_id, status, round_number, public_state, state_version)
  values (
    p_room_id,
    coalesce(p_public_state ->> 'status', 'not_started'),
    coalesce((p_public_state ->> 'roundNumber')::int, 0),
    p_public_state,
    coalesce((p_public_state ->> 'stateVersion')::int, 0)
  )
  returning id into v_game_id;

  insert into public.game_secret_states (game_id, canonical_state)
  values (v_game_id, p_canonical_state);

  return v_game_id;
end;
$$;

revoke all on function public.create_game(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_game(uuid, jsonb, jsonb) to service_role;
