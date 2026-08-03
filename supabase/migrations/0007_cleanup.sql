-- Expiration/retention housekeeping. These are plain SQL functions; wiring
-- up *when* they run (Supabase Dashboard → Database → Cron, a pg_cron
-- schedule, or an external scheduler hitting a protected route) is a
-- deploy-time operational step documented in docs/DEPLOYMENT.md — it
-- depends on the hosting plan/self-hosting choice, so it isn't baked into
-- a migration.
create or replace function public.cleanup_expired_rooms()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.rooms
  where status = 'lobby'
    and expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_expired_rooms() to service_role;

create or replace function public.cleanup_old_game_events(p_retention_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.game_events ge
  using public.games g
  where ge.game_id = g.id
    and g.status = 'match_over'
    and g.updated_at < now() - (p_retention_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_old_game_events(int) from public, anon, authenticated;
grant execute on function public.cleanup_old_game_events(int) to service_role;
