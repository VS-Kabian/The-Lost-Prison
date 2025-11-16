import { useEffect, useRef, useState } from "react";

type AudioKey =
  | "bgMusic"
  | "boom"
  | "gunShoot"
  | "itemPick"
  | "jump"
  | "playerOut"
  | "stricks";

const audioSources: Record<AudioKey, string> = {
  bgMusic: "/Music/01. Key.mp3",
  boom: "/Music/Boom.mp3",
  gunShoot: "/Music/Gun Shoot.mp3",
  itemPick: "/Music/Item-Pick.mp3",
  jump: "/Music/Jump.mp3",
  playerOut: "/Music/PlayerOut.wav",
  stricks: "/Music/Stricks.mp3",
};

export type AudioMap = Record<AudioKey, HTMLAudioElement>;

export function useAudio(): {
  audio: AudioMap;
  loaded: boolean;
  enabled: boolean;
  playSound: (key: AudioKey) => void;
  playBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  setMuted: (muted: boolean) => void;
  enableAudio: () => Promise<void>;
} {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<AudioMap | null>(null);
  const enabledRef = useRef(false);

  // Initialize audio on first mount
  if (!audioRef.current) {
    const audioMap = {} as AudioMap;
    Object.entries(audioSources).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";

      if (key === "bgMusic") {
        audio.loop = true;
        audio.volume = 0.4;
      } else if (key === "jump") {
        audio.volume = 0.25;
      } else {
        audio.volume = 0.5;
      }

      audioMap[key as AudioKey] = audio;
    });
    audioRef.current = audioMap;
  }

  const audio = audioRef.current;

  useEffect(() => {
    const checkLoaded = () => {
      const allLoaded = Object.values(audio).every(
        (a) => a.readyState >= 2 // HAVE_CURRENT_DATA or better
      );
      if (allLoaded && !loaded) {
        setLoaded(true);
      }
    };

    const timer = setInterval(checkLoaded, 500);
    checkLoaded();

    return () => clearInterval(timer);
  }, [audio, loaded]);

  const enableAudio = async (): Promise<void> => {
    if (enabledRef.current) {
      return;
    }

    try {
      // Try to play and pause each sound to unlock audio context
      const unlockPromises = Object.entries(audio).map(async ([key, sound]) => {
        try {
          await sound.play();
          sound.pause();
          sound.currentTime = 0;
          return true;
        } catch (err) {
          console.warn(`Failed to unlock ${key}`);
          return false;
        }
      });

      await Promise.all(unlockPromises);

      enabledRef.current = true;
      setEnabled(true);
      console.log("🎵 Audio ready");
    } catch (err) {
      console.error("Audio initialization failed:", err);
    }
  };

  const playSound = (key: AudioKey) => {
    if (!enabledRef.current) {
      return;
    }

    const sound = audio[key];
    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch (err) {
      // Silent fail
    }
  };

  const playBackgroundMusic = () => {
    if (!enabledRef.current) {
      return;
    }

    const music = audio.bgMusic;
    if (music.paused) {
      music.currentTime = 0;
      music.play().catch(() => {});
    }
  };

  const stopBackgroundMusic = () => {
    const music = audio.bgMusic;
    music.pause();
  };

  const setMuted = (muted: boolean) => {
    Object.values(audio).forEach((a) => (a.muted = muted));
  };

  return {
    audio,
    loaded,
    enabled,
    playSound,
    playBackgroundMusic,
    stopBackgroundMusic,
    setMuted,
    enableAudio,
  };
}
