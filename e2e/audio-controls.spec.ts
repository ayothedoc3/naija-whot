import { expect, test } from "@playwright/test";

test("music is disabled until a clean track exists while sound effects remain independent", async ({
  page,
}) => {
  await page.goto("/");

  const musicButton = page.getByRole("button", { name: "Music coming soon" });
  const soundButton = page.getByRole("button", { name: "Sound on" });

  await expect(musicButton).toBeDisabled();
  await expect(musicButton).toHaveAttribute("aria-pressed", "false");
  await expect(soundButton).toHaveAttribute("aria-pressed", "true");

  await soundButton.click();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(musicButton).toHaveAttribute("aria-pressed", "false");

  await page.reload();

  await expect(page.getByRole("button", { name: "Music coming soon" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("naija-whot:music-enabled")))
    .toBe("false");
  await expect(page.locator("[data-testid='music-volume']")).toHaveCount(0);
  await expect(page.evaluate(() => "__NAIJA_WHOT_MUSIC_DIAGNOSTICS__" in window)).resolves.toBe(
    false,
  );
});
