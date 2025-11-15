import type { LevelData } from "../types";
import { logError } from "./logger";

const LEVEL_PREFIX = "level_";
const TUTORIAL_KEY = "seenTutorial";

export function saveLevelToStorage(level: number, data: LevelData): void {
  localStorage.setItem(`${LEVEL_PREFIX}${level}`, JSON.stringify(data));
}

export function loadLevelFromStorage(level: number): LevelData | null {
  const raw = localStorage.getItem(`${LEVEL_PREFIX}${level}`);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);

    // Basic validation to prevent malformed data
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid level data structure');
    }
    if (!Array.isArray(parsed.grid) || !parsed.name) {
      throw new Error('Missing required level properties');
    }

    return parsed as LevelData;
  } catch (error) {
    logError("Failed to parse level data", error);
    // Clear corrupted data
    localStorage.removeItem(`${LEVEL_PREFIX}${level}`);
    return null;
  }
}

export function exportLevel(level: number, data: LevelData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `level_${level}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function markTutorialSeen(): void {
  localStorage.setItem(TUTORIAL_KEY, "true");
}

export function hasSeenTutorial(): boolean {
  return localStorage.getItem(TUTORIAL_KEY) === "true";
}

