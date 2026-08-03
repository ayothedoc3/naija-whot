# Deployment

Production target: **Coolify**, deploying a Docker image built from the
repository `Dockerfile`. Vercel is not used.

## Overview

```
GitHub repository ──push──▶ Coolify (Dockerfile build pack) ──▶ container on your server
                                                                     │
                                                                     ▼
                                                        Supabase (managed, separate)
```

The Next.js container is stateless — it holds no authoritative game data, no
uploaded files, no session storage on disk. All durable state lives in
Supabase Postgres. This means the container can be restarted, redeployed, or
scaled to N identical replicas at any time without losing an in-progress
game.

## 1. Supabase (do this first)

1. Create a project at supabase.com (or self-host — see § Optional
   self-hosted Supabase below).
2. Authentication → Providers → enable **Anonymous Sign-ins**.
3. Authentication → URL Configuration → add your production URL (e.g.
   `https://whot.example.com`) and `http://localhost:3000` to **Redirect
   URLs** / **Site URL** as needed.
4. Database → run the migrations in `supabase/migrations/` in order (see
   README "Running migrations" for the exact CLI commands) against this
   project using `supabase link` + `supabase db push`.
5. Database → Replication → enable Realtime for `rooms`, `room_members`,
   `games`, `game_events` (the migrations also do this via
   `ALTER PUBLICATION supabase_realtime ADD TABLE ...`, but verify it in the
   dashboard).
6. Settings → API → copy the **Project URL**, **anon public key**, and
   **service_role key** (keep the service-role key secret — it never goes in
   `NEXT_PUBLIC_*`).
7. (Recommended for production) Set up Cloudflare Turnstile
   (turnstile.cloudflare.com), create a widget, and copy the site key +
   secret key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
   This is optional for local dev (leave blank to disable).

## 2. Environment variables

See `.env.example` for the full annotated list. Split by when they're needed:

**Required at Docker _build_ time** (embedded into the JS bundle — Next.js
inlines `NEXT_PUBLIC_*` values during `next build`):

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optional, blank disables Turnstile)
- `NEXT_PUBLIC_ENABLE_DEV_FIXTURES` (must be `false`/unset in production)

Pass these as Docker **build arguments** (see `Dockerfile` `ARG`/`ENV` pairs)
— in Coolify, set them under the application's **Build Variables**, not just
runtime variables, or the compiled bundle will contain empty values.

**Required only at container _runtime_** (never baked into the image):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DATABASE_URL` (only needed if you run one-off scripts against the
  DB outside the Supabase CLI; not required for the app to serve requests)
- `TURNSTILE_SECRET_KEY` (optional)
- `SENTRY_DSN` (optional)

Set these under Coolify's **Runtime Environment Variables**. `src/lib/env/`
validates all of this with Zod at boot and fails fast with a clear message if
a required variable is missing — see that folder for exactly which variables
are required in which `NODE_ENV`.

## 3. Local Docker build/run verification

Run this before trusting a Coolify deploy:

```bash
cp .env.example .env.local   # fill in your local Supabase values
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key> \
  -t naija-whot .
docker run --rm -p 3000:3000 --env-file .env.local naija-whot
curl -i http://localhost:3000/api/health   # expect HTTP 200 {"status":"ok"}
```

## 4. Coolify setup (exact steps)

1. Push the repository to GitHub.
2. Open your Coolify dashboard.
3. **+ New → Application**.
4. Select **GitHub** as the source and pick this repository.
5. Build pack: **Dockerfile**.
6. Root directory: `/` (not a monorepo).
7. Dockerfile location: `/Dockerfile`.
8. Ports: expose **3000**.
9. Health check path: `/api/health`, expected status `200`, port `3000`.
10. Add every **build-time** variable from § 2 under Build Variables.
11. Add every **runtime** variable from § 2 under Runtime/Environment
    Variables.
12. Attach your production domain.
13. Point its DNS `A`/`CNAME` record at your Coolify host as instructed by
    Coolify's domain screen.
14. Enable **HTTPS** (Coolify/Let's Encrypt automatic certificate).
15. Click **Deploy**.
16. Watch the build logs, then the runtime logs, for errors.
17. `curl -i https://your-domain/api/health` → expect `200`.
18. From your phone, open the site and create a room.
19. From a second device (or another network), join with the room code.
20. Confirm both clients update in real time (ready toggle, then in-game).
21. Refresh one client mid-game and confirm it reconnects into the same seat.
22. Play a full round to completion on both devices and confirm they show the
    same winner.
23. In Coolify, enable **automatic deployments** on push to your production
    branch (e.g. `main`) so future pushes redeploy without manual steps.
24. **Rollback:** Coolify keeps previous deployments — use its "Redeploy"
    action on a prior successful deployment to roll back instantly; because
    the container is stateless this never risks game data (that lives in
    Supabase, independent of the app deployment).
25. **Backup responsibility:** the app container needs no backup (stateless).
    Supabase Postgres is the durable store — if self-hosting Supabase,
    configure its own scheduled backups (see below); on managed Supabase,
    use their built-in backup/PITR settings.

## 5. Room expiration & retention (operational)

- `rooms.expires_at` (default: 24h from creation) marks lobby rooms eligible
  for cleanup. Run the cleanup as a scheduled Supabase Edge Function or
  `pg_cron` job calling the `cleanup_expired_rooms()` SQL function from
  migration `0007_cleanup.sql` — documented inline in that migration.
- `game_events` retention default: 7 days after a game reaches
  `match_over`, via the same scheduled job (`cleanup_old_game_events()`).
- These are SQL functions checked into migrations; wiring the schedule itself
  (Supabase Dashboard → Database → Cron, or an external scheduler hitting a
  protected route) is a manual step left to the operator, since it depends on
  your Supabase plan/self-hosting choice.

## 6. GitHub Actions

`.github/workflows/ci.yml` runs install → format check → lint → typecheck →
unit tests → production `next build` → `docker build` (and Playwright when
`NEXT_PUBLIC_SUPABASE_URL`/service role secrets are available to the runner).
It does **not** deploy — Coolify deploys on push via its own GitHub
integration, independently of this workflow's pass/fail (though you should
treat a red CI run as a signal not to rely on that commit being deployed).

## 7. Optional: self-hosting Supabase on Coolify too

Managed Supabase is the default recommendation above. If you choose to
self-host Supabase instead:

- Deploy it as a **separate** Coolify service/stack from the Next.js app —
  never combine them into one container.
- Use a separate subdomain for the Supabase API (e.g. `supabase.example.com`)
  from the app domain.
- Attach persistent volumes to the Postgres/Storage services (the app
  container itself still needs none).
- Configure real external backups for that Postgres volume — a Coolify
  volume alone is not a backup strategy.
- Put Postgres behind the private network / firewall Coolify provides; do not
  expose port 5432 publicly.
- Rotate every generated secret (JWT secret, anon/service keys, dashboard
  password) away from any documented default.
- Manually set the Auth redirect/site URLs to your real app domain.
- Verify Realtime connectivity from a browser on your real domain (not just
  `localhost`) before relying on it.
- Document your own update/migration and disaster-recovery process for that
  stack — it is now infrastructure you operate, not a managed service.
- Never let an app deployment "reset" or "recreate" that stack's volumes;
  keep the two Coolify services' lifecycles completely independent.
