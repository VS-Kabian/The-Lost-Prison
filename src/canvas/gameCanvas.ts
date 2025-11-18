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

  // Calculate camera offset to follow player
  const viewportWidth = ctx.canvas.width;
  const viewportHeight = ctx.canvas.height;
  const mapWidth = state.grid[0].length * TILE_SIZE;
  const mapHeight = state.grid.length * TILE_SIZE;

  // Center camera on player horizontally, position vertically with 3 blocks above player
  let cameraX = state.player.x + state.player.width / 2 - viewportWidth / 2;
  let cameraY = state.player.y - 2 * TILE_SIZE;

  // Clamp camera to map boundaries
  cameraX = Math.max(0, Math.min(cameraX, mapWidth - viewportWidth));
  cameraY = Math.max(0, Math.min(cameraY, mapHeight - viewportHeight));

  // Apply camera transformation
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // Draw background image or color (fill the entire map, not just viewport)
  if (state.background === "bg1" && textures.bg1?.complete) {
    ctx.drawImage(textures.bg1, 0, 0, mapWidth, mapHeight);
  } else if (state.background === "bg2" && textures.bg2?.complete) {
    ctx.drawImage(textures.bg2, 0, 0, mapWidth, mapHeight);
  } else {
    // Default sky blue background
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, mapWidth, mapHeight);
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
      if (textures.weapon?.complete) {
        ctx.drawImage(textures.weapon, item.x, item.y, 30, 30);
      } else {
        ctx.fillStyle = "#4299e1";
        ctx.fillRect(item.x + 3, item.y + 3, 24, 24);
        ctx.font = "20px Arial";
        ctx.fillText("🔫", item.x + 15, item.y + 21);
      }
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
    const goalX = state.goalPos.x * TILE_SIZE;
    const goalY = state.goalPos.y * TILE_SIZE;

    if (textures.goal?.complete) {
      // Draw the goal flag image (smaller and centered)
      const goalSize = 32; // Reduced from 40
      const offset = (TILE_SIZE - goalSize) / 2; // Center it
      ctx.drawImage(textures.goal, goalX + offset, goalY + offset, goalSize, goalSize);
    } else {
      // Fallback: Draw the star and text
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(goalX, goalY, TILE_SIZE, TILE_SIZE);
      drawStar(ctx, goalX + 20, goalY + 20, 5, 20, 10, "#fbbf24");
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", goalX + 20, goalY - 5);
    }
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
    // Blinking animation: eyes closed for 3-5 frames every 40 frames
    const blinkCycle = state.animationFrame % 40;
    const isBlinking = blinkCycle >= 36 && blinkCycle <= 39;
    const monsterImage = isBlinking ? textures.monsterClose : textures.monsterOpen;

    if (monsterImage?.complete) {
      ctx.drawImage(monsterImage, monster.x, monster.y, 30, 30);
    } else {
      // Fallback to emoji
      ctx.fillStyle = "#e53e3e";
      ctx.fillRect(monster.x, monster.y, 30, 30);
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("👾", monster.x + 15, monster.y + 23);
    }

    // Health bar
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

  // Render fire traps
  state.firetraps.forEach((trap) => {
    const trapX = trap.x * TILE_SIZE;
    const trapY = trap.y * TILE_SIZE;

    // Draw the trap block
    if (textures.fireTrapBlock?.complete) {
      ctx.drawImage(textures.fireTrapBlock, trapX, trapY, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#ff4400";
      ctx.fillRect(trapX, trapY, TILE_SIZE, TILE_SIZE);
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔥", trapX + 20, trapY + 26);
    }

    // Draw warning glow
    if (trap.warning) {
      const glowIntensity = Math.abs(Math.sin(state.animationFrame * 0.2)) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = glowIntensity;
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(trapX, trapY, TILE_SIZE, TILE_SIZE);
      ctx.restore();
    }

    // Draw fire blocks (animated with PNG frames) - BIGGER SIZE
    if (trap.isActive && trap.fireBlocks.length > 0) {
      trap.fireBlocks.forEach((fireBlock, index) => {
        const fireX = fireBlock.x * TILE_SIZE;
        const fireY = fireBlock.y * TILE_SIZE;

        // Cycle through 4 fire animation frames (change every 5 frames)
        const frameIndex = Math.floor((state.animationFrame + index * 5) / 5) % 4;
        const fireFrames = [textures.fire1, textures.fire2, textures.fire3, textures.fire4];
        const currentFrame = fireFrames[frameIndex];

        // Make fire 2.5x bigger for better visibility
        const fireSize = TILE_SIZE * 2.5;
        const fireOffsetX = fireX - TILE_SIZE * 0.75;  // Center the bigger fire
        const fireOffsetY = fireY - TILE_SIZE * 0.75;

        if (currentFrame?.complete) {
          ctx.drawImage(currentFrame, fireOffsetX, fireOffsetY, fireSize, fireSize);
        } else {
          // Fallback: gradient fire effect
          const gradient = ctx.createRadialGradient(
            fireX + TILE_SIZE / 2,
            fireY + TILE_SIZE / 2,
            0,
            fireX + TILE_SIZE / 2,
            fireY + TILE_SIZE / 2,
            fireSize / 2
          );
          gradient.addColorStop(0, "#ffff00");
          gradient.addColorStop(0.5, "#ff6600");
          gradient.addColorStop(1, "#ff0000");
          ctx.fillStyle = gradient;
          ctx.fillRect(fireOffsetX, fireOffsetY, fireSize, fireSize);
        }
      });
    }
  });

  const player = state.player;
  const flashDamage = state.damageTimer > 0 && Math.floor(state.damageTimer / 10) % 2 === 0;

  // Check if player is at goal for visual feedback
  let atGoal = false;
  if (state.goalPos) {
    const goalBox = {
      x: state.goalPos.x * TILE_SIZE,
      y: state.goalPos.y * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE
    };
    atGoal = (
      player.x < goalBox.x + goalBox.width &&
      player.x + player.width > goalBox.x &&
      player.y < goalBox.y + goalBox.height &&
      player.y + player.height > goalBox.y
    );
  }

  // Draw "LEVEL COMPLETE!" message if at goal
  if (atGoal) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, ctx.canvas.height / 2 - 40, ctx.canvas.width, 80);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⭐ LEVEL COMPLETE! ⭐", ctx.canvas.width / 2, ctx.canvas.height / 2);

    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Arial";
    ctx.fillText("Loading next level...", ctx.canvas.width / 2, ctx.canvas.height / 2 + 30);
  }

  const isVisible = !player.invincible || Math.floor((player.invincibleTimer ?? 0) / 10) % 2 === 0;
  if (isVisible) {
    // Calculate shake offset if player is shaking (on lava)
    const shakeOffsetX = player.shaking ? (Math.random() - 0.5) * 4 : 0;
    const shakeOffsetY = player.shaking ? (Math.random() - 0.5) * 4 : 0;

    // Blinking animation: eyes closed for 3-5 frames every 40 frames
    const blinkCycle = state.animationFrame % 40;
    const isBlinking = blinkCycle >= 36 && blinkCycle <= 39;
    const playerImage = isBlinking ? textures.playerClose : textures.playerOpen;

    if (playerImage?.complete) {
      // Save context for flipping
      ctx.save();

      // Apply damage flash tint
      if (flashDamage) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#f56565";
        ctx.fillRect(player.x + shakeOffsetX, player.y + shakeOffsetY, player.width, player.height);
        ctx.globalAlpha = 1;
      }

      // Flip image horizontally if facing left
      if (!player.facingRight) {
        ctx.translate(player.x + player.width / 2 + shakeOffsetX, player.y + player.height / 2 + shakeOffsetY);
        ctx.scale(-1, 1);
        ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height);
      } else {
        ctx.drawImage(playerImage, player.x + shakeOffsetX, player.y + shakeOffsetY, player.width, player.height);
      }

      ctx.restore();

      // Draw weapon indicator
      if (player.hasWeapon) {
        ctx.fillStyle = "#2d3748";
        ctx.fillRect(player.x + (player.facingRight ? 20 : -5) + shakeOffsetX, player.y + 12 + shakeOffsetY, 10, 4);
      }
    } else {
      // Fallback to green circle if textures not loaded
      let playerColor = "#48bb78";
      if (flashDamage) {
        playerColor = "#f56565";
      }
      ctx.fillStyle = playerColor;
      ctx.beginPath();
      ctx.arc(player.x + 15 + shakeOffsetX, player.y + 15 + shakeOffsetY, 15, 0, Math.PI * 2);
      ctx.fill();
      if (player.hasWeapon) {
        ctx.fillStyle = "#2d3748";
        ctx.fillRect(player.x + (player.facingRight ? 20 : -5) + shakeOffsetX, player.y + 12 + shakeOffsetY, 10, 4);
      }
    }
  }

  // Restore context after camera transformation
  ctx.restore();
}

