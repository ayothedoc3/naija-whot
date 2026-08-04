import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function whoami(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/whoami");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.userId as string;
}

async function createStartedFixture(pageA: Page, pageB: Page, aliceHand: string[]) {
  await pageA.goto("/");
  await pageA.getByLabel("Your nickname").fill("Alice");
  await pageA.getByRole("button", { name: "Create Game" }).click();
  const createRoomResponse = pageA.waitForResponse(
    (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
  );
  await pageA.getByRole("button", { name: "Create Room" }).click();
  const createRoom = await createRoomResponse;
  expect(createRoom.ok(), await createRoom.text()).toBe(true);
  const { code } = (await createRoom.json()) as { code: string };
  await pageA.goto(`/room/${code}`);

  const aliceId = await whoami(pageA.request);

  await pageB.goto(`/room/${code}`);
  await pageB.getByLabel("Nickname").fill("Bob");
  await pageB.getByRole("button", { name: "Join Room" }).click();
  await expect(pageB.getByRole("button", { name: "I'm ready" })).toBeVisible({ timeout: 25_000 });
  await pageA.reload();
  await pageA.getByText("Players (2/").waitFor({ timeout: 25_000 });
  const bobId = await whoami(pageB.request);

  await pageB.getByRole("button", { name: "I'm ready" }).click();
  await pageA.getByRole("button", { name: "Start Game" }).waitFor({ timeout: 25_000 });

  const startRes = await pageA.request.post("/api/dev/fixtures/start", {
    data: {
      roomCode: code,
      hands: {
        [aliceId]: aliceHand,
        [bobId]: ["star-1", "star-2", "star-3"],
      },
      topCardId: "circle-3",
      currentPlayerUserId: aliceId,
    },
  });
  expect(startRes.ok(), await startRes.text()).toBe(true);

  await expect(pageA.getByTestId("hand-card")).toHaveCount(aliceHand.length, { timeout: 15_000 });
  await expect(pageA.getByTestId("turn-indicator")).toHaveText("Your turn", { timeout: 15_000 });
}

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectFullyInside(viewport: Locator, card: Locator) {
  const viewportBox = await bounds(viewport);
  const cardBox = await bounds(card);
  expect(cardBox.x).toBeGreaterThanOrEqual(viewportBox.x - 1);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1);
  expect(cardBox.y).toBeGreaterThanOrEqual(viewportBox.y - 1);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 1);
}

async function scrollMetrics(viewport: Locator) {
  return viewport.evaluate((el) => ({
    left: el.scrollLeft,
    max: el.scrollWidth - el.clientWidth,
  }));
}

async function dragHandLeft(page: Page, viewport: Locator) {
  const box = await bounds(viewport);
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 32;
  const endX = box.x + 32;
  const client = await page.context().newCDPSession(page);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: endX, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

const BASE_HAND = [
  "circle-1",
  "triangle-4",
  "cross-7",
  "square-11",
  "star-8",
  "triangle-10",
  "cross-5",
  "square-13",
  "star-4",
  "triangle-12",
  "cross-14",
  "square-1",
  "star-5",
  "triangle-7",
  "cross-10",
  "square-5",
  "circle-4",
  "circle-5",
  "triangle-2",
  "whot-1",
];

const CASES = [
  { name: "320x568 small hand", viewport: { width: 320, height: 568 }, size: 5 },
  { name: "360x800 medium hand", viewport: { width: 360, height: 800 }, size: 8 },
  { name: "390x844 long hand", viewport: { width: 390, height: 844 }, size: 12 },
  { name: "412x915 twenty-card hand", viewport: { width: 412, height: 915 }, size: 20 },
];

test("desktop hand rail centers cards when the full hand fits", async ({ browser, page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageB = await contextB.newPage();

  await createStartedFixture(page, pageB, BASE_HAND.slice(0, 5));

  const viewport = page.getByTestId("hand-scroll-viewport");
  const cards = page.getByTestId("hand-card");
  const firstCard = cards.first();
  const lastCard = cards.last();

  const metrics = await viewport.evaluate((el) => ({
    maxScrollLeft: el.scrollWidth - el.clientWidth,
  }));
  expect(metrics.maxScrollLeft).toBeLessThanOrEqual(2);

  const viewportBox = await bounds(viewport);
  const firstBox = await bounds(firstCard);
  const lastBox = await bounds(lastCard);
  const handCenter = (firstBox.x + lastBox.x + lastBox.width) / 2;
  const viewportCenter = viewportBox.x + viewportBox.width / 2;

  expect(Math.abs(handCenter - viewportCenter)).toBeLessThanOrEqual(8);
  await expectFullyInside(viewport, firstCard);
  await expectFullyInside(viewport, lastCard);

  await contextB.close();
});

for (const scenario of CASES) {
  test.describe(`mobile hand rail - ${scenario.name}`, () => {
    test.use({
      viewport: scenario.viewport,
      isMobile: true,
      hasTouch: true,
    });

    test("keeps first, last, and selected cards fully reachable without resetting scroll", async ({
      browser,
      page,
    }) => {
      const contextB = await browser.newContext({
        viewport: scenario.viewport,
        isMobile: true,
        hasTouch: true,
      });
      const pageB = await contextB.newPage();
      const aliceHand = [...BASE_HAND.slice(0, scenario.size - 1), "whot-1"];

      await createStartedFixture(page, pageB, aliceHand);

      const viewport = page.getByTestId("hand-scroll-viewport");
      const cards = page.getByTestId("hand-card");
      const firstCard = cards.first();
      const lastCard = cards.last();

      await viewport.evaluate((el) => {
        el.scrollLeft = 0;
      });
      await expectFullyInside(viewport, firstCard);

      const beforeDrag = await scrollMetrics(viewport);
      if (scenario.size > 5 && beforeDrag.max > 1) {
        await dragHandLeft(page, viewport);
        await expect.poll(async () => (await scrollMetrics(viewport)).left).toBeGreaterThan(1);
      }

      await viewport.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expectFullyInside(viewport, lastCard);

      const beforeSelection = await scrollMetrics(viewport);
      await lastCard.click();
      await expect(lastCard).toHaveAttribute("aria-pressed", "true");
      await expectFullyInside(viewport, lastCard);
      await expect(page.getByRole("button", { name: /^Play/ })).toBeVisible();

      await page.waitForTimeout(1_200);
      const afterRerender = await scrollMetrics(viewport);
      expect(afterRerender.left).toBeGreaterThanOrEqual(beforeSelection.left - 2);

      await contextB.close();
    });
  });
}
