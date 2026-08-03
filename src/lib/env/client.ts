import { z } from "zod";

/**
 * Public environment variables only. Next.js inlines `NEXT_PUBLIC_*` values at
 * build time, so each one must be referenced as a static `process.env.X`
 * member expression below — never through a dynamic key.
 *
 * Deliberately NOT guarded with the `client-only` package: these values are
 * non-secret by design and are read from server contexts too (Server
 * Components, Route Handlers, and Edge Middleware all need
 * NEXT_PUBLIC_SUPABASE_URL, for example). `server.ts` in this folder is the
 * one guarded with `server-only`, for the values that actually are secret.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_ENABLE_DEV_FIXTURES: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

function loadClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_ENABLE_DEV_FIXTURES: process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}\n\nCopy .env.example to .env.local and fill in real values.`,
    );
  }

  return parsed.data;
}

export const clientEnv = loadClientEnv();

// Deliberately NOT also gated on `process.env.NODE_ENV !== "production"`
// here: Next.js always sets NODE_ENV=production for any optimized build
// (including a local `next build && next start` used to test against a
// production-parity server), so that check would make fixtures
// unreachable in every built environment, not just a real deployment. The
// explicit NEXT_PUBLIC_ENABLE_DEV_FIXTURES flag — which a real production
// deployment's env vars must simply never set, per .env.example and
// docs/DEPLOYMENT.md — is the actual safety boundary, checked again
// server-side (independently of this client value) in the fixture route
// itself. This constant only controls a cosmetic "DEV FIXTURES ON" badge.
export const isDevFixturesEnabled = clientEnv.NEXT_PUBLIC_ENABLE_DEV_FIXTURES;
