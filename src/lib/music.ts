"use client";

export type MusicMode = "lobby" | "game";

export interface MusicDiagnostics {
  activeInstances: number;
  source: string;
  readyState: number;
  playing: boolean;
  volume: number;
  enabled: boolean;
  lastError: string | null;
}

type DiagnosticsWindow = Window & {
  __NAIJA_WHOT_MUSIC_DIAGNOSTICS__?: () => MusicDiagnostics;
};

const MUSIC_SOURCE = "/audio/music/game-table.mp3";

class MusicManager {
  private enabled = false;
  private volume = 0.1;
  private desiredMode: MusicMode = "lobby";
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private lastError: string | null = null;
  private visibilityListenerAttached = false;

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.audio) return this.audio;

    try {
      const audio = new Audio(MUSIC_SOURCE);
      audio.loop = true;
      audio.volume = this.volume;
      audio.preload = "auto";
      audio.addEventListener("pause", () => {
        this.playing = false;
      });
      audio.addEventListener("playing", () => {
        this.playing = true;
        this.lastError = null;
      });
      audio.addEventListener("error", () => {
        this.playing = false;
        this.lastError = "Unable to load background music.";
      });
      this.audio = audio;
      this.attachVisibilityListener();
    } catch (err) {
      this.lastError =
        err instanceof Error ? err.message : "Unable to initialize background music.";
      return null;
    }

    return this.audio;
  }

  private attachVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.visibilityListenerAttached = true;
  }

  private handleVisibilityChange() {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      this.pause();
      return;
    }
    if (this.enabled) {
      void this.play();
    }
  }

  private async play(): Promise<void> {
    const audio = this.ensureAudio();
    if (!audio) return;

    try {
      audio.volume = this.volume;
      await audio.play();
      this.playing = !audio.paused;
      this.lastError = null;
    } catch (err) {
      this.playing = false;
      this.lastError = err instanceof Error ? err.message : "Unable to play background music.";
    }
  }

  private pause() {
    try {
      this.audio?.pause();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : "Unable to pause background music.";
    } finally {
      this.playing = false;
    }
  }

  hydrate(enabled: boolean, mode: MusicMode) {
    this.enabled = enabled;
    this.desiredMode = mode;
    this.ensureAudio();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    const audio = this.ensureAudio();
    if (audio) audio.volume = this.volume;
  }

  async setEnabled(enabled: boolean, mode: MusicMode) {
    this.enabled = enabled;
    this.desiredMode = mode;
    if (enabled) {
      await this.play();
      return;
    }
    this.pause();
  }

  async setMode(mode: MusicMode) {
    this.desiredMode = mode;
  }

  stop() {
    this.enabled = false;
    this.pause();
  }

  getDiagnostics(): MusicDiagnostics {
    const audio = this.audio;
    return {
      activeInstances: audio ? 1 : 0,
      source: MUSIC_SOURCE,
      readyState: audio?.readyState ?? 0,
      playing: this.playing && !!audio && !audio.paused,
      volume: this.volume,
      enabled: this.enabled,
      lastError: this.lastError,
    };
  }

  getDesiredMode(): MusicMode {
    return this.desiredMode;
  }

  getVolume(): number {
    return this.volume;
  }

  resetForTests() {
    if (typeof document !== "undefined" && this.visibilityListenerAttached) {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    this.visibilityListenerAttached = false;
    this.enabled = false;
    this.playing = false;
    this.lastError = null;
    this.audio = null;
  }
}

export const music = new MusicManager();

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as DiagnosticsWindow).__NAIJA_WHOT_MUSIC_DIAGNOSTICS__ = () => music.getDiagnostics();
}
