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

export const isDevFixturesEnabled =
  clientEnv.NEXT_PUBLIC_ENABLE_DEV_FIXTURES && process.env.NODE_ENV !== "production";
