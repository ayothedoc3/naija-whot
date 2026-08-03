import { ROOM_CODE_CHARSET } from "@/lib/validation/room";

/** Cryptographically random 6-character room code from the same charset the
 *  database CHECK constraint enforces (excludes 0/O/1/I). */
export function generateRoomCode(): string {
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const value of bytes) {
    code += ROOM_CODE_CHARSET[value % ROOM_CODE_CHARSET.length];
  }
  return code;
}
