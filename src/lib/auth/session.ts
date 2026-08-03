"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { Session, User } from "@supabase/supabase-js";

const NICKNAME_STORAGE_KEY = "naija-whot:nickname";

/** Returns the current session if one exists (persisted via cookies by
 *  @supabase/ssr — surviving a page refresh), without creating a new one. */
export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Ensures the visitor has an authenticated (possibly anonymous) session,
 * creating one via Supabase Anonymous Auth if none exists yet. Safe to call
 * on every page load — it's a no-op once a session is already persisted.
 */
export async function ensureSession(nickname?: string): Promise<{ user: User; session: Session }> {
  const supabase = getBrowserSupabaseClient();
  const existing = await getCurrentSession();
  if (existing) {
    return { user: existing.user, session: existing };
  }

  const { data, error } = await supabase.auth.signInAnonymously(
    nickname ? { options: { data: { nickname } } } : undefined,
  );
  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "Failed to start a session.");
  }
  if (nickname) {
    rememberNickname(nickname);
  }
  return { user: data.user, session: data.session };
}

/** Updates the signed-in user's display name (own row only — enforced by RLS). */
export async function setNickname(nickname: string): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("You need an active session to set a nickname.");
  }
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: nickname })
    .eq("user_id", userData.user.id);
  if (error) throw error;
  rememberNickname(nickname);
}

/** Local-only convenience so the nickname field can be pre-filled after a
 *  refresh; the database row (via RLS, scoped to the owner) is authoritative. */
export function rememberNickname(nickname: string): void {
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
  } catch {
    // localStorage can throw in privacy modes — non-critical, ignore.
  }
}

export function getRememberedNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
