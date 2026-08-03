import { NextResponse } from "next/server";
import type { GameErrorCode } from "@/lib/game-engine/errors";

export type AppErrorCode =
  | GameErrorCode
  | "ROOM_NOT_FOUND"
  | "ROOM_EXPIRED"
  | "ROOM_FULL"
  | "ALREADY_JOINED"
  | "INVALID_NICKNAME"
  | "UNAUTHENTICATED"
  | "NOT_ROOM_HOST"
  | "NOT_ROOM_MEMBER"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Partial<Record<AppErrorCode, number>> = {
  // Lobby/room errors
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  ALREADY_JOINED: 409,
  INVALID_NICKNAME: 400,
  UNAUTHENTICATED: 401,
  NOT_ROOM_HOST: 403,
  NOT_ROOM_MEMBER: 403,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  // Game engine errors (src/lib/game-engine/errors.ts)
  NOT_YOUR_TURN: 409,
  GAME_NOT_IN_PROGRESS: 409,
  GAME_ALREADY_ENDED: 409,
  NOT_ENOUGH_PLAYERS: 400,
  ALREADY_STARTED: 409,
  CARD_NOT_IN_HAND: 400,
  NO_CARDS_SELECTED: 400,
  DUPLICATE_CARD_SELECTED: 400,
  MULTI_PLAY_NUMBER_MISMATCH: 400,
  DOUBLE_DECKING_DISABLED: 400,
  ILLEGAL_CARD: 422,
  MUST_DEFEND_OR_ACCEPT_PENALTY: 422,
  MIXED_PENALTY_DEFENSE: 422,
  NO_PENDING_PENALTY: 400,
  MISSING_SHAPE_SELECTION: 400,
  INVALID_SHAPE_SELECTION: 400,
  UNEXPECTED_SHAPE_SELECTION: 400,
  RULE_DISABLED: 400,
  VERSION_CONFLICT: 409,
  DUPLICATE_ACTION: 409,
  UNKNOWN_PLAYER: 403,
  PLAYER_ALREADY_FORFEITED: 409,
  CANNOT_LEAVE_DURING_ROUND: 409,
  REMATCH_NOT_UNANIMOUS: 409,
  NO_ACTIVE_PENALTY_TO_ACCEPT: 400,
  TIMEOUT_NOT_YET_DUE: 409,
  INVALID_ACTION_FOR_STATUS: 409,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function errorJson(code: AppErrorCode, message: string, status?: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status: status ?? STATUS_BY_CODE[code] ?? 400 },
  );
}

export function okJson<T extends object>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
