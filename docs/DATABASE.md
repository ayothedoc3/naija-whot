# Database

Postgres via Supabase. Migrations live in `supabase/migrations/`, applied in
filename order by the Supabase CLI (`pnpm supabase:start` + `supabase db
push`, or automatically on `supabase start` against a fresh local shadow db).

## Tables

### `profiles`

`user_id` (PK, FK → `auth.users`), `display_name`, `created_at`, `updated_at`.
One row per anonymous (or future real) auth user.

### `rooms`

`id` (PK), `code` (unique, 6 chars), `host_user_id`, `status`
(`lobby|active|finished`), `max_players`, `settings` (jsonb — the rule
configuration from `docs/PRODUCT_SPEC.md`), `created_at`, `updated_at`,
`expires_at`.

### `room_members`

`room_id` + `user_id` (composite PK), `seat_number`, `ready`, `joined_at`,
`last_seen_at`. Unique constraint on `(room_id, seat_number)` and on
`(room_id, user_id)`.

### `games`

Public/sanitized game record readable by room members: `id` (PK), `room_id`,
`status` (`dealing|in_progress|round_over|match_over`), `round_number`,
`public_state` (jsonb — sanitized, see `public-state.ts`), `state_version`,
`winner_user_id`, `turn_deadline`, `created_at`, `updated_at`.

### `game_secret_states`

**Server-only**, never selectable by `anon`/`authenticated` roles: `game_id`
(PK, FK → games), `canonical_state` (jsonb — full deck order, all hands,
pending effects, declarations), `updated_at`.

### `game_events`

Append-only sanitized event log: `id` (PK), `game_id`, `sequence_number`,
`action_id`, `actor_user_id`, `event_type`, `public_payload` (jsonb, no
private data), `created_at`. Unique `(game_id, sequence_number)`.

### `processed_game_actions`

Replay/idempotency guard: `game_id` + `action_id` (composite PK),
`actor_user_id`, `resulting_version`, `created_at`.

## Indexes

- `rooms(code)` unique; `rooms(expires_at)` for the cleanup job.
- `room_members(room_id)`, `room_members(user_id)`.
- `games(room_id)` and a partial index on `games(room_id) WHERE status <>
'match_over'` for "find the active game" lookups.
- `game_events(game_id, sequence_number)` for ordered replay/pagination.
- `processed_game_actions(game_id, action_id)` unique — this _is_ the replay
  guard, enforced at the database level, not just in application code.

## `commit_game_transition`

A single `SECURITY DEFINER` Postgres function that, in one transaction:

1. Locks and checks `games.state_version = expected_version` (raises a
   distinguishable error otherwise).
2. Updates `game_secret_states.canonical_state`.
3. Updates `games.public_state`, `state_version + 1`, `turn_deadline`, and
   `status`/`winner_user_id` when applicable.
4. Inserts the sanitized `game_events` row.
5. Inserts the `processed_game_actions` row (its unique constraint rejects a
   replayed `action_id` even under a race).

`REVOKE EXECUTE ON FUNCTION commit_game_transition FROM PUBLIC, anon,
authenticated;` — it is only ever called by server code using the
service-role client (see `src/lib/supabase/service-role.ts`). See migration
`0004_commit_game_transition.sql`.

## Row Level Security

Enabled on every table. Summary (full policies in the migrations):

- `profiles`: a user can select/update only their own row.
- `rooms`: selectable only by current `room_members` of that room (or by code
  during the join pre-check, via a `SECURITY DEFINER` lookup function that
  returns only non-sensitive fields needed to validate a join attempt).
- `room_members`: selectable by members of the same room; a user may insert
  their own membership row (join) and update only their own `ready`/
  `last_seen_at`; only the host may delete another member's row (kick).
- `games`: selectable by room members only. No client `INSERT`/`UPDATE`/
  `DELETE` policies exist at all — every write goes through
  `commit_game_transition`.
- `game_secret_states`: no policies grant `anon`/`authenticated` any access —
  effectively unreadable and unwritable from the browser.
- `game_events`: selectable by room members only; no client write policy.
- `processed_game_actions`: no client policies at all.

## Expiration & retention

- `rooms.expires_at` defaults to 24h after creation; a cleanup job (documented
  in `docs/DEPLOYMENT.md`) deletes expired lobby-status rooms and cascades to
  members/games/events.
- `game_events` older than a finished game's retention window (default 7 days)
  are eligible for cleanup — see the retention note in `docs/DEPLOYMENT.md`.
