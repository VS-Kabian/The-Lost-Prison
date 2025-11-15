import type { TextureMap } from "../hooks/useTextures";
import type { GameState } from "../types";
import { TILE_SIZE, TileType } from "../types";
import { drawStar } from "./shared";

export function drawGameCanvas(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  textures: TextureMap
): void {
  if (!state.grid.length) {
    ctx.fillStyle = "#2d3748";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("No level loaded. Please create a level first.", ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

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

  // Draw subtle grid lines (optional - can be removed for cleaner gameplay)
  ctx.strokeStyle = "rgba(226, 232, 240, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.grid[0].length; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, state.grid.length * TILE_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= state.grid.length; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(state.grid[0].length * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
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

  state.collectibles.forEach((item) => {
    if (item.collected) return;
    if (item.type === "key") {
      if (textures.key?.complete) {
        ctx.drawImage(textures.key, item.x, item.y, 30, 30);
      } else {
        ctx.fillStyle = "#f6e05e";
        ctx.beginPath();
        ctx.arc(item.x + 15, item.y + 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("🗝️", item.x + 15, item.y + 21);
      }
    } else if (item.type === "weapon") {
      ctx.fillStyle = "#4299e1";
      ctx.fillRect(item.x + 3, item.y + 3, 24, 24);
      ctx.font = "20px Arial";
      ctx.fillText("🔫", item.x + 15, item.y + 21);
    } else if (item.type === "bomb") {
      if (textures.bomb?.complete) {
        ctx.drawImage(textures.bomb, item.x, item.y, 30, 30);
      } else {
        ctx.fillStyle = "#ed8936";
        ctx.beginPath();
        ctx.arc(item.x + 15, item.y + 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "20px Arial";
        ctx.fillText("💣", item.x + 15, item.y + 21);
      }
    } else if (item.type === "heart") {
      ctx.font = "20px Arial";
      ctx.fillText("❤️", item.x + 15, item.y + 21);
    } else if (item.type === "coin") {
      ctx.font = "20px Arial";
      ctx.fillText("🪙", item.x + 15, item.y + 21);
    }
  });

  if (state.goalPos) {
    drawStar(ctx, state.goalPos.x * TILE_SIZE + 20, state.goalPos.y * TILE_SIZE + 20, 5, 15, 8, "#fbbf24");
  }

  state.doors.forEach((door) => {
    if (door.open) return;
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

  state.monsters.forEach((monster) => {
    ctx.fillStyle = "#e53e3e";
    ctx.fillRect(monster.x, monster.y, 30, 30);
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("👾", monster.x + 15, monster.y + 23);
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(monster.x, monster.y - 5, (monster.health / 3) * 30, 3);
  });

  state.bullets.forEach((bullet) => {
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  state.placedBombs.forEach((bomb) => {
    const bombX = bomb.x * TILE_SIZE;
    const bombY = bomb.y * TILE_SIZE;
    const flash = Math.floor(bomb.timer / 10) % 2 === 0;
    if (textures.bomb?.complete) {
      ctx.globalAlpha = flash ? 1 : 0.6;
      ctx.drawImage(textures.bomb, bombX, bombY, TILE_SIZE, TILE_SIZE);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = flash ? "#ed8936" : "#f56565";
      ctx.beginPath();
      ctx.arc(bombX + 20, bombY + 20, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("💣", bombX + 20, bombY + 26);
    }
  });

  const player = state.player;
  const flashDamage = state.damageTimer > 0 && Math.floor(state.damageTimer / 10) % 2 === 0;
  let playerColor = "#48bb78";
  if (flashDamage) {
    playerColor = "#f56565";
  }

  const isVisible = !player.invincible || Math.floor((player.invincibleTimer ?? 0) / 10) % 2 === 0;
  if (isVisible) {
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y + 15, 15, 0, Math.PI * 2);
    ctx.fill();
    if (player.hasWeapon) {
      ctx.fillStyle = "#2d3748";
      ctx.fillRect(player.x + (player.facingRight ? 20 : -5), player.y + 12, 10, 4);
    }
  }
}

