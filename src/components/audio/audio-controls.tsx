"use client";

import { useEffect, useState } from "react";
import { Music, Music2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSoundEnabled, setSoundEnabled } from "@/lib/sound-preference";
import {
  DEFAULT_MUSIC_VOLUME,
  getMusicEnabled,
  getMusicVolume,
  setMusicEnabled,
  setMusicVolume,
} from "@/lib/music-preference";
import { music, type MusicMode } from "@/lib/music";

interface AudioControlsProps {
  mode: MusicMode;
  compact?: boolean;
}

export function AudioControls({ mode, compact }: AudioControlsProps) {
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_MUSIC_VOLUME);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundOn(getSoundEnabled());
    setMusicOn(getMusicEnabled());
    const storedVolume = getMusicVolume();
    setVolume(storedVolume);
    music.setVolume(storedVolume);
    if (getMusicEnabled()) void music.setMode(mode);
  }, [mode]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
    void music.setEnabled(next, mode);
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    setMusicVolume(nextVolume);
    music.setVolume(nextVolume);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" data-testid="audio-controls">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggleSound}
        aria-pressed={soundOn}
        className="text-cream/75 hover:text-gold gap-1 px-2"
      >
        {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
        {compact ? "SFX" : `Sound ${soundOn ? "on" : "off"}`}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggleMusic}
        aria-pressed={musicOn}
        className="text-cream/75 hover:text-gold gap-1 px-2"
      >
        {musicOn ? <Music2 className="size-3.5" /> : <Music className="size-3.5" />}
        {compact ? "Music" : `Music ${musicOn ? "on" : "off"}`}
      </Button>
      <label className="text-cream/70 flex items-center gap-1 text-xs">
        <span>Music volume</span>
        <input
          data-testid="music-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => changeVolume(Number(event.currentTarget.value))}
          className="w-20 accent-[var(--color-gold)]"
          aria-label="Music volume"
        />
      </label>
    </div>
  );
}
