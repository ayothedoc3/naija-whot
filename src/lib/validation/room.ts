import { z } from "zod";
import { RULE_BOUNDS } from "@/lib/game-engine/rules";

/** Excludes 0/O and 1/I to avoid visually ambiguous codes — mirrors the
 *  CHECK constraint on rooms.code in supabase/migrations/0002_rooms.sql. */
export const ROOM_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ROOM_CODE_REGEX, "Room codes are 6 characters (letters and numbers, no 0/O/1/I).");

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Nickname must be at least 2 characters.")
  .max(20, "Nickname must be at most 20 characters.")
  .regex(/^[\p{L}\p{N} '_-]+$/u, "Nickname can only contain letters, numbers, spaces, - _ and '.");

export const turnTimerSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(60),
  z.null(),
]);

export const bestOfSchema = z.union([z.literal(1), z.literal(3), z.literal(5)]);

export const roomSettingsSchema = z.object({
  maxPlayers: z.number().int().min(RULE_BOUNDS.maxPlayers.min).max(RULE_BOUNDS.maxPlayers.max),
  startingHandSize: z
    .number()
    .int()
    .min(RULE_BOUNDS.startingHandSize.min)
    .max(RULE_BOUNDS.startingHandSize.max),
  turnTimerSeconds: turnTimerSchema,
  pickTwoStacking: z.boolean(),
  pickThreeStacking: z.boolean(),
  generalMarket: z.boolean(),
  holdOn: z.boolean(),
  suspension: z.boolean(),
  lastCardDeclaration: z.boolean(),
  checkUpDeclaration: z.boolean(),
  multiCardPlay: z.boolean(),
  doubleDecking: z.boolean().optional(),
  directionChangeOnPenalty: z.boolean(),
  bestOf: bestOfSchema,
});

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  settings: roomSettingsSchema,
});

export const joinRoomSchema = z.object({
  nickname: nicknameSchema,
  code: roomCodeSchema,
});

export type RoomSettingsInput = z.infer<typeof roomSettingsSchema>;
