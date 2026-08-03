import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * The complete two-browser-context scenario from the master spec §16,
 * exercised against the real app (real anonymous auth, real Supabase,
 * real Realtime) with one deliberate use of dev fixture mode
 * (NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true) to deal a specific, deterministic
 * hand instead of a random one — the only way to reliably hit a named
 * special-card/declaration scenario in an automated test. Everything
 * upstream of the deal (room creation, joining, readying up) is the real,
 * unmocked flow.
 *
 * Requires NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true in the server's environment
 * (set in .env.local) and a running local Supabase stack (`pnpm supabase:start`).
 */

async function whoami(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/whoami");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.userId as string;
}

/** Returns each hand card's "{Shape} {number}" identity, stripping the
 *  accessibility-only ", not playable" suffix CardFace adds for cards that
 *  can't legally be played right now — real, correct app behavior that
 *  this test's card-presence assertions don't care about. */
async function handLabels(page: Page): Promise<string[]> {
  const labels = await page
    .getByTestId("hand-card")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return labels.map((label) => label.replace(/, not playable$/, ""));
}

/** Selects a specific card in hand by its stable id (data-card-id), rather
 *  than by visible text — the card face's visible text is just the number,
 *  not "{Shape} {number}", so text-based matching can't disambiguate. */
function handCard(page: Page, cardId: string) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${cardId}"]`);
}

