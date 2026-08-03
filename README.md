# Naija Whot

Real-time, mobile-first multiplayer Nigerian Whot. No registration — pick a
nickname, create or join a room with a 6-character code, and play. The server
is the only source of truth for game state; see `docs/ARCHITECTURE.md` for why
and `docs/GAME_RULES.md` for the exact rules implemented.

Stack: Next.js (App Router, TypeScript strict) + Supabase (Postgres,
Anonymous Auth, Realtime) + Tailwind v4 + shadcn/ui (Base UI). Deployed as a
Docker container to **Coolify** — not Vercel.

## Table of contents

- [Quick start](#quick-start)
- [Local Supabase setup](#local-supabase-setup)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Running tests](#running-tests)
- [Docker](#docker)
- [Managed Supabase (production) setup](#managed-supabase-production-setup)
- [Database migrations](#database-migrations)
- [GitHub repository setup](#github-repository-setup)
- [Deploying to Coolify](#deploying-to-coolify)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)

## Quick start

Prerequisites: **Node 22**, **pnpm** (version pinned via `packageManager` in
`package.json` — corepack resolves it automatically), and **Docker Desktop**
(for the local Supabase stack).

```bash
git clone https://github.com/ayothedoc3/naija-whot.git
cd naija-whot
pnpm install
pnpm supabase:start        # starts local Postgres + Auth + Realtime + PostgREST
cp .env.example .env.local # then fill in the values `supabase status` prints
pnpm dev
```

Open **http://localhost:3000**. Create a room in one browser tab, open the
room URL in a second (private/incognito) tab or a different browser to join
as a second player.

## Local Supabase setup

The local stack is the Supabase CLI's own Docker-based dev environment — real
Postgres, real Auth, real Realtime, not a mock.

```bash
pnpm supabase:start   # `supabase start` — pulls images on first run, applies
                       # every migration in supabase/migrations/ to a fresh DB
pnpm supabase:status  # if you need to see the values again later: `supabase status`
```

`supabase start` prints (among others) `API URL`, `anon key`, and
`service_role key`. Copy them into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from the output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from the output>
```

These specific local values are the Supabase CLI's well-known demo
credentials — identical on every machine running `supabase start` for any
project, published in the CLI's own source, and **not a secret** (see the
comment in `src/test/integration/helpers.ts`, which hardcodes them as a
fallback for exactly this reason). Never reuse them for a real project.

Useful commands:

```bash
pnpm supabase:reset   # `supabase db reset` — drops and re-applies every migration
pnpm supabase:stop    # `supabase stop` — stops the local containers
pnpm supabase:types   # regenerates src/lib/supabase/database.types.ts from the local schema
```

Studio (a local dashboard UI for the Postgres data) is at
**http://127.0.0.1:54323** while the stack is running.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. Every variable
below is actually read by the code (grep `process.env` in `src/lib/env/` to
verify) — nothing here is unused, and nothing the code reads is undocumented.

| Variable                          | Required?                         | When needed                                                        | Public or private                                                        | Where it's set                                                                                                  |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`             | Required                          | Build time (also read at runtime for metadata)                     | Public — safe in the browser bundle                                      | `.env.local` locally; Coolify **Build Variables**                                                               |
| `NEXT_PUBLIC_SUPABASE_URL`        | Required                          | Build time                                                         | Public — RLS enforces access, not secrecy of the URL                     | `.env.local`; Coolify **Build Variables**                                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Required                          | Build time                                                         | Public — same reasoning as above                                         | `.env.local`; Coolify **Build Variables**                                                                       |
| `NEXT_PUBLIC_ENABLE_DEV_FIXTURES` | Optional, default `false`         | Build time                                                         | Public, but must be `false`/unset in real production — see warning below | `.env.local` (`true` for local E2E); **never set in a real production deploy**                                  |
| `SUPABASE_SERVICE_ROLE_KEY`       | Required                          | Runtime only — never baked into the image                          | **Private** — bypasses RLS entirely                                      | `.env.local`; Coolify **Runtime/Environment Variables** (not Build Variables)                                   |
| `SUPABASE_DATABASE_URL`           | Optional                          | Runtime only, for one-off `psql`/maintenance scripts if you use it | **Private** — contains the DB password                                   | `.env.local` if you need it; not required for the app to serve requests                                         |
| `SENTRY_DSN`                      | Optional, default `""` (disabled) | Runtime only                                                       | Private-by-convention (server-only config)                               | Coolify **Runtime Environment Variables**, once `@sentry/nextjs` is actually wired up (see `src/lib/logger.ts`) |

Notes:

- **Build-time vs runtime matters a lot with Docker.** Next.js inlines every
  `NEXT_PUBLIC_*` value into the JavaScript bundle at `next build` — setting
  one only as a container _runtime_ environment variable does nothing; the
  bundle already has whatever value (or empty string) was present at build
  time. This is why the Dockerfile takes them as `ARG`s. Its defaults are
  local placeholders only so `docker build .` can run as a smoke check;
  Coolify must override them with production values. Conversely,
  `SUPABASE_SERVICE_ROLE_KEY` must **never** be passed as a build argument —
  it would get baked into image layers and potentially into build logs. It is
  read only at request time, inside route handlers that never ship to the
  browser (`src/lib/supabase/service-role.ts`, guarded by the `server-only`
  package, which makes importing it from client code a build error).
- **`NEXT_PUBLIC_ENABLE_DEV_FIXTURES`** gates `POST /api/dev/fixtures/start`,
  a real backdoor that lets a caller force an exact hand/top-card deal instead
  of a random one. It exists solely so the Playwright suite can hit specific
  named scenarios deterministically. It is deliberately **not** gated by
  `NODE_ENV` (Next.js always sets `NODE_ENV=production` for any optimized
  build, including a local one used to test production parity, which would
  make the gate permanently defeat itself). The only thing keeping this route
  closed in a real deployment is this flag being unset — do not set it to
  `true` anywhere outside local dev / CI.
- Two environment variables that used to be plumbed through here — Cloudflare
  Turnstile's site/secret keys — were removed: no Turnstile widget or
  server-side verification call was ever actually implemented, so keeping
  the env vars would have been documentation for a feature that doesn't
  exist. Bot mitigation for anonymous-auth abuse is the rate limiter in
  `src/lib/rate-limit.ts` instead (see `docs/SECURITY.md`).
- `RUN_SUPABASE_INTEGRATION_TESTS=1` is a **test-only** switch (set by the
  `pnpm test:integration` script itself, not something you put in
  `.env.local`) that un-skips `security.integration.test.ts`.

## Running the app

```bash
pnpm dev              # Next.js dev server on http://localhost:3000
pnpm build && pnpm start   # production-mode build + serve, for parity testing
```

## Running tests

```bash
pnpm format:check     # Prettier
pnpm lint             # ESLint
pnpm typecheck         # tsc --noEmit
pnpm test              # Vitest unit tests (game engine, validation, etc.) — no external services needed
pnpm test:integration   # Real RLS/RPC checks against local Supabase — requires `pnpm supabase:start` first
pnpm e2e                # Playwright, two real browser contexts — requires local Supabase running;
                         # builds and boots its own production server (see playwright.config.ts)
pnpm build              # Production Next.js build
```

Run the full chain exactly like CI does (see `.github/workflows/ci.yml`):

```bash
pnpm install --frozen-lockfile
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test
pnpm supabase:start && pnpm test:integration
set -a; source .env.local; set +a   # NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true needed for e2e
pnpm e2e
pnpm build
```

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<your local anon key> \
  -t naija-whot .

docker run --rm -p 3000:3000 --env-file .env.local naija-whot
curl -i http://localhost:3000/api/health   # expect HTTP 200 {"status":"ok"}
```

The image is a non-root, standalone-output, multi-stage build (`node:22-slim`
→ `deps` → `builder` → `runner`), exposes port `3000`, binds `0.0.0.0`, has a
`HEALTHCHECK` against `/api/health`, and contains no `.env*` files (verified
in CI — see the `docker` job's "Assert no .env files baked into image" step).
The app itself holds no state — Postgres is the only durable store, so the
container can be restarted, redeployed, or replaced at any time without
losing an in-progress game.

**Testing the container against local Supabase has a networking wrinkle that
does not exist in real deployment** — see `docs/DEPLOYMENT.md` § 3 for the
exact cause (container network namespace vs. host loopback) and the
`host.docker.internal` workaround. A real deployment talks to a managed
Supabase project over a real HTTPS URL, so this never comes up in practice.

## Managed Supabase (production) setup

The app currently ships configured for **local Supabase only** — there is no
production Supabase project wired up by default. To go to production:

1. Create a project at [supabase.com](https://supabase.com) (or self-host —
   see `docs/DEPLOYMENT.md` § 7 for the additional steps that requires).
2. **Authentication → Providers → Anonymous Sign-ins → Enable.** This app has
   no email/password/OAuth flow at all; without this toggle, nobody can use
   the app.
3. **Authentication → URL Configuration:**
   - **Site URL:** your production URL (e.g. `https://whot.example.com`).
   - **Redirect URLs:** add that same URL and, if you also test against a
     deployed preview/staging URL, add that too. `http://localhost:3000` is
     useful to keep here as well if you ever point a local build at the
     production project.
4. **Database → run the migrations** — see [Database migrations](#database-migrations)
   below.
5. **Database → Replication:** confirm Realtime is enabled for `rooms`,
   `room_members`, `games`, and `game_events`. The migrations already do this
   via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`
   (`supabase/migrations/0006_realtime.sql`), but verify it in the dashboard
   since this is easy to silently lose track of.
6. **Settings → API:** copy the **Project URL**, **anon public key**, and
   **service_role key** into your deployment's environment variables per the
   [Environment variables](#environment-variables) table above.
7. **Database functions and RLS:** nothing further to configure by hand —
   `commit_game_transition`, `create_game`, `create_room_with_host`,
   `join_room`, and every RLS policy are created by the migrations themselves
   with `execute` revoked from `anon`/`authenticated` where appropriate (see
   `docs/DATABASE.md` § Row Level Security and § `commit_game_transition`).
   After migrating, it's worth running `pnpm test:integration` once against
   the production project's credentials (temporarily, locally) to confirm RLS
   really is enforced there the same way it is locally — see
   [Database migrations](#database-migrations) for exactly how to point the
   CLI at it.
8. **Production security verification:** confirm in the dashboard that
   `anon` and `authenticated` roles have no direct `INSERT`/`UPDATE`/`DELETE`
   grant on `games` or `game_secret_states`, and that `EXECUTE` on
   `commit_game_transition`/`create_game` is granted only to `service_role`
   (`supabase/migrations/0005_commit_game_transition.sql`). These are set by
   the migrations; this step is just verifying nothing reverted them.

## Database migrations

Local (already done by `supabase start` on a fresh volume, but idempotent to
re-run):

```bash
pnpm supabase:reset   # supabase db reset — fresh DB, re-applies every migration in order
```

Against a real managed project:

```bash
pnpm exec supabase login                       # opens a browser to authenticate the CLI
pnpm exec supabase link --project-ref <your-project-ref>   # found in the project's Settings → General
pnpm exec supabase db push                      # applies every migration in supabase/migrations/ in order
```

`supabase db push` is safe to re-run — already-applied migrations are
skipped by the CLI's own migration-history tracking. Never hand-edit a
migration that has already shipped to any environment; add a new one.

## GitHub repository setup

This repo is already on GitHub as `ayothedoc3/naija-whot`, `origin` remote,
production branch `main`:

```bash
git remote -v          # confirm origin -> https://github.com/ayothedoc3/naija-whot.git
git push -u origin main
```

For a fresh clone of this project onto a new GitHub account/repo instead:

```bash
gh repo create <owner>/<name> --private --source=. --remote=origin
git push -u origin main
```

Coolify's GitHub App integration (next section) needs read access to
whichever repository you actually deploy from.

## Deploying to Coolify

Full exhaustive walkthrough (including rollback, backups, and self-hosted
Supabase as an alternative): **`docs/DEPLOYMENT.md`**. Summary:

1. **Connect GitHub to Coolify:** Coolify dashboard → Sources (or Settings →
   Sources) → **+ Add** → GitHub App → follow Coolify's install flow to grant
   it access to the `ayothedoc3/naija-whot` repository (or "All repositories"
   if you'd rather not scope it per-repo).
2. **+ New → Application**, pick the GitHub source from step 1, select the
   `naija-whot` repository.
3. **Branch:** `main`.
4. **Build pack:** **Dockerfile**.
5. **Dockerfile location:** `/Dockerfile` (repository root — this is not a
   monorepo).
6. **Ports:** expose **3000** — matches the Dockerfile's `EXPOSE 3000`,
   `ENV PORT=3000`, and `ENV HOSTNAME=0.0.0.0`.
7. **Health check:** path `/api/health`, port `3000`, expected status `200`.
8. **Build Variables:** every `NEXT_PUBLIC_*` variable from the
   [Environment variables](#environment-variables) table — these become
   Docker build args. Getting this wrong (setting them only as runtime vars)
   is the single most common Coolify Next.js deployment mistake; the symptom
   is a deployed app that behaves as if every public env var is empty.
9. **Runtime/Environment Variables:** `SUPABASE_SERVICE_ROLE_KEY` and any
   optional runtime vars (`SUPABASE_DATABASE_URL`, `SENTRY_DSN`). Never put
   these under Build Variables.
10. **Domain:** attach your domain in the application's Domains screen; point
    its DNS `A`/`CNAME` record at your Coolify host as that screen instructs.
11. **HTTPS:** enable it in the same screen — Coolify provisions a Let's
    Encrypt certificate automatically once DNS resolves.
12. **Deploy**, then watch the build logs and the runtime logs for errors.
13. **Automatic deployments:** enable "Auto Deploy" (or equivalent toggle) on
    push to `main` so future pushes redeploy without a manual click.
14. **Rollback:** Coolify retains previous deployments — use "Redeploy" on an
    earlier successful one to roll back instantly. Because the app container
    is stateless (all durable state is in Supabase), a rollback never risks
    losing game data.
15. **Backups:** the app container needs none. Supabase Postgres is the
    durable store — on managed Supabase, use its built-in backup/point-in-time
    recovery settings; if self-hosting Supabase, you own configuring real
    scheduled backups for that Postgres volume (a Coolify volume alone is not
    a backup).

## Troubleshooting

- **Deployed app behaves like env vars are empty / shows a Supabase URL
  error:** a `NEXT_PUBLIC_*` var was set only as a runtime variable, not a
  build variable. Redeploy after adding it under Build Variables — this
  requires a rebuild, not just a container restart.
- **Docker container works via `curl /api/health` but the browser can't
  create a room when testing locally against `supabase start`:** see the
  [Docker](#docker) section above — this is the container-vs-host loopback
  networking mismatch, not an app bug.
- **Local dev shows a CSP `eval()` console error:** only happens in `next
build`-based production-mode testing if you disabled the dev-only CSP
  relaxation in `next.config.ts`; `pnpm dev` itself already allows
  `unsafe-eval` in non-production. If you see it in a real deployment, that's
  a real problem — production's CSP should never need `unsafe-eval`.
- **Dev fixture route returns 404 or "not found" even with
  `NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true` in `.env.local`:** the variable is
  baked in at build time. If you're testing a `next build && next start`
  server (or a Docker image), the value must have been present at _build_
  time, not just when starting the server.
- **`supabase start` fails or hangs:** make sure Docker Desktop is actually
  running first; `supabase start` runs its own Docker Compose stack under the
  hood and needs a working Docker daemon.
- **Realtime updates don't arrive (lobby/board seems stuck) against a custom
  Supabase URL:** check `next.config.ts`'s `Content-Security-Policy` header —
  `connect-src` must include the `ws://`/`wss://` variant of your Supabase
  URL, not just `http(s)://`. This is computed automatically from
  `NEXT_PUBLIC_SUPABASE_URL` already, but if you're pointing at something
  unusual (a proxy, a non-standard port), verify the resulting header in the
  browser's Network tab.
- **A migration errors with "already exists" against a real project:**
  you likely ran raw SQL by hand instead of `supabase db push`. Never hand-run
  migration SQL directly against a project that also uses the CLI's migration
  tracking — it desyncs the two.

## Project structure

See `CLAUDE.md` for the full repository map and non-negotiable architecture
rules (server-authoritative state, no secrets in client bundles, every
action going through the pure engine + `commit_game_transition`, etc.). Deep
dives:

- `docs/PRODUCT_SPEC.md` — what the product does and why
- `docs/GAME_RULES.md` — the exact Nigerian Whot rules implemented
- `docs/ARCHITECTURE.md` — request lifecycle, Realtime channels, reconnection, the dev fixture mode
- `docs/DATABASE.md` — schema, RLS, the `commit_game_transition`/`create_game` functions
- `docs/SECURITY.md` — threat model, authZ, rate limiting
- `docs/DEPLOYMENT.md` — the exhaustive Coolify/Docker/Supabase deployment walkthrough
- `TASKS.md` — phase-by-phase build log with honest completion notes
