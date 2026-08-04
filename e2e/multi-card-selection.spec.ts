import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function whoami(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/whoami");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return body.userId as string;
}

async function startFixture(pageA: Page, pageB: Page, aliceHand: string[]) {
  await pageA.goto("/");
  await pageA.getByLabel("Your nickname").fill("Alice");
  await pageA.getByRole("button", { name: "Create Game" }).click();
  await pageA.getByRole("switch", { name: "Multi-card play" }).click();
  const createRoomResponse = pageA.waitForResponse(
    (response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST",
  );
  await pageA.getByRole("button", { name: "Create Room" }).click();
  const createRoom = await createRoomResponse;
  expect(createRoom.ok(), await createRoom.text()).toBe(true);
  const { code } = (await createRoom.json()) as { code: string };

  const aliceId = await whoami(pageA.request);
  await pageA.goto(`/room/${code}`);

  await pageB.goto(`/room/${code}`);
  await pageB.getByLabel("Nickname").fill("Bob");
  await pageB.getByRole("button", { name: "Join Room" }).click();
  await expect(pageB.getByRole("button", { name: "I'm ready" })).toBeVisible({ timeout: 25_000 });
  const bobId = await whoami(pageB.request);
  await pageB.getByRole("button", { name: "I'm ready" }).click();

  const startRes = await pageA.request.post("/api/dev/fixtures/start", {
    data: {
      roomCode: code,
      hands: {
        [aliceId]: aliceHand,
        [bobId]: ["star-1", "star-2", "star-3"],
      },
      topCardId: "circle-7",
      currentPlayerUserId: aliceId,
    },
  });
  expect(startRes.ok(), await startRes.text()).toBe(true);

  await expect(pageA.getByTestId("hand-card")).toHaveCount(aliceHand.length, { timeout: 15_000 });
}

function handCard(page: Page, id: string) {
  return page.locator(`[data-testid="hand-card"][data-card-id="${id}"]`);
}

test("selection order, middle removal, clearing, and Pick Six preview", async ({
  browser,
  page,
}) => {
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await startFixture(page, pageB, ["circle-2", "triangle-2", "star-2", "circle-10"]);

  await handCard(page, "circle-2").click();
  await handCard(page, "triangle-2").click();
  await handCard(page, "star-2").click();

  await expect(page.getByTestId("selection-summary")).toContainText("3 cards selected");
  await expect(page.getByTestId("selection-summary")).toContainText("Pick 6");
  await expect(page.getByTestId("selection-summary")).toContainText("Final shape: Star");
  await expect(handCard(page, "circle-10")).toBeDisabled();
  await expect(page.getByTestId("selection-order-badge")).toHaveText(["1", "2", "3"]);

  await handCard(page, "triangle-2").click();
  await expect(page.getByTestId("selection-order-badge")).toHaveText(["1", "2"]);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("selection-summary")).toHaveCount(0);

  await contextB.close();
});

test("Last Card and Check Up previews use projected batch size", async ({ browser, page }) => {
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await startFixture(page, pageB, ["circle-3", "triangle-3", "cross-3", "circle-10"]);

  await handCard(page, "circle-3").click();
  await handCard(page, "triangle-3").click();
  await handCard(page, "cross-3").click();
  await expect(page.getByTestId("selection-summary")).toContainText("Last Card required");
  await expect(page.getByRole("button", { name: "Last Card" })).toBeVisible();

  await contextB.close();

  const contextC = await browser.newContext();
  const contextD = await browser.newContext();
  const pageC = await contextC.newPage();
  const pageD = await contextD.newPage();
  await startFixture(pageC, pageD, ["circle-3", "triangle-3", "cross-3"]);

  await handCard(pageC, "circle-3").click();
  await handCard(pageC, "triangle-3").click();
  await handCard(pageC, "cross-3").click();
  await expect(pageC.getByTestId("selection-summary")).toContainText("Check Up required");
  await expect(pageC.getByRole("button", { name: "Check Up" })).toBeVisible();

  await contextC.close();
  await contextD.close();
});
