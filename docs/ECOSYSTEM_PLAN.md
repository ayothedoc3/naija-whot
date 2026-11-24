# Ecosystem Plan: from Naija Whot to Oya!

Status: plan only. Nothing in this document is built yet except milestone M0.
Owner: Ayo (ayothedoc3). Written 24 November 2026.

This is the handoff document for the next engineer or coding agent. Read it
together with `CLAUDE.md` (architecture rules), `docs/ARCHITECTURE.md` and
`docs/GAME_RULES.md`. Where this plan and `CLAUDE.md` disagree, `CLAUDE.md` wins
and this plan should be corrected.

## 1. Where things stand

- The repo is a working, deployed, real-time multiplayer Whot game: Next.js App
  Router, TypeScript, Supabase (Postgres, anonymous auth, Realtime), Docker on
  Coolify.
- The rules engine in `src/lib/game-engine/` is pure TypeScript with its own
  test suite and no Supabase, Next.js or React imports.
- Rooms are temporary (they expire after 24 hours) and hold 2 to 4 players.
- Background music is back in the repo as of M0 (see section 7).

### A constraint on how this gets built

A version of this ecosystem was prototyped in a separate hosted workspace on a
SQLite backend. That code is not in this repository, is not available, and must
not be copied or reconstructed from memory or screenshots. Everything here is
built fresh on this codebase and its Supabase backend. Ideas and product
direction come from the owner; implementation starts from this repo.

## 2. Product vision

Oya! is a private space for two partners, built for long-distance couples. One
partner creates a space, the other joins with an invite, and the space is
permanent. Inside it they find:

- Games to play together, live or one move at a time across time zones.
- Small daily rituals that take a minute, such as a question both answer.
- Shared things that build up over time: plans, countdowns, a timeline.

Naija Whot stays the flagship game and keeps working as a standalone 2 to 4
player room game for friends. The hub is added alongside it, not instead of it.

## 3. Decisions already made

| Decision        | Choice                              | Why                                                                                  |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Backend         | Keep Supabase                       | Already deployed. Auth, Realtime and row level security already work and are tested. |
| Hosting         | Keep Docker on Coolify              | No change.                                                                           |
| Source of truth | Server only, as today               | Rule 1 in `CLAUDE.md`. Applies to every new activity.                                |
| Realtime        | Notification channel only, as today | Rule 5 in `CLAUDE.md`. Clients refetch sanitized state.                              |
| Package manager | pnpm, as pinned in `package.json`   | No change.                                                                           |
| Migrations      | Additive only, numbered from `0010` | Never edit an applied migration.                                                     |

## 4. Architecture: what has to change

Today the database and routes are shaped around one game. Three things need to
become general. Do them in this order, because each is safe to ship alone.

### 4.1 An activity interface

Create `src/lib/activities/` with a small contract that every game or ritual
implements. Sketch, to be refined during M1:

```ts
interface ActivityDefinition<State, Action, PublicState, PrivateView> {
  id: string; // "whot", "ayo", "question-of-the-day"
  name: string;
  minPlayers: number;
  maxPlayers: number;
  pace: "live" | "turns" | "daily";
  actionSchema: ZodType<Action>;
  create(params: CreateParams): State;
  apply(state: State, action: Action, ctx: ActionContext): ActionResult<State>;
  toPublicState(state: State): PublicState;
  toPrivateView(state: State, userId: string): PrivateView;
  isFinished(state: State): boolean;
}
```

Rules for the interface:

- Activities are pure. No I/O, no clock reads, no randomness except through
  values passed in by the host (seed, now). This keeps them testable and
  replayable.
- `toPublicState` must never contain anything a player should not see. For
  Whot that is other hands. For sealed-answer activities that is any answer
  before both partners have answered.
- The existing Whot engine is wrapped by an adapter. Do not rewrite it and do
  not move rule logic.

### 4.2 Generic persistence

Add tables that mirror today's `games` family but are keyed by activity type:

- `activity_sessions`: id, owner scope (room or space), `activity_type`,
  status, `public_state`, `state_version`, `turn_deadline`, timestamps.
- `activity_secret_states`: canonical state, service role only, no client
  policies.
- `activity_events`: ordered log with `(session_id, sequence_number)` unique.
- `processed_activity_actions`: the replay guard, `(session_id, action_id)`
  primary key.
- `commit_activity_transition(...)`: same contract as
  `commit_game_transition`, including the version check.

Row level security follows the existing pattern: members of the owning room or
space may select `activity_sessions` and `activity_events`; nobody but the
service role touches the other two.

Whot moves onto these tables through its adapter. The old `games` tables stay
until Whot has run on the new ones in production without issue, then a later
migration retires them. Do not drop anything in the same release that
introduces its replacement.

### 4.3 Spaces

Rooms are temporary and multi-player. Couples need something permanent.

- `spaces`: id, invite code, created_at. Exactly two members once paired.
- `space_members`: space_id, user_id, display_name, joined_at.
- `is_space_member(space_id, user_id)` security definer function, same
  approach as `is_room_member`.
- An invite is single use once the second partner joins.

Identity is the hard part here. The app uses anonymous auth, so a partner who
clears their browser or changes phone loses their identity and with it the
space. Before spaces ship to real users, anonymous users need a way to upgrade
to a permanent login (for example email) while keeping the same user id.
Supabase supports converting an anonymous user to a permanent one; check the
current Supabase documentation for the exact API before designing this, do not
rely on memory.

### 4.4 Generic routes

- `POST /api/activities/[sessionId]/actions`: authenticate, check membership,
  rate limit, validate with the activity's schema, apply, commit. Same shape
  as today's game action route.
