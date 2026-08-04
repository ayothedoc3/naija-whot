"use client";

import { useEffect, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSoundEnabled, setSoundEnabled } from "@/lib/sound-preference";
import { DEFAULT_MUSIC_VOLUME, getMusicVolume, setMusicEnabled } from "@/lib/music-preference";
import { music, type MusicMode } from "@/lib/music";

interface AudioControlsProps {
  mode: MusicMode;
  compact?: boolean;
}

export function AudioControls({ mode, compact }: AudioControlsProps) {
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_MUSIC_VOLUME);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundOn(getSoundEnabled());
    const storedVolume = getMusicVolume();
    setVolume(storedVolume);
    music.setVolume(storedVolume);
    setMusicEnabled(false);
    void music.setEnabled(false, mode);
  }, [mode]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
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
        disabled
        aria-pressed="false"
        title="Music coming soon"
        className="text-cream/45 gap-1 px-2"
      >
        <Music className="size-3.5" />
        {compact ? "Music soon" : "Music coming soon"}
      </Button>
      <span className="sr-only">Music volume saved at {volume}</span>
    </div>
  );
}
