import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_MUSIC_VOLUME, getMusicEnabled, getMusicVolume } from "@/lib/music-preference";

describe("music preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults music off and volume to 0.10 when no preference is saved", () => {
    expect(getMusicEnabled()).toBe(false);
    expect(getMusicVolume()).toBe(DEFAULT_MUSIC_VOLUME);
    expect(getMusicVolume()).toBe(0.1);
  });
});
