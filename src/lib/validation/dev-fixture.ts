import { z } from "zod";

/**
 * Validates the body of the dev-fixture start route. This route is also
 * gated by a hard `process.env.NODE_ENV !== "production"` check in the
 * route itself (never trusting any client-supplied flag) — see
 * docs/ARCHITECTURE.md § Development fixture mode.
 */
export const devFixtureStartSchema = z.object({
  roomCode: z.string().min(1).max(20),
  hands: z.record(z.string(), z.array(z.string().min(1).max(40)).min(0).max(20)),
  topCardId: z.string().min(1).max(40),
  currentPlayerUserId: z.string().min(1),
  activeShape: z.enum(["Circle", "Triangle", "Cross", "Square", "Star"]).optional(),
  marketCardIds: z.array(z.string()).optional(),
  discardHistoryIds: z.array(z.string()).optional(),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
});

export type DevFixtureStartInput = z.infer<typeof devFixtureStartSchema>;
