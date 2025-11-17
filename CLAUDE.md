# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Lost Prison** is a browser-based 2D platformer game with Supabase backend and integrated level editor. The project separates player gameplay (public) from admin level creation (protected), using React, TypeScript, HTML5 Canvas, and Supabase for authentication and data persistence.

## Technology Stack

- **React 18.3.1** - UI framework
- **TypeScript 5.6.2** - Type-safe JavaScript
- **Vite 5.1.6** - Build tool and dev server
- **Tailwind CSS 3.4.13** - Utility-first CSS framework
- **HTML5 Canvas** - Game rendering
- **Supabase 2.81.0** - Backend (auth, database, RLS)
- **React Router 7.9.5** - Client-side routing
- **pnpm** - Package manager (user preference)

## Development Commands

```bash
pnpm install     # Install dependencies (user uses pnpm, not npm)
pnpm run dev     # Start development server (Vite)
pnpm run build   # Build for production
pnpm run preview # Preview production build
```

The development server runs on `http://localhost:5173` by default.

## Environment Setup

Create a `.env` file (use `.env.example` as template):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
src/
├── main.tsx                  # React entry with BrowserRouter + AuthProvider
├── App.tsx                   # Routes: /, /admin/login, /admin/editor
├── types.ts                  # TypeScript types, physics constants
├── constants.ts              # Game constants, tool definitions
├── config/
│   └── supabase.ts          # Supabase client initialization
├── types/
│   └── database.types.ts    # Generated Supabase types
├── contexts/
│   └── AuthContext.tsx      # Authentication state management
├── services/
│   ├── authService.ts       # Login, signup, profile operations
│   ├── levelService.ts      # Level CRUD, publish/unpublish
│   └── progressService.ts   # Player progress tracking
├── pages/
│   ├── GamePage.tsx         # Public: plays published levels
│   ├── EditorPage.tsx       # Protected: admin level editor
│   └── AdminLoginPage.tsx   # Admin authentication
├── components/
│   ├── ProtectedRoute.tsx   # Route guard (admin only)
│   ├── Navbar.tsx           # Navigation (legacy, mostly removed)
│   └── LevelSelector.tsx    # Grid of published levels
├── state/
│   ├── editorState.ts       # Editor state management
│   ├── gameState.ts         # Game state management
│   └── gameLoop.ts          # Game loop and update logic
├── canvas/
│   ├── editorCanvas.ts      # Editor rendering with backgrounds
│   ├── gameCanvas.ts        # Game rendering with backgrounds
│   └── shared.ts            # Shared rendering utilities
├── hooks/
│   ├── useTextures.ts       # Image asset loading hook
│   └── useAudio.ts          # Audio system hook
└── utils/
    └── storage.ts           # localStorage operations (legacy)

