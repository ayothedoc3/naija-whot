import type { Card, Shape } from "./cards";
import { getCurrentPlayer } from "./selectors";
import type { GameState, PendingPenalty } from "./types";

export interface PublicPlayerState {
  userId: string;
  seatIndex: number;
  handCount: number;
  forfeited: boolean;
  lastCardDeclared: boolean;
  checkUpDeclared: boolean;
  requestedRematch: boolean;
}

export interface PublicGameState {
  gameId: string;
  status: GameState["status"];
  roundNumber: number;
  players: PublicPlayerState[];
  currentPlayerUserId: string | null;
  direction: 1 | -1;
  activeShape: Shape;
  topCard: Card | null;
  discardCount: number;
  marketCount: number;
  pendingPenalty: PendingPenalty | null;
  turnDeadline: number | null;
  matchScores: Record<string, number>;
  roundWinnerUserId: string | null;
  matchWinnerUserId: string | null;
  bestOf: number;
  stateVersion: number;
}

/**
 * Strips everything private (other players' hands, market/deck order, full
 * discard history) so this is the only shape of game data that ever reaches
 * the database's public `games.public_state` column, Realtime payloads, or
 * a client response.
 */
export function toPublicGameState(state: GameState): PublicGameState {
  return {
    gameId: state.gameId,
    status: state.status,
    roundNumber: state.roundNumber,
    players: state.players.map((p) => ({
      userId: p.userId,
      seatIndex: p.seatIndex,
      handCount: p.hand.length,
      forfeited: p.forfeited,
      lastCardDeclared: p.lastCardArmed,
      checkUpDeclared: p.checkUpArmed,
      requestedRematch: p.requestedRematch,
    })),
    currentPlayerUserId: state.status === "in_progress" ? getCurrentPlayer(state).userId : null,
    direction: state.direction,
    activeShape: state.activeShape,
    topCard:
      state.discardPile.length > 0
        ? (state.discardPile[state.discardPile.length - 1] as Card)
        : null,
    discardCount: state.discardPile.length,
    marketCount: state.market.length,
    pendingPenalty: state.pendingPenalty,
    turnDeadline: state.turnDeadline,
    matchScores: { ...state.matchScores },
    roundWinnerUserId: state.roundWinnerUserId,
    matchWinnerUserId: state.matchWinnerUserId,
    bestOf: state.ruleConfig.bestOf,
    stateVersion: state.stateVersion,
  };
}

/** The only place a player's own cards are ever read out of canonical state. */
export function getPrivateHand(state: GameState, userId: string): Card[] {
  const player = state.players.find((p) => p.userId === userId);
  return player ? [...player.hand] : [];
}
