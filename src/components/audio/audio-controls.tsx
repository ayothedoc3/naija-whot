"use client";

import { useEffect, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
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
    const storedMusicEnabled = getMusicEnabled();
    const storedVolume = getMusicVolume();
    setMusicOn(storedMusicEnabled);
    setVolume(storedVolume);
    music.setVolume(storedVolume);
    music.hydrate(storedMusicEnabled, mode);
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

  function changeMusicVolume(nextValue: number) {
    const next = Math.min(1, Math.max(0, nextValue));
    setVolume(next);
    setMusicVolume(next);
    music.setVolume(next);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" data-testid="audio-controls">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggleSound}
        aria-pressed={soundOn}
        className="text-cream/80 gap-1 rounded-full px-2 hover:bg-[#f8e7bc]/15 hover:text-[#f8e7bc]"
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
        className="text-cream/80 gap-1 rounded-full px-2 hover:bg-[#f8e7bc]/15 hover:text-[#f8e7bc]"
      >
        <Music className="size-3.5" />
        {compact ? "Music" : `Music ${musicOn ? "on" : "off"}`}
      </Button>
      <label
        className="text-cream/80 flex items-center gap-1 text-xs"
        htmlFor={compact ? "music-volume-compact" : "music-volume"}
      >
        <span className="sr-only">Music volume</span>
        <input
          id={compact ? "music-volume-compact" : "music-volume"}
          data-testid="music-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => changeMusicVolume(Number(event.currentTarget.value))}
          aria-label="Music volume"
          className="accent-gold h-4 w-20"
        />
      </label>
    </div>
  );
}
