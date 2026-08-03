import "server-only";
import { z } from "zod";

/**
 * Server-only environment variables. Importing this module from a client
 * component is a build-time error (via the `server-only` package), and the
 * values here must never be passed into a client component's props.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_DATABASE_URL: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
  SENTRY_DSN: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join(
          "\n",
        )}\n\nSet these in your runtime environment (never NEXT_PUBLIC_*, never .env committed to git).`,
    );
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();

export const isProduction = serverEnv.NODE_ENV === "production";
export const isTurnstileEnabled = serverEnv.TURNSTILE_SECRET_KEY.length > 0;
