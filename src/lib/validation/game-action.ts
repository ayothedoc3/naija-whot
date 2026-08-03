import { z } from "zod";
import { REQUESTABLE_SHAPES } from "@/lib/game-engine/cards";

const actionEnvelope = {
  // Normal actions use a client-generated UUID; the resolve_timeout action
  // deliberately uses `timeout:{gameId}:{deadlineMs}` instead (see
  // docs/ARCHITECTURE.md § Turn timer) so two racing timeout resolutions
  // collide on the same id rather than both applying. Validate shape/length
  // generically rather than requiring UUID format specifically.
  actionId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9:._-]+$/, "actionId contains invalid characters"),
  expectedVersion: z.number().int().min(0),
};

const requestableShapeSchema = z.enum(REQUESTABLE_SHAPES);

const declarationFlags = {
  declareLastCard: z.boolean().optional(),
  declareCheckUp: z.boolean().optional(),
  reverseDirection: z.boolean().optional(),
};

const cardIdSchema = z.string().min(1).max(40);

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start_game"), ...actionEnvelope }),
  z.object({
    type: z.literal("play_card"),
    ...actionEnvelope,
    cardId: cardIdSchema,
    chosenShape: requestableShapeSchema.optional(),
    ...declarationFlags,
  }),
  z.object({
    type: z.literal("play_multi"),
    ...actionEnvelope,
    cardIds: z.array(cardIdSchema).min(1).max(10),
    chosenShape: requestableShapeSchema.optional(),
    ...declarationFlags,
  }),
  z.object({ type: z.literal("draw_card"), ...actionEnvelope }),
  z.object({ type: z.literal("accept_penalty"), ...actionEnvelope }),
  z.object({ type: z.literal("declare_last_card"), ...actionEnvelope }),
  z.object({ type: z.literal("declare_check_up"), ...actionEnvelope }),
  z.object({ type: z.literal("leave_game"), ...actionEnvelope }),
  z.object({ type: z.literal("forfeit"), ...actionEnvelope }),
  z.object({ type: z.literal("resolve_timeout"), ...actionEnvelope }),
  z.object({ type: z.literal("request_rematch"), ...actionEnvelope }),
  z.object({ type: z.literal("start_rematch"), ...actionEnvelope }),
]);

export type GameActionInput = z.infer<typeof gameActionSchema>;
