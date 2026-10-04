import type { Card, CardEffect, RequestableShape } from "./cards";
import { isRequestableShape } from "./cards";
import { buildShuffledDeck, secureShuffle, type ShuffleFn } from "./deck";
import { gameError, GameEngineError } from "./errors";
import { normalizeRuleConfig, type RuleConfig } from "./rules";
import {
  getActivePlayers,
  getCurrentPlayer,
  getNextSeatIndex,
  getPlayerByUserId,
  allPlayersRequestedRematch,
  computeRemainingCardScores,
  hasPlayerWonMatch,
} from "./selectors";
import type {
  ActionContext,
  ActionResult,
  GameAction,
  GameEvent,
  GameState,
  PendingPenaltyType,
  PlayerState,
} from "./types";
import { findCardInHand, isActionAllowedForStatus, isCardPlayable } from "./validation";

const MAX_RECENT_ACTION_IDS = 200;
const LAST_CARD_HAND_SIZE = 1;
const LAST_CARD_PENALTY = 2;

export interface CreateGameStateParams {
  gameId: string;
  seatUserIds: string[];
  ruleConfig: RuleConfig;
}

export function createGameState({
  gameId,
  seatUserIds,
  ruleConfig,
}: CreateGameStateParams): GameState {
  const players: PlayerState[] = seatUserIds.map((userId, seatIndex) => ({
    userId,
    seatIndex,
    hand: [],
    forfeited: false,
    lastCardArmed: false,
    checkUpArmed: false,
    requestedRematch: false,
  }));

  return {
    gameId,
    status: "not_started",
    ruleConfig,
    players,
    currentPlayerIndex: 0,
    direction: 1,
    market: [],
    discardPile: [],
    activeShape: "Circle",
    pendingPenalty: null,
    turnDeadline: null,
    roundNumber: 0,
    matchScores: Object.fromEntries(seatUserIds.map((id) => [id, 0])),
    roundWinnerUserId: null,
    matchWinnerUserId: null,
    stateVersion: 0,
    recentActionIds: [],
    lastRoundStarterSeatIndex: null,
  };
}

export function applyAction(
  state: GameState,
  action: GameAction,
  ctx: ActionContext,
): ActionResult {
  if (state.recentActionIds.includes(action.actionId)) {
    return {
      ok: false,
      error: gameError("DUPLICATE_ACTION", "This action was already processed."),
    };
  }

  if (action.expectedVersion !== state.stateVersion) {
    return {
      ok: false,
      error: gameError(
        "VERSION_CONFLICT",
        `Expected version ${action.expectedVersion} but game is at ${state.stateVersion}.`,
        { expected: action.expectedVersion, actual: state.stateVersion },
      ),
    };
  }

  if (!isActionAllowedForStatus(action.type, state.status)) {
    const code = state.status === "not_started" ? "GAME_NOT_IN_PROGRESS" : "GAME_ALREADY_ENDED";
    return {
      ok: false,
      error: gameError(
        code,
        `Action "${action.type}" is not allowed while game status is "${state.status}".`,
      ),
    };
  }

  const draft = structuredClone(state);
  draft.ruleConfig = normalizeRuleConfig(draft.ruleConfig);
  const events: GameEvent[] = [];
  const shuffle: ShuffleFn = ctx.shuffle ?? secureShuffle;

  try {
    switch (action.type) {
      case "start_game":
        handleStartGame(draft, ctx, shuffle, events);
        break;
      case "play_card":
        handlePlay(
          draft,
          ctx,
          shuffle,
          events,
          [action.cardId],
          action.chosenShape,
          action.declareLastCard,
          action.reverseDirection,
        );
        break;
      case "play_multi":
        handlePlay(
          draft,
          ctx,
          shuffle,
          events,
          action.cardIds,
          action.chosenShape,
          action.declareLastCard,
          action.reverseDirection,
        );
        break;
      case "draw_card":
        handleDrawCard(draft, ctx, shuffle, events);
        break;
      case "accept_penalty":
        handleAcceptPenalty(draft, ctx, shuffle, events);
        break;
      case "declare_last_card":
        handleDeclareLastCard(draft, ctx, events);
        break;
      case "declare_check_up":
        throw gameError("RULE_DISABLED", "Check Up is no longer required.");
      case "leave_game":
        handleLeaveGame(draft, ctx, events);
        break;
      case "forfeit":
        handleForfeit(draft, ctx, events);
        break;
      case "resolve_timeout":
        handleResolveTimeout(draft, ctx, shuffle, events);
        break;
      case "request_rematch":
        handleRequestRematch(draft, ctx, events);
        break;
      case "start_rematch":
        handleStartRematch(draft, ctx, shuffle, events);
        break;
    }
  } catch (err) {
    if (err instanceof GameEngineError) {
      return { ok: false, error: err };
    }
    throw err;
  }

  draft.stateVersion += 1;
  draft.recentActionIds.push(action.actionId);
  if (draft.recentActionIds.length > MAX_RECENT_ACTION_IDS) {
    draft.recentActionIds = draft.recentActionIds.slice(-MAX_RECENT_ACTION_IDS);
  }

  return { ok: true, state: draft, events };
}