- `GET /api/activities/[sessionId]/view`: returns public state plus the
  caller's private view.
- Existing `/api/games/...` routes keep working until the Whot client has
  moved over, then they are removed.

### 4.5 A contract test suite

One shared test file that runs against every registered activity:

- Determinism: same seed and same actions give the same state.
- Privacy: across many random playthroughs, the public state and each
  player's private view never contain another player's secrets.
- Idempotency: a repeated action id is not applied twice.
- Version conflict: a stale `expectedVersion` is rejected.
- Serialization: state survives a JSON round trip unchanged.
- Termination: random legal play always reaches a finished state.

A new activity is not done until it passes this suite unchanged.

## 5. Milestones

One pull request per milestone where possible. Each lists what "done" means.

### M0. Housekeeping (done in the PR that adds this plan)

- Background music file, its licence note and its packaging test restored.
- This plan added.

### M1. Activity interface and Whot adapter

- `src/lib/activities/` with the interface, a registry, and a Whot adapter
  around the existing engine.
- Contract test suite written and passing for Whot.
- No database, route or UI changes. No behaviour change.
- Done when: all existing tests pass untouched, the contract suite passes,
  and `pnpm lint && pnpm typecheck && pnpm build` are clean.

### M2. Generic persistence and routes

- Migrations `0010` onward for the tables and function in 4.2.
- Generic action and view routes from 4.4.
- Whot runs on the new tables behind the adapter.
- Security integration tests extended to the new tables.
- Done when: `pnpm test:integration` and the full Playwright suite pass
  against local Supabase, and a two-browser Whot match plays end to end on the
  new tables.

### M3. Spaces and the home screen

- Tables and policies from 4.3, pairing by invite.
- Account upgrade from anonymous to permanent login.
- Home screen: partner card with online status, ongoing sessions, a "your
  move" marker, a list of activities to start.
- Done when: two browser contexts can pair, start a Whot match from the
  space, leave, return the next day and find it; and a partner who upgrades
  their account and signs in on a second browser context sees the same space.

### M4. Ayò

- The Yoruba sowing game as the second activity. It is the opposite of Whot:
  open information, no luck, and it suits one move at a time across time
  zones.
- Rules written up in `docs/` before coding, including the capture rule, the
  rule about leaving the opponent with seeds, and how a game ends. Variants
  differ, so the owner confirms the variant first.
- Done when: the contract suite passes, a full game plays in two browsers,
  and switching between an Ayò match and a Whot match loses nothing.

### M5. Sealed-answer rituals

- Question of the day and How well do you know me.
- An answer is hidden from the partner until both have answered. This is
  enforced in `toPublicState` and covered by a test that goes through the
  real route and the Realtime path, not only the pure function.
- Question content is original or openly licensed.
- Done when: the privacy contract tests pass and an end-to-end test proves a
  partner's browser never receives a sealed answer early.

### M6. More games

- Ludo (dice rolled on the server), Draughts, Naija trivia. Order to be set
  by the owner. Each follows the M4 pattern: rules document, activity,
  contract suite, UI, end-to-end test.

### M7. Shared things

- Countdowns, shared plans list, timeline of finished games and moments.
- These are not turn-based. Decide during design whether they fit the
  activity interface or are plain tables with row level security. Prefer the
  simpler option.

### M8. Sound, notifications and polish

- Sound effects and music for new activities, with the existing preference
  toggles.
- "Your move" notifications. Web push needs a service worker and permission
  flow; scope this separately.
- Drag a card onto the pile to play it, in addition to the Play button.

### Later, not scheduled

- Offline play with a queue that syncs on reconnect.
- A shared Bible reading plan (3, 6 or 12 months). Only a public domain
  translation may be bundled, such as the World English Bible or King James
  Version.
- Draw and guess.
- Date night with voice or video.

## 6. Open decisions for the owner

1. Name and branding: does the product become Oya! with Naija Whot as a game
   inside it, or stay Naija Whot with a couples mode?
2. Do temporary multi-player rooms stay available to people who are not in a
   couple space?
3. Which permanent login: email link, email and password, phone, or social?
4. Which Ayò variant?
5. Order of the games in M6.
6. Is the product for the owner and partner only, or for other couples too?
   The second changes hosting, privacy policy and moderation needs.

## 7. Assets and licences

- `public/audio/music/game-table.mp3` is under the Pixabay Content License,
  not the repository's MIT licence. Details are in
  `docs/audio-licenses/game-table-music.md`. Keep that note next to any new
  audio and record the source of every asset added.
- Do not add art, sound or fonts taken from commercial games or apps.

## 8. How to work in this repo

- Local development needs Docker for `supabase start`. See the README.
- After every change: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Database or route changes also need `pnpm test:integration` and `pnpm e2e`.
- Regenerate types after a migration with `pnpm supabase:types`.
- Never weaken a row level security policy to make a test pass.
- Never send canonical or sealed state to a browser.
- Update `TASKS.md` as milestones complete.

## 9. First task for the next agent

Start M1 and nothing else.

1. Read `src/lib/game-engine/types.ts`, `reducer.ts` and `public-state.ts`.
2. Propose the final `ActivityDefinition` types in a short note in the pull
   request description, including how `ActionContext` and the Whot
   `ActionResult` map onto it. Wait for the owner's approval if anything in
   the sketch in 4.1 does not fit.
3. Add `src/lib/activities/types.ts`, `registry.ts` and `whot/adapter.ts`.
4. Add `src/lib/activities/__tests__/contract.test.ts` covering the six
   properties in 4.5, running against every registered activity.
5. Run the full check from section 8. No existing test may change.
6. Open a pull request titled "M1: activity interface and Whot adapter".
