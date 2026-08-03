# Architecture

## High-level

```
Browser (React client components)
   │  fetch()                          ▲ Supabase Realtime (postgres_changes, presence, broadcast)
   ▼                                    │
Next.js Route Handlers (src/app/api/**)│
   │  service-role client              │
   ▼                                    │
Postgres (Supabase) ───────────────────┘
   games (public_state)  ← RLS-readable by room members, also streamed via Realtime
   game_secret_states    ← never RLS-readable, server-only
   commit_game_transition ← the only write path for game state
```

The browser never computes new authoritative state. It renders whatever the
server last returned or streamed, and it submits _requests_ to act.

## Request lifecycle for a game action

1. Client calls `POST /api/games/[gameId]/actions` with
   `{ actionId, expectedVersion, type, payload }`.
2. The handler authenticates the caller (Supabase server client reads the
   session cookie), confirms room/game membership, and rate-limits.
3. It loads `game_secret_states.canonical_state` and `games.state_version`
   using the **service-role** client (never exposed to the browser).
4. If `games.state_version !== expectedVersion`, return `409` with a
   `VERSION_CONFLICT` error code — the client refetches and retries.
5. Otherwise, run the pure engine:
   `applyAction(canonicalState, action, actingUserId, now, rng?) → Result`.
   A domain error (illegal move, wrong turn, etc.) returns `422` with a typed
   error code and message; nothing is written.
6. On success, call `commit_game_transition(...)` (a single RPC, one
   transaction) with the new canonical state, new sanitized public state, the
   sanitized event, and the action id.
7. Return the acting player's own updated private hand + the new public
   state to the caller directly (avoids a round-trip through Realtime for the
   actor's own UI).
8. All _other_ room members receive the update via a `postgres_changes`
   subscription on `games` (public_state/state_version) and `game_events`,
   and separately re-fetch their own hand only when the sanitized event
   indicates their hand changed (drew cards, was dealt a penalty, etc.) —
   never by inferring it client-side.

## Turn timer on a stateless container

The app runs as a single stateless Next.js container (see
`docs/DEPLOYMENT.md`); there is no long-lived in-process scheduler, and Coolify
gives no built-in cron primitive for the app service itself. Rather than
promise a background timer that isn't really there, the design is:

- `games.turn_deadline` is the authoritative deadline, set by the server on
  every action that starts a new turn.
- **Lazy resolution:** any authenticated interaction with a game — submitting
  an action, opening the game page, or a lightweight `GET
/api/games/[gameId]/state` poll the client issues every few seconds while a
  timer is running and it's _not_ the local player's turn — first checks
  `now() > turn_deadline`. If expired, the server applies the timeout
  resolution (auto-draw for the inactive player, pass the turn, extend a new
  deadline) via the same `commit_game_transition` path _before_ handling
  whatever the request originally asked for, tagging the resulting event as
  `type: "timeout"` so the UI can show _why_ the turn changed.
- This makes expiry resolve within roughly one poll interval (a few seconds)
  of the deadline passing in practice, without a dedicated always-on process,
  and it's exactly as safe under concurrency as any other action: guarded by
  `state_version` and a synthetic `actionId` (`timeout:{gameId}:{deadlineIso}`)
  so two racing resolutions can't both apply — the second hits the
  `processed_game_actions` unique constraint and no-ops.
- **Known limitation:** if _nobody_ touches the game (both tabs closed, no
  poll in flight) the deadline can sit "expired but unresolved" until someone
  reconnects. For a 2-friends-playing-live product this is acceptable; it is
  called out explicitly in the README's "Known limitations" section.
- **Optional true background expiry:** `supabase/functions/resolve-timeouts/`
  contains an optional Supabase Edge Function + `pg_cron`/Scheduled Trigger
  design (documented inline in that folder's README) that calls the same
  timeout-resolution code path once a second across all games with a passed
  deadline. It is not required for local dev or for the definition of done in
  this repo, but it's the recommended upgrade for a "real" always-on timer if
  the responsiveness of lazy resolution isn't enough in production.

## Realtime channels

- `room:{roomId}` — Presence (online/away/last-seen) + `postgres_changes` on
  `room_members` (joins/leaves/ready toggles/kicks) and `rooms` (settings,
  status).
- `game:{gameId}` — `postgres_changes` on `games` (public_state, state_version,
  turn_deadline) and `game_events` (append-only feed), plus Broadcast for
  purely cosmetic events (emoji reactions, "thinking" indicator, confetti
  trigger) that carry no authoritative meaning and are never persisted.

## Reconnection

A disconnected player keeps their seat; Presence marks them "away" after a
short grace period without a heartbeat. On the client, losing the Realtime
socket shows a "reconnecting…" indicator while `@supabase/realtime-js`
auto-reconnects; on reconnect (or on a fresh page load / navigating to the
invite URL again) the client re-fetches current public state + its own hand
from the server rather than trusting anything cached. The host can remove a
disconnected player from the **lobby** (before a game starts) but cannot
remove or otherwise manipulate a seat once a game is in progress — a
disconnected mid-game player can only leave via forfeit (their own action) or
by timing out repeatedly (handled the same as any other timeout).

## Development fixture mode

`NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true` unlocks forced hands, a forced top
card/active shape, and a forced market order through
`POST /api/dev/fixtures/start` (`src/app/api/dev/fixtures/start/route.ts`),
used by the Playwright suite (`e2e/full-game.spec.ts`) to reliably exercise
a named special-card or declaration scenario instead of hoping a random
deal produces one. Everything upstream of it — creating the room, joining,
becoming ready — is the real, unmocked flow; the fixture route only
replaces the *dealing* step a normal "Start Game" click would otherwise
perform, by calling the same `buildFixtureGameState` state constructor
`src/lib/game-engine/fixtures.ts` shares with the engine's own unit tests
instead of shuffling a fresh deck.

The route is hard-gated by reading `process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES`
directly on the server — never on any client-supplied flag — and returns a
plain 404 otherwise. This is deliberately **not** also gated on
`NODE_ENV === "production"`: Next.js always sets `NODE_ENV=production` for
any optimized build, including the local `next build && next start` that
Playwright's own webServer runs for this exact suite, so a `NODE_ENV` check
would make the route unreachable in every built environment, not just a
real deployment. The actual safety boundary is that a real production
deployment's environment variables must simply never set
`NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true` — `.env.example` and
`docs/DEPLOYMENT.md` both call this out explicitly. The route never weakens
RLS or the action-validation path either way; it only chooses what the
*initial* canonical state looks like. Whenever
`NEXT_PUBLIC_ENABLE_DEV_FIXTURES` is on, a small "DEV FIXTURES ON" badge
(`src/components/dev-fixture-badge.tsx`) is shown fixed on-screen, satisfying
the "clearly marked in the UI" requirement.
