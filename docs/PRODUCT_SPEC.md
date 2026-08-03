# Product Specification — Naija Whot

## Overview

Naija Whot is a mobile-first web app for playing Nigerian Whot with friends in
real time, without registering an account. One player creates a room, shares a
6-character code or invite link, and up to three friends join from their own
phone or browser. The server enforces every rule; clients only render state
and submit intended actions.

## Primary use case

Two friends playing remotely, on phones, in the same 10-minute sitting. The
2-player path (fast lobby, minimal steps, short reconnect grace period) is
optimized first; 3–4 players is supported by the same engine and UI.

## Core flows

1. **Landing** — enter a nickname (persisted locally + tied to an anonymous
   Supabase auth session), then Create or Join.
2. **Create room** — host configures max players, hand size, timer, which
   house rules are on, and best-of length. Gets a room code + shareable URL.
3. **Join room** — via code or link. Validated: room exists, not expired, not
   full, game not already in progress (unless reconnecting), nickname valid,
   no duplicate seat for the same authenticated user.
4. **Lobby** — see all players, host badge, ready/connected status, and the
   selected rules. Host can kick a player or start once everyone but the host
   is ready and at least 2 players are present. Non-host players toggle ready.
5. **Game** — real-time board: hands, market, discard pile, active shape,
   pending penalty, timer, event feed. Playable cards are highlighted;
   illegal cards are visibly disabled, not hidden.
6. **Round end** — winner, remaining card counts, best-of score.
7. **Rematch** — all players vote to continue; a new round deals fresh cards
   into the same room without needing a new invite link.

## Explicitly out of scope

No real-money betting, staking, or purchasable currency of any kind. No
account registration/passwords. No spectator mode in v1. No native mobile
app — installable PWA only.

## Player-facing rule configuration (per room)

| Setting                            | Range                        | Default |
| ---------------------------------- | ---------------------------- | ------- |
| Max players                        | 2–4                          | 4       |
| Starting hand size                 | 3–6                          | 5       |
| Turn timer                         | 10s / 20s / 30s / 60s / none | 20s     |
| Pick Two stacking                  | on/off                       | on      |
| Pick Three stacking                | on/off                       | on      |
| General Market                     | on/off                       | on      |
| Hold On                            | on/off                       | on      |
| Suspension                         | on/off                       | on      |
| Last Card declaration              | on/off                       | on      |
| Check Up declaration               | on/off                       | on      |
| Double decking                     | on/off                       | off     |
| Direction change on Pick Two/Three | on/off                       | off     |
| Best-of                            | 1 / 3 / 5                    | 1       |

See `docs/GAME_RULES.md` for the full rules reference.
