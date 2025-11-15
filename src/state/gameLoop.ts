import {
  applyGravity,
  checkCollision,
  movePlayerHorizontal,
  resolveCollision,
  updateBullets,
  updatePlacedBombs
} from "./gameState";
import { TileType, TILE_SIZE, type GameState, type PlayerState } from "../types";

export interface GameUpdateEvents {
  levelComplete: boolean;
  playerDied: boolean;
  doorOpened: boolean;
  tookDamage: boolean;
}

export type KeyMap = Record<string, boolean>;

function cloneState(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player },
    monsters: state.monsters.map((monster) => ({ ...monster })),
    collectibles: state.collectibles.map((item) => ({ ...item })),
    doors: state.doors.map((door) => ({ ...door })),
    bullets: state.bullets.map((bullet) => ({ ...bullet })),
    placedBombs: state.placedBombs.map((bomb) => ({ ...bomb })),
    grid: state.grid.map((row) => [...row])
  };
}

function handleTileCollisions(state: GameState, player: PlayerState): void {
  player.onGround = false;
  const gridX = Math.floor(player.x / TILE_SIZE);
  const gridY = Math.floor(player.y / TILE_SIZE);

  // Check regular tiles within grid bounds
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const checkX = gridX + dx;
      const checkY = gridY + dy;
      if (
        checkX >= 0 &&
        checkX < state.grid[0].length &&
        checkY >= 0 &&
        checkY < state.grid.length
      ) {
        const tile = state.grid[checkY][checkX];
        if (
          tile === TileType.Wall ||
          tile === TileType.Stone ||
          tile === TileType.Lava ||
          tile === TileType.Platform
        ) {
          const box = {
            x: checkX * TILE_SIZE,
            y: checkY * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE
          };
          if (checkCollision(player, box)) {
            resolveCollision(player, box);
          }
        }
      }
    }
  }

  // Add invisible boundary walls to prevent falling out of grid
  const gridWidth = state.grid[0].length * TILE_SIZE;
  const gridHeight = state.grid.length * TILE_SIZE;
  const wallThickness = TILE_SIZE;

  // Left boundary wall
  const leftWall = {
    x: -wallThickness,
    y: 0,
    width: wallThickness,
    height: gridHeight
  };
  if (checkCollision(player, leftWall)) {
    resolveCollision(player, leftWall);
  }

  // Right boundary wall
  const rightWall = {
    x: gridWidth,
    y: 0,
    width: wallThickness,
    height: gridHeight
  };
  if (checkCollision(player, rightWall)) {
    resolveCollision(player, rightWall);
  }

  // Top boundary wall
  const topWall = {
    x: 0,
    y: -wallThickness,
    width: gridWidth,
    height: wallThickness
  };
  if (checkCollision(player, topWall)) {
    resolveCollision(player, topWall);
  }

  // Bottom boundary wall
  const bottomWall = {
    x: 0,
    y: gridHeight,
    width: gridWidth,
    height: wallThickness
  };
  if (checkCollision(player, bottomWall)) {
    resolveCollision(player, bottomWall);
  }
}

function updateMonsters(state: GameState, player: PlayerState): boolean {
  let playerKilled = false;
  state.monsters.forEach((monster) => {
    // Store original position
    const originalX = monster.x;

    // Try to move
    monster.x += monster.speed * monster.direction;

    // Check for wall collisions
    const monsterGridX = Math.floor(monster.x / TILE_SIZE);
    const monsterGridY = Math.floor(monster.y / TILE_SIZE);
    let hitWall = false;

    // Check tiles around monster for solid blocks
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = monsterGridX + dx;
        const checkY = monsterGridY + dy;

        if (
          checkX >= 0 &&
          checkX < state.grid[0].length &&
          checkY >= 0 &&
          checkY < state.grid.length
        ) {
          const tile = state.grid[checkY][checkX];
          if (
            tile === TileType.Wall ||
            tile === TileType.Stone ||
            tile === TileType.Platform
          ) {
            const tileBox = {
              x: checkX * TILE_SIZE,
              y: checkY * TILE_SIZE,
              width: TILE_SIZE,
              height: TILE_SIZE
            };
            if (checkCollision(monster, tileBox)) {
              hitWall = true;
              break;
            }
          }
        }
      }
      if (hitWall) break;
    }

    // If hit wall or reached patrol boundary, reverse direction
    const gridX = Math.floor(monster.x / TILE_SIZE);
    if (hitWall || gridX <= monster.patrol[0] || gridX >= monster.patrol[1]) {
      monster.direction = monster.direction === 1 ? -1 : 1;
      monster.x = originalX; // Reset to original position
    }

    // Check collision with player
    if (checkCollision(player, monster)) {
      state.deaths += 1;
      playerKilled = true;
    }
  });
  return playerKilled;
}

