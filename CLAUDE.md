# CLAUDE.md

Guidance for Claude Code (or any engineer) working in this repository.

## What this is

**Naija Whot** — a mobile-first, real-time multiplayer Nigerian Whot card game.
Next.js App Router + TypeScript + Supabase (Postgres, Anonymous Auth, Realtime).
Deployed as a Docker container to **Coolify** (not Vercel — see `docs/DEPLOYMENT.md`).

## Non-negotiable architecture rules

1. **The server is the only source of truth for game state.** The pure game
   engine lives in `src/lib/game-engine/` and knows nothing about Next.js,
   Supabase, or React. It is a set of plain functions: `(state, action) =>
{ state, publicState, events, ... }`.
2. **Never send canonical secret state (`game_secret_states`) to the browser.**
   Only sanitized `public_state` and the acting player's own hand are ever
   returned to a client.
3. **Every authoritative action goes through a server route handler**, which
   loads canonical state, validates the action with the engine, and commits
   the result via the `commit_game_transition` Postgres function using the
   **service-role** client. Clients never write directly to `games`,
   `game_secret_states`, or `game_events`.
4. **Optimistic concurrency via `state_version`.** Every action carries the
   `expectedVersion` it was computed against. A mismatch is a conflict, not a
   silent overwrite.
5. **Realtime is a notification channel, not a state source.** On any
   `postgres_changes`/broadcast notification, clients refetch or receive the
   sanitized public state and replace their local copy — they never derive
   new authoritative state themselves. Supabase Presence is for online/away
   status; Broadcast is only for cosmetic, non-authoritative effects
   (reactions, "thinking" indicators).
6. **No secrets in client bundles.** `SUPABASE_SERVICE_ROLE_KEY` and
   `SUPABASE_DATABASE_URL` are read only in files that are never imported by
   client components (see `src/lib/supabase/service-role.ts`, which throws if
   imported in a browser context).

## Repository map

```
src/lib/game-engine/   Pure rules engine (see docs/GAME_RULES.md). No I/O.
src/lib/supabase/      Server/browser/service-role Supabase client factories.
src/lib/env/           Zod-validated environment access (fails fast on boot).
src/app/               Next.js App Router routes, layouts, API route handlers.
src/components/        React components (ui/ is shadcn-generated primitives).
supabase/migrations/   SQL migrations, applied in order by the Supabase CLI.
e2e/                   Playwright multi-browser-context tests.
docs/                  Product, rules, architecture, database, security, deployment docs.
```

The roadmap for extending this game into a multi-game couples hub is in
`docs/ECOSYSTEM_PLAN.md`. Read it before starting any new activity or game.

## Working process for this project

- Keep rule logic out of React components — if you're writing an `if` about
  card legality inside a `.tsx` file, it belongs in `src/lib/game-engine/`
  instead.
- Any new authoritative action needs: an engine case, a Zod schema for the
  payload, a route handler, and unit tests (legal + illegal + edge cases).
- Run after every change: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Update `TASKS.md` as work completes. Don't leave TODOs, mocked multiplayer,
  or disabled tests in a committed state.
- Local Supabase (via `supabase start`, requires Docker) is the default dev
  loop — see `docs/DATABASE.md` and the README for exact commands.
