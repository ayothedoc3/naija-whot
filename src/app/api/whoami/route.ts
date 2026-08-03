import { errorJson, okJson } from "@/lib/api-response";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Returns the caller's own user id. Trivially safe (you can always know
 *  your own identity) and used by tests to target fixture data at the
 *  right player without threading ids through the UI. */
export async function GET() {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return errorJson("UNAUTHENTICATED", "Sign in first.");
  }
  return okJson({ userId: data.user.id });
}
