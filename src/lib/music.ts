"use client";

export type MusicMode = "lobby" | "game";

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

class ProceduralMusicManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: OscillatorNode[] = [];
  private enabled = false;
  private desiredMode: MusicMode = "lobby";
  private currentMode: MusicMode | null = null;
  private volume = 0.15;
  private wasPlayingBeforeHidden = false;
  private visibilityBound = false;

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  async setEnabled(enabled: boolean, mode: MusicMode) {
    this.enabled = enabled;
    this.desiredMode = mode;
    if (!enabled) {
      this.stop();
      return;
    }
    if (prefersReducedData()) return;
    await this.play(mode);
  }

  async setMode(mode: MusicMode) {
    if (!this.enabled || prefersReducedData()) return;
    if (this.nodes.length > 0 && this.currentMode === mode) return;
    this.desiredMode = mode;
    await this.play(mode);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx ??= new Ctor();
    this.bindVisibility();
    return this.ctx;
  }

  private bindVisibility() {
    if (this.visibilityBound || typeof document === "undefined") return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.wasPlayingBeforeHidden = this.enabled && this.nodes.length > 0;
        this.stop();
      } else if (this.wasPlayingBeforeHidden && this.enabled) {
        void this.play(this.desiredMode);
      }
    });
  }

  private async play(mode: MusicMode) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      this.stop(0.08);
      this.desiredMode = mode;
      this.currentMode = mode;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, this.volume),
        ctx.currentTime + 0.2,
      );
      master.connect(ctx.destination);
      this.master = master;

      const base = mode === "lobby" ? 196 : 147;
      const intervals = mode === "lobby" ? [1, 1.5, 2] : [1, 1.25, 1.5];
      this.nodes = intervals.map((interval, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index === 0 ? "sine" : "triangle";
        osc.frequency.value = base * interval;
        gain.gain.value = index === 0 ? 0.16 : 0.045;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        return osc;
      });
    } catch {
      this.stop();
    }
  }

  private stop(fadeSeconds = 0.12) {
    if (!this.ctx || !this.master) {
      this.nodes = [];
      return;
    }
    const ctx = this.ctx;
    const master = this.master;
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeSeconds);
    const nodes = this.nodes;
    window.setTimeout(
      () => {
        for (const node of nodes) {
          try {
            node.stop();
          } catch {
            // Already stopped.
          }
          node.disconnect();
        }
        master.disconnect();
      },
      Math.max(40, fadeSeconds * 1000),
    );
    this.master = null;
    this.nodes = [];
    this.currentMode = null;
  }
}

export const music = new ProceduralMusicManager();
