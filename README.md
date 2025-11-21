# The Lost Prison

A browser-based 2D platformer game with Supabase backend, featuring a powerful level editor and mobile touch controls for creating and playing custom prison escape challenges.

## Overview
The Lost Prison is a pixel-art platformer where players navigate through dangerous prison levels filled with monsters, locked doors, and deadly traps. Features role-based authentication with admin level creation and public gameplay, persistent cloud storage, and mobile-optimized touch controls.

## Core Features

### Authentication & Roles
- **Admin Mode** - Protected level editor with Supabase authentication
- **Public Play** - Anyone can play published levels without login
- **Role-Based Access** - Row Level Security enforced at database level

### Level Editor (Admin Only)
- **Visual Grid Editor** - Drag-and-draw tools with real-time preview
- **Cloud Storage** - Levels saved to Supabase with publish/unpublish control
- **Test Mode** - Play-test levels before publishing
- **6 Custom Backgrounds** - Choose from multiple themed environments
- **Adjustable Grid** - 10-30 width × 10-20 height canvas
- **Zoom Controls** - Zoom in/out or fit-to-view

### Gameplay
- **Physics Engine** - Smooth jumping, gravity, collision detection with AABB
- **Combat System** - Collect weapons, shoot monsters, place bombs
- **Puzzle Elements** - Keys unlock doors, bombs destroy stone blocks
- **Fire Traps** - Configurable hazards with direction, timing, and spray distance
- **Progress Tracking** - Best times, deaths, completion status saved to cloud
- **Mobile Optimized** - Touch controls for landscape gameplay on phones/tablets

### Game Elements
- **Terrain Blocks** - Walls (indestructible), Stone (destructible), Lava (damage), Platforms
- **Objects** - Player spawn point, Goal star, Keys, Locked doors
- **Hazards** - Patrolling monsters, Fire traps with configurable timing
- **Combat Items** - Weapons with ammo, Bombs with blast radius
- **Player Stats** - Health (5 HP), Ammo, Bomb count, Keys, Deaths, Time

**Objective:** Navigate from the player start to the goal star while collecting keys, avoiding hazards, and defeating monsters.

## Tech Stack
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · HTML5 Canvas
**Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
**Routing:** React Router 7
**Package Manager:** pnpm
**Security:** Input sanitization, Error boundaries, Runtime validation

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Supabase account (for backend features)

### Setup
```bash
git clone <YOUR_GIT_URL>
cd The-Lost-Prison
pnpm install
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Run Development Server
```bash
pnpm run dev
```
Game runs at http://localhost:5173

**Routes:**
- `/` - Public gameplay (play published levels)
- `/admin/login` - Admin authentication
- `/admin/editor` - Level editor (admin only)


## Scripts
| Command | Description |
|---------|-------------|
| `pnpm run dev` | Dev server with hot reload (Vite) |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview production build |


## Deployment
Build output: `pnpm run build` → `dist/`
Deploy to Vercel, Netlify, or any static host with environment variables configured.


## License
MIT License

Built for creative level design and classic platformer fun with modern web technologies.

---

<div align="center">
  <strong>Game Version: 2.0.0</strong> | Supabase Backend | Mobile Optimized
</div>
