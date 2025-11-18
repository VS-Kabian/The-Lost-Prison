import {
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  MIN_GRID_HEIGHT,
  MIN_GRID_WIDTH
} from "../types";
import type {
  BackgroundKey,
  EditorDoor,
  EditorMonster,
  EditorState,
  GridPosition,
  LevelData,
  Tool
} from "../types";

export const DEFAULT_GRID_WIDTH = 20;
export const DEFAULT_GRID_HEIGHT = 15;

export function createEmptyGrid(width: number, height: number): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = 0;
    }
  }
  return grid;
}

export function clampGridSize(width: number, height: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(MIN_GRID_WIDTH, Math.min(MAX_GRID_WIDTH, width)),
    height: Math.max(MIN_GRID_HEIGHT, Math.min(MAX_GRID_HEIGHT, height))
  };
}

export function createInitialEditorState(): EditorState {
  return {
    currentLevel: 1,
    selectedTool: "empty",
    gridWidth: DEFAULT_GRID_WIDTH,
    gridHeight: DEFAULT_GRID_HEIGHT,
    name: "Level 1",
    grid: createEmptyGrid(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT),
    monsters: [],
    weapons: [],
    bombs: [],
    hearts: [],
    coins: [],
    keys: [],
    doors: [],
    firetraps: [],
    playerStart: null,
    goal: null,
    background: "none",
    theme: "sky",
    isDrawing: false
  };
}

export function createLevelFromEditorState(state: EditorState): LevelData {
  return {
    name: state.name,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    grid: state.grid,
    monsters: state.monsters,
    weapons: state.weapons,
    bombs: state.bombs,
    hearts: state.hearts,
    coins: state.coins,
    keys: state.keys,
    doors: state.doors,
    firetraps: state.firetraps,
    playerStart: state.playerStart,
    goal: state.goal,
    background: state.background,
    theme: state.theme
  };
}

export function applyLevelToEditorState(state: EditorState, level: LevelData): EditorState {
  return {
    ...state,
    name: level.name,
    gridWidth: level.gridWidth ?? state.gridWidth,
    gridHeight: level.gridHeight ?? state.gridHeight,
    grid: level.grid ?? createEmptyGrid(level.gridWidth ?? state.gridWidth, level.gridHeight ?? state.gridHeight),
    monsters: level.monsters ?? [],
    weapons: level.weapons ?? [],
    bombs: level.bombs ?? [],
    hearts: level.hearts ?? [],
    coins: level.coins ?? [],
    keys: level.keys ?? [],
    doors: level.doors ?? [],
    firetraps: level.firetraps ?? [],
    playerStart: level.playerStart ?? null,
    goal: level.goal ?? null,
    background: (level.background ?? "none") as BackgroundKey
  };
}

export function removeObjectAtPosition<T extends GridPosition>(
  items: T[],
  position: GridPosition
): T[] {
  return items.filter((item) => !(item.x === position.x && item.y === position.y));
}

export function upsertUnique<T extends GridPosition>(items: T[], item: T): T[] {
  const without = removeObjectAtPosition(items, item);
  return [...without, item];
}

export function createMonsterAt(x: number, y: number, width: number): EditorMonster {
  const patrolStart = Math.max(0, x - 3);
  const patrolEnd = Math.min(width - 1, x + 3);
  return { x, y, patrol: [patrolStart, patrolEnd] };
}

export function createDoorAt(x: number, y: number): EditorDoor {
  return { x, y, open: false };
}

export function createFireTrapAt(x: number, y: number): import("../types").EditorFireTrap {
  return {
    x,
    y,
    direction: "up",     // Default direction - fire comes from top
    sprayDistance: 1,    // Default 1 block height
    sprayTime: 2,        // Default 2 seconds
    restTime: 2          // Default 2 seconds
  };
}

export function toolToTile(tool: Tool): number | null {
  switch (tool) {
    case "wall":
      return 1;
    case "stone":
      return 2;
    case "lava":
      return 3;
    case "platform":
      return 10;
    default:
      return null;
  }
}

