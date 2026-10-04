"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownUp, ArrowLeftRight, Bookmark, Flag, Loader2, Play, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioControls } from "@/components/audio/audio-controls";
import type { Card as WhotCard, RequestableShape, Shape } from "@/lib/game-engine/cards";
import type { RuleConfig } from "@/lib/game-engine/rules";
import type { PublicGameState } from "@/lib/game-engine/public-state";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { sound } from "@/lib/sound";
import { CardBack } from "./card-back";
import { CardFace } from "./card-face";
import { PlayerSeat } from "./player-seat";
import { ShapeSelector } from "./shape-selector";
import { RoundResultOverlay } from "./round-result-overlay";
import { SHAPE_ICONS, SHAPE_LABELS } from "./card-visuals";
import { RulesHelpDialog } from "@/components/rules/rules-help-dialog";

interface GameBoardProps {
  roomId: string;
  gameId: string;
  currentUserId: string;
  roomCode: string;
  ruleConfig: RuleConfig;
  players: { userId: string; displayName: string }[];
  onlineUserIds: Set<string>;
}

function isCardPlayableClientSide(
  card: WhotCard,
  state: PublicGameState,
  ruleConfig?: RuleConfig,
): boolean {
  if (state.pendingPenalty) {
    const stackingEnabled =
      state.pendingPenalty.type === "pickTwo"
        ? ruleConfig?.pickTwoStacking !== false
        : ruleConfig?.pickThreeStacking !== false;
    return stackingEnabled && card.number === state.pendingPenalty.defendingNumber;
  }
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
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [hand, setHand] = useState<WhotCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [pendingShapeSelection, setPendingShapeSelection] = useState(false);
  const [declareLastCard, setDeclareLastCard] = useState(false);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [roundScores, setRoundScores] = useState<Record<string, number> | null>(null);
  const triedTimeoutForDeadline = useRef<number | null>(null);
  const previousIsMyTurn = useRef<boolean | null>(null);
  const handRequestId = useRef(0);
  const handViewportRef = useRef<HTMLDivElement | null>(null);

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
    // Realtime events (a games UPDATE, a game_events INSERT) can fire in
    // quick succession — e.g. match_over followed almost immediately by a
    // rematch's fresh deal — each triggering its own loadHand() call with
    // no guarantee their *responses* resolve in the same order they were
    // issued. Without this guard, a slower older request's response can
    // land after a faster newer one and silently overwrite it with stale
    // cards. Only the response to the most recently issued request wins.
    const requestId = ++handRequestId.current;
    const res = await fetch(`/api/games/${gameId}/hand`, { cache: "no-store" });
    if (res.ok && requestId === handRequestId.current) {
      const json = await res.json();
      if (requestId === handRequestId.current) {
        setHand(json.hand as WhotCard[]);
      }
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

  // Realtime is a convenience channel, not a delivery guarantee — under a
  // burst of rapid successive commits to the same game row (e.g. match_over
  // followed almost immediately by a rematch vote and a fresh deal), a
  // Postgres changes event can occasionally be missed entirely. This
  // periodic re-sync is the fallback that guarantees eventual consistency
  // even if that happens, the same way RoomClient's presence heartbeat
  // guarantees the lobby doesn't get permanently stuck on a stale view.
  useEffect(() => {
    const resync = setInterval(() => {
      void loadPublicState();
      void loadHand();
    }, 4_000);
    return () => clearInterval(resync);
  }, [loadPublicState, loadHand]);

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
          if (evt.event_type === "round_over") {
            const scores = evt.public_payload.remainingCardScores;
            if (scores && typeof scores === "object") {
              setRoundScores(scores as Record<string, number>);
            }
            if (evt.public_payload.winnerUserId === currentUserId) sound.roundWin();
            else sound.roundLose();
          }
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
        let currentVersion = expectedVersion;
        let attemptedRetry = isRetry;

        for (;;) {
          const res = await fetch(`/api/games/${gameId}/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...action,
              actionId: crypto.randomUUID(),
              expectedVersion: currentVersion,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            // Someone else's action landed first. The user's intent is still
            // valid — retry once against the now-current version, rather than
            // silently dropping their click (a real risk when two players act
            // near-simultaneously, e.g. both hitting "ready for rematch").
            if (data.error?.code === "VERSION_CONFLICT" && !attemptedRetry) {
              attemptedRetry = true;
              const fresh = await loadPublicState();
              await loadHand();
              if (fresh) {
                currentVersion = fresh.stateVersion;
                continue;
              }
              return;
            }
            if (data.error?.code === "DUPLICATE_ACTION") {
              await loadPublicState();
              await loadHand();
            } else {
              sound.error();
              const message = data.error?.message ?? "That didn't work.";
              setLastActionError(message);
              toast.error(message);
            }
            return;
          }
          const actionType = action.type;
          if (actionType === "play_card" || actionType === "play_multi") sound.cardPlay();
          else if (actionType === "draw_card" || actionType === "accept_penalty") sound.cardDraw();
          setPublicState(data.publicState);
          setHand(data.hand);
          setSelectedCardIds([]);
          setDeclareLastCard(false);
          setReverseDirection(false);
          setLastActionError(null);
          return;
        }
      } catch {
        sound.error();
        setLastActionError("Network error - please try again.");
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
    const deadline = publicState.turnDeadline;
    triedTimeoutForDeadline.current = deadline;
    fetch(`/api/games/${gameId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "resolve_timeout",
        actionId: `timeout:${gameId}:${deadline}`,
        expectedVersion: publicState.stateVersion,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setPublicState(data.publicState);
          void loadHand();
        } else if (triedTimeoutForDeadline.current === deadline) {
          // VERSION_CONFLICT/DUPLICATE_ACTION here just mean another client
          // (or our own retry) already resolved it — fine either way. Any
          // other failure: allow a retry on the next tick instead of
          // permanently giving up on this deadline.
          const data = await res.json().catch(() => null);
          const code = data?.error?.code;
          if (code !== "VERSION_CONFLICT" && code !== "DUPLICATE_ACTION") {
            triedTimeoutForDeadline.current = null;
          }
        }
      })
      .catch(() => {
        if (triedTimeoutForDeadline.current === deadline) {
          triedTimeoutForDeadline.current = null;
        }
      });
  }, [now, publicState, gameId, loadHand]);

  useEffect(() => {
    const isMine = publicState?.currentPlayerUserId === currentUserId;
    if (isMine && previousIsMyTurn.current === false) {
      sound.yourTurn();
    }
    previousIsMyTurn.current = isMine;
  }, [publicState?.currentPlayerUserId, currentUserId]);

  const scrollCardIntoHandView = useCallback((cardId: string) => {
    const viewport = handViewportRef.current;
    if (!viewport) return;

    const selector =
      typeof CSS !== "undefined" && CSS.escape
        ? `[data-card-id="${CSS.escape(cardId)}"]`
        : `[data-card-id="${cardId}"]`;
    const cardElement = viewport.querySelector<HTMLElement>(selector);
    if (!cardElement) return;

    const viewportBox = viewport.getBoundingClientRect();
    const cardBox = cardElement.getBoundingClientRect();
    const edgePadding = 8;
    let delta = 0;

    if (cardBox.left < viewportBox.left + edgePadding) {
      delta = cardBox.left - viewportBox.left - edgePadding;
    } else if (cardBox.right > viewportBox.right - edgePadding) {
      delta = cardBox.right - viewportBox.right + edgePadding;
    }

    if (Math.abs(delta) < 1) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({ left: delta, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, []);

  const queueCardIntoHandView = useCallback(
    (cardId: string) => {
      window.requestAnimationFrame(() => scrollCardIntoHandView(cardId));
    },
    [scrollCardIntoHandView],
  );

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
  const currentPlayerName =
    nameByUserId.get(publicState.currentPlayerUserId ?? "") ?? (isMyTurn ? "You" : "Opponent");
  const selectedCards = selectedCardIds
    .map((id) => hand.find((c) => c.id === id))
    .filter(Boolean) as WhotCard[];
  const firstSelected = selectedCards[0];
  const canSelectMore = ruleConfig.multiCardPlay;
  const projectedHandCount = selectedCardIds.length
    ? hand.length - selectedCardIds.length
    : hand.length;
  const selectionPreview = getSelectionPreview({
    selectedCards,
    projectedHandCount,
    pendingPenalty: publicState.pendingPenalty,
    declareLastCard,
    lastCardDeclaration: ruleConfig.lastCardDeclaration,
  });

  function toggleCard(card: WhotCard) {
    const state = publicState;
    if (!state || !isMyTurn || busy) return;
    const isSelected = selectedCardIds.includes(card.id);
    if (
      !isSelected &&
      !isSelectableForCurrentBatch(card, selectedCards, state, ruleConfig, canSelectMore)
    ) {
      setLastActionError(explainIllegalCard(card, state));
      return;
    }
    const willSelect = !isSelected;
    setSelectedCardIds((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
      if (prev.length === 0) return [card.id];
      if (canSelectMore && firstSelected && card.number === firstSelected.number) {
        return [...prev, card.id];
      }
      return [card.id];
    });
    if (willSelect) queueCardIntoHandView(card.id);
  }

  function clearSelection() {
    setSelectedCardIds([]);
    setDeclareLastCard(false);
    setReverseDirection(false);
  }

  function undoLastSelection() {
    setSelectedCardIds((prev) => prev.slice(0, -1));
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
            declareLastCard: projectedHandCount === 1 && declareLastCard,
            reverseDirection,
          }
        : {
            type: "play_card",
            cardId: selectedCardIds[0],
            chosenShape,
            declareLastCard: projectedHandCount === 1 && declareLastCard,
            reverseDirection,
          };
    setPendingShapeSelection(false);
    return submitAction(payload);
  }

  const showLastCardToggle = isMyTurn && ruleConfig.lastCardDeclaration && projectedHandCount === 1;
  const showReverseToggle =
    isMyTurn &&
    ruleConfig.directionChangeOnPenalty &&
    firstSelected &&
    (firstSelected.number === 2 || firstSelected.number === 5);

  const secondsLeft = publicState.turnDeadline
    ? Math.max(0, Math.ceil((publicState.turnDeadline - now) / 1000))
    : null;
  const directionText = publicState.direction === 1 ? "Clockwise" : "Counter-clockwise";
  const actionHint = getActionHint({
    isMyTurn,
    pendingPenalty: publicState.pendingPenalty,
    showLastCardToggle,
    topCard: publicState.topCard,
    activeShape: publicState.activeShape,
    currentPlayerName,
  });

  return (
    <main className="bg-wood-table relative flex min-h-screen flex-col gap-4 overflow-hidden px-3 py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[3%] top-[11%] bottom-[12%] rounded-[50%] border border-[#d5ad57]/25 bg-[radial-gradient(ellipse_at_center,rgba(27,87,51,0.88),rgba(18,67,39,0.84)_52%,rgba(25,12,7,0.08)_72%,transparent_74%)] shadow-[inset_0_0_80px_rgba(7,32,18,0.55),0_18px_44px_rgba(16,8,4,0.28)]"
      />
      <ShapeSelector open={pendingShapeSelection} onSelect={(shape) => void submitPlay(shape)} />

      {(publicState.status === "round_over" || publicState.status === "match_over") && (
        <RoundResultOverlay
          publicState={publicState}
          nameByUserId={nameByUserId}
          currentUserId={currentUserId}
          gameId={gameId}
          onAction={submitAction}
          busy={busy}
          remainingCardScores={roundScores}
          onLeave={() => {
            void submitAction({ type: "leave_game" });
            router.push("/");
          }}
        />
      )}

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-full border border-[#e0bb6e]/25 bg-[#211009]/60 px-3 py-1.5 text-xs font-semibold text-[#f8e7bc] shadow-sm backdrop-blur-[2px]">
          <span>Round {publicState.roundNumber}</span>
          {publicState.bestOf > 1 && (
            <span>
              · Match {Object.values(publicState.matchScores).join("–")} (best of{" "}
              {publicState.bestOf})
            </span>
          )}
        </div>
        {secondsLeft !== null && (
          <Badge
            variant={secondsLeft <= 5 ? "destructive" : "secondary"}
            className="h-7 rounded-full px-3 font-mono shadow-sm"
          >
            {secondsLeft}s
          </Badge>
        )}
        <div className="flex flex-wrap items-center justify-end gap-1">
          <AudioControls mode="game" compact />
          <RulesHelpDialog
            settings={ruleConfig}
            publicState={publicState}
            triggerClassName="rounded-full border-[#e1bd74]/40 bg-[#f8e7bc] text-[#2c150d] hover:bg-[#fff3cf]"
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-cream/80 gap-1 rounded-full hover:bg-[#f8e7bc]/15 hover:text-[#f8e7bc]"
            onClick={() => void submitAction({ type: "forfeit" })}
          >
            <Flag className="size-3.5" /> Forfeit
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-3xl gap-2 rounded-full border border-[#d6ad62]/30 bg-[#211009]/55 px-4 py-3 text-sm text-[#fff4d6] shadow-[0_12px_30px_rgba(19,8,3,0.24)] backdrop-blur-[2px]">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant={isMyTurn ? "default" : "secondary"}
            className="h-7 rounded-full px-3 font-bold"
          >
            {isMyTurn ? "Your turn" : `${currentPlayerName}'s turn`}
          </Badge>
          <Badge variant="outline" className="border-[#e1bd74]/40 bg-[#3b2113]/70 text-[#f8e7bc]">
            <ShapeIcon shape={publicState.activeShape} /> Requested{" "}
            {SHAPE_LABELS[publicState.activeShape]}
          </Badge>
          <Badge variant="outline" className="border-[#e1bd74]/40 bg-[#3b2113]/70 text-[#f8e7bc]">
            <ArrowDownUp className="size-3" /> {directionText}
          </Badge>
          {busy && (
            <Badge variant="secondary">
              <Loader2 className="size-3 animate-spin" /> Processing
            </Badge>
          )}
        </div>
        <p className="text-cream/80 text-center text-xs">{actionHint}</p>
        {lastActionError && (
          <p className="text-center text-xs font-medium text-amber-200">{lastActionError}</p>
        )}
      </section>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        {opponents.map((p) => (
          <PlayerSeat
            key={p.userId}
            displayName={nameByUserId.get(p.userId) ?? "Player"}
            handCount={p.handCount}
            isCurrentTurn={publicState.currentPlayerUserId === p.userId}
            online={onlineUserIds.has(p.userId)}
            isSelf={false}
            lastCardDeclared={p.lastCardDeclared}
            forfeited={p.forfeited}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex items-end gap-7 rounded-[2rem] border border-[#d6ad62]/20 bg-[#1a0d08]/20 px-6 py-4 shadow-[inset_0_0_32px_rgba(6,28,16,0.22)]">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              data-testid="draw-card"
              disabled={!isMyTurn || busy || Boolean(publicState.pendingPenalty)}
              onClick={() => void submitAction({ type: "draw_card" })}
              className="rounded-xl transition-transform hover:-translate-y-1 disabled:opacity-40 disabled:hover:translate-y-0"
              aria-label="Draw a card"
            >
              <CardBack size="lg" />
            </button>
            <span className="rounded-full border border-[#e1bd74]/30 bg-[#2b160d]/80 px-2.5 py-1 text-xs font-semibold text-[#f8e7bc]">
              Market · {publicState.marketCount}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            {publicState.topCard && (
              <CardFace card={publicState.topCard} size="lg" data-testid="top-card" />
            )}
            <span
              data-testid="active-shape"
              className="flex items-center gap-1 rounded-full border border-[#e1bd74]/30 bg-[#2b160d]/80 px-2.5 py-1 text-xs font-semibold text-[#f8e7bc]"
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

        <p
          data-testid="turn-indicator"
          role="status"
          aria-live="polite"
          className="rounded-full border border-[#e1bd74]/35 bg-[#25130c]/75 px-3 py-1 text-sm font-bold text-[#fff2cc] shadow-sm"
        >
          {isMyTurn
            ? "Your turn"
            : `${nameByUserId.get(publicState.currentPlayerUserId ?? "") ?? "Opponent"}'s turn`}
        </p>
      </div>

      <section className="relative z-10 flex min-w-0 flex-col gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {selectionPreview.length > 0 && (
          <div
            data-testid="selection-summary"
            className="text-cream/85 flex flex-wrap items-center justify-center gap-1 text-xs"
          >
            {selectionPreview.map((item) => (
              <Badge key={item} variant="secondary" className="bg-[#f8e7bc] text-[#2b160d]">
                {item}
              </Badge>
            ))}
          </div>
        )}
        <div className="z-10 flex min-h-8 flex-wrap items-center justify-center gap-2">
          {showLastCardToggle && (
            <Button
              size="sm"
              variant={declareLastCard ? "default" : "outline"}
              onClick={() => setDeclareLastCard((v) => !v)}
              className="gap-1 rounded-full"
            >
              <Bookmark className="size-3.5" /> Last Card
            </Button>
          )}
          {showReverseToggle && (
            <Button
              size="sm"
              variant={reverseDirection ? "default" : "outline"}
              onClick={() => setReverseDirection((v) => !v)}
              className="gap-1 rounded-full"
            >
              <ArrowLeftRight className="size-3.5" /> Reverse
            </Button>
          )}
          {selectedCardIds.length > 0 && (
            <Button
              size="sm"
              onClick={handleConfirmPlay}
              disabled={busy}
              className="gap-1 rounded-full"
            >
              <Play className="size-3.5" /> Play {selectedCardIds.length} card
              {selectedCardIds.length === 1 ? "" : "s"}
            </Button>
          )}
          {selectedCardIds.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={undoLastSelection}
              disabled={busy}
              className="gap-1 rounded-full"
            >
              <Undo2 className="size-3.5" /> Undo last
            </Button>
          )}
          {selectedCardIds.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={busy}
              className="text-cream/80 gap-1 rounded-full hover:bg-[#f8e7bc]/15"
            >
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>

        <div
          ref={handViewportRef}
          data-testid="hand-scroll-viewport"
          className="w-full min-w-0 touch-pan-x [scroll-padding-inline:1rem] [scrollbar-gutter:stable] overflow-x-auto overscroll-x-contain pb-2"
          role="region"
          aria-label="Your hand scroll area"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          <div
            data-testid="hand-track"
            className="flex w-max min-w-full items-end justify-center gap-1 px-4 pt-3 pb-1"
            role="list"
            aria-label="Your hand"
          >
            <div
              data-testid="hand-leading-spacer"
              aria-hidden
              className="h-px shrink-0"
              style={{ flexBasis: "max(1rem, env(safe-area-inset-left))" }}
            />
            {hand.map((card) => {
              const selectedOrder = selectedCardIds.indexOf(card.id);
              const playable = isSelectableForCurrentBatch(
                card,
                selectedCards,
                publicState,
                ruleConfig,
                canSelectMore,
              );
              const disabledReason = explainSelectionState(
                card,
                selectedCards,
                publicState,
                ruleConfig,
                canSelectMore,
                isMyTurn,
              );
              return (
                <CardFace
                  key={card.id}
                  card={card}
                  data-testid="hand-card"
                  playable={isMyTurn ? playable : false}
                  selected={selectedOrder !== -1}
                  selectionOrder={selectedOrder === -1 ? undefined : selectedOrder + 1}
                  title={playable && isMyTurn ? "Playable" : disabledReason}
                  onFocus={() => queueCardIntoHandView(card.id)}
                  onClick={isMyTurn && !busy && playable ? () => toggleCard(card) : undefined}
                />
              );
            })}
            <div
              data-testid="hand-trailing-spacer"
              aria-hidden
              className="h-px shrink-0"
              style={{ flexBasis: "max(1rem, env(safe-area-inset-right))" }}
            />
          </div>
        </div>
        <p className="text-center text-xs text-[#f8e7bc]/70">
          {myPlayer ? `You have ${myPlayer.handCount} cards` : null}
          {showLastCardToggle ? " - tap Last Card before playing down to one." : ""}
        </p>
      </section>
    </main>
  );
}

function explainIllegalCard(card: WhotCard, state: PublicGameState): string {
  if (state.pendingPenalty) {
    return `Penalty pending: defend with a ${state.pendingPenalty.defendingNumber} or draw ${state.pendingPenalty.amount}.`;
  }
  if (!state.topCard) return "No top card is available yet.";
  return `${SHAPE_LABELS[card.shape]} ${card.displayValue} does not match ${SHAPE_LABELS[state.activeShape]} or ${state.topCard.displayValue}.`;
}

function isSelectableForCurrentBatch(
  card: WhotCard,
  selectedCards: WhotCard[],
  state: PublicGameState,
  ruleConfig: RuleConfig,
  multiCardPlay: boolean,
): boolean {
  if (selectedCards.some((selected) => selected.id === card.id)) return true;
  if (selectedCards.length === 0) return isCardPlayableClientSide(card, state, ruleConfig);
  if (!multiCardPlay) return false;
  return card.number === selectedCards[0]?.number;
}

function explainSelectionState(
  card: WhotCard,
  selectedCards: WhotCard[],
  state: PublicGameState,
  ruleConfig: RuleConfig,
  multiCardPlay: boolean,
  isMyTurn: boolean,
): string {
  if (!isMyTurn) return "Wait for your turn.";
  if (selectedCards.some((selected) => selected.id === card.id)) return "Selected. Tap to remove.";
  if (selectedCards.length === 0) {
    if (state.pendingPenalty) {
      const stackingEnabled =
        state.pendingPenalty.type === "pickTwo"
          ? ruleConfig.pickTwoStacking
          : ruleConfig.pickThreeStacking;
      if (!stackingEnabled) {
        return `Penalty stacking is off. Draw ${state.pendingPenalty.amount} cards.`;
      }
    }
    return explainIllegalCard(card, state);
  }
  if (!multiCardPlay) return "Multi-card play is disabled in this room.";
  const first = selectedCards[0] as WhotCard;
  if (card.number !== first.number) {
    return `Only ${first.displayValue} cards can be added to this batch.`;
  }
  return "Playable in this batch.";
}

function getSelectionPreview({
  selectedCards,
  projectedHandCount,
  pendingPenalty,
  declareLastCard,
  lastCardDeclaration,
}: {
  selectedCards: WhotCard[];
  projectedHandCount: number;
  pendingPenalty: PublicGameState["pendingPenalty"];
  declareLastCard: boolean;
  lastCardDeclaration: boolean;
}): string[] {
  if (selectedCards.length === 0) return [];

  const finalCard = selectedCards[selectedCards.length - 1] as WhotCard;
  const preview = [`${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"} selected`];

  if (finalCard.number === 2) {
    const amount = (pendingPenalty?.amount ?? 0) + selectedCards.length * 2;
    preview.push(formatPickAmount(amount));
  } else if (finalCard.number === 5) {
    const amount = (pendingPenalty?.amount ?? 0) + selectedCards.length * 3;
    preview.push(formatPickAmount(amount));
  }

  if (finalCard.shape !== "Whot") {
    preview.push(`Final shape: ${SHAPE_LABELS[finalCard.shape]}`);
  }

  if (projectedHandCount === 1 && lastCardDeclaration) {
    preview.push(`1 card will remain — Last Card ${declareLastCard ? "armed" : "required"}`);
  } else if (projectedHandCount === 0) {
    preview.push("This play finishes your hand");
  }

  return preview;
}

function formatPickAmount(amount: number): string {
  const names: Record<number, string> = {
    2: "Two",
    3: "Three",
    4: "Four",
    6: "Six",
    8: "Eight",
    9: "Nine",
    10: "Ten",
    12: "Twelve",
  };
  return `Pick ${names[amount] ?? amount}`;
}

function getActionHint({
  isMyTurn,
  pendingPenalty,
  showLastCardToggle,
  topCard,
  activeShape,
  currentPlayerName,
}: {
  isMyTurn: boolean;
  pendingPenalty: PublicGameState["pendingPenalty"];
  showLastCardToggle: boolean;
  topCard: PublicGameState["topCard"];
  activeShape: Shape;
  currentPlayerName: string;
}) {
  if (!isMyTurn)
    return `Waiting for ${currentPlayerName}. Online status is shown beside each player.`;
  if (pendingPenalty) {
    return `Defend with a ${pendingPenalty.defendingNumber}, or draw ${pendingPenalty.amount}.`;
  }
  if (showLastCardToggle) return "Tap Last Card before playing down to one card.";
  if (!topCard) return "Play a legal card or draw from the market.";
  return `Play a ${SHAPE_LABELS[activeShape]} card, a ${topCard.displayValue}, or Whot.`;
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
      sound.penalty();
      toast.warning(`${nameOf(payload.actorUserId)} forgot to declare Last Card — drew 2.`);
      break;
    case "penalty_applied":
      if (isMe(payload.targetUserId)) sound.penalty();
      break;
    case "turn_timeout":
      toast.info(`${nameOf(payload.previousPlayerUserId)}'s turn timed out.`);
      break;
    default:
      break;
  }
}
