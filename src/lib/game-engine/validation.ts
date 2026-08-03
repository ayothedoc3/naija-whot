import type { Card } from "./cards";
import type { GameState, PendingPenalty, PlayerState } from "./types";

export function getTopCard(state: GameState): Card {
  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) {
    throw new Error("Invariant violated: discard pile is empty");
  }
  return top;
}

export function findCardInHand(player: PlayerState, cardId: string): Card | undefined {
  return player.hand.find((c) => c.id === cardId);
}

/**
 * Whether `card` is legal to play right now, given the active shape, the top
 * discard card, and any pending Pick Two/Pick Three penalty. When a penalty
 * is pending, ONLY a matching defending number is legal — shape-matching,
 * number-matching-top-card, and Whot do not apply as escapes.
 */
export function isCardPlayable(card: Card, state: GameState): boolean {
  if (state.pendingPenalty) {
    return card.number === state.pendingPenalty.defendingNumber;
  }

  if (card.shape === "Whot") return true;
  if (card.shape === state.activeShape) return true;

  const topCard = getTopCard(state);
  return card.number === topCard.number;
}

export function canDefendPenalty(card: Card, pendingPenalty: PendingPenalty): boolean {
  return card.number === pendingPenalty.defendingNumber;
}

const ACTIONS_ALLOWED_WHEN_ROUND_OR_MATCH_OVER = new Set([
  "leave_game",
  "request_rematch",
  "start_rematch",
]);

export function isActionAllowedForStatus(actionType: string, status: GameState["status"]): boolean {
  if (status === "not_started") {
    return actionType === "start_game";
  }
  if (status === "in_progress") {
    return (
      actionType !== "start_rematch" &&
      actionType !== "request_rematch" &&
      actionType !== "start_game"
    );
  }
  // round_over / match_over
  return ACTIONS_ALLOWED_WHEN_ROUND_OR_MATCH_OVER.has(actionType);
}
