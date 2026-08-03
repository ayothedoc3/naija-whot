import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env/client";

/**
 * Refreshes the Supabase auth cookie on every matched request. This is
 * Next.js 16's "Proxy" convention (the renamed successor to Middleware —
 * same runtime, same file-based hook, just moved from middleware.ts to
 * proxy.ts with an exported `proxy` function). Required by @supabase/ssr's
 * Next.js App Router pattern — without this, sessions can appear to
 * randomly log out because the access token expires and nothing else in
 * the request lifecycle refreshes it. Keep logic between
 * `createServerClient` and `getUser()` to a minimum (per Supabase's own
 * guidance) since subtle bugs here are easy to introduce and hard to debug.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
