import { describe, expect, it } from "vitest";
import { act, craftInProgressState } from "./helpers";

describe("turn timer expiry", () => {
  it("rejects resolving a timeout when there is no timer configured", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      turnDeadline: null,
    });
    const result = act(state, "b", { type: "resolve_timeout" }, { now: 999_999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TIMEOUT_NOT_YET_DUE");
  });

  it("rejects resolving a timeout before the deadline has passed", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      turnDeadline: 10_000,
    });
    const result = act(state, "b", { type: "resolve_timeout" }, { now: 5_000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TIMEOUT_NOT_YET_DUE");
  });

  it("auto-draws one card and passes the turn once the deadline has passed", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      turnDeadline: 10_000,
    });
    const result = act(state, "system", { type: "resolve_timeout" }, { now: 10_001 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.find((p) => p.userId === "a")?.hand).toHaveLength(2);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.events.some((e) => e.type === "turn_timeout")).toBe(true);
  });

  it("resolves an expired pending penalty by drawing the full accumulated amount", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      turnDeadline: 10_000,
      pendingPenalty: { type: "pickTwo", amount: 4, defendingNumber: 2 },
    });
    const result = act(state, "system", { type: "resolve_timeout" }, { now: 10_001 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.find((p) => p.userId === "a")?.hand).toHaveLength(5);
    expect(result.state.pendingPenalty).toBeNull();
  });

  it("cannot apply the same timeout resolution twice", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      turnDeadline: 10_000,
    });
    const timeoutActionId = "timeout:game-1:10000";
    const first = act(
      state,
      "system",
      { type: "resolve_timeout" },
      { now: 10_001, actionId: timeoutActionId },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = act(
      first.state,
      "system",
      { type: "resolve_timeout" },
      { now: 10_002, actionId: timeoutActionId, expectedVersion: first.state.stateVersion },
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("DUPLICATE_ACTION");
  });
});