function requirePlayer(draft: GameState, userId: string): PlayerState {
  const player = getPlayerByUserId(draft, userId);
  if (!player) throw gameError("UNKNOWN_PLAYER", `User ${userId} is not a player in this game.`);
  return player;
}

function requireCurrentPlayer(draft: GameState, userId: string): PlayerState {
  const player = requirePlayer(draft, userId);
  if (getCurrentPlayer(draft).userId !== userId) {
    throw gameError("NOT_YOUR_TURN", "It is not your turn.");
  }
  return player;
}

function setTurnDeadline(draft: GameState, ctx: ActionContext): void {
  draft.turnDeadline = draft.ruleConfig.turnTimerSeconds
    ? ctx.now + draft.ruleConfig.turnTimerSeconds * 1000
    : null;
}

/** Draws up to `count` cards into `player`'s hand, reshuffling the discard pile
 *  (preserving the top card) whenever the market runs dry. Returns how many
 *  cards were actually drawn (may be fewer than requested if the deck is
 *  fully exhausted across market + discard + hands — an extreme edge case). */
function drawCardsInto(
  draft: GameState,
  player: PlayerState,
  count: number,
  shuffle: ShuffleFn,
  events: GameEvent[],
): number {
  let remaining = count;
  let drawn = 0;
  while (remaining > 0) {
    if (draft.market.length === 0) {
      if (draft.discardPile.length <= 1) break;
      const top = draft.discardPile[draft.discardPile.length - 1] as Card;
      const rest = draft.discardPile.slice(0, -1);
      draft.market = shuffle(rest);
      draft.discardPile = [top];
      events.push({ type: "market_reshuffled", cardsMoved: rest.length });
    }
    const card = draft.market.pop();
    if (!card) break;
    player.hand.push(card);
    drawn += 1;
    remaining -= 1;
  }
  return drawn;
}

