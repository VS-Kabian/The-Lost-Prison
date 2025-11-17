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
  itemCollected: boolean;
  bombExploded: boolean;
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
  let tookDamage = false;

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

    // Check collision with player - deal 1 damage with cooldown
    if (checkCollision(player, monster)) {
      if (state.damageTimer === 0) {
        state.health -= 1;
        state.damageTimer = 60; // 1 second cooldown (60 frames)
        tookDamage = true;
      }
    }
  });

  return tookDamage;
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
      // Trigger shake effect
      player.shaking = true;
      player.shakeTimer = 30; // Shake for 30 frames (~0.5 seconds)
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

function collectItems(state: GameState, player: PlayerState): boolean {
  let collected = false;
  state.collectibles.forEach((item) => {
    if (!item.collected && checkCollision(player, item)) {
      item.collected = true;
      collected = true;
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
  return collected;
}

function handleGoal(state: GameState, player: PlayerState): boolean {
  if (!state.goalPos) {
    console.log("No goal position set!");
    return false;
  }

  const goalBox = {
    x: state.goalPos.x * TILE_SIZE,
    y: state.goalPos.y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE
  };

  const collision = checkCollision(player, goalBox);

  if (collision) {
    console.log("🎯 GOAL REACHED!", {
      playerPos: { x: player.x, y: player.y },
      goalPos: state.goalPos,
      goalBox,
      playerBox: { x: player.x, y: player.y, width: player.width, height: player.height }
    });
  }

  return collision;
}

export function updateGameFrame(state: GameState, keys: KeyMap): {
  state: GameState;
  events: GameUpdateEvents;
} {
  if (!state.grid.length) {
    return { state, events: { levelComplete: false, playerDied: false, doorOpened: false, tookDamage: false, itemCollected: false, bombExploded: false } };
  }

  const nextState = cloneState(state);
  const player = nextState.player;

  const horizontalDirection =
    keys.ArrowLeft || keys.a || keys.A ? -1 :
    keys.ArrowRight || keys.d || keys.D ? 1 : 0;
  movePlayerHorizontal(player, horizontalDirection as -1 | 0 | 1);

  applyGravity(player);

  player.x += player.velocityX;
  player.y += player.velocityY;

  handleTileCollisions(nextState, player);

  // Handle monster damage
  const monsterDamage = updateMonsters(nextState, player);

  // Handle lava damage
  const lavaDamage = handleLavaDamage(nextState, player);

  // Combine damage from both sources
  const tookDamage = monsterDamage || lavaDamage;

  // Check if player died from damage
  if (tookDamage && nextState.health <= 0) {
    nextState.deaths += 1;
    return {
      state: nextState,
      events: { levelComplete: false, playerDied: true, doorOpened: false, tookDamage: true, itemCollected: false, bombExploded: false }
    };
  }

  const doorOpened = openDoorIfPossible(nextState, player);

  const itemCollected = collectItems(nextState, player);

  const { bullets, monsters } = updateBullets(nextState.bullets, nextState.grid, nextState.monsters);
  nextState.bullets = bullets;
  nextState.monsters = monsters;

  const { bombs, grid, exploded: bombExploded } = updatePlacedBombs(nextState.placedBombs, nextState.grid);
  nextState.placedBombs = bombs;
  nextState.grid = grid;

  const levelComplete = handleGoal(nextState, player);

  nextState.time = Math.floor((Date.now() - nextState.startTime) / 1000);
  nextState.animationFrame = (nextState.animationFrame + 1) % 1000;

  // Update shake timer
  if (player.shakeTimer !== undefined && player.shakeTimer > 0) {
    player.shakeTimer -= 1;
    if (player.shakeTimer <= 0) {
      player.shaking = false;
      player.shakeTimer = 0;
    }
  }

  return {
    state: nextState,
    events: {
      levelComplete,
      playerDied: false,
      doorOpened,
      tookDamage,
      itemCollected,
      bombExploded
    }
  };
}

