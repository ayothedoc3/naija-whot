import { expect, test } from "@playwright/test";

test("music is off by default and persists independently from sound effects", async ({ page }) => {
  await page.goto("/");

  const musicButton = page.getByRole("button", { name: "Music off" });
  const soundButton = page.getByRole("button", { name: "Sound on" });

  await expect(musicButton).toHaveAttribute("aria-pressed", "false");
  await expect(soundButton).toHaveAttribute("aria-pressed", "true");

  await musicButton.click();
  await expect(page.getByRole("button", { name: "Music on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await soundButton.click();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Music on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByLabel("Music volume").fill("0.35");
  await page.reload();

  await expect(page.getByRole("button", { name: "Music on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByLabel("Music volume")).toHaveValue("0.35");
});
