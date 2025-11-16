import type { TextureMap } from "../hooks/useTextures";
import type { EditorState } from "../types";
import { TileType, TILE_SIZE } from "../types";
import { drawStar } from "./shared";

export function drawEditorCanvas(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  textures: TextureMap
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw background image or color
  if (state.background === "bg1" && textures.bg1?.complete) {
    ctx.drawImage(textures.bg1, 0, 0, ctx.canvas.width, ctx.canvas.height);
  } else if (state.background === "bg2" && textures.bg2?.complete) {
    ctx.drawImage(textures.bg2, 0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    // Default sky blue background
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Draw grid lines
  ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.gridWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, state.gridHeight * TILE_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= state.gridHeight; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(state.gridWidth * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      const tileX = x * TILE_SIZE;
      const tileY = y * TILE_SIZE;

      switch (tile) {
        case TileType.Wall:
          if (textures.wall?.complete) {
            ctx.drawImage(textures.wall, tileX, tileY, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#2d3748";
            ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
          }
          break;
        case TileType.Stone:
          if (textures.stone?.complete) {
            ctx.drawImage(textures.stone, tileX, tileY, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#4299e1";
            ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
          }
          break;
        case TileType.Lava:
          if (textures.lava?.complete) {
            ctx.drawImage(textures.lava, tileX, tileY, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#f56565";
            ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
          }
          break;
        case TileType.Platform:
          if (textures.platform?.complete) {
            ctx.drawImage(textures.platform, tileX, tileY, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
          }
          break;
        default:
          break;
      }
    }
  }

  state.monsters.forEach((monster) => {
    const monsterX = monster.x * TILE_SIZE + 5;
    const monsterY = monster.y * TILE_SIZE + 5;

    if (textures.monsterOpen?.complete) {
      ctx.drawImage(textures.monsterOpen, monsterX, monsterY, 30, 30);
    } else {
      // Fallback to emoji
      ctx.fillStyle = "#e53e3e";
      ctx.fillRect(monsterX, monsterY, 30, 30);
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("👾", monster.x * TILE_SIZE + 20, monster.y * TILE_SIZE + 28);
    }
  });

  state.weapons.forEach((weapon) => {
    const weaponX = weapon.x * TILE_SIZE;
    const weaponY = weapon.y * TILE_SIZE;

    if (textures.weapon?.complete) {
      ctx.drawImage(textures.weapon, weaponX + 5, weaponY + 5, 30, 30);
    } else {
      ctx.fillStyle = "#4299e1";
      ctx.fillRect(weaponX + 8, weaponY + 8, 24, 24);
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔫", weaponX + 20, weaponY + 26);
    }
  });

  state.bombs.forEach((bomb) => {
    const bombX = bomb.x * TILE_SIZE;
    const bombY = bomb.y * TILE_SIZE;
    if (textures.bomb?.complete) {
      ctx.drawImage(textures.bomb, bombX, bombY, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#ed8936";
      ctx.beginPath();
      ctx.arc(bombX + 20, bombY + 20, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("💣", bombX + 20, bombY + 26);
    }
  });

  state.keys.forEach((key) => {
    const keyX = key.x * TILE_SIZE;
    const keyY = key.y * TILE_SIZE;
    if (textures.key?.complete) {
      ctx.drawImage(textures.key, keyX, keyY, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#f6e05e";
      ctx.beginPath();
      ctx.arc(keyX + 20, keyY + 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🗝️", keyX + 20, keyY + 26);
    }
  });

  state.doors.forEach((door) => {
    const doorX = door.x * TILE_SIZE;
    const doorY = door.y * TILE_SIZE;
    if (textures.lock?.complete) {
      ctx.drawImage(textures.lock, doorX, doorY, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#9f7aea";
      ctx.fillRect(doorX, doorY, TILE_SIZE, TILE_SIZE);
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔒", doorX + 20, doorY + 26);
    }
  });

  if (state.goal) {
    const goalX = state.goal.x * TILE_SIZE;
    const goalY = state.goal.y * TILE_SIZE;

    if (textures.goal?.complete) {
      // Draw the goal flag image (smaller and centered)
      const goalSize = 32; // Reduced from 40
      const offset = (TILE_SIZE - goalSize) / 2; // Center it
      ctx.drawImage(textures.goal, goalX + offset, goalY + offset, goalSize, goalSize);
    } else {
      // Fallback: Draw the star
      drawStar(ctx, goalX + 20, goalY + 20, 5, 15, 8, "#fbbf24");
    }
  }

  if (state.playerStart) {
    const playerX = state.playerStart.x * TILE_SIZE + 5;
    const playerY = state.playerStart.y * TILE_SIZE + 5;

    if (textures.playerOpen?.complete) {
      ctx.drawImage(textures.playerOpen, playerX, playerY, 30, 30);
    } else {
      ctx.fillStyle = "#48bb78";
      ctx.beginPath();
      ctx.arc(playerX + 15, playerY + 15, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

