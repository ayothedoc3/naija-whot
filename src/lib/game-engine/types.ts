import type { Card, RequestableShape, Shape } from "./cards";
import type { RuleConfig } from "./rules";
import type { GameEngineError } from "./errors";
import type { ShuffleFn } from "./deck";

export type GameStatus = "not_started" | "in_progress" | "round_over" | "match_over";

export interface PlayerState {
  userId: string;
  seatIndex: number;
  hand: Card[];
  forfeited: boolean;
  /** "Last Card" declared, armed and waiting for the qualifying 2-cards-to-1 play. */
  lastCardArmed: boolean;
  /** "Check Up" declared, armed and waiting for the qualifying final-card play. */
  checkUpArmed: boolean;
  requestedRematch: boolean;
}

export type PendingPenaltyType = "pickTwo" | "pickThree";

export interface PendingPenalty {
  type: PendingPenaltyType;
  amount: number;
  /** The card number that can defend this penalty: 2 for pickTwo, 5 for pickThree. */
  defendingNumber: number;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  ruleConfig: RuleConfig;
  /** Seat order is the array order; never reordered after creation. */
  players: PlayerState[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  /** Draw pile. Last element is drawn first (array-as-stack). */
  market: Card[];
  /** Discard pile. Last element is the top (currently active) card. */
  discardPile: Card[];
  activeShape: Shape;
  pendingPenalty: PendingPenalty | null;
  /** Epoch ms deadline for the current turn, or null when no timer is configured. */
  turnDeadline: number | null;
  roundNumber: number;
  /** userId -> rounds won so far in this match. */
  matchScores: Record<string, number>;
  roundWinnerUserId: string | null;
  matchWinnerUserId: string | null;
  stateVersion: number;
  /** Bounded ring buffer of recently processed action ids (defense in depth; the
   *  database's unique constraint on processed_game_actions is authoritative). */
  recentActionIds: string[];
  /** Seat index that started the most recently dealt round, for fair rotation. */
  lastRoundStarterSeatIndex: number | null;
}

export interface ActionEnvelope {
  actionId: string;
  expectedVersion: number;
}

export type DeclarationFlags = {
  declareLastCard?: boolean;
  declareCheckUp?: boolean;
  /** Only meaningful when playing a 2 or 5 with directionChangeOnPenalty enabled. */
  reverseDirection?: boolean;
};

export type GameAction =
  | (ActionEnvelope & { type: "start_game" })
  | (ActionEnvelope &
      DeclarationFlags & { type: "play_card"; cardId: string; chosenShape?: RequestableShape })
  | (ActionEnvelope &
      DeclarationFlags & {
        type: "play_multi";
        cardIds: string[];
        chosenShape?: RequestableShape;
      })
  | (ActionEnvelope & { type: "draw_card" })
  | (ActionEnvelope & { type: "accept_penalty" })
  | (ActionEnvelope & { type: "declare_last_card" })
  | (ActionEnvelope & { type: "declare_check_up" })
  | (ActionEnvelope & { type: "leave_game" })
  | (ActionEnvelope & { type: "forfeit" })
  | (ActionEnvelope & { type: "resolve_timeout" })
  | (ActionEnvelope & { type: "request_rematch" })
  | (ActionEnvelope & { type: "start_rematch" });

export type GameActionType = GameAction["type"];

export type GameEvent =
  | { type: "game_started"; roundNumber: number; startingPlayerUserId: string }
  | { type: "card_played"; actorUserId: string; cardIds: string[]; resultingShape: Shape }
  | { type: "card_drawn"; actorUserId: string; count: number; voluntary: boolean }
  | {
      type: "penalty_applied";
      targetUserId: string;
      penaltyType: PendingPenaltyType;
      amount: number;
    }
  | {
      type: "penalty_defended";
      actorUserId: string;
      penaltyType: PendingPenaltyType;
      newAmount: number;
    }
  | { type: "hold_on"; actorUserId: string }
  | { type: "suspension"; actorUserId: string; skippedUserId: string }
  | { type: "general_market"; actorUserId: string; affectedUserIds: string[] }
  | { type: "shape_chosen"; actorUserId: string; shape: RequestableShape }
  | { type: "last_card_declared"; actorUserId: string }
  | { type: "last_card_penalty"; actorUserId: string }
  | { type: "check_up_declared"; actorUserId: string }
  | { type: "check_up_penalty"; actorUserId: string }
  | { type: "market_reshuffled"; cardsMoved: number }
  | { type: "direction_reversed"; actorUserId: string }
  | { type: "turn_timeout"; previousPlayerUserId: string; drewCount: number }
  | { type: "player_forfeited"; userId: string }
  | { type: "player_left"; userId: string }
  | {
      type: "round_over";
      winnerUserId: string;
      remainingCardScores: Record<string, number>;
    }
  | { type: "match_over"; winnerUserId: string }
  | { type: "rematch_requested"; userId: string }
  | { type: "rematch_started"; roundNumber: number };

export interface ActionContext {
  actingUserId: string;
  now: number;
  /** Injected shuffle source; defaults to a cryptographically secure shuffle. */
  shuffle?: ShuffleFn;
}

export interface ActionSuccess {
  ok: true;
  state: GameState;
  events: GameEvent[];
}

export interface ActionFailure {
  ok: false;
  error: GameEngineError;
}

export type ActionResult = ActionSuccess | ActionFailure;

export type { Card, Shape, RequestableShape };
