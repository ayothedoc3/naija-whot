import { describe, expect, it } from "vitest";
import { act, craftInProgressState } from "./helpers";

describe("concurrency and lifecycle guards", () => {
  it("rejects a replayed action id even when resubmitted against the resulting state", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const first = act(state, "a", { type: "draw_card" }, { actionId: "shared-id" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = act(first.state, "a", { type: "draw_card" }, { actionId: "shared-id" });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.error.code).toBe("DUPLICATE_ACTION");
  });

  it("rejects an action submitted against a stale expected version", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    const result = act(
      state,
      "a",
      { type: "draw_card" },
      { expectedVersion: state.stateVersion + 1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VERSION_CONFLICT");
    }
  });

  it("the loser of a race gets a version conflict instead of silently overwriting", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
    });
    // Two requests both computed against the same starting version — only the
    // first to commit should succeed; the second must see a version conflict
    // when checked against the now-advanced canonical state.
    const winner = act(
      state,
      "a",
      { type: "draw_card" },
      { expectedVersion: state.stateVersion, actionId: "req-1" },
    );
    expect(winner.ok).toBe(true);
    if (!winner.ok) return;

    const loser = act(
      winner.state,
      "a",
      { type: "draw_card" },
      {
        expectedVersion: state.stateVersion,
        actionId: "req-2",
      },
    );
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.error.code).toBe("VERSION_CONFLICT");
  });

  it("rejects any game action after the match has ended", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "match_over",
    });
    const result = act(state, "a", { type: "draw_card" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GAME_ALREADY_ENDED");
  });

  it("rejects playing before the game has started", () => {
    const state = craftInProgressState({
      seatUserIds: ["a", "b"],
      hands: { a: ["circle-3"], b: ["circle-4"] },
      topCardId: "circle-5",
      currentPlayerUserId: "a",
      status: "not_started",
    });
    const result = act(state, "a", { type: "draw_card" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GAME_NOT_IN_PROGRESS");
  });
});
