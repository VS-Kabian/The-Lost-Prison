import {
  BOMB_BLAST_RADIUS,
  BULLET_SPEED,
  GRAVITY,
  JUMP_POWER,
  MOVE_SPEED,
  TileType,
  TILE_SIZE
} from "../types";
import type {
  BulletState,
  CollectibleState,
  DoorState,
  GameState,
  GridPosition,
  LevelData,
  MonsterState,
  PlacedBomb,
  PlayerState
} from "../types";

export function createInitialGameState(): GameState {
  return {
    level: 1,
    keys: 0,
    ammo: 0,
    bombCount: 0,
    time: 0,
    deaths: 0,
    health: 5,
    maxHealth: 5,
    damageTimer: 0,
    background: "none",
    grid: [],
    monsters: [],
    collectibles: [],
    doors: [],
    bullets: [],
    placedBombs: [],
    goalPos: null,
    theme: "sky",
    player: {
      x: 40,
      y: 40,
      width: 30,
      height: 30,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
      hasWeapon: false,
      facingRight: true
    },
    startTime: Date.now()
  };
}

export function createGridClone(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export function gridToPixel(position: GridPosition): GridPosition {
  return {
    x: position.x * TILE_SIZE + 5,
    y: position.y * TILE_SIZE + 5
  };
}

export function buildGameStateFromLevel(levelData: LevelData, currentLevel: number): GameState {
  const state = createInitialGameState();
  state.level = currentLevel;
  state.grid = createGridClone(levelData.grid);
  state.theme = levelData.theme ?? "sky";
  state.background = levelData.background ?? "none";
  state.goalPos = levelData.goal ?? null;

  if (levelData.playerStart) {
    const pixel = gridToPixel(levelData.playerStart);
    state.player.x = pixel.x;
    state.player.y = pixel.y;
  }

  state.monsters = (levelData.monsters ?? []).map(
    (monster): MonsterState => ({
      x: monster.x * TILE_SIZE + 5,
      y: monster.y * TILE_SIZE + 5,
      patrol: monster.patrol ?? [monster.x - 3, monster.x + 3],
      direction: 1,
      speed: 1.5,
      width: 30,
      height: 30,
      health: 3
    })
  );

  const collectibles: CollectibleState[] = [];
  (levelData.keys ?? []).forEach((key) => {
    const pixel = gridToPixel(key);
    collectibles.push({
      ...pixel,
      width: 30,
      height: 30,
      type: "key",
      collected: false
    });
  });
  (levelData.weapons ?? []).forEach((weapon) => {
    const pixel = gridToPixel(weapon);
    collectibles.push({
      ...pixel,
      width: 30,
      height: 30,
      type: "weapon",
      collected: false
    });
  });
  (levelData.bombs ?? []).forEach((bomb) => {
    const pixel = gridToPixel(bomb);
    collectibles.push({
      ...pixel,
      width: 30,
      height: 30,
      type: "bomb",
      collected: false
    });
  });
  (levelData.hearts ?? []).forEach((heart) => {
    const pixel = gridToPixel(heart);
    collectibles.push({
      ...pixel,
      width: 30,
      height: 30,
      type: "heart",
      collected: false
    });
  });
  (levelData.coins ?? []).forEach((coin) => {
    const pixel = gridToPixel(coin);
    collectibles.push({
      ...pixel,
      width: 30,
      height: 30,
      type: "coin",
      collected: false
    });
  });
  state.collectibles = collectibles;

  state.doors = (levelData.doors ?? []).map(
    (door): DoorState => ({
      x: door.x,
      y: door.y,
      open: Boolean(door.open)
    })
  );

  state.startTime = Date.now();
  return state;
}

export function checkCollision(a: { x: number; y: number; width: number; height: number }, b: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function resolveCollision(player: PlayerState, box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  const overlapLeft = player.x + player.width - box.x;
  const overlapRight = box.x + box.width - player.x;
  const overlapTop = player.y + player.height - box.y;
  const overlapBottom = box.y + box.height - player.y;

  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapTop && player.velocityY > 0) {
    player.y = box.y - player.height;
    player.velocityY = 0;
    player.onGround = true;
  } else if (minOverlap === overlapBottom && player.velocityY < 0) {
    player.y = box.y + box.height;
    player.velocityY = 0;
  } else if (minOverlap === overlapLeft) {
    player.x = box.x - player.width;
    player.velocityX = 0;
  } else if (minOverlap === overlapRight) {
    player.x = box.x + box.width;
    player.velocityX = 0;
  }
}

export function updateBullets(bullets: BulletState[], grid: number[][], monsters: MonsterState[]): {
  bullets: BulletState[];
  monsters: MonsterState[];
} {
  const nextBullets: BulletState[] = [];
  const nextMonsters = monsters.map((monster) => ({ ...monster }));

  bullets.forEach((bullet) => {
    const nextBullet = { ...bullet, x: bullet.x + bullet.velocityX };

    let hitMonster = false;
    nextMonsters.forEach((monster) => {
      if (monster.health > 0 && checkCollision(nextBullet, monster)) {
        monster.health -= 1;
        hitMonster = true;
      }
    });

    if (hitMonster) {
      return;
    }

    const gridX = Math.floor(nextBullet.x / TILE_SIZE);
    const gridY = Math.floor(nextBullet.y / TILE_SIZE);
    const outOfBounds =
      gridY < 0 ||
      gridY >= grid.length ||
      gridX < 0 ||
      gridX >= grid[0].length ||
      grid[gridY][gridX] === TileType.Wall;

    if (!outOfBounds) {
      nextBullets.push(nextBullet);
    }
  });

  return {
    bullets: nextBullets,
    monsters: nextMonsters.filter((monster) => monster.health > 0)
  };
}

export function updatePlacedBombs(placedBombs: PlacedBomb[], grid: number[][]): {
  bombs: PlacedBomb[];
  grid: number[][];
} {
  const nextGrid = grid.map((row) => [...row]);
  const activeBombs: PlacedBomb[] = [];

  placedBombs.forEach((bomb) => {
    const nextTimer = bomb.timer - 1;
    if (nextTimer <= 0) {
      for (let dy = -BOMB_BLAST_RADIUS; dy <= BOMB_BLAST_RADIUS; dy++) {
        for (let dx = -BOMB_BLAST_RADIUS; dx <= BOMB_BLAST_RADIUS; dx++) {
          const x = bomb.x + dx;
          const y = bomb.y + dy;
          if (
            y >= 0 &&
            y < nextGrid.length &&
            x >= 0 &&
            x < nextGrid[0].length &&
            nextGrid[y][x] === TileType.Stone
          ) {
            nextGrid[y][x] = TileType.Empty;
          }
        }
      }
    } else {
      activeBombs.push({ ...bomb, timer: nextTimer });
    }
  });

  return {
    bombs: activeBombs,
    grid: nextGrid
  };
}

export function createPlayerBullet(player: PlayerState): BulletState {
  return {
    x: player.x + (player.facingRight ? 30 : 0),
    y: player.y + 15,
    velocityX: player.facingRight ? BULLET_SPEED : -BULLET_SPEED,
    width: 8,
    height: 4
  };
}

export function createPlacedBomb(player: PlayerState): PlacedBomb {
  const gridX = Math.floor((player.x + 15) / TILE_SIZE);
  const gridY = Math.floor((player.y + 15) / TILE_SIZE);
  return {
    x: gridX,
    y: gridY,
    timer: 90
  };
}

export function applyGravity(player: PlayerState): void {
  player.velocityY += GRAVITY;
  if (player.velocityY > 15) {
    player.velocityY = 15;
  }
}

export function jump(player: PlayerState): void {
  player.velocityY = JUMP_POWER;
}

export function movePlayerHorizontal(player: PlayerState, direction: -1 | 0 | 1): void {
  if (direction === 0) {
    player.velocityX *= 0.85;
    return;
  }
  player.velocityX = MOVE_SPEED * direction;
  player.facingRight = direction > 0;
}

