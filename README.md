# The Lost Prison

Browser-based 2D platformer game with a built-in level editor for creating custom prison escape challenges.

## Overview
The Lost Prison is a pixel-art platformer where players navigate through dangerous prison levels filled with monsters, locked doors, and deadly traps. Features a powerful level editor for designing custom levels with up to 10 unique stages.

## Core Features
**Dual Mode Interface** - Switch between Level Editor and Game Mode instantly
**Level Editor** - Visual grid-based editor with drag-and-draw tools
**10 Custom Levels** - Save and load up to 10 different levels in browser storage
**Physics Engine** - Smooth jumping, gravity, and collision detection
**Combat System** - Collect weapons, shoot monsters, place bombs to destroy walls
**Puzzle Elements** - Keys unlock doors, bombs destroy stone blocks
**Custom Backgrounds** - Choose from Forest Platformer or Sky Plains themes
**Export/Import** - Download levels as JSON files to share with others

### Game Elements
- **Terrain Blocks** - Walls (indestructible), Stone (destructible), Lava (damage), Platforms
- **Objects** - Player spawn point, Goal star, Keys, Locked doors
- **Combat** - Monsters with patrol routes, Weapons with ammo, Bombs with blast radius
- **Player Stats** - Health, Ammo, Bomb count, Keys, Deaths, Time tracking


**Objective:** Navigate from the green player start to the gold star goal while avoiding monsters and lava.

## Level Editor
**Tools:**
- Terrain: Empty, Wall, Stone, Lava, Platform
- Objects: Player Start, Goal, Key, Door
- Combat: Monster, Weapon, Bomb

**Features:**
- Adjustable grid size (10-30 width × 10-20 height)
- Auto-fill border with walls
- Clear level option
- Background selection
- Real-time preview

**Save System:** All levels stored in browser localStorage with automatic persistence.

## Tech Stack
React 18 · TypeScript · Vite · Tailwind CSS · HTML5 Canvas · localStorage

## Quick Start
```bash
git clone <YOUR_GIT_URL>
cd "Classic Game"
pnpm install
pnpm run dev
```
Game runs at http://localhost:5173

## Build for Production
```bash
pnpm run build    # Creates optimized build in dist/
pnpm run preview  # Preview production build locally
```


## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Deployment
Build output: `npm run build` → `dist/`
Deploy to Vercel, GitHub Pages or any static host.


## License
MIT
Built for creative level design and classic platformer fun.

<div align="center">
  <strong>Game Version: 1.7.0</strong>
</div>
