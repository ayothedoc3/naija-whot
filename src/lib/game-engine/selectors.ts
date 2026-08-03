import type { Card } from "./cards";
import { isCardPlayable } from "./validation";
import type { GameState, PlayerState } from "./types";
import { roundsToWinMatch } from "./rules";

export function getPlayerByUserId(state: GameState, userId: string): PlayerState | undefined {
  return state.players.find((p) => p.userId === userId);
}

export function getPlayerBySeat(state: GameState, seatIndex: number): PlayerState {
  const player = state.players[seatIndex];
  if (!player) {
    throw new Error(`Invariant violated: no player at seat ${seatIndex}`);
  }
  return player;
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return getPlayerBySeat(state, state.currentPlayerIndex);
}

export function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.forfeited);
}

/**
 * Advances a seat index by `steps` seats in the state's current direction,
 * skipping forfeited players, and wrapping around the table.
 */
export function getNextSeatIndex(state: GameState, fromSeatIndex: number, steps = 1): number {
  const total = state.players.length;
  const activeCount = getActivePlayers(state).length;
  if (activeCount === 0) {
    throw new Error("Invariant violated: no active players remain");
  }

  let seat = fromSeatIndex;
  let remaining = steps;
  while (remaining > 0) {
    seat = (seat + state.direction + total) % total;
    if (!getPlayerBySeat(state, seat).forfeited) {
      remaining -= 1;
    }
  }
  return seat;
}

export function getPlayableCardIds(state: GameState, userId: string): string[] {
  const player = getPlayerByUserId(state, userId);
  if (!player) return [];
  if (state.status !== "in_progress") return [];
  if (getCurrentPlayer(state).userId !== userId) return [];

  return player.hand.filter((card) => isCardPlayable(card, state)).map((c) => c.id);
}

export function computeRemainingCardScores(state: GameState): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const player of state.players) {
    scores[player.userId] = player.hand.reduce((sum, c) => sum + c.scoreValue, 0);
  }
  return scores;
}

export function hasPlayerWonMatch(state: GameState, userId: string): boolean {
  const wins = state.matchScores[userId] ?? 0;
  return wins >= roundsToWinMatch(state.ruleConfig.bestOf);
}

export function groupHandByNumber(hand: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of hand) {
    const group = map.get(card.number) ?? [];
    group.push(card);
    map.set(card.number, group);
  }
  return map;
}

export function allPlayersRequestedRematch(state: GameState): boolean {
  const activePlayers = getActivePlayers(state);
  return activePlayers.length > 0 && activePlayers.every((p) => p.requestedRematch);
}
