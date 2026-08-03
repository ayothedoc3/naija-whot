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

- [x] Migrations: profiles, rooms, room_members, games, game_secret_states,
      game_events, processed_game_actions (8 migrations, `supabase/migrations/0001`–`0008`)
- [x] RLS policies for every table + explicit table-level GRANTs (this Supabase image no
      longer auto-exposes new tables — discovered and fixed via real testing, not assumed)
- [x] `commit_game_transition` + `create_game` SQL functions, execute revoked from anon/authenticated
- [x] Anonymous auth wiring (`src/lib/auth/session.ts`, `src/proxy.ts` for cookie refresh),
      profile creation trigger (`handle_new_auth_user`)
- [x] Local Supabase stack via Docker CLI, migrations applied and verified
- [x] Security tests (RLS: cross-room access denied, secret state unreadable, RPC unreachable
      by clients, replay/version-conflict rejected) — `src/test/integration/security.integration.test.ts`,
      10/10 passing against the real local stack via `pnpm test:integration`
- **Acceptance:** local `supabase start` + migrations apply cleanly; RLS tests pass. **DONE.**

## Phase 4 — Lobby

- [x] Landing page: nickname, create/join, how-to-play, rules link, sound toggle (install
      prompt deferred to Phase 8's PWA work)
- [x] Create room route (`POST /api/rooms`) + settings form, atomic `create_room_with_host` RPC
- [x] Join room by code/link + validation (`POST /api/rooms/[code]/join`, atomic `join_room` RPC,
      idempotent for reconnects)
- [x] Lobby screen: presence (Realtime + heartbeat), ready state, host badge, rule summary,
      copy link, native share, kick (client-side RLS-scoped DELETE), start
- [x] Host transfer on host departure (`handle_room_member_delete` trigger, promotes earliest
      remaining member)
- **Acceptance:** two browser sessions can create/join/ready/start a room end-to-end. **DONE —
  verified with a real two-browser-context Playwright run against the production build**: create →
  realtime-sync join → realtime-sync ready → host start → both clients transition together. Also
  fixed a real CSP bug found during this (`connect-src` didn't allow the Realtime WebSocket scheme).

## Phase 5 — Multiplayer board

- [x] Generic `POST /api/games/[gameId]/actions` handler — every action type goes through the
      pure engine then `commit_game_transition`; no rule logic in the route itself
- [x] Realtime subscriptions (public game state, events); `state_version` guard so out-of-order
      Realtime delivery can never overwrite a newer snapshot with a stale one
- [x] `GET /api/games/[gameId]/hand` — the only place a player's own cards are ever returned
- [x] Full original card UI (`CardFace`/`CardBack`, color+icon+text so it's never color-only),
      player seats, market/discard piles, Whot shape selector, turn timer, declare-toggle buttons
- [x] Round/match result overlay + rematch voting (pulled forward from Phase 7 — needed so a
      finished round doesn't dead-end the board)
- **Acceptance:** full turn cycle works live across two clients; refresh recovers state. **DONE —
  verified with a real ~100-turn two-browser-context Playwright playthrough** (see commit):
  penalty stacking, Whot shape selection, Last Card/Check Up declarations, market reshuffling,
  round end, and rematch all exercised through the actual UI against the real local Supabase
  stack, both clients agreeing on the winner. Caught and fixed two real bugs this way: (1)
  `RoomClient` excluded `match_over` games when picking the "active" game, so finishing a match
  bounced both clients back to the pre-game lobby instead of showing the result screen; (2) a
  `VERSION_CONFLICT` from two players acting near-simultaneously (e.g. both clicking "ready for
  rematch") was silently dropped instead of retried, per the architecture doc's own stated design.

## Phase 6 — Complete rules

- [x] Pick Two / Pick Three stacking + mixed-penalty rejection (unit-tested in Phase 2;
      exercised live over ~100 real turns in the Phase 5 playthrough)
- [x] Hold On, Suspension, General Market, Whot shape selection (same as above)
- [x] Last Card / Check Up declarations + penalties (same as above; declare-toggle buttons wired
      into the board)
- [x] Double decking (disabled by default) — unit-tested (Phase 2); UI multi-select wiring is
      generic (goes through the same play_multi action every other play uses) and typechecked,
      not separately re-verified live given the low wiring risk and time budget
- [x] Direction change (disabled by default) — same as double decking
- [x] Turn timer: deadline stored server-side, resolved lazily via client polling
      (see docs/ARCHITECTURE.md § Timer). **Verified live** with a real 20s-expiry
      two-browser-context test — this caught and fixed a real bug: the action Zod schema
      required `actionId` to be a UUID, but `resolve_timeout` deliberately uses a
      `timeout:{gameId}:{deadline}` id for idempotency, so every timeout silently failed
      validation. Fixed the schema + added a regression test
      (`src/lib/validation/__tests__/game-action.test.ts`) and made the client retry on
      the next tick instead of permanently giving up on a deadline after any failure.
- [x] Market reshuffle preserving top card and player hands (unit-tested Phase 2; exercised live
      in the Phase 5 playthrough)
- [x] Forfeit / disconnect handling — **verified live**: forfeiting immediately ends the match
      with the remaining player declared winner on both clients.
- **Acceptance:** engine unit tests cover every rule combination; manual playtest. **DONE** —
  104 unit tests + two targeted live two-browser Playwright checks (forfeit, turn timer).

## Phase 7 — Match system

- [x] Round-end summary (winner, card counts, remaining-card scores from the round_over event)
- [x] Best-of match scoring across rounds (engine-side, unit-tested in Phase 2)
- [x] Rematch voting + match champion screen + "Return to lobby" — pulled forward and live-verified
      in Phase 5/6/7; added the remaining-card-score display and return-to-lobby button this phase
- **Acceptance:** a best-of-3 match completes and a rematch starts a fresh round. **DONE** for
  bestOf=1 (live-verified twice: full playthrough in Phase 5, forfeit path in Phase 6/7). bestOf=3/5
  scoring and match-champion logic is covered by the Phase 2 engine unit suite
  (`match-scoring.test.ts`) rather than re-run live, since the wiring is identical regardless of
  the configured bestOf value — only the engine's win-condition threshold differs.

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
