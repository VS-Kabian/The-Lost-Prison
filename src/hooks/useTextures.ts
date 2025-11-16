import { useEffect, useMemo, useState } from "react";

type TextureKey =
  | "wall"
  | "stone"
  | "lava"
  | "platform"
  | "key"
  | "bomb"
  | "lock"
  | "bg1"
  | "bg2"
  | "playerOpen"
  | "playerClose"
  | "goal"
  | "weapon"
  | "monsterOpen"
  | "monsterClose";

const textureSources: Record<TextureKey, string> = {
  wall: "/Images/Wall.webp",
  stone: "/Images/Stone.webp",
  lava: "/Images/Lava.png",
  platform: "/Images/Wood Platform.webp",
  key: "/Images/Key.png",
  bomb: "/Images/Bomb-Lev-1.webp",
  lock: "/Images/Lock-Normal.png",
  bg1: "/Images/BG-1.webp",
  bg2: "/Images/BG-2.jpg",
  playerOpen: "/Images/Player/Kilo-Opened.png",
  playerClose: "/Images/Player/Kilo-Closed.png",
  goal: "/Images/Player/Goal.png",
  weapon: "/Images/Player/Gun.png",
  monsterOpen: "/Images/Player/Monster-Open.png",
  monsterClose: "/Images/Player/Monster-Close.png"
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
      image.onerror = (event) => {
        if (cancelled) return;
        console.warn(`Failed to load texture ${key}`, event);
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

