import { describe, expect, it } from "vitest";
import { gameActionSchema } from "../game-action";

describe("gameActionSchema actionId", () => {
  it("accepts a client-generated UUID (the normal case)", () => {
    const result = gameActionSchema.safeParse({
      type: "draw_card",
      actionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      expectedVersion: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts the timeout:{gameId}:{deadline} format used by resolve_timeout", () => {
    // Regression test: this format was previously rejected because the
    // schema required strict UUID format, silently breaking every turn
    // timeout in production (caught by a real two-browser Playwright run —
    // see docs/ARCHITECTURE.md § Turn timer for why this id shape exists).
    const result = gameActionSchema.safeParse({
      type: "resolve_timeout",
      actionId: "timeout:3fa85f64-5717-4562-b3fc-2c963f66afa6:1735689600000",
      expectedVersion: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty actionId", () => {
    const result = gameActionSchema.safeParse({
      type: "draw_card",
      actionId: "",
      expectedVersion: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an actionId with disallowed characters", () => {
    const result = gameActionSchema.safeParse({
      type: "draw_card",
      actionId: "not an id!",
      expectedVersion: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an overly long actionId", () => {
    const result = gameActionSchema.safeParse({
      type: "draw_card",
      actionId: "a".repeat(101),
      expectedVersion: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("gameActionSchema per-action payloads", () => {
  const base = { actionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", expectedVersion: 0 };

  it("requires cardId for play_card", () => {
    expect(gameActionSchema.safeParse({ ...base, type: "play_card" }).success).toBe(false);
    expect(
      gameActionSchema.safeParse({ ...base, type: "play_card", cardId: "circle-5" }).success,
    ).toBe(true);
  });

  it("requires a non-empty cardIds array for play_multi", () => {
    expect(gameActionSchema.safeParse({ ...base, type: "play_multi", cardIds: [] }).success).toBe(
      false,
    );
    expect(
      gameActionSchema.safeParse({ ...base, type: "play_multi", cardIds: ["circle-2", "star-2"] })
        .success,
    ).toBe(true);
  });

  it("rejects Whot as a chosenShape", () => {
    const result = gameActionSchema.safeParse({
      ...base,
      type: "play_card",
      cardId: "whot-1",
      chosenShape: "Whot",
    });
    expect(result.success).toBe(false);
  });

  it("accepts action types with no extra payload", () => {
    for (const type of [
      "start_game",
      "draw_card",
      "accept_penalty",
      "declare_last_card",
      "declare_check_up",
      "leave_game",
      "forfeit",
      "resolve_timeout",
      "request_rematch",
      "start_rematch",
    ]) {
      expect(gameActionSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });
});