public/
├── Images/                  # Game textures and backgrounds
└── Music/                   # Sound effects and background music
```

## Architecture Overview

### Three-Route Application

The application uses **React Router** with three main routes ([App.tsx](src/App.tsx)):

1. **`/` - GamePage (Public)** - Players can play published levels without login
2. **`/admin/login` - AdminLoginPage** - Email/password authentication for admins
3. **`/admin/editor` - EditorPage (Protected)** - Admin-only level editor with Supabase save/publish

Protected routes require `role='admin'` in the user's profile (Supabase RLS enforced).

### Supabase Database Schema

**Tables** (see [supabase-schema.sql](supabase-schema.sql)):

**`profiles`**:
- Links to auth.users via user_id
- `role` (text): 'admin' or 'player'
- `username` (text): Display name
- Auto-created on signup via trigger

**`levels`**:
- `level_number` (int): 1-10 per creator
- `level_name` (text): Custom level name
- `map_data` (jsonb): Complete level data (grid, objects, background)
- `background` (text): 'none', 'bg1', 'bg2'
- `is_published` (boolean): Visibility control
- `created_by` (uuid): References profiles(user_id)
- RLS: Only admins can write, players can read published levels

**`progress`**:
- Tracks player completion, best times, deaths per level
- `completed` (boolean), `best_time` (int), `deaths` (int)

### Authentication Flow

**Admin Login**:
1. Navigate to `/admin/login`
2. Enter email/password
3. `signInWithEmail()` from [authService.ts](src/services/authService.ts)
4. Check `profile.role === 'admin'`
5. Redirect to `/admin/editor`

**ProtectedRoute** ([components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)):
- Checks `useAuth()` for authenticated user
- If `requireAdmin`, checks `isAdmin()` from context
- Shows "Access Denied" if not authorized

### Data Flow

**Admin Creating Level**:
1. EditorPage loads with `editorState` (local React state)
2. Admin edits level with tools
3. Click "Save" → `upsertLevel()` saves to Supabase `levels` table
4. Click "Publish" → `publishLevel()` sets `is_published=true`
5. Now visible to players on GamePage

**Player Playing Level**:
1. GamePage calls `getPublishedLevels()` on mount
2. Fetches all levels where `is_published=true` (RLS enforced)
3. `levelToLevelData()` converts Supabase row to game format
4. `buildGameStateFromLevel()` converts to runtime `GameState`
5. Game loop renders and updates canvas

### State Management

**Editor State** ([editorState.ts](src/state/editorState.ts)):
- `grid: number[][]` - 2D array of tile types (grid coordinates)
- `monsters[]`, `weapons[]`, `bombs[]`, `keys[]`, `doors[]` - Objects at grid positions
- `playerStart` and `goal` - Start/end grid positions
- `gridWidth`, `gridHeight` - Canvas dimensions in tiles
- `currentLevel` - Level number (1-10)
- `selectedTool` - Active drawing tool
- `background` - 'none' | 'bg1' | 'bg2'

**Game State** ([gameState.ts](src/state/gameState.ts)):
- `grid: number[][]` - Cloned level grid (modifiable by bombs)
- `player: PlayerState` - Position (pixels), velocity, dimensions, weapon state
- `monsters[]`, `collectibles[]`, `bullets[]`, `placedBombs[]` - Active objects in pixel coordinates
- `keys`, `ammo`, `bombCount`, `health` - Player stats
- `level`, `deaths`, `time` - Session tracking
- `background` - Background image ID

**CRITICAL**: Editor uses **grid coordinates**, game uses **pixel coordinates**. Conversion via `buildGameStateFromLevel()` multiplies grid positions by `TILE_SIZE` (40) and adds offset (+5).

### Coordinate System Conversion

```typescript
// Editor: {x: 5, y: 10} (grid cell)
// Game:   {x: 205, y: 405} (pixels)
//
// Conversion: x = gridX * 40 + 5, y = gridY * 40 + 5
```

See `gridToPixel()` in [gameState.ts](src/state/gameState.ts:61-66).

### Canvas Rendering with Backgrounds

**Background rendering happens INSIDE the canvas**, not in wrapper divs.

Both [editorCanvas.ts](src/canvas/editorCanvas.ts) and [gameCanvas.ts](src/canvas/gameCanvas.ts) follow this pattern:

```typescript
// 1. Clear canvas
ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