function handleLavaDamage(state: GameState, player: PlayerState): boolean {
  if (state.damageTimer > 0) {
    state.damageTimer -= 1;
    return false;
  }

  const playerBottomY = Math.floor((player.y + player.height) / TILE_SIZE);
  const playerCenterX = Math.floor((player.x + player.width / 2) / TILE_SIZE);

  if (
    playerBottomY >= 0 &&
    playerBottomY < state.grid.length &&
    playerCenterX >= 0 &&
    playerCenterX < state.grid[0].length
  ) {
    const tileBelow = state.grid[playerBottomY][playerCenterX];
    if (tileBelow === TileType.Lava && player.onGround) {
      state.health -= 1;
      state.damageTimer = 60;
      return true;
    }
  }
  return false;
}

function openDoorIfPossible(state: GameState, player: PlayerState): boolean {
  let openedDoor = false;
  state.doors.forEach((door) => {
    if (!door.open) {
      const doorBox = {
        x: door.x * TILE_SIZE,
        y: door.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE
      };
      if (checkCollision(player, doorBox)) {
        if (state.keys > 0) {
          door.open = true;
          state.keys -= 1;
          openedDoor = true;
        } else {
          resolveCollision(player, doorBox);
        }
      }
    }
  });
  return openedDoor;
}

function collectItems(state: GameState, player: PlayerState): void {
  state.collectibles.forEach((item) => {
    if (!item.collected && checkCollision(player, item)) {
      item.collected = true;
      if (item.type === "key") {
        state.keys += 1;
      } else if (item.type === "weapon") {
        player.hasWeapon = true;
        state.ammo += 10;
      } else if (item.type === "bomb") {
        state.bombCount += 3;
      } else if (item.type === "heart") {
        state.health = Math.min(state.maxHealth, state.health + 1);
      } else if (item.type === "coin") {
        // Reserved for score tracking
      }
    }
  });
}

function handleGoal(state: GameState, player: PlayerState): boolean {
  if (!state.goalPos) return false;
  const goalBox = {
    x: state.goalPos.x * TILE_SIZE,
    y: state.goalPos.y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE
  };
  return checkCollision(player, goalBox);
}

export function updateGameFrame(state: GameState, keys: KeyMap): {
  state: GameState;
  events: GameUpdateEvents;
} {
  if (!state.grid.length) {
    return { state, events: { levelComplete: false, playerDied: false, doorOpened: false, tookDamage: false } };
  }

  const nextState = cloneState(state);
  const player = nextState.player;

  const horizontalDirection = keys.arrowleft || keys.a ? -1 : keys.arrowright || keys.d ? 1 : 0;
  movePlayerHorizontal(player, horizontalDirection as -1 | 0 | 1);

  applyGravity(player);

  player.x += player.velocityX;
  player.y += player.velocityY;

  handleTileCollisions(nextState, player);

  const playerKilled = updateMonsters(nextState, player);
  if (playerKilled) {
    return {
      state: nextState,
      events: { levelComplete: false, playerDied: true, doorOpened: false, tookDamage: false }
    };
  }

  const tookDamage = handleLavaDamage(nextState, player);
  if (tookDamage && nextState.health <= 0) {
    nextState.deaths += 1;
    return {
      state: nextState,
      events: { levelComplete: false, playerDied: true, doorOpened: false, tookDamage: true }
    };
  }

  const doorOpened = openDoorIfPossible(nextState, player);

  collectItems(nextState, player);

  const { bullets, monsters } = updateBullets(nextState.bullets, nextState.grid, nextState.monsters);
  nextState.bullets = bullets;
  nextState.monsters = monsters;

  const { bombs, grid } = updatePlacedBombs(nextState.placedBombs, nextState.grid);
  nextState.placedBombs = bombs;
  nextState.grid = grid;

  const levelComplete = handleGoal(nextState, player);

  nextState.time = Math.floor((Date.now() - nextState.startTime) / 1000);

  return {
    state: nextState,
    events: {
      levelComplete,
      playerDied: false,
      doorOpened,
      tookDamage
    }
  };
}