function dealNewRound(draft: GameState, ctx: ActionContext, shuffle: ShuffleFn): void {
  const activePlayers = getActivePlayers(draft);
  if (activePlayers.length < 2) {
    throw gameError(
      "NOT_ENOUGH_PLAYERS",
      "At least two active players are required to start a round.",
    );
  }

  for (const player of draft.players) {
    player.hand = [];
    player.lastCardArmed = false;
    player.checkUpArmed = false;
    player.requestedRematch = false;
  }

  const deck = buildShuffledDeck(shuffle);

  for (const player of activePlayers) {
    player.hand = deck.splice(0, draft.ruleConfig.startingHandSize);
  }

  const setAside: Card[] = [];
  let startingCard: Card | undefined;
  while (deck.length > 0) {
    const candidate = deck.pop() as Card;
    if (candidate.effect === null) {
      startingCard = candidate;
      break;
    }
    setAside.push(candidate);
  }
  if (!startingCard) {
    // Pathological (only reachable with a tiny custom test deck): fall back
    // to whatever special card is available rather than crashing.
    startingCard = setAside.pop();
  }
  if (!startingCard) {
    throw new Error("Invariant violated: no card available to start the discard pile");
  }

  draft.market = shuffle([...deck, ...setAside]);
  draft.discardPile = [startingCard];
  draft.activeShape = startingCard.shape === "Whot" ? "Circle" : startingCard.shape;
  draft.pendingPenalty = null;
  draft.direction = 1;

  const activeSeatIndices = activePlayers.map((p) => p.seatIndex);
  let starterSeatIndex: number;
  if (draft.lastRoundStarterSeatIndex === null) {
    const shuffledSeats = shuffle(activeSeatIndices);
    starterSeatIndex = shuffledSeats[0] as number;
  } else {
    starterSeatIndex = getNextSeatIndex(draft, draft.lastRoundStarterSeatIndex, 1);
  }

  draft.currentPlayerIndex = starterSeatIndex;
  draft.lastRoundStarterSeatIndex = starterSeatIndex;
  draft.roundWinnerUserId = null;
  draft.status = "in_progress";
  setTurnDeadline(draft, ctx);
}

function handleStartGame(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
): void {
  if (draft.players.length < 2) {
    throw gameError("NOT_ENOUGH_PLAYERS", "At least two players are required to start a game.");
  }
  draft.roundNumber = 1;
  for (const player of draft.players) {
    draft.matchScores[player.userId] = 0;
  }
  draft.matchWinnerUserId = null;
  dealNewRound(draft, ctx, shuffle);
  events.push({
    type: "game_started",
    roundNumber: draft.roundNumber,
    startingPlayerUserId: getCurrentPlayer(draft).userId,
  });
}

function resolveEffect(card: Card, ruleConfig: RuleConfig): CardEffect | null {
  if (!card.effect) return null;
  switch (card.effect) {
    case "holdOn":
      return ruleConfig.holdOn ? "holdOn" : null;
    case "pickTwo":
      return "pickTwo";
    case "pickThree":
      return "pickThree";
    case "suspension":
      return ruleConfig.suspension ? "suspension" : null;
    case "generalMarket":
      return ruleConfig.generalMarket ? "generalMarket" : null;
    case "whot":
      return "whot";
  }
}

function finishRound(draft: GameState, winnerUserId: string, events: GameEvent[]): void {
  draft.status = "round_over";
  draft.roundWinnerUserId = winnerUserId;
  draft.matchScores[winnerUserId] = (draft.matchScores[winnerUserId] ?? 0) + 1;
  draft.turnDeadline = null;
  for (const player of draft.players) {
    player.requestedRematch = false;
  }

  const remainingCardScores = computeRemainingCardScores(draft);
  events.push({ type: "round_over", winnerUserId, remainingCardScores });

  if (hasPlayerWonMatch(draft, winnerUserId)) {
    draft.status = "match_over";
    draft.matchWinnerUserId = winnerUserId;
    events.push({ type: "match_over", winnerUserId });
  }
}