// 2. Draw background first (fills entire canvas)
if (state.background === "bg1" && textures.bg1?.complete) {
  ctx.drawImage(textures.bg1, 0, 0, ctx.canvas.width, ctx.canvas.height);
} else if (state.background === "bg2" && textures.bg2?.complete) {
  ctx.drawImage(textures.bg2, 0, 0, ctx.canvas.width, ctx.canvas.height);
} else {
  ctx.fillStyle = "#87CEEB"; // Sky blue default
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

// 3. Draw grid lines (subtle, semi-transparent)
// 4. Draw tiles, objects, monsters, player
```

**Why**: This ensures backgrounds appear inside the game grid only, not outside. Canvas wrappers use `bg-slate-900` for consistent dark framing.

### Game Loop and Keyboard Handlers

**IMPORTANT FIX**: The `jump()`, `createPlayerBullet()`, and `createPlacedBomb()` functions in [gameState.ts](src/state/gameState.ts) have specific signatures:

- `jump(player: PlayerState): void` - Mutates player, returns void
- `createPlayerBullet(player: PlayerState): BulletState` - Returns bullet object
- `createPlacedBomb(player: PlayerState): PlacedBomb` - Returns bomb object

**Correct keyboard handler pattern** (see [GamePage.tsx](src/pages/GamePage.tsx:174-201)):

```typescript
// JUMP - mutates player object
if (e.key === " " && gameStateRef.current.player.onGround) {
  e.preventDefault();
  setGameState(prev => {
    const next = { ...prev, player: { ...prev.player } };
    jump(next.player); // Mutates next.player
    return next;
  });
}

// SHOOT - creates bullet object
if (e.key === "f" || e.key === "F") {
  if (gameStateRef.current.player.hasWeapon && gameStateRef.current.ammo > 0) {
    setGameState(prev => ({
      ...prev,
      bullets: [...prev.bullets, createPlayerBullet(prev.player)],
      ammo: prev.ammo - 1
    }));
  }
}

// BOMB - creates bomb object
if (e.key === "b" || e.key === "B") {
  if (gameStateRef.current.bombCount > 0) {
    setGameState(prev => ({
      ...prev,
      placedBombs: [...prev.placedBombs, createPlacedBomb(prev.player)],
      bombCount: prev.bombCount - 1
    }));
  }
}
```

**WRONG** (causes blue screen bug):
```typescript
setGameState(prev => jump(prev)); // Returns void, sets state to undefined!
```

### Tile Types

```typescript
enum TileType {
  Empty = 0,
  Wall = 1,      // Black, indestructible
  Stone = 2,     // Blue, destructible by bombs
  Lava = 3,      // Red, damages player
  Platform = 10  // Brown, walkable
}
```

**Critical**: Only Stone (type 2) is destructible by bombs. Walls, lava, platforms are immune.

### Physics Constants

Defined in [types.ts](src/types.ts:1-11):

```typescript
export const TILE_SIZE = 40;
export const GRAVITY = 0.5;
export const JUMP_POWER = -9.1;
export const MOVE_SPEED = 4;
export const BULLET_SPEED = 8;
export const BOMB_BLAST_RADIUS = 2;
```

### Level Data Conversion

**Supabase → Game**:
```typescript
// 1. Fetch from Supabase
const levels = await getPublishedLevels();

// 2. Convert row to LevelData
const levelData = levelToLevelData(supabaseLevel);

// 3. Build game state with level number
const gameState = buildGameStateFromLevel(levelData, level.level_number);
```

**IMPORTANT**: `buildGameStateFromLevel()` requires TWO parameters: `levelData` and `currentLevel` (number).

### Collision Detection

Uses **AABB (Axis-Aligned Bounding Box)**:

```typescript
checkCollision(a, b): boolean // Returns true if rectangles overlap
resolveCollision(player, box): void // Pushes player out, sets onGround
```

Player checks a **4×4 grid area** around position each frame in `handleTileCollisions()` ([gameLoop.ts](src/state/gameLoop.ts:33-118)).

Invisible boundary walls prevent falling off grid edges.

### Monster AI

Patrol behavior ([gameLoop.ts](src/state/gameLoop.ts:120-182)):
- `patrol: [startX, endX]` in grid coordinates
- Moves with `speed` and `direction` (±1)
- Reverses at patrol boundaries or walls
- Contact kills player instantly

### Bomb Mechanics

1. **Collectible** → `bombCount++`
2. **Placed** (B key) → 90-frame countdown at player grid position
3. **Explosion** → Destroys only Stone blocks within 2-tile blast radius

### Damage System

- **Lava**: 1 HP/second (60-frame cooldown)
- **Monster**: Instant death, level restart

### Image Assets

Loaded via [useTextures.ts](src/hooks/useTextures.ts) hook:
- `public/Images/Wall.webp` - Walls
- `public/Images/Stone.webp` - Destructible stone
- `public/Images/Lava.png` - Hazard tiles
- `public/Images/Wood Platform.webp` - Platforms
- `public/Images/Key.png` - Keys
- `public/Images/Bomb-Lev-1.webp` - Bombs
- `public/Images/Lock-Normal.png` - Doors
- `public/Images/BG-1.webp` - Forest background
- `public/Images/BG-2.jpg` - Sky background

Emoji fallbacks (⬛🟦🟥🟫) used if textures fail to load.

### Audio System

**Audio Hook** ([useAudio.ts](src/hooks/useAudio.ts)):
- Manages all game audio including background music and sound effects
- Handles browser autoplay restrictions with async `enableAudio()` function
- Audio files loaded from `public/Music/`:
  - `01. Key.mp3` - Background music (loops at 0.4 volume)
  - `Boom.mp3` - Explosion sound
  - `Gun Shoot.mp3` - Weapon fire
  - `Item-Pick.mp3` - Collectible pickup
  - `Jump.mp3` - Player jump (0.25 volume)
  - `PlayerOut.wav` - Player death
  - `Stricks.mp3` - Strike/hit sound

**Browser Audio Policy Handling**:
- Audio must be enabled after user interaction (click/keypress)
- GamePage auto-enables audio on first user interaction via event listeners
- Audio unlocking: plays and pauses each sound once to initialize AudioContext
- Background music starts automatically when audio is enabled and level loaded

**Audio Functions**:
```typescript
enableAudio(): Promise<void>        // Unlock audio context (async)
playSound(key: AudioKey): void      // Play sound effect
playBackgroundMusic(): void         // Start/resume looping music
stopBackgroundMusic(): void         // Pause music
setMuted(muted: boolean): void      // Mute/unmute all audio
```

**IMPORTANT**: Always check `enabled` state before playing sounds. The `playSound()` and `playBackgroundMusic()` functions silently fail if audio is not yet enabled.

### Visual Effects

**Player Shake Effect** ([types.ts](src/types.ts), [gameLoop.ts](src/state/gameLoop.ts)):
- `PlayerState` includes `shaking?: boolean` and `shakeTimer?: number`
- Triggered when player takes lava damage (30 frames / ~0.5 seconds)
- Rendering applies random ±2 pixel offset to player position when `shaking === true`
- Timer decrements each frame in `updateGameFrame()`

**Lava Damage with Shake**:
```typescript
// In handleLavaDamage()
if (tileBelow === TileType.Lava && player.onGround) {
  state.health -= 1;
  state.damageTimer = 60;
  player.shaking = true;
  player.shakeTimer = 30;
}

// In renderGame() (gameCanvas.ts)
const shakeOffsetX = player.shaking ? (Math.random() - 0.5) * 4 : 0;
const shakeOffsetY = player.shaking ? (Math.random() - 0.5) * 4 : 0;
ctx.drawImage(playerImage, player.x + shakeOffsetX, player.y + shakeOffsetY, ...);
```

### Editor Zoom Controls

**Zoom Functionality** ([EditorPage.tsx](src/pages/EditorPage.tsx:676-735)):
- Three zoom buttons: `+` (zoom in), `−` (zoom out), `⊡` (fit to view)
- Zoom uses CSS `transform: scale()` on canvas element
- Canvas remains centered in scrollable container

**Zoom Levels**:
- **Zoom In**: 1 → 1.5 → 2.0
- **Zoom Out**: 1 → 0.5 → 0.25
- **Fit to View**: Calculates optimal scale to fit entire canvas in viewport

**Fit-to-View Calculation**:
```typescript
// Get canvas actual dimensions
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

// Get container available space (minus padding)
const containerWidth = container.clientWidth - 32;
const containerHeight = container.clientHeight - 32;

// Calculate scale ratios
const scaleX = containerWidth / canvasWidth;
const scaleY = containerHeight / canvasHeight;

// Use minimum to fit both dimensions, cap at 1 (no upscaling)
const fitScale = Math.min(scaleX, scaleY, 1);
canvas.style.transform = `scale(${fitScale})`;
```

**IMPORTANT**: The container must have proper dimensions when calculating fit. Account for padding (typically 32px total) to prevent clipping.

### Editor Test Mode

**Testing Levels** ([EditorPage.tsx](src/pages/EditorPage.tsx:398-468)):
- Click "▶️ Test Level" to switch from `editor` mode to `game` mode
- Converts current `editorState` to `gameState` using `buildGameStateFromLevel()`
- Renders game canvas with full physics and collision detection
- Shows "📝 Back to Editor" button to return to editing
- Changes are not saved when testing - must return to editor and click Save

**Mode States**:
- `mode === "editor"`: Normal editing interface with tools, settings, and canvas
- `mode === "game"`: Full gameplay with player controls, stats bar, and game loop

**Use Case**: Test level mechanics, monster patrols, and difficulty before publishing to players.

### UI Patterns

**No Page Scrolling**: GamePage uses `overflow-hidden` on all containers and sets `document.body.style.overflow = 'hidden'` to prevent scrolling during gameplay.

**Fixed Viewport**: All game UI uses flexbox with `h-screen` and `flex-shrink-0` to fit exactly in viewport without scrolling.

**Collapsible Controls**: Player controls are hidden by default, shown with "Show Controls" button toggle.

**Modern UI Design**:
- **Compact HUD**: Stats grouped in single bar with `bg-black/20 backdrop-blur-sm rounded-full` glass morphism
- **Visual Health Bar**: Instead of numbers, uses array of small rounded bars: `Array.from({ length: health }).map(() => div)`
- **Icon-Only Buttons**: Minimal 8×8 buttons with emoji icons, hover scale effect
- **Gradient Top Bar**: `bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600`
- **Ambient Canvas Glow**: Dark background with `bg-gradient-radial from-purple-900/10` overlay
- **Rounded Canvas**: `rounded-2xl border-4 border-slate-700/30` with multi-layer box shadows
- **Dividers**: Vertical `w-px h-4 bg-white/20` separators between stats

**CSS Animations** ([index.css](src/index.css)):
- `@keyframes statPulse`: Scale animation for stat changes (1 → 1.2 → 1)
- `@keyframes buttonGlow`: Box shadow pulse for interactive elements
- `@keyframes healthPulse`: Opacity fade for low health warnings
- `.bg-gradient-radial`: Custom Tailwind utility for radial gradients

## Common Tasks

### Creating Admin Account

Run in Supabase SQL Editor after user signs up:
```sql
UPDATE profiles
SET role = 'admin'
WHERE user_id = 'user-uuid-here';
```

### Adding New Tile Type

1. Add to `TileType` enum in [types.ts](src/types.ts)
2. Update `toolToTile()` in [editorState.ts](src/state/editorState.ts)
3. Add to `TOOL_OPTIONS` in [constants.ts](src/constants.ts)
4. Add rendering in [editorCanvas.ts](src/canvas/editorCanvas.ts) and [gameCanvas.ts](src/canvas/gameCanvas.ts)
5. Add collision handling in [gameLoop.ts](src/state/gameLoop.ts) if solid

### Adding New Background

1. Add image to `public/Images/`
2. Add to `textureSources` in [useTextures.ts](src/hooks/useTextures.ts)
3. Update `TextureKey` type
4. Add to background options in [constants.ts](src/constants.ts)
5. Add rendering case in both canvas files

### Adding New Sound Effect

1. Add audio file to `public/Music/` (prefer .mp3 format)
2. Update `AudioKey` type in [useAudio.ts](src/hooks/useAudio.ts)
3. Add to `audioSources` object with file path
4. Set appropriate volume in initialization (0.25-0.5 for effects, 0.4 for music)
5. Call `playSound(newAudioKey)` where needed (e.g., in game loop, event handlers)

**Example**:
```typescript
// In useAudio.ts
type AudioKey = "bgMusic" | "boom" | "newSound";

const audioSources: Record<AudioKey, string> = {
  // ... existing
  newSound: "/Music/NewSound.mp3"
};

// Set volume during initialization
if (key === "newSound") {
  audio.volume = 0.3;
}

// In GamePage.tsx or gameLoop.ts
playSound("newSound");
```

### Debugging Blue Screen Bug

If page goes blue/blank on key press:
- Check that state update functions return proper values
- `jump()` returns void, must be called on cloned player
- `createPlayerBullet()` returns BulletState, add to bullets array
- See "Correct keyboard handler pattern" above

### Fixing Background Outside Grid

If background shows outside canvas:
- Remove background styles from canvas wrapper divs
- Ensure canvas drawing functions draw background first
- Use `bg-slate-900` on wrapper for consistent framing
- Background should be drawn with `ctx.drawImage()` inside canvas

### Debugging Audio Issues

If audio/music not playing:
1. **Check Browser Policy**: Audio requires user interaction to enable
   - Verify `enableAudio()` is called after click/keypress event
   - Check browser console for autoplay policy warnings
2. **Check Audio State**: Ensure `enabled === true` before playing sounds
   - `playSound()` and `playBackgroundMusic()` silently fail if not enabled
3. **Check File Paths**: Verify audio files exist in `public/Music/`
   - Use browser DevTools Network tab to check for 404 errors
   - File paths are case-sensitive on some servers
4. **Check Volume Levels**: Different sounds have different default volumes
   - Background music: 0.4
   - Jump: 0.25
   - Other effects: 0.5
5. **Check Mute State**: User may have clicked mute button
   - `isMuted` state controls `audio.muted` property

**Testing Audio**:
```typescript
// In browser console (after user interaction)
console.log("Audio enabled:", enabled);
console.log("Audio loaded:", loaded);
playSound("jump"); // Should play immediately if enabled
```

## Key Architectural Patterns

- **React Router** for route-based navigation
- **Protected routes** with role-based access control
- **Supabase RLS** for database security
- **Context API** for authentication state
- **Service layer** for API abstractions
- **Ref-based optimization** for game loop (avoid re-render issues)
- **Canvas immediate mode rendering** - Full redraw each frame
- **Immutable state updates** with spread operators
- **TypeScript strict mode** throughout
- **Grid-to-pixel coordinate conversion** for editor/game separation
- **Background rendering inside canvas** for proper layout
- **Fixed viewport with no scrolling** for game pages
