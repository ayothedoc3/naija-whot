import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("background music asset packaging", () => {
  it("keeps the licensed MP3 in public assets", () => {
    const mp3 = statSync(join(root, "public/audio/music/game-table.mp3"));

    expect(mp3.isFile()).toBe(true);
    expect(mp3.size).toBeGreaterThan(1_000_000);
  });

  it("copies public assets into the standalone Docker image", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    const dockerignore = readFileSync(join(root, ".dockerignore"), "utf8");

    expect(dockerfile).toContain("/app/public ./public");
    expect(dockerignore).not.toMatch(/^public(?:\/|$)/m);
    expect(dockerignore).not.toMatch(/^public\/audio(?:\/|$)/m);
  });
});
