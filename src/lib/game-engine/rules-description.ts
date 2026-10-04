import { REQUESTABLE_SHAPES, SHAPES, type Card, type Shape } from "./cards";
import { RULE_BOUNDS, type RuleConfig } from "./rules";

export const RULES_PAGE_METADATA = {
  title: "How to Play Naija Whot",
  description:
    "Learn the cards, special actions, declarations, and configurable house rules used in Naija Whot.",
} as const;

export const PLAYABLE_SHAPES = SHAPES;
export const WHOT_REQUESTABLE_SHAPES = REQUESTABLE_SHAPES;

export const SAMPLE_CARDS = {
  topCard: sampleCard("Circle", 7),
  matchingShape: sampleCard("Circle", 3),
  matchingNumber: sampleCard("Star", 7),
  illegal: sampleCard("Triangle", 12),
  whot: sampleCard("Whot", 20, "Whot"),
} as const;

export const SPECIAL_CARD_RULES = [
  {
    number: 1,
    name: "Hold On",
    settingKey: "holdOn",
    summary: "The player keeps the turn and may play again.",
    twoPlayer: "In a two-player game this is simply another immediate turn for the same player.",
  },
  {
    number: 2,
    name: "Pick Two",
    settingKey: "pickTwoStacking",
    summary: "The next player must draw 2 unless they defend with another 2.",
    twoPlayer:
      "With two players, a defended 2 sends the accumulated penalty straight back to the other player.",
  },
  {
    number: 5,
    name: "Pick Three",
    settingKey: "pickThreeStacking",
    summary: "The next player must draw 3 unless they defend with another 5.",
    twoPlayer:
      "With two players, a defended 5 sends the accumulated penalty straight back to the other player.",
  },
  {
    number: 8,
    name: "Suspension",
    settingKey: "suspension",
    summary: "The next player is skipped.",
    twoPlayer: "In a two-player game, skipping the opponent gives the same player another turn.",
  },
  {
    number: 14,
    name: "General Market",
    settingKey: "generalMarket",
    summary: "Every other active player draws 1 card, then the same player continues.",
    twoPlayer: "In a two-player game, the opponent draws 1 and the same player plays again.",
  },
  {
    number: 20,
    name: "Whot",
    settingKey: null,
    summary: "A Whot card can be played on any normal card and requests a new active shape.",
    twoPlayer: "Two-player behavior is the same: choose Circle, Triangle, Cross, Square, or Star.",
  },
] as const;

export const HOUSE_RULE_OPTIONS: {
  key: keyof RuleConfig;
  label: string;
  description: string;
  formatValue?: (settings: RuleConfig) => string;
}[] = [
  {
    key: "maxPlayers",
    label: "Max players",
    description: `Rooms support ${RULE_BOUNDS.maxPlayers.min}-${RULE_BOUNDS.maxPlayers.max} players.`,
    formatValue: (settings) => `${settings.maxPlayers} players`,
  },
  {
    key: "startingHandSize",
    label: "Starting hand size",
    description: `Each player starts with ${RULE_BOUNDS.startingHandSize.min}-${RULE_BOUNDS.startingHandSize.max} cards.`,
    formatValue: (settings) => `${settings.startingHandSize} cards`,
  },
  {
    key: "turnTimerSeconds",
    label: "Turn timer",
    description:
      "A timed-out player draws the pending penalty, or 1 card when no penalty is pending.",
    formatValue: (settings) =>
      settings.turnTimerSeconds === null ? "No timer" : `${settings.turnTimerSeconds} seconds`,
  },
  {
    key: "bestOf",
    label: "Best-of match length",
    description: "A match can be a single round, best of 3, or best of 5.",
    formatValue: (settings) =>
      settings.bestOf === 1 ? "Single round" : `Best of ${settings.bestOf}`,
  },
  {
    key: "pickTwoStacking",
    label: "Pick Two stacking",
    description: "When enabled, a pending Pick Two may be defended with another 2.",
  },
  {
    key: "pickThreeStacking",
    label: "Pick Three stacking",
    description: "When enabled, a pending Pick Three may be defended with another 5.",
  },
  {
    key: "generalMarket",
    label: "General Market",
    description: "Playing a 14 makes every other active player draw 1 card.",
  },
  {
    key: "holdOn",
    label: "Hold On",
    description: "Playing a 1 lets the same player act again.",
  },
  {
    key: "suspension",
    label: "Suspension",
    description: "Playing an 8 skips the next player.",
  },
  {
    key: "lastCardDeclaration",
    label: "Last Card",
    description: "A player moving from 2 cards to 1 must declare Last Card or draw 2.",
  },
  {
    key: "multiCardPlay",
    label: "Multi-card play",
    description: "Allows several cards of the same number to be played in one atomic turn.",
  },
  {
    key: "directionChangeOnPenalty",
    label: "Direction changes",
    description: "When enabled, playing a 2 or 5 can reverse turn order.",
  },
];

export const ONBOARDING_STEPS = [
  "Enter a nickname.",
  "Create a room or join with a code.",
  "Share the invite link.",
  "Mark ready before the host starts.",
  "Match by shape or number, or play Whot.",
  "Declare Last Card when a play leaves one card. Empty your hand to win.",
] as const;

export function describeSettingValue(settings: RuleConfig, key: keyof RuleConfig): string {
  const option = HOUSE_RULE_OPTIONS.find((item) => item.key === key);
  if (option?.formatValue) return option.formatValue(settings);
  return settings[key] ? "On" : "Off";
}

function sampleCard(shape: Shape, number: number, displayValue = String(number)): Card {
  return {
    id: `rules-${shape.toLowerCase()}-${displayValue.toLowerCase()}`,
    shape,
    number,
    displayValue,
    scoreValue: number,
    effect: number === 20 ? "whot" : null,
  };
}