test("full multiplayer round: create, join, deterministic play, reconnect, declarations, rematch", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Track every JSON response body either page receives, to assert an
  // opponent's cards never appear in a client's own network traffic.
  const seenBodiesA: string[] = [];
  const seenBodiesB: string[] = [];
  pageA.on("response", async (res) => {
    if (res.request().resourceType() === "fetch" || res.url().includes("/api/")) {
      try {
        seenBodiesA.push(await res.text());
      } catch {
        /* ignore non-text bodies */
      }
    }
  });
  pageB.on("response", async (res) => {
    if (res.request().resourceType() === "fetch" || res.url().includes("/api/")) {
      try {
        seenBodiesB.push(await res.text());
      } catch {
        /* ignore non-text bodies */
      }
    }
  });

  // 1-2. Player A opens the app and creates a room.
  await pageA.goto("/");
  await pageA.getByLabel("Your nickname").fill("Alice");
  await pageA.getByRole("button", { name: "Create Game" }).click();
  await pageA.getByRole("button", { name: "Create Room" }).click();
  await pageA.waitForURL(/\/room\/[A-Z2-9]{6}/, { timeout: 25_000 });
  const code = pageA.url().split("/room/")[1] as string;

  const aliceId = await whoami(pageA.request);

  // 3. Player B joins using the room code.
  await pageB.goto(`/room/${code}`);
  await pageB.getByLabel("Nickname").fill("Bob");
  await pageB.getByRole("button", { name: "Join Room" }).click();
  await pageA.getByText("Players (2/").waitFor({ timeout: 25_000 });

  const bobId = await whoami(pageB.request);

  // 4. Player B becomes ready.
  await pageB.getByRole("button", { name: "I'm ready" }).click();
  await pageA.getByRole("button", { name: "Start Game" }).waitFor({ timeout: 25_000 });

  // 5. Player A starts the game — via the dev fixture route instead of the
  // normal random deal, so the rest of this test is deterministic.
  //   Alice: circle-1 (Hold On), circle-10, circle-11
  //   Bob:   circle-13, star-2, star-3, star-4
  //   Top card: circle-3 (plain, shape Circle)
  const startRes = await pageA.request.post("/api/dev/fixtures/start", {
    data: {
      roomCode: code,
      hands: {
        [aliceId]: ["circle-1", "circle-10", "circle-11"],
        [bobId]: ["circle-13", "star-2", "star-3", "star-4"],
      },
      topCardId: "circle-3",
      currentPlayerUserId: aliceId,
    },
  });
  expect(startRes.ok(), await startRes.text()).toBe(true);

  await pageA.getByTestId("turn-indicator").waitFor({ timeout: 25_000 });
  await pageB.getByTestId("turn-indicator").waitFor({ timeout: 25_000 });
  // The hand loads via its own async fetch, independent of the turn
  // indicator's data — wait for it explicitly rather than assuming it's
  // ready the moment the turn indicator renders.
  await expect(pageA.getByTestId("hand-card").first()).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByTestId("hand-card").first()).toBeVisible({ timeout: 15_000 });

  // 6-7. Both players receive their own private hand; neither receives the
  // opponent's cards — assert directly on each page's rendered hand.
  const aliceHand = await handLabels(pageA);
  const bobHand = await handLabels(pageB);
  expect(aliceHand.sort()).toEqual(["Circle 1", "Circle 10", "Circle 11"].sort());
  expect(bobHand.sort()).toEqual(["Circle 13", "Star 2", "Star 3", "Star 4"].sort());
  for (const label of bobHand) expect(aliceHand).not.toContain(label);
  for (const label of aliceHand) expect(bobHand).not.toContain(label);

  await expect(pageA.getByTestId("turn-indicator")).toHaveText("Your turn");

  // 8-9. Players take turns; the first play (circle-1, Hold On) is the
  // deterministic special-card exercise.
  await handCard(pageA, "circle-1").click();
  await pageA.getByRole("button", { name: /^Play/ }).click();
  // Hold On: Alice plays again immediately.
  await expect(pageA.getByTestId("turn-indicator")).toHaveText("Your turn");
  await expect(pageA.getByTestId("hand-card")).toHaveCount(2);

  // 12. Declare "Last Card" correctly (2 cards -> 1) before the next play.
  await pageA.getByRole("button", { name: "Last Card" }).click();
  await handCard(pageA, "circle-10").click();
  await pageA.getByRole("button", { name: /^Play/ }).click();
  await expect(pageA.getByTestId("hand-card")).toHaveCount(1); // no penalty applied

  // Turn passes to Bob.
  await expect(pageB.getByTestId("turn-indicator")).toHaveText("Your turn", { timeout: 25_000 });

  // 10-11. Player B refreshes and reconnects; the game continues correctly.
  await pageB.reload();
  await pageB.getByTestId("turn-indicator").waitFor({ timeout: 25_000 });
  await expect(pageB.getByTestId("turn-indicator")).toHaveText("Your turn");
  await expect(pageB.getByTestId("hand-card").first()).toBeVisible({ timeout: 15_000 });
  expect((await handLabels(pageB)).sort()).toEqual(["Circle 13", "Star 2", "Star 3", "Star 4"].sort());

  await handCard(pageB, "circle-13").click();
  await pageB.getByRole("button", { name: /^Play/ }).click();
  await expect(pageA.getByTestId("turn-indicator")).toHaveText("Your turn", { timeout: 25_000 });

  // 13-14. Alice is down to her final card — declare "Check Up" correctly
  // and win the round (and, at best-of-1, the match).
  await expect(pageA.getByTestId("hand-card")).toHaveCount(1);
  await pageA.getByRole("button", { name: "Check Up" }).click();
  await handCard(pageA, "circle-11").click();
  await pageA.getByRole("button", { name: /^Play/ }).click();

  // 15. The game ends and both clients show the same winner.
  await pageA.getByText(/wins the match!/).waitFor({ timeout: 25_000 });
  await pageB.getByText(/wins the match!/).waitFor({ timeout: 25_000 });
  const winnerA = await pageA.getByText(/wins the match!/).first().textContent();
  const winnerB = await pageB.getByText(/wins the match!/).first().textContent();
  expect(winnerA).toBe("Alice wins the match!");
  expect(winnerA).toBe(winnerB);

  // 16-17. Both players accept a rematch and a new round begins.
  await pageA.getByRole("button", { name: "Ready for rematch" }).click();
  await pageB.getByRole("button", { name: "Ready for rematch" }).click();
  await pageA.getByRole("button", { name: "Start rematch" }).waitFor({ timeout: 25_000 });
  await pageA.getByRole("button", { name: "Start rematch" }).click();

  await pageA.getByTestId("turn-indicator").waitFor({ timeout: 25_000 });
  await pageB.getByTestId("turn-indicator").waitFor({ timeout: 25_000 });
  // bestOf defaults to 1, so a rematch after match_over starts a fresh
  // match (round resets to 1) rather than "round 2" of the same match —
  // see match-scoring.test.ts for the same behavior unit-tested. A fresh,
  // real (non-fixture) deal is confirmed by both hands being a full 5 cards.
  await expect(pageA.getByText("Round 1")).toBeVisible();
  await expect(pageA.getByTestId("hand-card").first()).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByTestId("hand-card").first()).toBeVisible({ timeout: 15_000 });
  expect((await handLabels(pageA)).length).toBe(5);
  expect((await handLabels(pageB)).length).toBe(5);

  // Security: neither client's network traffic ever contained the other
  // player's card ids anywhere in a JSON response body. Matched as a
  // quoted JSON string value (`"circle-1"`), not a bare substring — a bare
  // substring search would spuriously match "circle-1" inside a player's
  // OWN card id "circle-10" or "circle-13".
  const bobOnlyCardIds = ["star-2", "star-3", "star-4"]; // ids not shared with Alice's hand
  const aliceOnlyCardIds = ["circle-1", "circle-10", "circle-11"];
  for (const id of bobOnlyCardIds) {
    expect(seenBodiesA.some((body) => body.includes(`"${id}"`))).toBe(false);
  }
  for (const id of aliceOnlyCardIds) {
    expect(seenBodiesB.some((body) => body.includes(`"${id}"`))).toBe(false);
  }

  await contextA.close();
  await contextB.close();
});
