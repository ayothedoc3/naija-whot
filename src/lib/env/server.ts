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
  SENTRY_DSN: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
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

let cachedServerEnv: ServerEnv | undefined;

// Validated lazily, on first property access, rather than at module import
// time. `next build`'s page-data-collection step imports every route
// module to read its static config (e.g. `export const dynamic`) without
// ever calling the handler — an eager `parse()` here would fail that step
// on any machine that doesn't have runtime-only secrets set at build time
// (which, per this project's own security model, is every build machine).
// The validation still throws immediately the first time a request handler
// actually reads a value, so a missing var is still caught on the first
// real request rather than silently producing `undefined`.
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop, receiver) {
    cachedServerEnv ??= loadServerEnv();
    return Reflect.get(cachedServerEnv, prop, receiver);
  },
});
