"use client";

const MUSIC_ENABLED_KEY = "naija-whot:music-enabled";
const MUSIC_VOLUME_KEY = "naija-whot:music-volume";
export const DEFAULT_MUSIC_VOLUME = 0.1;

export function getMusicEnabled(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMusicEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_ENABLED_KEY, String(enabled));
  } catch {
    // Non-critical preference; privacy mode may block localStorage.
  }
}

export function getMusicVolume(): number {
  try {
    const raw = window.localStorage.getItem(MUSIC_VOLUME_KEY);
    if (raw === null) return DEFAULT_MUSIC_VOLUME;
    const stored = Number(raw);
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : DEFAULT_MUSIC_VOLUME;
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
}

export function setMusicVolume(volume: number): void {
  try {
    window.localStorage.setItem(MUSIC_VOLUME_KEY, String(Math.min(1, Math.max(0, volume))));
  } catch {
    // Non-critical preference; privacy mode may block localStorage.
  }
}
