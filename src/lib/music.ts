"use client";

export type MusicMode = "lobby" | "game";

export interface MusicDiagnostics {
  enabled: boolean;
  activeTrackName: string | null;
  activeInstances: number;
  available: boolean;
  reason: string;
}

type DiagnosticsWindow = Window & {
  __NAIJA_WHOT_MUSIC_DIAGNOSTICS__?: () => MusicDiagnostics;
};

class MusicManager {
  private enabled = false;
  private volume = 0.15;
  private desiredMode: MusicMode = "lobby";

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  async setEnabled(enabled: boolean, mode: MusicMode) {
    this.enabled = false;
    this.desiredMode = mode;
    if (enabled) {
      return Promise.resolve();
    }
  }

  async setMode(mode: MusicMode) {
    this.desiredMode = mode;
    return Promise.resolve();
  }

  stop() {
    this.enabled = false;
  }

  getDiagnostics(): MusicDiagnostics {
    return {
      enabled: this.enabled,
      activeTrackName: null,
      activeInstances: 0,
      available: false,
      reason: "Background music is disabled until a clean licensed track is added.",
    };
  }

  getDesiredMode(): MusicMode {
    return this.desiredMode;
  }

  getVolume(): number {
    return this.volume;
  }
}

export const music = new MusicManager();

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as DiagnosticsWindow).__NAIJA_WHOT_MUSIC_DIAGNOSTICS__ = () => music.getDiagnostics();
}
