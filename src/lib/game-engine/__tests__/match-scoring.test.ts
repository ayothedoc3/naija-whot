import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("match scoring and rematches", () => {
  it("a single round win ends the match when bestOf is 1", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { bestOf: 1, checkUpDeclaration: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.status).toBe("match_over");
    expect(next.matchWinnerUserId).toBe("a");
    expect(next.matchScores.a).toBe(1);
  });

  it("bestOf 3 requires two round wins before the match ends", () => {
    const roundOver = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: {},
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "round_over",
      matchScores: { a: 1, b: 0 },
      rules: { bestOf: 3 },
    });
    expect(roundOver.status).toBe("round_over");

    // Not yet unanimous.
    const afterOneVote = actOrThrow(roundOver, "a", { type: "request_rematch" });
    const attempt = act(afterOneVote, "a", { type: "start_rematch" }, { seed: 7 });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error.code).toBe("REMATCH_NOT_UNANIMOUS");

    const afterBothVotes = actOrThrow(afterOneVote, "b", { type: "request_rematch" });
    const round2 = actOrThrow(afterBothVotes, "a", { type: "start_rematch" }, { seed: 7 });
    expect(round2.status).toBe("in_progress");
    expect(round2.roundNumber).toBe(2);
    expect(round2.matchScores.a).toBe(1);
  });

  it("resets scores and round number for a fresh match after match_over", () => {
    const matchOver = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: {},
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "match_over",
      matchScores: { a: 1, b: 0 },
      roundNumber: 1,
      rules: { bestOf: 1 },
    });
    const bothVoted = actOrThrow(actOrThrow(matchOver, "a", { type: "request_rematch" }), "b", {
      type: "request_rematch",
    });
    const freshMatch = actOrThrow(bothVoted, "a", { type: "start_rematch" }, { seed: 3 });
    expect(freshMatch.status).toBe("in_progress");
    expect(freshMatch.roundNumber).toBe(1);
    expect(freshMatch.matchScores).toEqual({ a: 0, b: 0 });
  });

  it("rejects starting a rematch with fewer than two active players", () => {
    const roundOver = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: {},
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "round_over",
      matchScores: { a: 0, b: 0 },
      playerOverrides: { b: { forfeited: true, requestedRematch: true } },
    });
    const withVote = actOrThrow(roundOver, "a", { type: "request_rematch" });
    const result = act(withVote, "a", { type: "start_rematch" }, { seed: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_ENOUGH_PLAYERS");
  });
});
