import { useEffect, useMemo, useState } from "react";
import { logWarning } from "../utils/logger";

type TextureKey =
  | "wall"
  | "stone"
  | "lava"
  | "platform"
  | "grassstone"
  | "grass"
  | "soil"
  | "key"
  | "bomb"
  | "lock"
  | "bg1"
  | "bg2"
  | "bg3"
  | "bg4"
  | "bg5"
  | "bg6"
  | "playerOpen"
  | "playerClose"
  | "goal"
  | "weapon"
  | "monsterOpen"
  | "monsterClose"
  | "fireTrapBlock"
  | "fire1"
  | "fire2"
  | "fire3"
  | "fire4"
  | "spikeTrapBlock"
  | "spike";

const textureSources: Record<TextureKey, string> = {
  wall: "/Images/Wall.webp",
  stone: "/Images/Stone.webp",
  lava: "/Images/Lava.png",
  platform: "/Images/Wood Platform.webp",
  grassstone: "/Images/Grass-Stone-Block.jpg",
  grass: "/Images/Grass-Block.webp",
  soil: "/Images/Soil.webp",
  key: "/Images/Key.png",
  bomb: "/Images/Bomb-Lev-1.webp",
  lock: "/Images/Lock-Normal.png",
  bg1: "/Images/BackGround/BG-1.webp",
  bg2: "/Images/BackGround/BG-2.jpg",
  bg3: "/Images/BackGround/BG-3.jpg",
  bg4: "/Images/BackGround/BG-4.jpg",
  bg5: "/Images/BackGround/BG-5.jpg",
  bg6: "/Images/BackGround/BG-6.jpg",
  playerOpen: "/Images/Player/Kilo-Opened.png",
  playerClose: "/Images/Player/Kilo-Closed.png",
  goal: "/Images/Player/Goal.png",
  weapon: "/Images/Player/Gun.png",
  monsterOpen: "/Images/Player/Monster-Open.png",
  monsterClose: "/Images/Player/Monster-Close.png",
  fireTrapBlock: "/Images/Fire_Trap.png",
  fire1: "/Images/Fire Anim/Fire-1.png",
  fire2: "/Images/Fire Anim/Fire-2.png",
  fire3: "/Images/Fire Anim/Fire-3.png",
  fire4: "/Images/Fire Anim/Fire-4.png",
  spikeTrapBlock: "/Images/Spike_Trap.webp",
  spike: "/Images/Spike.png"
};

export type TextureMap = Partial<Record<TextureKey, HTMLImageElement>>;

export function useTextures(): {
  textures: TextureMap;
  loaded: boolean;
  error: Error | null;
} {
  const [textures, setTextures] = useState<TextureMap>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const keys = useMemo(() => Object.keys(textureSources) as TextureKey[], []);

  useEffect(() => {
    let cancelled = false;

    const images: TextureMap = {};
    let loadedCount = 0;

    keys.forEach((key) => {
      const image = new Image();
      image.src = textureSources[key];
      image.onload = () => {
        if (cancelled) return;
        images[key] = image;
        loadedCount += 1;
        if (loadedCount === keys.length) {
          setTextures(images);
          setLoaded(true);
        }
      };
      image.onerror = () => {
        if (cancelled) return;
        logWarning(`Failed to load texture ${key}`);
        loadedCount += 1;
        if (loadedCount === keys.length) {
          setTextures(images);
          setLoaded(true);
          setError(new Error(`Some textures failed to load`));
        }
      };
    });

    return () => {
      cancelled = true;
    };
  }, [keys]);

  return { textures, loaded, error };
}

