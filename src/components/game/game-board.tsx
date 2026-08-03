"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Bookmark, Flag, Loader2, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Card as WhotCard, RequestableShape, Shape } from "@/lib/game-engine/cards";
import type { RuleConfig } from "@/lib/game-engine/rules";
import type { PublicGameState } from "@/lib/game-engine/public-state";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { CardBack } from "./card-back";
import { CardFace } from "./card-face";
import { PlayerSeat } from "./player-seat";
import { ShapeSelector } from "./shape-selector";
import { RoundResultOverlay } from "./round-result-overlay";
import { SHAPE_ICONS, SHAPE_LABELS } from "./card-visuals";

interface GameBoardProps {
  roomId: string;
  gameId: string;
  currentUserId: string;
  roomCode: string;
  ruleConfig: RuleConfig;
  players: { userId: string; displayName: string }[];
  onlineUserIds: Set<string>;
}

function isCardPlayableClientSide(card: WhotCard, state: PublicGameState): boolean {
  if (state.pendingPenalty) return card.number === state.pendingPenalty.defendingNumber;
  if (card.shape === "Whot") return true;
  if (card.shape === state.activeShape) return true;
  return state.topCard ? card.number === state.topCard.number : false;
}

export function GameBoard({
  gameId,
  currentUserId,
  ruleConfig,
  players,
  onlineUserIds,
}: GameBoardProps) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [hand, setHand] = useState<WhotCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [pendingShapeSelection, setPendingShapeSelection] = useState(false);
  const [declareLastCard, setDeclareLastCard] = useState(false);
  const [declareCheckUp, setDeclareCheckUp] = useState(false);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const triedTimeoutForDeadline = useRef<number | null>(null);

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) map.set(p.userId, p.displayName);
    return map;
  }, [players]);

  const loadPublicState = useCallback(async (): Promise<PublicGameState | null> => {
    const { data } = await supabase
      .from("games")
      .select("public_state")
      .eq("id", gameId)
      .maybeSingle();
    const next = data ? (data.public_state as unknown as PublicGameState) : null;
    if (next) setPublicState(next);
    return next;
  }, [gameId, supabase]);

  const loadHand = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/hand`);
    if (res.ok) {
      const json = await res.json();
      setHand(json.hand as WhotCard[]);
    }
  }, [gameId]);

  useEffect(() => {
    // Standard async-data-fetch-on-mount pattern — the lint rule's
    // cascading-render heuristic traces into these async calls, but there's
    // no synchronous setState here to cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPublicState();
    void loadHand();
  }, [loadPublicState, loadHand]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as { public_state: PublicGameState };
          // Realtime delivery order isn't guaranteed — never let a stale
          // snapshot overwrite a newer one the client already applied
          // (e.g. from the action response returning before the broadcast
          // arrives, or a reordered delivery).
          setPublicState((prev) =>
            prev && prev.stateVersion > row.public_state.stateVersion ? prev : row.public_state,
          );
          void loadHand();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const evt = payload.new as {
            event_type: string;
            public_payload: Record<string, unknown>;
          };
          announceEvent(evt.event_type, evt.public_payload, nameByUserId, currentUserId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const performAction = useCallback(
    async (
      action: Record<string, unknown>,
      expectedVersion: number,
      isRetry = false,
    ): Promise<void> => {
      setBusy(true);
      try {
        const res = await fetch(`/api/games/${gameId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...action, actionId: crypto.randomUUID(), expectedVersion }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Someone else's action landed first. The user's intent is still
          // valid — retry once against the now-current version, rather than
          // silently dropping their click (a real risk when two players act
          // near-simultaneously, e.g. both hitting "ready for rematch").
          if (data.error?.code === "VERSION_CONFLICT" && !isRetry) {
            const fresh = await loadPublicState();
            await loadHand();
            if (fresh) {
              await performAction(action, fresh.stateVersion, true);
            }
            return;
          }
          if (data.error?.code === "DUPLICATE_ACTION") {
            await loadPublicState();
            await loadHand();
          } else {
            toast.error(data.error?.message ?? "That didn't work.");
          }
          return;
        }
        setPublicState(data.publicState);
        setHand(data.hand);
        setSelectedCardIds([]);
        setDeclareLastCard(false);
        setDeclareCheckUp(false);
        setReverseDirection(false);
      } catch {
        toast.error("Network error — please try again.");
      } finally {
        setBusy(false);
      }
    },
    [gameId, loadPublicState, loadHand],
  );

  const submitAction = useCallback(
    (action: Record<string, unknown>) => {
      if (!publicState) return Promise.resolve();
      return performAction(action, publicState.stateVersion);
    },
    [publicState, performAction],
  );

  // Lazy timeout resolution: if the deadline has passed, ask the server to
  // resolve it (idempotent — harmless if another client already did).
  useEffect(() => {
    if (!publicState?.turnDeadline || publicState.status !== "in_progress") return;
    if (now < publicState.turnDeadline) return;
    if (triedTimeoutForDeadline.current === publicState.turnDeadline) return;
    triedTimeoutForDeadline.current = publicState.turnDeadline;
    void fetch(`/api/games/${gameId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "resolve_timeout",
        actionId: `timeout:${gameId}:${publicState.turnDeadline}`,
        expectedVersion: publicState.stateVersion,
      }),
    }).then((res) => {
      if (res.ok) {
        res.json().then((data) => {
          setPublicState(data.publicState);
          void loadHand();
        });
      }
    });
  }, [now, publicState, gameId, loadHand]);

  if (!publicState) {
    return (
      <main className="bg-felt flex min-h-screen items-center justify-center">
        <Loader2 className="text-cream size-8 animate-spin" />
      </main>
    );
  }

  const isMyTurn = publicState.currentPlayerUserId === currentUserId;
  const myPlayer = publicState.players.find((p) => p.userId === currentUserId);
  const opponents = publicState.players.filter((p) => p.userId !== currentUserId);
  const selectedCards = selectedCardIds
    .map((id) => hand.find((c) => c.id === id))
    .filter(Boolean) as WhotCard[];
  const firstSelected = selectedCards[0];
  const canSelectMore = ruleConfig.doubleDecking;

  function toggleCard(card: WhotCard) {
    if (!isMyTurn || busy) return;
    setSelectedCardIds((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
      if (prev.length === 0) return [card.id];
      if (canSelectMore && firstSelected && card.number === firstSelected.number) {
        return [...prev, card.id];
      }
      return [card.id];
    });
  }

  function handleConfirmPlay() {
    if (selectedCards.length === 0) return;
    const finalCard = selectedCards[selectedCards.length - 1] as WhotCard;
    if (finalCard.shape === "Whot") {
      setPendingShapeSelection(true);
      return;
    }
    void submitPlay();
  }

  function submitPlay(chosenShape?: RequestableShape) {
    const payload =
      selectedCardIds.length > 1
        ? {
            type: "play_multi",
            cardIds: selectedCardIds,
            chosenShape,
            declareLastCard,
            declareCheckUp,
            reverseDirection,
          }
        : {
            type: "play_card",
            cardId: selectedCardIds[0],
            chosenShape,
            declareLastCard,
            declareCheckUp,
            reverseDirection,
          };
    setPendingShapeSelection(false);
    return submitAction(payload);
  }

  const showLastCardToggle = isMyTurn && ruleConfig.lastCardDeclaration && hand.length === 2;
  const showCheckUpToggle = isMyTurn && ruleConfig.checkUpDeclaration && hand.length === 1;
  const showReverseToggle =
    isMyTurn &&
    ruleConfig.directionChangeOnPenalty &&
    firstSelected &&
    (firstSelected.number === 2 || firstSelected.number === 5);

  const secondsLeft = publicState.turnDeadline
    ? Math.max(0, Math.ceil((publicState.turnDeadline - now) / 1000))
    : null;

  return (
    <main className="bg-felt flex min-h-screen flex-col gap-4 px-3 py-4">
      <ShapeSelector open={pendingShapeSelection} onSelect={(shape) => void submitPlay(shape)} />

      {(publicState.status === "round_over" || publicState.status === "match_over") && (
        <RoundResultOverlay
          publicState={publicState}
          nameByUserId={nameByUserId}
          currentUserId={currentUserId}
          gameId={gameId}
          onAction={submitAction}
          busy={busy}
        />
      )}

      <header className="flex items-center justify-between">
        <div className="text-cream/80 flex items-center gap-2 text-xs">
          <span>Round {publicState.roundNumber}</span>
          {publicState.bestOf > 1 && (
            <span>
              · Match {Object.values(publicState.matchScores).join("–")} (best of{" "}
              {publicState.bestOf})
            </span>
          )}
        </div>
        {secondsLeft !== null && (
          <Badge variant={secondsLeft <= 5 ? "destructive" : "secondary"} className="font-mono">
            {secondsLeft}s
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-cream/70 gap-1"
          onClick={() => void submitAction({ type: "forfeit" })}
        >
          <Flag className="size-3.5" /> Forfeit
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {opponents.map((p) => (
          <PlayerSeat
            key={p.userId}
            displayName={nameByUserId.get(p.userId) ?? "Player"}
            handCount={p.handCount}
            isCurrentTurn={publicState.currentPlayerUserId === p.userId}
            online={onlineUserIds.has(p.userId)}
            isSelf={false}
            lastCardDeclared={p.lastCardDeclared}
            checkUpDeclared={p.checkUpDeclared}
            forfeited={p.forfeited}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              data-testid="draw-card"
              disabled={!isMyTurn || busy || Boolean(publicState.pendingPenalty)}
              onClick={() => void submitAction({ type: "draw_card" })}
              className="disabled:opacity-40"
              aria-label="Draw a card"
            >
              <CardBack size="lg" />
            </button>
            <span className="text-cream/70 text-xs">Market · {publicState.marketCount}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            {publicState.topCard && (
              <CardFace card={publicState.topCard} size="lg" data-testid="top-card" />
            )}
            <span
              data-testid="active-shape"
              className="text-cream/70 flex items-center gap-1 text-xs"
            >
              <ShapeIcon shape={publicState.activeShape} /> {SHAPE_LABELS[publicState.activeShape]}
            </span>
          </div>
        </div>

        {publicState.pendingPenalty && (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">
              Pick {publicState.pendingPenalty.amount} pending (
              {publicState.pendingPenalty.type === "pickTwo" ? "2s" : "5s"})
            </Badge>
            {isMyTurn && (
              <Button
                size="sm"
                onClick={() => void submitAction({ type: "accept_penalty" })}
                disabled={busy}
              >
                Draw {publicState.pendingPenalty.amount}
              </Button>
            )}
          </div>
        )}

        <p data-testid="turn-indicator" className="text-cream text-sm font-medium">
          {isMyTurn
            ? "Your turn"
            : `${nameByUserId.get(publicState.currentPlayerUserId ?? "") ?? "Opponent"}'s turn`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2">
          {showLastCardToggle && (
            <Button
              size="sm"
              variant={declareLastCard ? "default" : "outline"}
              onClick={() => setDeclareLastCard((v) => !v)}
              className="gap-1"
            >
              <Bookmark className="size-3.5" /> Last Card
            </Button>
          )}
          {showCheckUpToggle && (
            <Button
              size="sm"
              variant={declareCheckUp ? "default" : "outline"}
              onClick={() => setDeclareCheckUp((v) => !v)}
              className="gap-1"
            >
              <ShieldCheck className="size-3.5" /> Check Up
            </Button>
          )}
          {showReverseToggle && (
            <Button
              size="sm"
              variant={reverseDirection ? "default" : "outline"}
              onClick={() => setReverseDirection((v) => !v)}
              className="gap-1"
            >
              <ArrowLeftRight className="size-3.5" /> Reverse
            </Button>
          )}
          {selectedCardIds.length > 0 && (
            <Button size="sm" onClick={handleConfirmPlay} disabled={busy} className="gap-1">
              <Play className="size-3.5" /> Play{" "}
              {selectedCardIds.length > 1 ? selectedCardIds.length : ""}
            </Button>
          )}
        </div>

        <div
          className="flex justify-center gap-1 overflow-x-auto pb-2"
          role="list"
          aria-label="Your hand"
        >
          {hand.map((card) => {
            const playable = isMyTurn && isCardPlayableClientSide(card, publicState);
            return (
              <CardFace
                key={card.id}
                card={card}
                data-testid="hand-card"
                playable={!isMyTurn || playable}
                selected={selectedCardIds.includes(card.id)}
                onClick={() => toggleCard(card)}
              />
            );
          })}
        </div>
        <p className="text-cream/60 text-center text-xs">
          {myPlayer ? `You have ${myPlayer.handCount} cards` : null}
        </p>
      </div>
    </main>
  );
}

function ShapeIcon({ shape }: { shape: Shape }) {
  const Icon = SHAPE_ICONS[shape];
  return <Icon className="size-3" />;
}

function announceEvent(
  eventType: string,
  payload: Record<string, unknown>,
  nameByUserId: Map<string, string>,
  currentUserId: string,
) {
  const nameOf = (id: unknown) =>
    typeof id === "string" ? (nameByUserId.get(id) ?? "A player") : "A player";
  const isMe = (id: unknown) => id === currentUserId;

  switch (eventType) {
    case "hold_on":
      if (!isMe(payload.actorUserId))
        toast.info(`${nameOf(payload.actorUserId)} played Hold On and goes again.`);
      break;
    case "suspension":
      toast.info(`${nameOf(payload.actorUserId)} suspended ${nameOf(payload.skippedUserId)}.`);
      break;
    case "general_market":
      toast.info(`${nameOf(payload.actorUserId)} called General Market.`);
      break;
    case "last_card_penalty":
      toast.warning(`${nameOf(payload.actorUserId)} forgot to declare Last Card — drew 2.`);
      break;
    case "check_up_penalty":
      toast.warning(`${nameOf(payload.actorUserId)} forgot to declare Check Up — drew 2.`);
      break;
    case "turn_timeout":
      toast.info(`${nameOf(payload.previousPlayerUserId)}'s turn timed out.`);
      break;
    default:
      break;
  }
}
