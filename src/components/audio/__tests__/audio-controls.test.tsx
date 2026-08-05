import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioControls } from "@/components/audio/audio-controls";

describe("AudioControls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "Audio",
      class {
        loop = false;
        volume = 1;
        preload = "";
        paused = true;
        readyState = 4;

        constructor(readonly src: string) {}

        addEventListener() {}
        async play() {}
        pause() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps music off by default while sound effects default on", () => {
    render(<AudioControls mode="lobby" />);

    expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Music off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("persists music enabled and volume independently from SFX", async () => {
    const user = userEvent.setup();
    render(<AudioControls mode="lobby" />);

    await user.click(screen.getByRole("button", { name: "Music off" }));
    await user.click(screen.getByRole("button", { name: "Sound on" }));
    fireEvent.change(screen.getByRole("slider", { name: "Music volume" }), {
      target: { value: "0.42" },
    });

    expect(window.localStorage.getItem("naija-whot:music-enabled")).toBe("true");
    expect(window.localStorage.getItem("naija-whot:music-volume")).toBe("0.42");
    expect(window.localStorage.getItem("naija-whot:sound-enabled")).toBe("false");
  });
});
