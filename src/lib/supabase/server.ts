import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env/client";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client scoped to the current request's cookies, so
 * `auth.uid()` in RLS policies resolves to the actual signed-in user. Used
 * in Server Components and Route Handlers — never carries the service-role
 * key, so it is bound by the same RLS policies as the browser client.
 */
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written. Safe to ignore — middleware/route handlers refresh the
            // session on the next request that actually can set cookies.
          }
        },
      },
    },
  );
}
