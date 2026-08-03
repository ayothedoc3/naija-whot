-- `games` holds only what's safe for room members to see (sanitized
-- public_state, produced by src/lib/game-engine/public-state.ts). The
-- canonical secret state lives separately in game_secret_states, which no
-- client role can ever select.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'round_over', 'match_over')),
  round_number int not null default 0,
  public_state jsonb not null default '{}'::jsonb,
  state_version int not null default 0,
  winner_user_id uuid references auth.users (id),
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_room_id_idx on public.games (room_id);
-- Fast "find the active game for this room" lookup.
create index games_room_active_idx on public.games (room_id) where status <> 'match_over';

create trigger games_set_updated_at
  before update on public.games
  for each row
  execute function public.set_updated_at();

-- Server-only. No RLS policies are ever added for anon/authenticated — the
-- service-role client (which bypasses RLS entirely) is the only reader/writer.
create table public.game_secret_states (
  game_id uuid primary key references public.games (id) on delete cascade,
  canonical_state jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  sequence_number int not null,
  action_id text not null,
  actor_user_id uuid references auth.users (id),
  event_type text not null,
  public_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, sequence_number)
);

create index game_events_game_id_seq_idx on public.game_events (game_id, sequence_number);

-- The authoritative replay guard: a unique constraint the database enforces
-- even under concurrent requests, independent of the engine's own
-- in-memory recentActionIds check.
create table public.processed_game_actions (
  game_id uuid not null references public.games (id) on delete cascade,
  action_id text not null,
  actor_user_id uuid references auth.users (id),
  resulting_version int not null,
  created_at timestamptz not null default now(),
  primary key (game_id, action_id)
);

alter table public.games enable row level security;
alter table public.game_secret_states enable row level security;
alter table public.game_events enable row level security;
alter table public.processed_game_actions enable row level security;

create policy "games_select_members" on public.games
  for select
  using (public.is_room_member(room_id, auth.uid()));

create policy "game_events_select_members" on public.game_events
  for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_events.game_id
        and public.is_room_member(g.room_id, auth.uid())
    )
  );

-- No client policies at all on games (insert/update/delete), game_secret_states,
-- or processed_game_actions: every write goes through commit_game_transition,
-- executed only by server code via the service-role client.
