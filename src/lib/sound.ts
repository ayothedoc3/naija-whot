"use client";

import { getSoundEnabled } from "@/lib/sound-preference";

/**
 * Tiny procedurally-generated sound effects via the Web Audio API — no
 * external audio files, so there's nothing to license or attribute. Every
 * call is a no-op if the user has sound disabled or the browser has no
 * AudioContext (e.g. some test/automation environments), so the game is
 * always fully playable with sound off.
 */
let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

function playTone(frequencies: number[], durationMs: number, type: OscillatorType = "sine") {
  if (!getSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const stepMs = durationMs / frequencies.length;
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = now + (i * stepMs) / 1000;
    const end = start + stepMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

export const sound = {
  cardPlay: () => playTone([440], 90, "triangle"),
  cardDraw: () => playTone([300], 70, "sine"),
  yourTurn: () => playTone([523, 659], 160, "sine"),
  penalty: () => playTone([220, 180], 180, "sawtooth"),
  roundWin: () => playTone([523, 659, 784, 1046], 380, "triangle"),
  roundLose: () => playTone([392, 349, 294], 300, "sine"),
  error: () => playTone([180], 120, "square"),
};