function handlePlay(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
  cardIds: string[],
  chosenShape: RequestableShape | undefined,
  declareLastCard: boolean | undefined,
  reverseDirection: boolean | undefined,
): void {
  const player = requireCurrentPlayer(draft, ctx.actingUserId);

  if (cardIds.length === 0)
    throw gameError("NO_CARDS_SELECTED", "Select at least one card to play.");
  if (new Set(cardIds).size !== cardIds.length) {
    throw gameError("DUPLICATE_CARD_SELECTED", "The same card was selected more than once.");
  }
  if (cardIds.length > 1 && !draft.ruleConfig.multiCardPlay) {
    throw gameError(
      "MULTI_CARD_PLAY_DISABLED",
      "This room does not allow playing multiple cards at once.",
    );
  }

  if (draft.pendingPenalty) {
    const stackingEnabled =
      draft.pendingPenalty.type === "pickTwo"
        ? draft.ruleConfig.pickTwoStacking
        : draft.ruleConfig.pickThreeStacking;
    if (!stackingEnabled) {
      throw gameError(
        "PENALTY_STACKING_DISABLED",
        `Penalty stacking is disabled; draw ${draft.pendingPenalty.amount} cards to continue.`,
      );
    }
  }

  const cards: Card[] = [];
  for (const id of cardIds) {
    const card = findCardInHand(player, id);
    if (!card) throw gameError("CARD_NOT_IN_HAND", `Card ${id} is not in your hand.`);
    cards.push(card);
  }
  const firstCard = cards[0] as Card;

  if (!isCardPlayable(firstCard, draft)) {
    if (draft.pendingPenalty) {
      throw gameError(
        "MUST_DEFEND_OR_ACCEPT_PENALTY",
        `You must play a ${draft.pendingPenalty.defendingNumber} to defend, or accept the penalty.`,
      );
    }
    throw gameError("ILLEGAL_CARD", "That card cannot be played on the current top card.");
  }

  for (let i = 1; i < cards.length; i++) {
    if ((cards[i] as Card).number !== firstCard.number) {
      throw gameError(
        "MULTI_PLAY_NUMBER_MISMATCH",
        "All cards played together must share the same number.",
      );
    }
  }

  const finalCard = cards[cards.length - 1] as Card;
  const isWhotPlay = finalCard.shape === "Whot";

  if (isWhotPlay) {
    if (chosenShape === undefined) {
      throw gameError("MISSING_SHAPE_SELECTION", "Choose a shape for the Whot card.");
    }
    if (!isRequestableShape(chosenShape)) {
      throw gameError("INVALID_SHAPE_SELECTION", "Whot cannot be selected as the requested shape.");
    }
  } else if (chosenShape !== undefined) {
    throw gameError(
      "UNEXPECTED_SHAPE_SELECTION",
      "Shape selection is only used when playing a Whot card.",
    );
  }

  if (reverseDirection) {
    const canReverse =
      draft.ruleConfig.directionChangeOnPenalty &&
      (firstCard.number === 2 || firstCard.number === 5);
    if (!canReverse) {
      throw gameError(
        "RULE_DISABLED",
        "Direction can only be reversed when playing a 2 or 5 and the rule is enabled.",
      );
    }
  }

  const cardIdSet = new Set(cardIds);
  player.hand = player.hand.filter((c) => !cardIdSet.has(c.id));
  draft.discardPile.push(...cards);
  draft.activeShape = isWhotPlay ? (chosenShape as RequestableShape) : finalCard.shape;

  events.push({
    type: "card_played",
    actorUserId: ctx.actingUserId,
    cardIds,
    resultingShape: draft.activeShape,
  });
  if (isWhotPlay) {
    events.push({
      type: "shape_chosen",
      actorUserId: ctx.actingUserId,
      shape: chosenShape as RequestableShape,
    });
  }

  if (declareLastCard) player.lastCardArmed = true;

  if (player.hand.length === LAST_CARD_HAND_SIZE) {
    if (draft.ruleConfig.lastCardDeclaration) {
      if (!player.lastCardArmed) {
        drawCardsInto(draft, player, LAST_CARD_PENALTY, shuffle, events);
        events.push({ type: "last_card_penalty", actorUserId: ctx.actingUserId });
      }
    }
    player.lastCardArmed = false;
  }

  let roundEnded = false;
  if (player.hand.length === 0) {
    finishRound(draft, ctx.actingUserId, events);
    roundEnded = true;
    player.checkUpArmed = false;
  }

  if (roundEnded) return;

  applyPlayedEffectsAndAdvanceTurn(
    draft,
    ctx,
    shuffle,
    events,
    player,
    cards,
    firstCard,
    reverseDirection,
  );
}

