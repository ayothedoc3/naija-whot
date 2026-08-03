import { beforeAll, describe, expect, it } from "vitest";
import { randomRoomCode, serviceRoleClient, signInNewAnonymousUser } from "./helpers";

/**
 * Runs against a REAL local Supabase instance (`pnpm supabase:start`), not a
 * mock. Skipped by default so `pnpm test` stays hermetic in CI/anywhere
 * without Docker; run explicitly with `pnpm test:integration`.
 */
const RUN = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "1";

describe.skipIf(!RUN)("Supabase RLS and RPC security", () => {
  let alice: Awaited<ReturnType<typeof signInNewAnonymousUser>>;
  let bob: Awaited<ReturnType<typeof signInNewAnonymousUser>>;
  let carol: Awaited<ReturnType<typeof signInNewAnonymousUser>>; // never joins the room
  let roomId: string;
  let gameId: string;

  const service = serviceRoleClient();

  beforeAll(async () => {
    alice = await signInNewAnonymousUser("Alice");
    bob = await signInNewAnonymousUser("Bob");
    carol = await signInNewAnonymousUser("Carol");

    const { data: room, error: roomErr } = await service
      .from("rooms")
      .insert({ code: randomRoomCode(), host_user_id: alice.user.id, max_players: 4 })
      .select()
      .single();
    if (roomErr || !room) throw new Error(`Failed to seed room: ${roomErr?.message}`);
    roomId = room.id;

    const { error: memberErr } = await service.from("room_members").insert([
      {
        room_id: roomId,
        user_id: alice.user.id,
        seat_number: 0,
        display_name: "Alice",
        is_host: true,
      },
      {
        room_id: roomId,
        user_id: bob.user.id,
        seat_number: 1,
        display_name: "Bob",
        is_host: false,
      },
    ]);
    if (memberErr) throw new Error(`Failed to seed room_members: ${memberErr.message}`);

    const { data: id, error: gameErr } = await service.rpc("create_game", {
      p_game_id: crypto.randomUUID(),
      p_room_id: roomId,
      p_public_state: {
        status: "in_progress",
        roundNumber: 1,
        stateVersion: 1,
        turnDeadline: null,
        matchWinnerUserId: null,
        players: [
          { userId: alice.user.id, handCount: 5 },
          { userId: bob.user.id, handCount: 5 },
        ],
      },
      p_canonical_state: {
        players: [
          { userId: alice.user.id, hand: ["circle-1", "circle-2"] },
          { userId: bob.user.id, hand: ["star-3", "star-4"] },
        ],
      },
    });
    if (gameErr || !id) throw new Error(`Failed to seed game: ${gameErr?.message}`);
    gameId = id;
  });

  it("a user cannot read another user's profile", async () => {
    const { data } = await alice.client.from("profiles").select("*").eq("user_id", bob.user.id);
    expect(data).toEqual([]);
  });

  it("a non-member cannot read a room", async () => {
    const { data: forMember } = await alice.client.from("rooms").select("*").eq("id", roomId);
    expect(forMember).toHaveLength(1);

    const { data: forOutsider } = await carol.client.from("rooms").select("*").eq("id", roomId);
    expect(forOutsider).toEqual([]);
  });

  it("a non-member cannot read room_members", async () => {
    const { data: forMember } = await alice.client
      .from("room_members")
      .select("*")
      .eq("room_id", roomId);
    expect(forMember).toHaveLength(2);

    const { data: forOutsider } = await carol.client
      .from("room_members")
      .select("*")
      .eq("room_id", roomId);
    expect(forOutsider).toEqual([]);
  });

  it("a player can update only their own ready flag, not seat_number or another player's row", async () => {
    const { error: readyErr } = await bob.client
      .from("room_members")
      .update({ ready: true })
      .eq("room_id", roomId)
      .eq("user_id", bob.user.id);
    expect(readyErr).toBeNull();

    const { error: seatErr } = await bob.client
      .from("room_members")
      .update({ seat_number: 99 })
      .eq("room_id", roomId)
      .eq("user_id", bob.user.id);
    expect(seatErr?.message).toMatch(/permission denied/i);

    const { data: crossUpdateData } = await bob.client
      .from("room_members")
      .update({ ready: true })
      .eq("room_id", roomId)
      .eq("user_id", alice.user.id)
      .select();
    expect(crossUpdateData).toEqual([]);
  });

  it("a non-member cannot read a game's sanitized public state", async () => {
    const { data: forMember } = await alice.client.from("games").select("*").eq("id", gameId);
    expect(forMember).toHaveLength(1);
    expect(forMember?.[0]?.public_state).not.toHaveProperty("hand");

    const { data: forOutsider } = await carol.client.from("games").select("*").eq("id", gameId);
    expect(forOutsider).toEqual([]);
  });

  it("no client role can read game_secret_states, even a room member", async () => {
    const { data, error } = await alice.client
      .from("game_secret_states")
      .select("*")
      .eq("game_id", gameId);
    expect(data === null || data.length === 0).toBe(true);
    if (error) expect(error.message).toMatch(/permission denied/i);
  });

  it("no client role can call commit_game_transition directly", async () => {
    const { error } = await alice.client.rpc("commit_game_transition", {
      p_game_id: gameId,
      p_expected_version: 1,
      p_new_state_version: 2,
      p_new_canonical_state: {},
      p_new_public_state: { status: "in_progress" },
      p_action_id: "client-forged-action",
      p_actor_user_id: alice.user.id,
      p_events: [],
    });
    expect(error?.message).toMatch(/permission denied/i);
  });

  it("service-role commit_game_transition rejects a replayed action id", async () => {
    const { error: firstErr } = await service.rpc("commit_game_transition", {
      p_game_id: gameId,
      p_expected_version: 1,
      p_new_state_version: 2,
      p_new_canonical_state: { players: [] },
      p_new_public_state: { status: "in_progress", stateVersion: 2 },
      p_action_id: "integration-test-action-1",
      p_actor_user_id: alice.user.id,
      p_events: [{ type: "card_played", actorUserId: alice.user.id, cardIds: ["circle-1"] }],
    });
    expect(firstErr).toBeNull();

    const { error: replayErr } = await service.rpc("commit_game_transition", {
      p_game_id: gameId,
      p_expected_version: 2,
      p_new_state_version: 3,
      p_new_canonical_state: { players: [] },
      p_new_public_state: { status: "in_progress", stateVersion: 3 },
      p_action_id: "integration-test-action-1",
      p_actor_user_id: alice.user.id,
      p_events: [],
    });
    expect(replayErr?.message).toBe("DUPLICATE_ACTION");
  });

  it("service-role commit_game_transition rejects a stale expected version", async () => {
    const { error } = await service.rpc("commit_game_transition", {
      p_game_id: gameId,
      p_expected_version: 1, // stale — the previous test already advanced this to 2
      p_new_state_version: 4,
      p_new_canonical_state: { players: [] },
      p_new_public_state: { status: "in_progress", stateVersion: 4 },
      p_action_id: "integration-test-action-2",
      p_actor_user_id: alice.user.id,
      p_events: [],
    });
    expect(error?.message).toBe("VERSION_CONFLICT");
  });

  it("game_events payloads never contain another player's hand", async () => {
    const { data } = await alice.client.from("game_events").select("*").eq("game_id", gameId);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("star-3");
    expect(serialized).not.toContain("star-4");
  });
});
