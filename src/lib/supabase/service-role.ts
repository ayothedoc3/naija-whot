import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import type { Database } from "./database.types";

let serviceRoleClient: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Full-access client using the service-role key, which bypasses Row Level
 * Security entirely. Only ever call this from server-only code that has
 * already authenticated the caller and checked room/game membership itself
 * (route handlers under src/app/api/**) — never from a Server Component
 * that renders data straight to a page, and never anywhere reachable from
 * client code (the `server-only` import above makes that a build error).
 */
export function getServiceRoleClient() {
  serviceRoleClient ??= createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return serviceRoleClient;
}
