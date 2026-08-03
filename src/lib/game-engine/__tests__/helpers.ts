import { createSeededShuffle } from "../deck";
import {
  buildFixtureGameState,
  card,
  cards,
  makeRuleConfig,
  type FixtureStateParams,
} from "../fixtures";
import { applyAction, createGameState } from "../reducer";
import { type RuleConfig } from "../rules";
import type { ActionResult, GameAction, GameState } from "../types";

export { card, cards };
export const makeRules = makeRuleConfig;
export type CraftStateParams = FixtureStateParams;
export const craftInProgressState = buildFixtureGameState;

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
