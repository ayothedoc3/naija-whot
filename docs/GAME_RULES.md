# Game Rules — Nigerian Whot (as implemented)

Implemented entirely in `src/lib/game-engine/`, framework-independent.

## The deck (54 cards)

| Shape    | Numbers                                 |
| -------- | --------------------------------------- |
| Circle   | 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14 |
| Triangle | 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14 |
| Cross    | 1, 2, 3, 5, 7, 10, 11, 13, 14           |
| Square   | 1, 2, 3, 5, 7, 10, 11, 13, 14           |
| Star     | 1, 2, 3, 4, 5, 7, 8                     |
| Whot     | 20 (× 5)                                |

Each card has a unique id, shape, number, display value, score value (its
number, used for optional remaining-card scoring), and a special-effect tag
where applicable. Card art is original CSS/SVG — no copied assets.

## Starting a game

1. Server-side cryptographically secure shuffle (`crypto.getRandomValues` via
   `deck.ts`); a seeded PRNG can be injected for tests/fixtures only.
2. Deal the configured hand size to each seat, clockwise from a fairly chosen
   first player.
3. Flip one **normal** (non-special) card as the starting call card — the
   dealer re-draws from the market if the flipped card is a special card.
4. Remaining cards form the market.

## Legal moves

A card is playable if: its shape matches the active shape, or its number
matches the top card's number, or it is a Whot (20), or it is a valid
defensive card against an accumulated Pick Two/Pick Three penalty (only a
matching penalty card defends; Pick Two cannot be defended by a 5 and vice
versa). A player may draw instead of playing; a voluntarily drawn card cannot
be played the same turn (no chaining) unless a future rule flag enables it —
none does today.

## Special cards

- **1 — Hold On:** the same player takes another turn (in 2-player games this
  is still just "play again", not a skip of the only opponent).
- **2 — Pick Two:** next player draws 2 unless they play another 2, which adds
  2 more to the pending total and passes the decision along. A player holding
  a 2 may choose to just draw instead of defending. Drawing the accumulated
  penalty ends that player's turn.
- **5 — Pick Three:** same mechanics as Pick Two but with 3s/+3, and Pick
  Two/Pick Three penalties never mix — only a 2 defends a Pick Two total, only
  a 5 defends a Pick Three total.
- **8 — Suspension:** skip the next active player. In 2-player games this
  gives the player who played the 8 the next turn.
- **14 — General Market:** every other active player immediately draws 1 card
  (applied atomically, server-side, before the next action is accepted); the
  player who played it gets another turn. Cannot be defended.
- **20 — Whot:** playable on any top card; the play and the shape choice
  (Circle/Triangle/Cross/Square/Star — never Whot) are submitted and applied
  as a single atomic action.

## Declarations

- **Last Card:** required when a move takes a player from 2 cards to 1. Must
  be flagged in the same action as the move. If omitted, the server applies a
  2-card penalty after the move — the move itself still stands.
- **Check Up:** required when playing the final card. If declared and the
  move is valid, the round is won only after the server has validated the
  declaration and applied every card effect; if omitted, the server draws 2
  cards for that player and the round continues.

## Double decking (off by default)

When enabled, a player may play multiple cards sharing the same number in one
action: the first card must be legal against the current call card, every
subsequent card must share that number, and the final card in the sequence
determines the resulting active shape. Effects resolve in the order the cards
were submitted, left to right, fully deterministically.

## Direction change (off by default)

When enabled, playing a 2 or 5 may optionally reverse turn direction. The
direction is part of authoritative state; in a 2-player game it's a no-op on
turn order but must not corrupt seat rotation math.

## Empty market

When the market runs out: keep the current top discard card in place, shuffle
every _other_ discard card into a fresh market, and continue — cards in
players' hands are never touched.

## Turn timer

The server stores an absolute `turn_deadline` timestamp; the client renders a
countdown from it (never trusts its own clock as authoritative). Because the
app runs on a stateless container/serverless-style request model, there is no
always-on background timer process by default: **expiry is resolved
lazily, the next time any player interacts with the game** (submitting an
action, polling for state, or reconnecting checks `now() > turn_deadline`
first and, if true, applies the auto-draw-and-pass timeout resolution before
processing anything else). This is documented in `docs/ARCHITECTURE.md` along
with an optional Supabase scheduled Edge Function design for true
background expiry. Each timeout resolution is idempotent (guarded by
`state_version` + a synthetic timeout action id) so it can never apply twice.

## Match scoring

A match is best of 1/3/5 rounds. Each round win increments that player's match
score; the match ends once a player reaches the majority of the configured
length. Remaining-card score (sum of opponents' card values) is shown for
color but does not affect who wins the round or match.
