import type { BackgroundKey } from "./types";

export const THEMES = {
  sky: { bg: "#87CEEB", name: "Sky Blue" },
  cave: { bg: "#2c2c2c", name: "Dark Cave" },
  sunset: { bg: "linear-gradient(to bottom, #FF6B6B, #FFA500)", name: "Sunset" },
  forest: { bg: "#228B22", name: "Forest" },
  space: { bg: "linear-gradient(to bottom, #1a0033, #4a0080)", name: "Purple Space" },
  ocean: { bg: "linear-gradient(to bottom, #0077be, #00c3cc)", name: "Ocean" },
  desert: { bg: "linear-gradient(to bottom, #f4e7d7, #ffcc66)", name: "Desert" },
  snow: { bg: "linear-gradient(to bottom, #e6f2ff, #ffffff)", name: "Snow" },
  lava: { bg: "linear-gradient(to bottom, #1a0000, #ff4400)", name: "Lava Hell" },
  night: { bg: "linear-gradient(to bottom, #0a0a2e, #000000)", name: "Night Sky" }
} as const;

export type ThemeKey = keyof typeof THEMES;

export const BACKGROUND_OPTIONS: { value: BackgroundKey; label: string }[] = [
  { value: "none", label: "No Background" },
  { value: "bg1", label: "Forest Platformer" },
  { value: "bg2", label: "Sky Plains" },
  { value: "bg3", label: "Background 3" },
  { value: "bg4", label: "Background 4" },
  { value: "bg5", label: "Background 5" },
  { value: "bg6", label: "Background 6" }
];

export const TOOL_OPTIONS = [
  {
    label: "Terrain",
    tools: [
      { id: "empty", name: "Empty", icon: "⬜" },
      { id: "wall", name: "Wall", icon: "⬛" },
      { id: "stone", name: "Stone", icon: "🟦" },
      { id: "lava", name: "Lava", icon: "🟥" },
      { id: "platform", name: "Platform", icon: "🟫" }
    ]
  },
  {
    label: "Objects",
    tools: [
      { id: "player", name: "Player", icon: "🟢" },
      { id: "goal", name: "Goal", icon: "⭐" },
      { id: "key", name: "Key", icon: "🗝️" },
      { id: "door", name: "Door", icon: "🟪" }
    ]
  },
  {
    label: "Combat",
    tools: [
      { id: "monster", name: "Monster", icon: "👾" },
      { id: "weapon", name: "Weapon", icon: "🔫" },
      { id: "bomb", name: "Bomb", icon: "💣" }
    ]
  },
  {
    label: "Traps",
    tools: [
      { id: "firetrap", name: "Fire Trap", icon: "🔥" }
    ]
  }
] as const;