function applyPlayedEffectsAndAdvanceTurn(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
  actor: PlayerState,
  cards: Card[],
  firstCard: Card,
  reverseDirection: boolean | undefined,
): void {
  if (reverseDirection) {
    draft.direction = draft.direction === 1 ? -1 : 1;
    events.push({ type: "direction_reversed", actorUserId: ctx.actingUserId });
  }

  const effect = resolveEffect(firstCard, draft.ruleConfig);
  const actorSeatIndex = actor.seatIndex;

  let steps = 1;

  switch (effect) {
    case "holdOn": {
      steps = 0;
      events.push({ type: "hold_on", actorUserId: ctx.actingUserId });
      break;
    }
    case "suspension": {
      steps = 2;
      const skippedSeat = getNextSeatIndex(draft, actorSeatIndex, 1);
      events.push({
        type: "suspension",
        actorUserId: ctx.actingUserId,
        skippedUserId: (draft.players[skippedSeat] as PlayerState).userId,
      });
      break;
    }
    case "generalMarket": {
      steps = 0;
      const others = getActivePlayers(draft).filter((p) => p.userId !== ctx.actingUserId);
      for (const other of others) {
        drawCardsInto(draft, other, 1, shuffle, events);
      }
      events.push({
        type: "general_market",
        actorUserId: ctx.actingUserId,
        affectedUserIds: others.map((p) => p.userId),
      });
      break;
    }
    case "pickTwo":
    case "pickThree": {
      const existing = draft.pendingPenalty;
      const perCard = effect === "pickTwo" ? 2 : 3;
      const defendingNumber = effect === "pickTwo" ? 2 : 5;
      const penaltyType: PendingPenaltyType = effect;
      const newAmount = (existing?.amount ?? 0) + perCard * cards.length;
      draft.pendingPenalty = { type: penaltyType, amount: newAmount, defendingNumber };
      steps = 1;
      if (existing) {
        events.push({
          type: "penalty_defended",
          actorUserId: ctx.actingUserId,
          penaltyType,
          newAmount,
        });
      } else {
        const targetSeat = getNextSeatIndex(draft, actorSeatIndex, 1);
        events.push({
          type: "penalty_applied",
          targetUserId: (draft.players[targetSeat] as PlayerState).userId,
          penaltyType,
          amount: newAmount,
        });
      }
      break;
    }
    default:
      steps = 1;
  }

  draft.currentPlayerIndex = getNextSeatIndex(draft, actorSeatIndex, steps);
  setTurnDeadline(draft, ctx);
}

function handleDrawCard(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
): void {
  const player = requireCurrentPlayer(draft, ctx.actingUserId);
  if (draft.pendingPenalty) {
    throw gameError(
      "MUST_DEFEND_OR_ACCEPT_PENALTY",
      "You must defend with a matching card or accept the pending penalty.",
    );
  }
  drawCardsInto(draft, player, 1, shuffle, events);
  events.push({ type: "card_drawn", actorUserId: ctx.actingUserId, count: 1, voluntary: true });
  draft.currentPlayerIndex = getNextSeatIndex(draft, player.seatIndex, 1);
  setTurnDeadline(draft, ctx);
}

function handleAcceptPenalty(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
): void {
  const player = requireCurrentPlayer(draft, ctx.actingUserId);
  if (!draft.pendingPenalty) {
    throw gameError("NO_ACTIVE_PENALTY_TO_ACCEPT", "There is no pending penalty to accept.");
  }
  const amount = draft.pendingPenalty.amount;
  drawCardsInto(draft, player, amount, shuffle, events);
  draft.pendingPenalty = null;
  events.push({
    type: "card_drawn",
    actorUserId: ctx.actingUserId,
    count: amount,
    voluntary: false,
  });
  draft.currentPlayerIndex = getNextSeatIndex(draft, player.seatIndex, 1);
  setTurnDeadline(draft, ctx);
}

function handleDeclareLastCard(draft: GameState, ctx: ActionContext, events: GameEvent[]): void {
  if (!draft.ruleConfig.lastCardDeclaration) {
    throw gameError("RULE_DISABLED", "Last Card declaration is disabled in this room.");
  }
  const player = requireCurrentPlayer(draft, ctx.actingUserId);
  player.lastCardArmed = true;
  events.push({ type: "last_card_declared", actorUserId: ctx.actingUserId });
}

