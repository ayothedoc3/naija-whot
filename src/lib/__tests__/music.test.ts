import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { music as MusicSingleton } from "@/lib/music";

type Listener = () => void;

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playMock = vi.fn<() => Promise<void>>(async () => {});

  src: string;
  loop = false;
  volume = 1;
  preload = "";
  paused = true;
  readyState = 4;
  private listeners = new Map<string, Listener[]>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  async play() {
    await FakeAudio.playMock();
    this.paused = false;
    this.dispatch("playing");
  }

  pause() {
    this.paused = true;
    this.dispatch("pause");
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function freshMusic() {
  vi.resetModules();
  FakeAudio.instances = [];
  FakeAudio.playMock = vi.fn<() => Promise<void>>(async () => {});
  vi.stubGlobal("Audio", FakeAudio);
  return import("@/lib/music");
}

let activeMusic: typeof MusicSingleton | null = null;

describe("music manager", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setDocumentHidden(false);
  });

  afterEach(() => {
    activeMusic?.resetForTests();
    activeMusic = null;
    vi.unstubAllGlobals();
  });

  it("creates no playback during initial page load", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    expect(FakeAudio.instances).toHaveLength(0);
    expect(music.getDiagnostics()).toMatchObject({
      activeInstances: 0,
      source: "/audio/music/game-table.mp3",
      playing: false,
      enabled: false,
      volume: 0.1,
      lastError: null,
    });
    expect(FakeAudio.playMock).not.toHaveBeenCalled();
  });

  it("user enable starts the licensed looping MP3 once", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    await music.setEnabled(true, "game");
    await music.setMode("lobby");
    music.setVolume(0.3);

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]).toMatchObject({
      src: "/audio/music/game-table.mp3",
      loop: true,
      preload: "auto",
      volume: 0.3,
      paused: false,
    });
    expect(music.getDiagnostics()).toMatchObject({
      activeInstances: 1,
      playing: true,
      enabled: true,
      volume: 0.3,
    });
    expect(FakeAudio.playMock).toHaveBeenCalledTimes(1);
  });

  it("user disable pauses without destroying or duplicating the audio instance", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    await music.setEnabled(true, "game");
    await music.setEnabled(false, "game");
    await music.setEnabled(true, "game");

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.playMock).toHaveBeenCalledTimes(2);
    expect(music.getDiagnostics()).toMatchObject({
      activeInstances: 1,
      playing: true,
      enabled: true,
    });
  });

  it("rerenders and realtime-style mode updates do not recreate the audio element", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    music.hydrate(false, "lobby");
    await music.setMode("game");
    await music.setMode("game");
    await music.setEnabled(true, "game");
    await music.setMode("game");

    expect(FakeAudio.instances).toHaveLength(1);
    expect(music.getDiagnostics().activeInstances).toBe(1);
  });

  it("clamps volume between 0 and 1", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    music.setVolume(2);
    expect(music.getDiagnostics().volume).toBe(1);
    expect(FakeAudio.instances[0]?.volume).toBe(1);

    music.setVolume(-4);
    expect(music.getDiagnostics().volume).toBe(0);
    expect(FakeAudio.instances[0]?.volume).toBe(0);
  });

  it("hidden document pauses and visible document resumes only while enabled", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    await music.setEnabled(true, "game");
    setDocumentHidden(true);
    expect(music.getDiagnostics().playing).toBe(false);

    setDocumentHidden(false);
    await Promise.resolve();
    expect(FakeAudio.playMock).toHaveBeenCalledTimes(2);
    expect(music.getDiagnostics().playing).toBe(true);

    await music.setEnabled(false, "game");
    setDocumentHidden(true);
    setDocumentHidden(false);
    await Promise.resolve();
    expect(FakeAudio.playMock).toHaveBeenCalledTimes(2);
    expect(music.getDiagnostics()).toMatchObject({ enabled: false, playing: false });
  });

  it("playback rejection is captured without throwing", async () => {
    const { music } = await freshMusic();
    activeMusic = music;
    FakeAudio.playMock = vi.fn<() => Promise<void>>(async () => {
      throw new Error("autoplay blocked");
    });

    await expect(music.setEnabled(true, "game")).resolves.toBeUndefined();

    expect(music.getDiagnostics()).toMatchObject({
      enabled: true,
      playing: false,
      lastError: "autoplay blocked",
    });
  });

  it("diagnostics expose only the approved development fields", async () => {
    const { music } = await freshMusic();
    activeMusic = music;

    expect(Object.keys(music.getDiagnostics()).sort()).toEqual([
      "activeInstances",
      "enabled",
      "lastError",
      "playing",
      "readyState",
      "source",
      "volume",
    ]);
  });
});
