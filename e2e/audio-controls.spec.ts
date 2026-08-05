import { expect, test, type Page } from "@playwright/test";

type AudioTestState = {
  created: number;
  playCalls: number;
  pauseCalls: number;
  sources: string[];
};

declare global {
  interface Window {
    __audioTestState?: AudioTestState;
  }
}

async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const state: AudioTestState = {
      created: 0,
      playCalls: 0,
      pauseCalls: 0,
      sources: [],
    };

    window.__audioTestState = state;
    window.Audio = function Audio(src?: string) {
      const audio = new NativeAudio(src);
      state.created += 1;
      state.sources.push(src ?? "");

      const nativePlay = audio.play.bind(audio);
      audio.play = async () => {
        state.playCalls += 1;
        try {
          await nativePlay();
        } catch {
          // The app catches playback failures; this probe keeps the browser
          // test deterministic without depending on host audio permissions.
        }
      };

      const nativePause = audio.pause.bind(audio);
      audio.pause = () => {
        state.pauseCalls += 1;
        nativePause();
      };

      return audio;
    } as unknown as typeof Audio;
  });
}

test("music starts only from user control while sound effects remain independent", async ({
  page,
}) => {
  await installAudioProbe(page);
  await page.goto("/");

  await expect(page.getByText("Music coming soon")).toHaveCount(0);
  const musicOff = page.getByRole("button", { name: "Music off" });
  const soundButton = page.getByRole("button", { name: "Sound on" });

  await expect(musicOff).toHaveAttribute("aria-pressed", "false");
  await expect(soundButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Music volume" })).toHaveValue("0.1");
  await expect.poll(() => page.evaluate(() => window.__audioTestState?.playCalls ?? -1)).toBe(0);

  await musicOff.click();
  await expect(page.getByRole("button", { name: "Music on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("naija-whot:music-enabled")))
    .toBe("true");
  await expect.poll(() => page.evaluate(() => window.__audioTestState?.playCalls ?? -1)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__audioTestState?.created ?? -1)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__audioTestState?.sources[0]))
    .toBe("/audio/music/game-table.mp3");

  await page.getByRole("slider", { name: "Music volume" }).fill("0.42");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("naija-whot:music-volume")))
    .toBe("0.42");

  await soundButton.click();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Music on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Music on" }).click();
  await expect(page.getByRole("button", { name: "Music off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("naija-whot:music-enabled")))
    .toBe("false");
  await expect.poll(() => page.evaluate(() => window.__audioTestState?.pauseCalls ?? -1)).toBe(1);

  await page.reload();
  await expect(page.getByRole("button", { name: "Music off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.evaluate(() => "__NAIJA_WHOT_MUSIC_DIAGNOSTICS__" in window)).resolves.toBe(
    false,
  );
});

test("licensed MP3 is served with an audio content type", async ({ request }) => {
  const res = await request.get("/audio/music/game-table.mp3");

  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^audio\/(?:mpeg|mp3)/);
  expect(Number(res.headers()["content-length"] ?? "0")).toBeGreaterThan(1_000_000);
});
