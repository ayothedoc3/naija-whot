import { expect, test } from "@playwright/test";

test("rules page is public and links back to the game", async ({ page }) => {
  await page.goto("/rules");

  await expect(page).toHaveTitle(/How to Play Naija Whot/);
  await expect(page.getByRole("heading", { name: "How to Play Naija Whot" })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Pick Two can be defended only with another 2." }),
  ).toBeVisible();
  await expect(page.getByText("Whot cannot be selected as the requested shape.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Create Game" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Join Game" })).toHaveAttribute("href", "/");
});
