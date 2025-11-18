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
    firetraps: state.firetraps.map((trap) => ({ ...trap, fireBlocks: [...trap.fireBlocks] })),
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

  // Check collision with fire trap blocks (treat as solid obstacles)
  state.firetraps.forEach((trap) => {
    const trapBox = {
      x: trap.x * TILE_SIZE,
      y: trap.y * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE
    };
    if (checkCollision(player, trapBox)) {
      resolveCollision(player, trapBox);
    }
  });
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

    // Check collision with fire trap blocks
    if (!hitWall) {
      state.firetraps.forEach((trap) => {
        const trapBox = {
          x: trap.x * TILE_SIZE,
          y: trap.y * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE
        };
        if (checkCollision(monster, trapBox)) {
          hitWall = true;
        }
      });
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

// Treat all closed doors as solid blocks (collision only)
function handleDoorCollisions(state: GameState, player: PlayerState): void {
  state.doors.forEach((door) => {
    if (!door.open) {
      const doorBox = {
        x: door.x * TILE_SIZE,
        y: door.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE
      };
      if (checkCollision(player, doorBox)) {
        resolveCollision(player, doorBox);
      }
    }
  });
}

// Open door when K is pressed (exported for use in GamePage)
// Checks if player is within 1.5 blocks of the door center
export function tryOpenDoor(state: GameState): boolean {
  const player = state.player;
  let openedDoor = false;

  state.doors.forEach((door) => {
    if (!door.open && state.keys > 0) {
      // Calculate center of door and player
      const doorCenterX = door.x * TILE_SIZE + TILE_SIZE / 2;
      const doorCenterY = door.y * TILE_SIZE + TILE_SIZE / 2;
      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;

      // Calculate distance between player and door
      const distanceX = Math.abs(playerCenterX - doorCenterX);
      const distanceY = Math.abs(playerCenterY - doorCenterY);

      // Check if player is within 1.5 blocks (60 pixels) in both directions
      const maxDistance = TILE_SIZE * 1.5;
      if (distanceX <= maxDistance && distanceY <= maxDistance) {
        door.open = true;
        state.keys -= 1;
        openedDoor = true;
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

function updateFireTraps(state: GameState, player: PlayerState): boolean {
  let tookFireDamage = false;

  state.firetraps.forEach((trap) => {
    trap.timer -= 1;

    // Handle timer reset and state transitions
    if (trap.timer <= 0) {
      if (trap.isActive) {
        // End of spray phase, start rest phase
        trap.isActive = false;
        trap.warning = false;
        trap.fireBlocks = [];
        trap.timer = trap.restTime;
      } else {
        // End of rest phase, start warning then spray phase
        trap.warning = false;
        trap.isActive = true;
        trap.fireBlocks = [];
        trap.timer = trap.sprayTime;
      }
    }

    // Warning phase: 0.5s (30 frames) before activation
    if (!trap.isActive && trap.timer <= 30 && trap.timer > 0) {
      trap.warning = true;
    } else if (trap.isActive) {
      trap.warning = false;
    }

    // Update fire blocks when active (with animation)
    if (trap.isActive) {
      const framesSinceActivation = trap.sprayTime - trap.timer;
      const blocksToShow = Math.min(
        Math.floor(framesSinceActivation / 9) + 1,  // 9 frames (0.15s) per block
        trap.sprayDistance
      );

      // Calculate fire positions based on direction
      const fireBlocks: import("../types").GridPosition[] = [];
      for (let i = 1; i <= blocksToShow; i++) {
        let fireX = trap.x;
        let fireY = trap.y;

        switch (trap.direction) {
          case "up":
            fireY = trap.y - i;
            break;
          case "down":
            fireY = trap.y + i;
            break;
          case "left":
            fireX = trap.x - i;
            break;
          case "right":
            fireX = trap.x + i;
            break;
        }

        // Check if fire block is within grid bounds
        if (
          fireX >= 0 &&
          fireX < state.grid[0].length &&
          fireY >= 0 &&
          fireY < state.grid.length
        ) {
          fireBlocks.push({ x: fireX, y: fireY });
        }
      }

      trap.fireBlocks = fireBlocks;

      // Check collision with player
      if (state.damageTimer <= 0) {
        for (const fireBlock of fireBlocks) {
          const fireBox = {
            x: fireBlock.x * TILE_SIZE,
            y: fireBlock.y * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE
          };

          if (checkCollision(player, fireBox)) {
            state.health -= 1;
            state.damageTimer = 60;  // 1 second invincibility
            player.shaking = true;
            player.shakeTimer = 30;
            tookFireDamage = true;
            break;
          }
        }
      }
    }
  });

  return tookFireDamage;
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

  // Handle fire trap damage and animation
  const fireDamage = updateFireTraps(nextState, player);

  // Combine damage from all sources
  const tookDamage = monsterDamage || lavaDamage || fireDamage;

  // Check if player died from damage
  if (tookDamage && nextState.health <= 0) {
    nextState.deaths += 1;
    return {
      state: nextState,
      events: { levelComplete: false, playerDied: true, doorOpened: false, tookDamage: true, itemCollected: false, bombExploded: false }
    };
  }

  // Handle door collisions (doors act as solid blocks when closed)
  handleDoorCollisions(nextState, player);

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
      doorOpened: false, // Doors only open when K is pressed (handled in GamePage)
      tookDamage,
      itemCollected,
      bombExploded
    }
  };
}

