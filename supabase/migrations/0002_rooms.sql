create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- Excludes 0/O and 1/I to avoid visually ambiguous codes.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  max_players int not null default 4 check (max_players between 2 and 4),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index rooms_code_idx on public.rooms (code);
create index rooms_expires_at_idx on public.rooms (expires_at);
create index rooms_status_idx on public.rooms (status);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row
  execute function public.set_updated_at();

alter table public.rooms enable row level security;

-- Policies are added in 0003_room_members.sql once public.is_room_member()
-- exists (it needs room_members to be defined first).