export function applyToolAtPosition(state: EditorState, x: number, y: number): EditorState {
  if (x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) {
    return state;
  }

  const tool = state.selectedTool;
  const tileValue = toolToTile(tool);
  const newGrid = state.grid.map((row) => [...row]);

  let monsters = state.monsters;
  let weapons = state.weapons;
  let bombs = state.bombs;
  let keys = state.keys;
  let doors = state.doors;
  let firetraps = state.firetraps ?? [];
  let playerStart = state.playerStart;
  let goal = state.goal;

  const position: GridPosition = { x, y };

  const clearPosition = () => {
    monsters = removeObjectAtPosition(monsters, position);
    weapons = removeObjectAtPosition(weapons, position);
    bombs = removeObjectAtPosition(bombs, position);
    keys = removeObjectAtPosition(keys, position);
    doors = removeObjectAtPosition(doors, position);
    firetraps = removeObjectAtPosition(firetraps, position);
    if (playerStart && playerStart.x === x && playerStart.y === y) {
      playerStart = null;
    }
    if (goal && goal.x === x && goal.y === y) {
      goal = null;
    }
  };

  switch (tool) {
    case "empty":
      clearPosition();
      newGrid[y][x] = 0;
      break;
    case "wall":
    case "stone":
    case "lava":
    case "platform":
      clearPosition();
      if (tileValue !== null) {
        newGrid[y][x] = tileValue;
      }
      break;
    case "monster":
      clearPosition();
      monsters = upsertUnique(monsters, createMonsterAt(x, y, state.gridWidth));
      newGrid[y][x] = 0;
      break;
    case "weapon":
      clearPosition();
      weapons = upsertUnique(weapons, { x, y });
      newGrid[y][x] = 0;
      break;
    case "bomb":
      clearPosition();
      bombs = upsertUnique(bombs, { x, y });
      newGrid[y][x] = 0;
      break;
    case "key":
      clearPosition();
      keys = upsertUnique(keys, { x, y });
      newGrid[y][x] = 0;
      break;
    case "door":
      clearPosition();
      doors = upsertUnique(doors, createDoorAt(x, y));
      newGrid[y][x] = 0;
      break;
    case "goal":
      clearPosition();
      goal = { x, y };
      newGrid[y][x] = 0;
      break;
    case "player":
      clearPosition();
      playerStart = { x, y };
      newGrid[y][x] = 0;
      break;
    case "firetrap":
      clearPosition();
      firetraps = upsertUnique(firetraps, createFireTrapAt(x, y));
      newGrid[y][x] = 0;
      break;
    default:
      break;
  }

  return {
    ...state,
    grid: newGrid,
    monsters,
    weapons,
    bombs,
    keys,
    doors,
    firetraps,
    goal,
    playerStart
  };
}

export function fillBorder(state: EditorState): EditorState {
  const newGrid = state.grid.map((row) => [...row]);
  for (let x = 0; x < state.gridWidth; x++) {
    newGrid[0][x] = 1;
    newGrid[state.gridHeight - 1][x] = 1;
  }
  for (let y = 0; y < state.gridHeight; y++) {
    newGrid[y][0] = 1;
    newGrid[y][state.gridWidth - 1] = 1;
  }
  return {
    ...state,
    grid: newGrid
  };
}

export function clearEditorState(state: EditorState): EditorState {
  return {
    ...state,
    grid: createEmptyGrid(state.gridWidth, state.gridHeight),
    monsters: [],
    weapons: [],
    bombs: [],
    hearts: [],
    coins: [],
    keys: [],
    doors: [],
    firetraps: [],
    playerStart: null,
    goal: null
  };
}

export function resizeGrid(state: EditorState, width: number, height: number): EditorState {
  const { width: clampedWidth, height: clampedHeight } = clampGridSize(width, height);
  const newGrid = createEmptyGrid(clampedWidth, clampedHeight);
  for (let y = 0; y < clampedHeight; y++) {
    for (let x = 0; x < clampedWidth; x++) {
      newGrid[y][x] = state.grid[y]?.[x] ?? 0;
    }
  }
  const filterWithinBounds = <T extends GridPosition>(items: T[]): T[] =>
    items.filter((item) => item.x < clampedWidth && item.y < clampedHeight);

  return {
    ...state,
    gridWidth: clampedWidth,
    gridHeight: clampedHeight,
    grid: newGrid,
    monsters: filterWithinBounds(state.monsters),
    weapons: filterWithinBounds(state.weapons),
    bombs: filterWithinBounds(state.bombs),
    keys: filterWithinBounds(state.keys),
    doors: filterWithinBounds(state.doors),
    firetraps: filterWithinBounds(state.firetraps ?? []),
    playerStart: state.playerStart && state.playerStart.x < clampedWidth && state.playerStart.y < clampedHeight
      ? state.playerStart
      : null,
    goal: state.goal && state.goal.x < clampedWidth && state.goal.y < clampedHeight ? state.goal : null
  };
}

