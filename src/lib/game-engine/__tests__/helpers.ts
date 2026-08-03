import { buildStandardDeck, type Card, type Shape } from "../cards";
import { createSeededShuffle } from "../deck";
import { applyAction, createGameState } from "../reducer";
import { DEFAULT_RULE_CONFIG, type RuleConfig } from "../rules";
import type { ActionResult, GameAction, GameState, PendingPenalty, PlayerState } from "../types";

/** Plain `Omit` collapses a discriminated union down to its shared keys;
 *  this distributes over each member first so variant-specific fields
 *  (cardId, cardIds, chosenShape, ...) survive. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type ActionInput = DistributiveOmit<GameAction, "actionId" | "expectedVersion">;

let counter = 0;
export function nextActionId(): string {
  counter += 1;
  return `test-action-${counter}`;
}

export function makeRules(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return { ...DEFAULT_RULE_CONFIG, ...overrides };
}

const FULL_DECK = buildStandardDeck();
const DECK_BY_ID = new Map(FULL_DECK.map((c) => [c.id, c]));

export function card(id: string): Card {
  const found = DECK_BY_ID.get(id);
  if (!found) throw new Error(`Unknown test card id: ${id}`);
  return found;
}

export function cards(ids: string[]): Card[] {
  return ids.map(card);
}

/** Starts a real game via the normal start_game action + a seeded shuffle,
 *  for tests that care about structural correctness rather than exact cards. */
export function startTestGame(
  opts: {
    seatUserIds?: string[];
    rules?: Partial<RuleConfig>;
    seed?: number;
    now?: number;
  } = {},
): GameState {
  const seatUserIds = opts.seatUserIds ?? ["p1", "p2"];
  const ruleConfig = makeRules(opts.rules);
  const initial = createGameState({ gameId: "game-1", seatUserIds, ruleConfig });
  const shuffle = createSeededShuffle(opts.seed ?? 42);
  const result = applyAction(
    initial,
    { type: "start_game", actionId: nextActionId(), expectedVersion: 0 },
    { actingUserId: seatUserIds[0] as string, now: opts.now ?? 1000, shuffle },
  );
  if (!result.ok) throw new Error(`Failed to start test game: ${result.error.message}`);
  return result.state;
}

export interface CraftStateParams {
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

/** Builds a fully custom, deterministic in-progress GameState for testing a
 *  specific rule interaction without depending on shuffle output. */
export function craftInProgressState(params: CraftStateParams): GameState {
  const ruleConfig = makeRules(params.rules);
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
    gameId: "game-1",
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

export function act(
  state: GameState,
  actingUserId: string,
  action: ActionInput,
  opts: { now?: number; seed?: number; actionId?: string; expectedVersion?: number } = {},
): ActionResult {
  const shuffle = opts.seed !== undefined ? createSeededShuffle(opts.seed) : undefined;
  const fullAction = {
    ...action,
    actionId: opts.actionId ?? nextActionId(),
    expectedVersion: opts.expectedVersion ?? state.stateVersion,
  } as GameAction;
  return applyAction(state, fullAction, {
    actingUserId,
    now: opts.now ?? state.stateVersion * 1000 + 2000,
    shuffle,
  });
}

export function actOrThrow(
  state: GameState,
  actingUserId: string,
  action: ActionInput,
  opts: { now?: number; seed?: number; actionId?: string; expectedVersion?: number } = {},
): GameState {
  const result = act(state, actingUserId, action, opts);
  if (!result.ok) {
    throw new Error(
      `Expected action to succeed but got ${result.error.code}: ${result.error.message}`,
    );
  }
  return result.state;
}
