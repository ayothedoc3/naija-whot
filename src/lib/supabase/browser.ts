"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** One shared browser Supabase client per page load (session persisted via cookies). */
export function getBrowserSupabaseClient() {
  browserClient ??= createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        // Without this, repeated identical GET requests (the same
        // PostgREST URL — e.g. polling `games` by id, or `room_members` by
        // room_id) can be served from the browser's own HTTP cache instead
        // of hitting the network, since fetch()'s default cache mode
        // allows that whenever the response has no explicit no-store
        // directive. That's silently disastrous for authoritative game
        // state: a client can get stuck reading a stale snapshot forever,
        // no matter how many times it "refetches". Every Supabase request
        // from the browser must always hit the network.
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    },
  );
  return browserClient;
}
