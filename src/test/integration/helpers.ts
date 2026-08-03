import { createClient } from "@supabase/supabase-js";

/**
 * Local Supabase (`supabase start`) always uses these same well-known demo
 * keys regardless of project — they are not a secret, and are only used as
 * a fallback so `pnpm test:integration` works without extra setup once the
 * local stack is running. A real project's keys are never hardcoded.
 */
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? LOCAL_URL;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY;

export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

export function serviceRoleClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export async function signInNewAnonymousUser(nickname: string) {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously({ options: { data: { nickname } } });
  if (error || !data.user) {
    throw new Error(`Failed to sign in anonymously: ${error?.message}`);
  }
  return { client, user: data.user };
}

/** Generates a fresh, valid-looking 6-char room code per test to avoid collisions. */
export function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