function handleLeaveGame(draft: GameState, ctx: ActionContext, events: GameEvent[]): void {
  if (draft.status === "in_progress") {
    throw gameError(
      "CANNOT_LEAVE_DURING_ROUND",
      "Forfeit instead of leaving during an active round.",
    );
  }
  const player = requirePlayer(draft, ctx.actingUserId);
  if (player.forfeited)
    throw gameError("PLAYER_ALREADY_FORFEITED", "You have already left this game.");
  player.forfeited = true;
  player.requestedRematch = false;
  events.push({ type: "player_left", userId: ctx.actingUserId });
}

function handleForfeit(draft: GameState, ctx: ActionContext, events: GameEvent[]): void {
  const player = requirePlayer(draft, ctx.actingUserId);
  if (player.forfeited) throw gameError("PLAYER_ALREADY_FORFEITED", "You have already forfeited.");

  const wasCurrentPlayer = getCurrentPlayer(draft).userId === ctx.actingUserId;
  player.forfeited = true;
  events.push({ type: "player_forfeited", userId: ctx.actingUserId });

  if (wasCurrentPlayer) {
    draft.pendingPenalty = null;
  }

  const remainingActive = getActivePlayers(draft);
  if (remainingActive.length === 1) {
    const winner = remainingActive[0] as PlayerState;
    finishRound(draft, winner.userId, events);
    draft.status = "match_over";
    draft.matchWinnerUserId = winner.userId;
    return;
  }

  if (wasCurrentPlayer) {
    draft.currentPlayerIndex = getNextSeatIndex(draft, player.seatIndex, 1);
    setTurnDeadline(draft, ctx);
  }
}

function handleResolveTimeout(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
): void {
  if (draft.turnDeadline === null || ctx.now < draft.turnDeadline) {
    throw gameError("TIMEOUT_NOT_YET_DUE", "The current turn has not yet expired.");
  }
  const player = getCurrentPlayer(draft);
  let drewCount: number;
  if (draft.pendingPenalty) {
    drewCount = draft.pendingPenalty.amount;
    drawCardsInto(draft, player, drewCount, shuffle, events);
    draft.pendingPenalty = null;
  } else {
    drewCount = 1;
    drawCardsInto(draft, player, drewCount, shuffle, events);
  }
  events.push({
    type: "card_drawn",
    actorUserId: player.userId,
    count: drewCount,
    voluntary: false,
  });
  events.push({ type: "turn_timeout", previousPlayerUserId: player.userId, drewCount });
  draft.currentPlayerIndex = getNextSeatIndex(draft, player.seatIndex, 1);
  setTurnDeadline(draft, ctx);
}

function handleRequestRematch(draft: GameState, ctx: ActionContext, events: GameEvent[]): void {
  const player = requirePlayer(draft, ctx.actingUserId);
  if (player.forfeited) throw gameError("PLAYER_ALREADY_FORFEITED", "You have left this game.");
  player.requestedRematch = true;
  events.push({ type: "rematch_requested", userId: ctx.actingUserId });
}

function handleStartRematch(
  draft: GameState,
  ctx: ActionContext,
  shuffle: ShuffleFn,
  events: GameEvent[],
): void {
  const activePlayers = getActivePlayers(draft);
  if (activePlayers.length < 2) {
    throw gameError(
      "NOT_ENOUGH_PLAYERS",
      "At least two active players are required for a rematch.",
    );
  }
  if (!allPlayersRequestedRematch(draft)) {
    throw gameError("REMATCH_NOT_UNANIMOUS", "All remaining players must request a rematch first.");
  }

  if (draft.status === "match_over") {
    for (const player of draft.players) {
      draft.matchScores[player.userId] = 0;
    }
    draft.roundNumber = 0;
    draft.matchWinnerUserId = null;
  }
  draft.roundNumber += 1;

  dealNewRound(draft, ctx, shuffle);
  events.push({ type: "rematch_started", roundNumber: draft.roundNumber });
}

export { resolveEffect };
