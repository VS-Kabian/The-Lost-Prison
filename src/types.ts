export const TILE_SIZE = 40;
export const GRAVITY = 0.5;
export const JUMP_POWER = -9.1;
export const MOVE_SPEED = 4;
export const BULLET_SPEED = 8;
export const BOMB_BLAST_RADIUS = 2;
export const MAX_LEVELS = 10;
export const MIN_GRID_WIDTH = 10;
export const MAX_GRID_WIDTH = 30;
export const MIN_GRID_HEIGHT = 10;
export const MAX_GRID_HEIGHT = 20;

export enum TileType {
  Empty = 0,
  Wall = 1,
  Stone = 2,
  Lava = 3,
  Platform = 10
}

export type BackgroundKey = "none" | "bg1" | "bg2";

export type Tool =
  | "empty"
  | "wall"
  | "stone"
  | "lava"
  | "platform"
  | "player"
  | "goal"
  | "key"
  | "door"
  | "monster"
  | "weapon"
  | "bomb";

export interface GridPosition {
  x: number;
  y: number;
}

export interface EditorMonster extends GridPosition {
  patrol: [number, number];
}

export interface EditorDoor extends GridPosition {
  open?: boolean;
}

export interface LevelData {
  name: string;
  gridWidth: number;
  gridHeight: number;
  grid: number[][];
  monsters: EditorMonster[];
  weapons: GridPosition[];
  bombs: GridPosition[];
  hearts?: GridPosition[];
  coins?: GridPosition[];
  keys: GridPosition[];
  doors: EditorDoor[];
  playerStart: GridPosition | null;
  goal: GridPosition | null;
  background: BackgroundKey;
  theme?: string;
}

export interface EditorState extends LevelData {
  currentLevel: number;
  selectedTool: Tool;
  isDrawing: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  onGround: boolean;
  hasWeapon: boolean;
  facingRight: boolean;
  invincible?: boolean;
  invincibleTimer?: number;
  shaking?: boolean;
  shakeTimer?: number;
}

export interface MonsterState {
  x: number;
  y: number;
  patrol: [number, number];
  direction: 1 | -1;
  speed: number;
  width: number;
  height: number;
  health: number;
}

export interface CollectibleState {
  x: number;
  y: number;
  type: "key" | "weapon" | "bomb" | "heart" | "coin";
  collected: boolean;
  width: number;
  height: number;
}

export interface DoorState {
  x: number;
  y: number;
  open: boolean;
}

export interface BulletState {
  x: number;
  y: number;
  velocityX: number;
  width: number;
  height: number;
}

export interface PlacedBomb {
  x: number;
  y: number;
  timer: number;
}

export interface GameState {
  level: number;
  keys: number;
  ammo: number;
  bombCount: number;
  time: number;
  deaths: number;
  health: number;
  maxHealth: number;
  damageTimer: number;
  background: BackgroundKey;
  theme?: string;
  grid: number[][];
  monsters: MonsterState[];
  collectibles: CollectibleState[];
  doors: DoorState[];
  bullets: BulletState[];
  placedBombs: PlacedBomb[];
  goalPos: GridPosition | null;
  player: PlayerState;
  startTime: number;
  animationFrame: number;
}

