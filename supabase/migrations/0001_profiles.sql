-- Profiles: one row per auth user (anonymous or otherwise). Nicknames live
-- here; a trigger provisions a default row the moment auth.users gets one,
-- so every other table's FK to auth.users can assume a profile exists.
create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', 'Player')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert/delete policies: rows are created only by the trigger above and
-- never deleted by clients (cascades from auth.users deletion instead).
