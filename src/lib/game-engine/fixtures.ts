import { buildStandardDeck, type Card, type Shape } from "./cards";
import { DEFAULT_RULE_CONFIG, type RuleConfig } from "./rules";
import type { GameState, PendingPenalty, PlayerState } from "./types";

/**
 * Deterministic GameState construction, shared by the engine's own test
 * suite (src/lib/game-engine/__tests__/helpers.ts) and the runtime dev
 * fixture route (src/app/api/dev/fixtures/start/route.ts). Building a
 * specific hand/top-card/market arrangement directly — rather than dealing
 * from a shuffle — is what makes it possible to reliably exercise a named
 * special-card or declaration scenario in an automated end-to-end test
 * instead of hoping a random deal produces one.
 */

const FULL_DECK = buildStandardDeck();
const DECK_BY_ID = new Map(FULL_DECK.map((c) => [c.id, c]));

export function card(id: string): Card {
  const found = DECK_BY_ID.get(id);
  if (!found) throw new Error(`Unknown card id: ${id}`);
  return found;
}

export function cards(ids: string[]): Card[] {
  return ids.map(card);
}

export function makeRuleConfig(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return { ...DEFAULT_RULE_CONFIG, ...overrides };
}

export interface FixtureStateParams {
  gameId?: string;
  seatUserIds: string[];
  hands: Record<string, string[]>;
  topCardId: string;
  currentPlayerUserId: string;
  activeShape?: Shape;
  marketCardIds?: string[];
  /** Older discard cards, beneath the top card (bottom of pile first). */
  discardHistoryIds?: string[];
  rules?: Partial<RuleConfig>;
  pendingPenalty?: PendingPenalty | null;
  direction?: 1 | -1;
  turnDeadline?: number | null;
  matchScores?: Record<string, number>;
  roundNumber?: number;
  status?: GameState["status"];
  playerOverrides?: Record<string, Partial<PlayerState>>;
  lastRoundStarterUserId?: string;
}

export function buildFixtureGameState(params: FixtureStateParams): GameState {
  const ruleConfig = makeRuleConfig(params.rules);
  const discardHistoryIds = params.discardHistoryIds ?? [];
  const usedIds = new Set<string>([
    params.topCardId,
    ...discardHistoryIds,
    ...Object.values(params.hands).flat(),
  ]);

  const topCard = card(params.topCardId);
  const activeShape = params.activeShape ?? (topCard.shape === "Whot" ? "Circle" : topCard.shape);

  const market = params.marketCardIds
    ? cards(params.marketCardIds)
    : FULL_DECK.filter((c) => !usedIds.has(c.id));

  const players: PlayerState[] = params.seatUserIds.map((userId, seatIndex) => {
    const base: PlayerState = {
      userId,
      seatIndex,
      hand: cards(params.hands[userId] ?? []),
      forfeited: false,
      lastCardArmed: false,
      checkUpArmed: false,
      requestedRematch: false,
    };
    return { ...base, ...(params.playerOverrides?.[userId] ?? {}) };
  });

  const currentPlayerIndex = params.seatUserIds.indexOf(params.currentPlayerUserId);
  if (currentPlayerIndex === -1) {
    throw new Error(`currentPlayerUserId ${params.currentPlayerUserId} not found in seatUserIds`);
  }

  const lastRoundStarterSeatIndex = params.lastRoundStarterUserId
    ? params.seatUserIds.indexOf(params.lastRoundStarterUserId)
    : currentPlayerIndex;

  return {
    gameId: params.gameId ?? "fixture-game",
    status: params.status ?? "in_progress",
    ruleConfig,
    players,
    currentPlayerIndex,
    direction: params.direction ?? 1,
    market,
    discardPile: [...cards(discardHistoryIds), topCard],
    activeShape,
    pendingPenalty: params.pendingPenalty ?? null,
    turnDeadline: params.turnDeadline ?? null,
    roundNumber: params.roundNumber ?? 1,
    matchScores: params.matchScores ?? Object.fromEntries(params.seatUserIds.map((id) => [id, 0])),
    roundWinnerUserId: null,
    matchWinnerUserId: null,
    stateVersion: 0,
    recentActionIds: [],
    lastRoundStarterSeatIndex,
  };
}
