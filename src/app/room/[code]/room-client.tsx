"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Crown, Loader2, LogOut, Share2, UserX, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ensureSession,
  getCurrentSession,
  getRememberedNickname,
  rememberNickname,
} from "@/lib/auth/session";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { nicknameSchema } from "@/lib/validation/room";
import type { RuleConfig } from "@/lib/game-engine/rules";
import { GameBoard } from "@/components/game/game-board";

type RoomStatus = "lobby" | "active" | "finished";

interface RoomMemberRow {
  user_id: string;
  seat_number: number;
  display_name: string;
  is_host: boolean;
  ready: boolean;
  last_seen_at: string;
}

interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  max_players: number;
  settings: RuleConfig;
  host_user_id: string;
}

type PageState = "checking" | "need-join" | "joining" | "in-room" | "not-found";

const PRESENCE_STALE_MS = 45_000;

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [members, setMembers] = useState<RoomMemberRow[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Ticks periodically so the "online" staleness check below re-evaluates
  // over time, without calling the impure Date.now() directly during render.
  const [now, setNow] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, []);

  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const loadRoom = useCallback(async (): Promise<boolean> => {
    const { data: roomRow, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, status, max_players, settings, host_user_id")
      .eq("code", code)
      .maybeSingle();

    if (roomError || !roomRow) {
      return false;
    }

    setRoom(roomRow as unknown as RoomRow);

    const { data: memberRows } = await supabase
      .from("room_members")
      .select("user_id, seat_number, display_name, is_host, ready, last_seen_at")
      .eq("room_id", roomRow.id)
      .order("seat_number", { ascending: true });
    setMembers((memberRows as RoomMemberRow[]) ?? []);

    // Deliberately not filtered by status: once a room has ever started a
    // game, it stays on the board view for the lifetime of that game row —
    // including match_over (showing the result/rematch overlay) — rather
    // than bouncing back to the pre-game lobby UI. A fresh match reuses the
    // same room and the same game id (see start_rematch in the engine).
    const { data: gameRow } = await supabase
      .from("games")
      .select("id, status")
      .eq("room_id", roomRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveGameId(gameRow?.id ?? null);

    return true;
  }, [code, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setNickname(getRememberedNickname());
      const session = await getCurrentSession();
      if (cancelled) return;

      if (!session) {
        setPageState("need-join");
        return;
      }
      setCurrentUserId(session.user.id);

      const found = await loadRoom();
      if (cancelled) return;
      setPageState(found ? "in-room" : "need-join");
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadRoom]);

  // Realtime: room + membership changes, plus Presence for online status.
  useEffect(() => {
    if (pageState !== "in-room" || !room) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        () => void loadRoom(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        () => void loadRoom(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `room_id=eq.${room.id}` },
        () => void loadRoom(),
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string }>();
        setOnlineUserIds(
          new Set(Object.values(state).flatMap((entries) => entries.map((e) => e.userId))),
        );
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && currentUserId) {
        void channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() });
      }
    });

    const heartbeat = setInterval(() => {
      if (currentUserId) {
        void supabase
          .from("room_members")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("room_id", room.id)
          .eq("user_id", currentUserId);
      }
    }, 20_000);

    return () => {
      clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, room?.id, currentUserId]);

  async function handleJoin() {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Enter a nickname first.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await ensureSession(result.data);
      rememberNickname(result.data);
      setCurrentUserId(user.id);
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: result.data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to join the room.");
      const found = await loadRoom();
      setPageState(found ? "in-room" : "not-found");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReady(next: boolean) {
    if (!room || !currentUserId) return;
    const { error } = await supabase
      .from("room_members")
      .update({ ready: next })
      .eq("room_id", room.id)
      .eq("user_id", currentUserId);
    if (error) toast.error("Could not update ready status.");
  }

  async function kick(userId: string) {
    if (!room) return;
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", userId);
    if (error) toast.error("Could not remove that player.");
  }

  async function leaveRoom() {
    if (!room || !currentUserId) return;
    await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", currentUserId);
    router.push("/");
  }

  async function startGame() {
    if (!room) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to start the game.");
      setActiveGameId(data.gameId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Invite link copied!"),
      () => toast.error("Could not copy the link."),
    );
  }

  async function shareInviteLink() {
    const url = `${window.location.origin}/room/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Naija Whot game", url });
      } catch {
        // User cancelled the share sheet — not an error.
      }
    } else {
      copyInviteLink();
    }
  }

  if (pageState === "checking") {
    return (
      <main className="bg-felt flex min-h-screen items-center justify-center">
        <Loader2 className="text-cream size-8 animate-spin" aria-label="Loading" />
      </main>
    );
  }

  if (pageState === "need-join" || pageState === "not-found") {
    return (
      <main className="bg-felt flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="border-gold/30 bg-cream w-full max-w-sm rounded-2xl border p-6 shadow-xl">
          <h1 className="text-charcoal mb-1 text-xl font-bold">Join room {code}</h1>
          <p className="text-muted-foreground mb-4 text-sm">Enter a nickname to join this game.</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="join-nickname">Nickname</Label>
              <Input
                id="join-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Chidi"
                maxLength={20}
                autoFocus
              />
            </div>
            <Button onClick={handleJoin} disabled={busy}>
              {busy ? "Joining…" : "Join Room"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!room) return null;

  if (activeGameId) {
    return (
      <GameBoard
        roomId={room.id}
        gameId={activeGameId}
        currentUserId={currentUserId ?? ""}
        roomCode={room.code}
        ruleConfig={room.settings}
        players={members.map((m) => ({ userId: m.user_id, displayName: m.display_name }))}
        onlineUserIds={onlineUserIds}
      />
    );
  }

  const isHost = currentUserId === room.host_user_id;
  const nonHostMembers = members.filter((m) => !m.is_host);
  const allNonHostReady = nonHostMembers.every((m) => m.ready);
  const canStart = isHost && members.length >= 2 && allNonHostReady;

  return (
    <main className="bg-felt flex min-h-screen flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-2">
        <p className="text-cream/70 text-xs tracking-wide uppercase">Room code</p>
        <div className="flex items-center gap-2">
          <span className="text-gold font-mono text-4xl font-bold tracking-[0.2em]">
            {room.code}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-cream"
                  onClick={copyInviteLink}
                  aria-label="Copy invite link"
                />
              }
            >
              <Copy className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Copy invite link</TooltipContent>
          </Tooltip>
          <Button
            size="icon"
            variant="ghost"
            className="text-cream"
            onClick={shareInviteLink}
            aria-label="Share invite link"
          >
            <Share2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="border-gold/30 bg-cream w-full max-w-md rounded-2xl border p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-charcoal font-semibold">
            Players ({members.length}/{room.max_players})
          </h2>
          <Button variant="ghost" size="sm" onClick={leaveRoom} className="text-destructive gap-1">
            <LogOut className="size-3.5" /> Leave
          </Button>
        </div>

        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const online =
              onlineUserIds.has(member.user_id) ||
              now - new Date(member.last_seen_at).getTime() < PRESENCE_STALE_MS;
            return (
              <li
                key={member.user_id}
                className="bg-secondary/40 flex items-center justify-between rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {online ? (
                    <Wifi className="size-3.5 text-green-600" aria-label="Online" />
                  ) : (
                    <WifiOff className="text-muted-foreground size-3.5" aria-label="Disconnected" />
                  )}
                  <span className="text-charcoal font-medium">{member.display_name}</span>
                  {member.is_host && (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="size-3" /> Host
                    </Badge>
                  )}
                  {member.user_id === currentUserId && (
                    <Badge variant="outline" className="text-[10px]">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!member.is_host && (
                    <Badge variant={member.ready ? "default" : "outline"}>
                      {member.ready ? "Ready" : "Not ready"}
                    </Badge>
                  )}
                  {isHost && member.user_id !== currentUserId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => kick(member.user_id)}
                      aria-label={`Remove ${member.display_name}`}
                    >
                      <UserX className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2">
          {!isHost && (
            <Button
              variant={
                members.find((m) => m.user_id === currentUserId)?.ready ? "outline" : "default"
              }
              onClick={() => toggleReady(!members.find((m) => m.user_id === currentUserId)?.ready)}
            >
              {members.find((m) => m.user_id === currentUserId)?.ready ? "Not ready" : "I'm ready"}
            </Button>
          )}
          {isHost && (
            <Tooltip>
              <TooltipTrigger render={<span className="block w-full" />}>
                <Button onClick={startGame} disabled={!canStart || busy} className="w-full">
                  {busy ? "Starting…" : "Start Game"}
                </Button>
              </TooltipTrigger>
              {!canStart && (
                <TooltipContent>
                  {members.length < 2
                    ? "Waiting for at least one more player."
                    : "Waiting for all players to be ready."}
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      </div>

      <RuleSummary settings={room.settings} />
    </main>
  );
}

function RuleSummary({ settings }: { settings: RuleConfig }) {
  const chips: string[] = [
    `${settings.startingHandSize}-card hand`,
    settings.turnTimerSeconds ? `${settings.turnTimerSeconds}s timer` : "No timer",
    settings.bestOf === 1 ? "Single round" : `Best of ${settings.bestOf}`,
    settings.pickTwoStacking && "Pick Two",
    settings.pickThreeStacking && "Pick Three",
    settings.generalMarket && "General Market",
    settings.holdOn && "Hold On",
    settings.suspension && "Suspension",
    settings.lastCardDeclaration && "Last Card",
    settings.checkUpDeclaration && "Check Up",
    settings.doubleDecking && "Double decking",
    settings.directionChangeOnPenalty && "Direction change",
  ].filter(Boolean) as string[];

  return (
    <div className="flex w-full max-w-md flex-wrap justify-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip} variant="secondary" className="bg-cream/90 text-charcoal">
          {chip}
        </Badge>
      ))}
    </div>
  );
}
