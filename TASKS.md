# TASKS

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

## Phase 1 — Foundation

- [x] Initialize Next.js App Router project (TS strict, Tailwind v4, ESLint, Prettier)
- [x] Install Supabase, Zod, Vitest, RTL, Playwright, shadcn/ui (Base UI)
- [x] `next.config.ts`: standalone output, security headers
- [x] Docs: CLAUDE.md, TASKS.md, docs/PRODUCT_SPEC.md, GAME_RULES.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, DEPLOYMENT.md
- [x] `.env.example`, Zod env validation
- **Acceptance:** `pnpm build` succeeds on a placeholder page; lint/typecheck clean. **DONE.**

## Phase 2 — Game engine

- [x] `cards.ts` — 54-card Nigerian Whot composition, card metadata
- [x] `deck.ts` — deck build, secure shuffle (crypto), seeded shuffle for tests
- [x] `types.ts` — discriminated unions for state/actions/events/errors
- [x] `rules.ts` — rule configuration + defaults
- [x] `validation.ts` — legality checks
- [x] `reducer.ts` — pure state transition function
- [x] `selectors.ts` — derived queries (current player, playable cards, etc.)
- [x] `serialization.ts` / `public-state.ts` — canonical → sanitized public state
- [x] `errors.ts` — domain error codes
- [x] Full unit test suite (deck composition, shuffles, all special cards, stacking,
      declarations, double decking, direction, reshuffle, timers, action-id/version
      rejection, public-state sanitization)
- **Acceptance:** `pnpm test` green, no Supabase/React import in `game-engine/`. **DONE — 95/95
  tests pass; `pnpm lint`, `pnpm typecheck`, `pnpm build` all clean.**

## Phase 3 — Supabase

- [ ] Migrations: profiles, rooms, room_members, games, game_secret_states,
      game_events, processed_game_actions
- [ ] RLS policies for every table
- [ ] `commit_game_transition` SQL function, execute revoked from anon/authenticated
- [ ] Anonymous auth wiring (client + server), profile creation trigger
- [ ] Local Supabase stack via Docker CLI, migrations applied and verified
- [ ] Security tests (RLS: cross-room access denied, secret state unreadable, etc.)
- **Acceptance:** local `supabase start` + migrations apply cleanly; RLS tests pass.

## Phase 4 — Lobby

- [ ] Landing page: nickname, create/join, how-to-play, rules link, sound toggle, install prompt
- [ ] Create room route + settings form
- [ ] Join room by code/link + validation
- [ ] Lobby screen: presence, ready state, host badge, rule summary, copy link, kick, start
- [ ] Host transfer on host departure
- **Acceptance:** two browser sessions can create/join/ready/start a room end-to-end.

## Phase 5 — Multiplayer board

- [ ] Route handlers for start/play/draw/etc. via engine + `commit_game_transition`
- [ ] Realtime subscriptions (public game state, events) replace-not-merge
- [ ] Player's private hand fetch endpoint
- [ ] Reconnect: refresh restores game, presence shows reconnecting
- **Acceptance:** full turn cycle works live across two clients; refresh recovers state.

## Phase 6 — Complete rules

- [ ] Pick Two / Pick Three stacking + mixed-penalty rejection
- [ ] Hold On, Suspension, General Market, Whot shape selection
- [ ] Last Card / Check Up declarations + penalties
- [ ] Double decking (disabled by default)
- [ ] Direction change (disabled by default)
- [ ] Turn timer: deadline stored server-side, resolved on next interaction
      (see docs/ARCHITECTURE.md § Timer for the serverless limitation + optional
      Supabase scheduled-function design)
- [ ] Market reshuffle preserving top card and player hands
- [ ] Forfeit / disconnect handling
- **Acceptance:** engine unit tests cover every rule combination; manual playtest.

## Phase 7 — Match system

- [ ] Round-end summary (winner, card counts, scores)
- [ ] Best-of match scoring across rounds
- [ ] Rematch voting + match champion screen
- **Acceptance:** a best-of-3 match completes and a rematch starts a fresh round.

## Phase 8 — Polish

- [ ] Mobile-first responsive table layout, landscape/portrait
- [ ] CSS animations (deal/draw/play/effects), `prefers-reduced-motion` respected
- [ ] Optional sound effects (works muted)
- [ ] Accessibility: ARIA labels, keyboard nav, focus states, shape text alternatives
- [ ] PWA manifest, icons, offline shell for landing/reconnect only
- [ ] Friendly error states for every case in spec §15
- **Acceptance:** Lighthouse a11y pass on key screens; installable PWA.

## Phase 9 — QA

- [ ] Security tests (opponent hand never leaks, non-member room access denied)
- [ ] Integration tests (create → join → ready → start → play → reconnect → rematch)
- [ ] Playwright two-browser-context E2E (full scenario, spec §16)
- [ ] `pnpm build` production build verification
- [ ] No debug/mock code left in place
- **Acceptance:** full command chain in README §"Running tests" passes locally.

## Phase 10 — CI + deployment

- [x] GitHub Actions: install, format check, lint, typecheck, unit tests, build, docker build
- [x] Multi-stage `Dockerfile` (standalone output), `.dockerignore`, `/api/health`
- [x] `compose.yaml` for local dev/integration only (not required for prod)
- [ ] README with exact Supabase + Coolify steps
- [x] Production env validation (build-time vs runtime vars documented)
- **Acceptance:** `docker build` + `docker run` serve the app locally and `/api/health` returns 200.
  **Verified** at the end of Phase 2 against the current (pre-Supabase) app state — image builds,
  container runs as non-root on 0.0.0.0:3000, health check returns 200 with security headers.
  Will re-verify once Supabase wiring lands. Actual Coolify deployment requires the user's own
  Coolify instance/account — documented as a manual step, not claimed as completed by this session
  unless a live URL is verified.

---

See the final response in-conversation for the honest completion status of each item above,
including anything that could not be verified without user-provided credentials (hosted Supabase
project, Coolify instance, custom domain).
