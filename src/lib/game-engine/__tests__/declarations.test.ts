import { describe, expect, it } from "vitest";
import { act, actOrThrow, craftInProgressState } from "./helpers";

describe("Last Card declaration", () => {
  it("no penalty when declared in the same action as the qualifying play", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "circle-3",
      declareLastCard: true,
    });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(1);
  });

  it("applies a 2-card penalty when the declaration is missing, but the move stands", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    const playerA = next.players.find((p) => p.userId === "a");
    expect(playerA?.hand.some((c) => c.id === "circle-10")).toBe(true);
    expect(playerA?.hand).toHaveLength(3); // 1 remaining + 2 penalty
  });

  it("does not apply when the rule is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { lastCardDeclaration: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(1);
  });

  it("can be declared via a standalone action before playing", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const declared = actOrThrow(state, "a", { type: "declare_last_card" });
    expect(declared.players.find((p) => p.userId === "a")?.lastCardArmed).toBe(true);
    const next = actOrThrow(declared, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(1);
  });

  it("rejects declaring when the rule is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3", "circle-10"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { lastCardDeclaration: false },
    });
    const result = act(state, "a", { type: "declare_last_card" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RULE_DISABLED");
  });
});

describe("Check Up declaration", () => {
  it("wins the round when declared and the final move is valid", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", {
      type: "play_card",
      cardId: "circle-3",
      declareCheckUp: true,
    });
    expect(next.status).toBe("match_over");
    expect(next.roundWinnerUserId).toBe("a");
    expect(next.matchWinnerUserId).toBe("a");
  });

  it("draws two cards and continues the round when Check Up was omitted", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.status).toBe("in_progress");
    expect(next.roundWinnerUserId).toBeNull();
    expect(next.players.find((p) => p.userId === "a")?.hand).toHaveLength(2);
  });

  it("wins immediately with no declaration required when the rule is disabled", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      rules: { checkUpDeclaration: false },
    });
    const next = actOrThrow(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(next.status).toBe("match_over");
    expect(next.roundWinnerUserId).toBe("a");
  });

  it("does not declare a winner before validating the declaration, even on the winning move", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(state, "a", { type: "play_card", cardId: "circle-3" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.matchWinnerUserId).toBeNull();
    }
  });
});
