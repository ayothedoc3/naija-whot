"use client";

// Placeholder for Phase 5 — the real multiplayer table (hands, market,
// discard pile, turn indicator, actions) is built next. Kept as a separate
// component now so room-client.tsx's lobby → game transition is already
// wired and testable ahead of the board itself landing.
export function GameBoard({
  gameId,
}: {
  roomId: string;
  gameId: string;
  currentUserId: string;
  roomCode: string;
}) {
  return (
    <main className="bg-felt flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-cream text-2xl font-bold">Game started!</h1>
      <p className="text-cream/70 text-sm">
        Game <span className="font-mono">{gameId}</span> — the board is being built next.
      </p>
    </main>
  );
}
