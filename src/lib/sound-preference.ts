"use client";

const SOUND_STORAGE_KEY = "naija-whot:sound-enabled";

export function getSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore — non-critical preference, privacy mode can block localStorage.
  }
}
