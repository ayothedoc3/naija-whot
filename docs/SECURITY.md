# Security

## Threat model summary

The browser is never trusted to know deck order, opponent hands, whether a
move is legal, card effects, whose turn it is, draw amounts, the winner, timer
expiry, or match score. All of that lives server-side; see
`docs/ARCHITECTURE.md`.

## Authentication

Supabase Anonymous Auth. On first visit the client creates an anonymous user
and a `profiles` row with the chosen nickname; the session persists in a
Supabase-managed cookie so a refresh does not lose the player. Real identity
is never required. Production deployments should enable Cloudflare Turnstile
on the anonymous sign-in call (hook points are in
`src/lib/auth/turnstile.ts` and documented in `docs/DEPLOYMENT.md`) to slow
down anonymous-auth abuse/farming.

## Authorization (RLS)

See `docs/DATABASE.md` § Row Level Security. Nothing about the app's authority
model depends on obfuscation — even if RLS were the only line of defense, a
non-member cannot read a room, its members, its game, or its events, and no
authenticated client role can write to `games`, `game_secret_states`,
`game_events`, or `processed_game_actions`, or execute
`commit_game_transition`.

## Input validation

Every route handler validates its request body with a Zod schema before
touching the database or the engine (`src/lib/validation/`). This includes
nickname length/character constraints, room-code shape (`^[A-Z0-9]{6}$`),
action payload shapes per action type, and UUID shape for all ids.

## Replay & concurrency protection

- Every action carries a client-generated `actionId` (UUID) and the
  `expectedVersion` it was computed against.
- `processed_game_actions` has a unique constraint on `(game_id, action_id)` —
  a replayed action id is rejected at the database level even under a race
  between two requests.
- `commit_game_transition` checks `expected_version` inside the same
  transaction as the write, so a stale action cannot silently overwrite a
  newer state; the loser of a race gets a structured `VERSION_CONFLICT`
  response and refetches current state.

## Rate limiting

A minimal in-memory-per-instance token bucket (`src/lib/rate-limit.ts`) guards
room creation, room joining, and game actions per user/IP. Documented as a
**single-container-friendly** default; if the app is scaled to multiple
Coolify replicas, swap in a shared store (Postgres-backed or Redis) — the
limiter is defined behind a small interface specifically so that swap doesn't
touch call sites.

## Secrets handling

- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DATABASE_URL` are read only in
  `src/lib/supabase/service-role.ts`, which throws immediately if evaluated
  outside a server runtime (checks for `typeof window`). No route or
  component imports it from client code; this is also verified by a Vitest
  test that greps built client chunks for the service-role key material
  pattern (see `src/lib/supabase/__tests__/no-secret-leak.test.ts`).
- `.env`, `.env.local`, and `.env*.local` are git-ignored; `.env.example`
  documents every variable with no real values (see `docs/DEPLOYMENT.md`).
- The Docker image never `COPY`s `.env*` files (`.dockerignore`); runtime
  secrets are injected as container environment variables by Coolify.

## Logging

Structured server logs (`src/lib/logger.ts`) for room/game lifecycle events
per spec §20. The logger redacts by an explicit allowlist of fields per event
type rather than a denylist, so a new field added later can't accidentally
leak — full hands, deck order, tokens, and service-role keys are structurally
never in scope of what's passed to the logger for these events.

## HTTP security headers

Configured in `next.config.ts`: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and a
`Content-Security-Policy` scoped to `'self'` plus the Supabase project origin
for `connect-src`/`wss:`. Next.js's inline hydration script requires
`script-src 'unsafe-inline'`; tightening this further to a per-request nonce
is listed as a known limitation/future improvement in the README.

## What clients can never see

Opponent hands and deck order are excluded at the source — `public-state.ts`
strips them before anything is written to `games.public_state` or a
`game_events.public_payload`. Since realtime payloads and RSC/API responses
are built from those same sanitized rows, there is no code path where a
client request, a Realtime message, or a server log line can contain another
player's cards. This is covered by an explicit Vitest suite
(`public-state.test.ts`) and a Playwright network-payload assertion in the
E2E suite.
