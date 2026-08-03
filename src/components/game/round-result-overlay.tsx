"use client";

import { Trophy, Check, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PublicGameState } from "@/lib/game-engine/public-state";

export function RoundResultOverlay({
  publicState,
  nameByUserId,
  currentUserId,
  onAction,
  busy,
  remainingCardScores,
  onLeave,
}: {
  publicState: PublicGameState;
  nameByUserId: Map<string, string>;
  currentUserId: string;
  gameId: string;
  onAction: (action: Record<string, unknown>) => void;
  busy: boolean;
  remainingCardScores: Record<string, number> | null;
  onLeave: () => void;
}) {
  const isMatchOver = publicState.status === "match_over";
  const winnerId = isMatchOver ? publicState.matchWinnerUserId : publicState.roundWinnerUserId;
  const winnerName = winnerId ? (nameByUserId.get(winnerId) ?? "A player") : "Nobody";

  const activePlayers = publicState.players.filter((p) => !p.forfeited);
  const me = activePlayers.find((p) => p.userId === currentUserId);
  const allRequested = activePlayers.length > 0 && activePlayers.every((p) => p.requestedRematch);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="border-gold/40 bg-cream flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-2xl">
        <Trophy className="text-gold size-10" />
        <div>
          <h2 className="text-charcoal text-xl font-bold">
            {isMatchOver ? `${winnerName} wins the match!` : `${winnerName} wins the round!`}
          </h2>
          {publicState.bestOf > 1 && (
            <p className="text-muted-foreground text-sm">
              Match score:{" "}
              {publicState.players
                .map(
                  (p) =>
                    `${nameByUserId.get(p.userId) ?? "?"} ${publicState.matchScores[p.userId] ?? 0}`,
                )
                .join(" · ")}
            </p>
          )}
        </div>

        <ul className="w-full text-left text-sm">
          {publicState.players.map((p) => (
            <li key={p.userId} className="text-charcoal flex items-center justify-between py-0.5">
              <span>{nameByUserId.get(p.userId) ?? "Player"}</span>
              <span className="text-muted-foreground">
                {p.handCount} cards left
                {remainingCardScores?.[p.userId] !== undefined &&
                  ` · score ${remainingCardScores[p.userId]}`}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-1.5">
            {activePlayers.map((p) => (
              <Badge
                key={p.userId}
                variant={p.requestedRematch ? "default" : "outline"}
                className="gap-1"
              >
                {p.requestedRematch ? (
                  <Check className="size-3" />
                ) : (
                  <Hourglass className="size-3" />
                )}
                {nameByUserId.get(p.userId) ?? "Player"}
              </Badge>
            ))}
          </div>

          {!me?.requestedRematch ? (
            <Button
              onClick={() => onAction({ type: "request_rematch" })}
              disabled={busy}
              className="w-full"
            >
              Ready for rematch
            </Button>
          ) : allRequested ? (
            <Button
              onClick={() => onAction({ type: "start_rematch" })}
              disabled={busy}
              className="w-full"
            >
              Start rematch
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">Waiting for everyone to be ready…</p>
          )}
          <Button variant="ghost" onClick={onLeave} className="w-full">
            Return to lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
