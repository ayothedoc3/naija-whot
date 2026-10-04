export type TurnTimerSeconds = 10 | 20 | 30 | 60 | null;
export type BestOf = 1 | 3 | 5;

export interface RuleConfig {
  maxPlayers: number;
  startingHandSize: number;
  turnTimerSeconds: TurnTimerSeconds;
  pickTwoStacking: boolean;
  pickThreeStacking: boolean;
  generalMarket: boolean;
  holdOn: boolean;
  suspension: boolean;
  lastCardDeclaration: boolean;
  /** Deprecated persisted field. Final valid plays always win without a declaration. */
  checkUpDeclaration: boolean;
  multiCardPlay: boolean;
  directionChangeOnPenalty: boolean;
  bestOf: BestOf;
}

type LegacyRuleConfig = Partial<RuleConfig> & {
  /** Legacy persisted name for multi-card play. Kept for JSON compatibility. */
  doubleDecking?: boolean;
};

export const RULE_BOUNDS = {
  maxPlayers: { min: 2, max: 4 },
  startingHandSize: { min: 3, max: 6 },
  turnTimerOptions: [10, 20, 30, 60, null] as const,
  bestOfOptions: [1, 3, 5] as const,
};

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  maxPlayers: 4,
  startingHandSize: 5,
  turnTimerSeconds: 20,
  pickTwoStacking: true,
  pickThreeStacking: true,
  generalMarket: true,
  holdOn: true,
  suspension: true,
  lastCardDeclaration: true,
  checkUpDeclaration: false,
  multiCardPlay: false,
  directionChangeOnPenalty: false,
  bestOf: 1,
};

export function normalizeRuleConfig(config: LegacyRuleConfig | null | undefined): RuleConfig {
  const merged = { ...DEFAULT_RULE_CONFIG, ...(config ?? {}) };
  return {
    ...merged,
    checkUpDeclaration: false,
    multiCardPlay:
      config?.multiCardPlay ?? config?.doubleDecking ?? DEFAULT_RULE_CONFIG.multiCardPlay,
  };
}

export function isValidRuleConfig(config: Partial<RuleConfig>): config is RuleConfig {
  if (config.maxPlayers === undefined) return false;
  if (
    config.maxPlayers < RULE_BOUNDS.maxPlayers.min ||
    config.maxPlayers > RULE_BOUNDS.maxPlayers.max
  ) {
    return false;
  }
  if (config.startingHandSize === undefined) return false;
  if (
    config.startingHandSize < RULE_BOUNDS.startingHandSize.min ||
    config.startingHandSize > RULE_BOUNDS.startingHandSize.max
  ) {
    return false;
  }
  if (
    config.turnTimerSeconds !== null &&
    !RULE_BOUNDS.turnTimerOptions.includes(config.turnTimerSeconds as never)
  ) {
    return false;
  }
  if (config.bestOf === undefined || !RULE_BOUNDS.bestOfOptions.includes(config.bestOf)) {
    return false;
  }
  return true;
}

export function roundsToWinMatch(bestOf: BestOf): number {
  return Math.ceil(bestOf / 2);
}
