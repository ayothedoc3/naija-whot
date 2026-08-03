-- Enables Realtime (postgres_changes) for the tables clients subscribe to.
-- RLS still applies to every change event delivered over Realtime, so a
-- client only ever receives rows/changes for rooms it is a member of.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_events;
