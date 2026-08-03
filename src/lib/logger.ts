import "server-only";
import { serverEnv } from "@/lib/env/server";

/**
 * Structured server logging. Each event's fields are an explicit allowlist —
 * there is no path for a caller to accidentally pass along a full hand,
 * deck order, auth token, or service-role key, because those fields simply
 * don't exist on any of these types. Never widen these with a catch-all
 * `meta: Record<string, unknown>` field; add a named field instead.
 */
export type LogEvent =
  | { event: "room_created"; roomId: string; hostUserId: string; maxPlayers: number }
  | { event: "player_joined"; roomId: string; userId: string; seatNumber: number }
  | { event: "player_left_lobby"; roomId: string; userId: string; reason: "left" | "kicked" }
  | { event: "game_started"; gameId: string; roomId: string; playerCount: number }
  | {
      event: "action_accepted";
      gameId: string;
      actionType: string;
      actorUserId: string;
      resultingVersion: number;
    }
  | {
      event: "action_rejected";
      gameId: string;
      actionType: string;
      actorUserId: string;
      errorCode: string;
    }
  | {
      event: "version_conflict";
      gameId: string;
      actorUserId: string;
      expectedVersion: number;
      actualVersion: number;
    }
  | { event: "reconnection"; roomId: string; userId: string }
  | { event: "round_completed"; gameId: string; winnerUserId: string; roundNumber: number }
  | { event: "match_completed"; gameId: string; winnerUserId: string }
  | { event: "unexpected_engine_error"; gameId: string; actionType: string; message: string };

export function logEvent(entry: LogEvent): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  if (entry.event === "unexpected_engine_error" || entry.event === "action_rejected") {
    console.error(line);
  } else {
    // Sanctioned structured-logging call site — info-level events are
    // expected to go through here rather than being silenced entirely.
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

/**
 * Optional Sentry hook. Not required for local development — with no
 * SENTRY_DSN configured this is a no-op. To enable in production: run
 * `pnpm add @sentry/nextjs`, follow its setup wizard, and replace the body
 * of this function with `Sentry.captureException(error, { extra: context })`.
 */
export function captureException(error: unknown, context?: Record<string, string | number>): void {
  if (!serverEnv.SENTRY_DSN) return;
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: "unhandled_exception",
      message: error instanceof Error ? error.message : String(error),
      ...context,
    }),
  );
}
