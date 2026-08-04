/**
 * Domain error codes for the game engine. Every rejection the engine can
 * produce is one of these, so route handlers can map to consistent HTTP
 * status codes and the UI can show a friendly, specific message.
 */
export type GameErrorCode =
  | "NOT_YOUR_TURN"
  | "GAME_NOT_IN_PROGRESS"
  | "GAME_ALREADY_ENDED"
  | "NOT_ENOUGH_PLAYERS"
  | "ALREADY_STARTED"
  | "CARD_NOT_IN_HAND"
  | "NO_CARDS_SELECTED"
  | "DUPLICATE_CARD_SELECTED"
  | "MULTI_PLAY_NUMBER_MISMATCH"
  | "MULTI_CARD_PLAY_DISABLED"
  | "DOUBLE_DECKING_DISABLED"
  | "PENALTY_STACKING_DISABLED"
  | "ILLEGAL_CARD"
  | "MUST_DEFEND_OR_ACCEPT_PENALTY"
  | "MIXED_PENALTY_DEFENSE"
  | "NO_PENDING_PENALTY"
  | "MISSING_SHAPE_SELECTION"
  | "INVALID_SHAPE_SELECTION"
  | "UNEXPECTED_SHAPE_SELECTION"
  | "RULE_DISABLED"
  | "VERSION_CONFLICT"
  | "DUPLICATE_ACTION"
  | "UNKNOWN_PLAYER"
  | "PLAYER_ALREADY_FORFEITED"
  | "CANNOT_LEAVE_DURING_ROUND"
  | "REMATCH_NOT_UNANIMOUS"
  | "NO_ACTIVE_PENALTY_TO_ACCEPT"
  | "TIMEOUT_NOT_YET_DUE"
  | "INVALID_ACTION_FOR_STATUS";

export class GameEngineError extends Error {
  readonly code: GameErrorCode;
  readonly meta?: Record<string, unknown>;

  constructor(code: GameErrorCode, message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "GameEngineError";
    this.code = code;
    this.meta = meta;
  }
}

export function gameError(
  code: GameErrorCode,
  message: string,
  meta?: Record<string, unknown>,
): GameEngineError {
  return new GameEngineError(code, message, meta);
}
