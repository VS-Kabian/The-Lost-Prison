# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Lost Prison** is a browser-based 2D platformer game with Supabase backend and integrated level editor. The project separates player gameplay (public) from admin level creation (protected), using React, TypeScript, HTML5 Canvas, and Supabase for authentication and data persistence.

## Technology Stack

- **React 18.3.1** - UI framework
- **TypeScript 5.6.2** - Type-safe JavaScript
- **Vite 5.4.21** - Build tool and dev server
- **Tailwind CSS 3.4.18** - Utility-first CSS framework
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
│   ├── ErrorBoundary.tsx    # React error boundary (catches rendering errors)
│   ├── TouchControls.tsx    # Mobile touch controls for landscape mode
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
│   ├── useAudio.ts          # Audio system hook
│   ├── useDebounce.ts       # Function debouncing hook (rate limiting)
│   └── useMobileDetection.ts # Mobile device and orientation detection
└── utils/
    ├── logger.ts            # Secure logging utility (dev-only output)
    ├── sanitize.ts          # Input sanitization (XSS prevention)
    └── storage.ts           # localStorage operations (legacy, deprecated)

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
- `background` (text): 'none', 'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6'
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

**Token Refresh UX** ([AuthContext.tsx](src/contexts/AuthContext.tsx)):
- Supabase automatically refreshes JWT tokens before expiry
- Toast notifications shown for auth events: TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT
- Prevents user confusion when session updates in background
- All timeouts properly cleaned up to prevent memory leaks

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
- `background` - 'none' | 'bg1' | 'bg2' | 'bg3' | 'bg4' | 'bg5' | 'bg6'

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

// 2. Convert row to LevelData with validation
const levelData = levelToLevelData(supabaseLevel);
// This runs validateLevelData() which checks:
// - Grid is 2D array of numbers
// - All position arrays have x/y coordinates
// - Required fields present (name, playerStart, goal)
// - Background is valid enum value

// 3. Build game state with level number
const gameState = buildGameStateFromLevel(levelData, level.level_number);
```

**IMPORTANT**:
- `buildGameStateFromLevel()` requires TWO parameters: `levelData` and `currentLevel` (number)
- `levelToLevelData()` validates data structure and throws on invalid data
- Always sanitize level names with `processLevelName()` before saving

### Collision Detection

Uses **AABB (Axis-Aligned Bounding Box)**:

```typescript
checkCollision(a, b): boolean // Returns true if rectangles overlap
resolveCollision(player, box): void // Pushes player out, sets onGround
```

Player checks a **4×4 grid area** around position each frame in `handleTileCollisions()` ([gameLoop.ts](src/state/gameLoop.ts:33-118)).

Invisible boundary walls prevent falling off grid edges.

**Bullet Collision** ([gameState.ts](src/state/gameState.ts:250)):
- Bullets stop when hitting solid blocks: Wall (1), Stone (2), Platform (10)
- Bullets stop at closed doors and fire trap blocks
- `updateBullets()` requires `doors` and `firetraps` parameters for collision checks
- Bullets that hit monsters or solid objects are removed from the bullets array

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

### Hearts & Coins Collectible System

**Heart Collectibles** ([types.ts](src/types.ts:69), [gameLoop.ts](src/state/gameLoop.ts:310-314)):
- Placed in editor at grid positions like other collectibles
- Restores **1 health point** when collected
- Cannot exceed `maxHealth` (default: 6 HP)
- Plays pickup sound effect on collection
- Visual: Heart sprite or red circle fallback

**Coin Collectibles** ([types.ts](src/types.ts:69), [gameLoop.ts](src/state/gameLoop.ts:310-314)):
- Placed in editor at grid positions
- Currently collected but **no gameplay effect**
- Reserved for future score/currency system
- Plays pickup sound effect on collection
- Visual: Yellow coin sprite or circle fallback

**Implementation**:
```typescript
// In gameLoop.ts - handleCollectibles()
if (item.type === "heart") {
  state.health = Math.min(state.maxHealth, state.health + 1);
  playSound("itemPick");
} else if (item.type === "coin") {
  // Reserved for future score tracking
  playSound("itemPick");
}
```

**Level Data Structure**:
```typescript
interface LevelData {
  // ... other fields
  hearts?: GridPosition[];  // Optional heart positions
  coins?: GridPosition[];   // Optional coin positions
}
```

**IMPORTANT**: Hearts are fully functional. Coins are implemented but currently have no gameplay effect - they're reserved for a future score/currency feature.

### Door/Lock/Key System

**Key Mechanics**:
- Keys are collectibles placed in the editor at grid positions
- When player collects a key: `state.keys += 1` (shown in HUD)
- Multiple keys can be collected and used

**Door Mechanics** ([gameLoop.ts](src/state/gameLoop.ts:248-294)):
- Doors are placed in editor as EditorDoor objects at grid positions
- Each door has an `open: boolean` state
- Closed doors act as **solid walls** - player cannot pass through
- Open doors are non-solid and can be walked through

**Opening Doors** (K button):
- Player must press **K** to open a door (not automatic)
- Door opening uses **proximity check** (1.5 blocks / 60 pixels)
- Player can open door from:
  - Standing directly in front
  - Standing one block away (left/right/above/below)
  - Standing diagonally nearby
- Requirements:
  - Player must have at least 1 key (`state.keys > 0`)
  - Player must be within 1.5 blocks of door center
  - Door must be closed
- When opened: `door.open = true`, `state.keys -= 1`, sound effect plays

**Implementation**:
```typescript
// Collision handling (always treat closed doors as walls)
function handleDoorCollisions(state: GameState, player: PlayerState): void

// Opening doors on K press (proximity-based)
export function tryOpenDoor(state: GameState): boolean
  - Calculates distance between player center and door center
  - Opens if distanceX <= 60px AND distanceY <= 60px
  - Consumes one key and sets door.open = true
```

**CRITICAL**: Doors automatically acted as walls and opened on collision in earlier versions. Current implementation requires **explicit K button press** and uses **proximity detection** instead of collision.

### Damage System

- **Lava**: 1 HP/second (60-frame cooldown)
- **Monster**: Instant death, level restart
- **Fire Traps**: 1 HP on contact (60-frame invincibility)

### Progress Tracking & Leaderboard System

**Database Table**: `progress` (Supabase)

The game includes a comprehensive progress tracking system for recording player performance and displaying leaderboards.

**Progress Service** ([services/progressService.ts](src/services/progressService.ts)):

**Player Progress Functions**:
```typescript
// Fetch progress for specific level
getPlayerProgress(playerId: string, levelId: string): Promise<Progress | null>

// Fetch all progress for a player
getAllPlayerProgress(playerId: string): Promise<Progress[]>

// Save or update progress (only updates if new time is better)
upsertProgress(playerId: string, levelId: string, data: ProgressData): Promise<void>
```

**Leaderboard Functions**:
```typescript
// Level-specific leaderboard (sorted by best_time ascending)
getLeaderboard(levelId: string, limit?: number): Promise<LeaderboardEntry[]>

// Global leaderboard (sorted by total score descending)
getGlobalLeaderboard(limit?: number): Promise<GlobalLeaderboardEntry[]>
```

**Statistics Functions**:
```typescript
// Get player completion statistics
getPlayerStats(playerId: string): Promise<PlayerStats>
// Returns: { totalLevelsCompleted, totalDeaths, averageTime, bestScore }

// Check if player completed a level
hasCompletedLevel(playerId: string, levelId: string): Promise<boolean>

// Get player's best time for a level
getBestTime(playerId: string, levelId: string): Promise<number | null>
```

**Progress Data Structure**:
```typescript
interface ProgressData {
  completed: boolean;    // Whether level was completed
  time: number;          // Completion time in seconds
  deaths: number;        // Deaths in this attempt
  score: number;         // Score for this level
}

interface LeaderboardEntry {
  player_id: string;
  username: string;      // Joined from profiles table
  best_time: number;
  deaths: number;
  completed_at: string;
}
```

**Progress Table Schema** (Supabase):
```sql
CREATE TABLE progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  best_time INTEGER,           -- Best completion time in seconds
  total_deaths INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, level_id)
);
```

**Key Features**:
- **Smart Updates**: `upsertProgress()` only updates if new time is better than existing
- **Death Accumulation**: Tracks total deaths across all attempts
- **Username Integration**: Leaderboards join with profiles for display names
- **Row-Level Security**: Players can only update their own progress

**IMPORTANT**: Progress tracking is fully implemented in the service layer but may not be fully integrated into the GamePage UI. This system is ready for future leaderboard displays and statistics dashboards.

### Camera System

**Viewport Configuration** ([GamePage.tsx](src/pages/GamePage.tsx:142-145)):
- Fixed viewport: **12 tiles wide × 6 tiles tall** (480×240 pixels)
- Canvas scaled to **1.5x** with pixelated rendering for retro aesthetic
- Camera follows player smoothly with boundary clamping

**Camera Positioning** ([gameCanvas.ts](src/canvas/gameCanvas.ts:21-37)):
```typescript
// Center camera on player horizontally
let cameraX = state.player.x + state.player.width / 2 - viewportWidth / 2;

// Position camera 2 blocks above player vertically
let cameraY = state.player.y - 2 * TILE_SIZE;

// Clamp to map boundaries to prevent showing outside map
cameraX = Math.max(0, Math.min(cameraX, mapWidth - viewportWidth));
cameraY = Math.max(0, Math.min(cameraY, mapHeight - viewportHeight));

// Apply transformation to all rendering
ctx.translate(-cameraX, -cameraY);
```

**Key Points**:
- Background fills entire map, not just viewport
- All game objects rendered in world coordinates, camera transform handles view
- Canvas wrapper uses `overflow-hidden` to prevent scrolling
- `ctx.restore()` at end of render to reset transformation

### Fire Trap System

**Fire Trap Mechanics** ([types.ts](src/types.ts:51-58), [gameLoop.ts](src/state/gameLoop.ts)):

Fire traps are stationary hazards that periodically shoot fire in a direction.

**Editor Configuration** ([editorState.ts](src/state/editorState.ts:126-135)):
- **Direction**: "up" | "down" | "left" | "right" (default: "up")
- **Spray Distance**: Number of blocks fire travels (default: 1)
- **Spray Time**: Seconds fire is active (default: 2)
- **Rest Time**: Seconds between activations (default: 2)

**Game Runtime Behavior**:
1. **Rest Phase**: Fire trap block visible, no fire
2. **Warning Phase**: 0.5s (30 frames) before activation, block glows orange
3. **Active Phase**: Fire shoots out block-by-block with 0.15s (9 frames) delay
4. **Cycle**: Active (2s) → Rest (2s) → repeat

**Fire Animation** ([gameCanvas.ts](src/canvas/gameCanvas.ts:245-281)):
- Uses 4 PNG frames (`fire1.png` through `fire4.png`) cycling every 5 game frames
- Fire rendered at **2.5x tile size** (100×100px) for visibility
- Centered on grid position with offset calculation

**Collision**:
- Fire trap block acts as **solid wall** for player and monsters
- Active fire blocks deal **1 HP damage** on contact
- **60-frame (1 second) invincibility** after damage
- Player shakes when hit (same as lava damage)

**Implementation Notes**:
- Editor stores time in **seconds**, converted to **frames** (×60) in game state
- Timer starts with warning phase offset: `restTime * 60 - 30`
- Fire blocks calculated dynamically based on direction and spray distance
- `fireBlocks[]` array used for collision detection during active phase

### Image Assets

Loaded via [useTextures.ts](src/hooks/useTextures.ts) hook:
- `public/Images/Wall.webp` - Walls
- `public/Images/Stone.webp` - Destructible stone
- `public/Images/Lava.png` - Hazard tiles
- `public/Images/Wood Platform.webp` - Platforms
- `public/Images/Key.png` - Keys
- `public/Images/Bomb-Lev-1.webp` - Bombs
- `public/Images/Lock-Normal.png` - Doors
- `public/Images/Fire_Trap.png` - Fire trap block
- `public/Images/Fire Anim/Fire-1.png` to `Fire-4.png` - Fire animation frames
- `public/Images/BackGround/BG-1.webp` - Forest platformer background
- `public/Images/BackGround/BG-2.jpg` - Sky plains background
- `public/Images/BackGround/BG-3.jpg` - Background 3
- `public/Images/BackGround/BG-4.jpg` - Background 4
- `public/Images/BackGround/BG-5.jpg` - Background 5
- `public/Images/BackGround/BG-6.jpg` - Background 6
- `public/Images/Player/Kilo-Opened.png` - Player sprite (mouth open)
- `public/Images/Player/Kilo-Closed.png` - Player sprite (mouth closed)
- `public/Images/Player/Goal.png` - Goal/exit sprite
- `public/Images/Player/Gun.png` - Weapon sprite
- `public/Images/Player/Monster-Open.png` - Monster sprite (mouth open)
- `public/Images/Player/Monster-Close.png` - Monster sprite (mouth closed)

**Touch Control Assets** (Mobile):
- `public/Images/Control/Left Arrow.png` - Move left button
- `public/Images/Control/Right Arrow.png` - Move right button
- `public/Images/Control/Jump Button.png` - Jump button

Emoji fallbacks (⬛🟦🟥🟫🔥👾) used if textures fail to load.

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

### Custom Hooks

**useDebounce** ([hooks/useDebounce.ts](src/hooks/useDebounce.ts)):
- Debounces function calls to prevent rapid successive execution
- Prevents performance issues and rate limiting violations
- Default delay: 1000ms (customizable)
- Returns debounced version of the callback function

**Usage Example**:
```typescript
const debouncedSave = useDebounce(handleSave, 2000);
// handleSave will only execute 2 seconds after last call
```

**Used in**:
- EditorPage: Rate-limits save operations to prevent spam
- Prevents accidental multiple saves from rapid clicking

**useMobileDetection** ([hooks/useMobileDetection.ts](src/hooks/useMobileDetection.ts)):
- Detects mobile devices and screen orientation
- Returns: `{ isMobile, isLandscape, isMobileLandscape }`
- Updates automatically on resize and orientation change

**Detection Criteria**:
- User agent matching (Android, iOS, iPhone, iPad, etc.)
- Screen size: ≤900px width considered mobile
- Touch support via `maxTouchPoints` check
- Orientation API when available

**Usage Example**:
```typescript
const { isMobile, isLandscape, isMobileLandscape } = useMobileDetection();

// Show touch controls only in mobile landscape
{isMobileLandscape && <TouchControls />}
```

**Used in**:
- GamePage: Controls visibility of touch controls
- Responsive layout adjustments
- Mobile-specific optimizations

**useTextures** ([hooks/useTextures.ts](src/hooks/useTextures.ts)):
- [See "Image Assets" section for details]
- Loads all game textures and background images
- Returns `loaded` state and `textures` object
- Handles loading errors with fallbacks

**useAudio** ([hooks/useAudio.ts](src/hooks/useAudio.ts)):
- [See "Audio System" section for details]
- Manages all game audio and background music
- Handles browser autoplay restrictions
- Provides sound playback functions

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

**Animation Frame System** ([gameState.ts](src/state/gameState.ts), [gameLoop.ts](src/state/gameLoop.ts)):
- `GameState` includes `animationFrame: number` for synchronized animations
- Increments every frame: `state.animationFrame = (state.animationFrame + 1) % 1000`
- Used for multiple animation effects throughout the game

**Applications**:
```typescript
// Fire trap warning glow (pulsing orange effect)
const glowIntensity = Math.sin(state.animationFrame * 0.2) * 0.3 + 0.7;

// Fire animation frame cycling (4 frames, 5 game frames per animation frame)
const fireFrame = Math.floor((state.animationFrame + index * 5) / 5) % 4;
const fireImage = textures[`fire${fireFrame + 1}` as TextureKey];

// Player sprite mouth animation
const playerFrame = Math.floor(state.animationFrame / 10) % 2; // Alternates every 10 frames
```

**Why Global Frame Counter**:
- Ensures all animations stay synchronized
- Prevents drift between different animated elements
- Simplifies animation timing calculations
- Modulo 1000 prevents overflow while maintaining precision

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

### Exporting and Importing Levels

**Export Level** ([utils/storage.ts](src/utils/storage.ts:54-62)):

Admins can export level data as JSON files for backup, version control, or sharing:

```typescript
export function exportLevel(level: number, data: LevelData): void
```

**Usage** (in EditorPage):
1. Click "Export" button in editor interface
2. Browser downloads `level_X.json` file
3. File contains complete level data (grid, objects, background, settings)

**Export File Format**:
```json
{
  "levelName": "My Level",
  "grid": [[0,1,2], ...],
  "playerStart": {"x": 1, "y": 1},
  "goal": {"x": 20, "y": 10},
  "monsters": [...],
  "weapons": [...],
  "bombs": [...],
  "keys": [...],
  "doors": [...],
  "firetraps": [...],
  "hearts": [...],
  "coins": [...],
  "background": "bg1"
}
```

**Use Cases**:
- **Backup**: Keep local copies of level designs
- **Version Control**: Track level changes over time
- **Sharing**: Send levels to other developers
- **Testing**: Export for external testing or review
- **Migration**: Move levels between environments

**Implementation**:
```typescript
// Create downloadable JSON file
const dataStr = JSON.stringify(data, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);

// Trigger download
const link = document.createElement('a');
link.href = url;
link.download = `level_${level}.json`;
link.click();

// Cleanup
URL.revokeObjectURL(url);
```

**IMPORTANT**: Import functionality is not yet implemented. Exported files can be used for reference or manually imported via database operations.

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

### Adding New Trap Type (Following Fire Trap Pattern)

1. **Types** ([types.ts](src/types.ts)):
   - Add to `Tool` type union
   - Create `EditorNewTrap` interface with configuration
   - Create `NewTrapState` interface for runtime
   - Add to `LevelData` and `GameState` interfaces

2. **Constants** ([constants.ts](src/constants.ts)):
   - Add to `TOOL_OPTIONS` under "Traps" section

3. **Textures** ([useTextures.ts](src/hooks/useTextures.ts)):
   - Add texture keys to `TextureKey` type
   - Add file paths to `textureSources`

4. **Editor State** ([editorState.ts](src/state/editorState.ts)):
   - Create `createNewTrapAt()` function with defaults
   - Add case in `applyToolAtPosition()` switch
   - Update all state functions to include trap array

5. **Game State** ([gameState.ts](src/state/gameState.ts)):
   - Convert editor traps to game format in `buildGameStateFromLevel()`
   - Convert time-based values to frames if needed

6. **Game Loop** ([gameLoop.ts](src/state/gameLoop.ts)):
   - Create `updateNewTraps()` function with logic
   - Add collision detection for trap block and effects
   - Integrate into main game loop

7. **Canvas Rendering**:
   - Add rendering in [editorCanvas.ts](src/canvas/editorCanvas.ts)
   - Add rendering in [gameCanvas.ts](src/canvas/gameCanvas.ts)
   - Include animations, warning effects, etc.

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

### Debugging Camera Issues

If camera not following player correctly or showing wrong area:

1. **Check Viewport Dimensions** ([GamePage.tsx](src/pages/GamePage.tsx)):
   - Verify `VIEWPORT_WIDTH` and `VIEWPORT_HEIGHT` are set correctly
   - Canvas width/height must match viewport tile count × TILE_SIZE

2. **Check Camera Offset Calculation** ([gameCanvas.ts](src/canvas/gameCanvas.ts)):
   - Ensure `cameraX` centers on player: `player.x + player.width / 2 - viewportWidth / 2`
   - Ensure `cameraY` positions correctly above player: `player.y - 2 * TILE_SIZE`
   - Verify clamping prevents showing outside map boundaries

3. **Check Canvas Transformation**:
   - `ctx.save()` must be called before `ctx.translate()`
   - `ctx.restore()` must be called at end of render function
   - All rendering must happen between save/restore

4. **Check Background Rendering**:
   - Background should fill entire **map**, not viewport: `drawImage(bg, 0, 0, mapWidth, mapHeight)`
   - Not: `drawImage(bg, 0, 0, viewportWidth, viewportHeight)`

5. **Check Canvas Styling**:
   - `transform: scale()` applied for pixel-perfect scaling
   - `imageRendering: 'pixelated'` for retro look
   - Container uses `overflow-hidden` to prevent scrolling

## Security & Logging

### Secure Logger Utility

**CRITICAL**: Never use `console.log`, `console.warn`, or `console.error` directly in production code. Always use the secure logger utility ([utils/logger.ts](src/utils/logger.ts)).

**Logger Functions**:
```typescript
import { logInfo, logWarning, logError } from "../utils/logger";

logInfo("message", optionalData);     // Development-only info logging
logWarning("message", optionalData);  // Development-only warnings
logError("message", errorObject);     // Development-only error logging
```

**Why This Matters**:
- Logger only outputs in **development mode** (`import.meta.env.DEV`)
- **Silent in production** - prevents information disclosure and performance overhead
- Protects against exposing internal state, debug data, or error details to users
- Ready for integration with monitoring services (Sentry, LogRocket)

**Security Best Practices**:
- ✅ `.env` file in `.gitignore` (never commit credentials)
- ✅ Supabase RLS enforced on all tables
- ✅ Admin role cannot be self-assigned (database-only operation)
- ✅ TypeScript strict mode prevents type-related vulnerabilities
- ✅ No privilege escalation paths in client code
- ✅ Input validation and sanitization (processLevelName, sanitizeLevelName)
- ✅ Error boundaries prevent white screen crashes
- ✅ Memory leak prevention with proper cleanup

### Security Patterns

**Rate Limiting on Save Operations** ([EditorPage.tsx](src/pages/EditorPage.tsx:151-157)):

To prevent save spam and potential DoS attacks, the editor enforces a **2-second cooldown** between saves:

```typescript
const SAVE_COOLDOWN = 2000; // 2 seconds in milliseconds
const now = Date.now();

if (now - lastSaveTime < SAVE_COOLDOWN) {
  showMessage("⏱️ Please wait before saving again");
  return;
}

// Proceed with save...
setLastSaveTime(now);
```

**Implementation Details**:
- Tracks last save timestamp with `useState<number>`
- Enforces minimum 2-second interval between saves
- Shows user-friendly warning message on cooldown
- Timestamp updated **only after successful save**
- Works in conjunction with `useDebounce` hook for additional protection

**Why This Matters**:
- Prevents accidental rapid clicking
- Reduces database write load
- Protects against potential abuse/spam
- Improves overall system stability
- Prevents rate limit violations on Supabase

**Memory Leak Prevention**:
All `setTimeout` calls must use refs with cleanup in `useEffect`:
```typescript
const timeoutRef = useRef<number>();

// Setting timeout
if (timeoutRef.current) {
  window.clearTimeout(timeoutRef.current);
}
timeoutRef.current = window.setTimeout(() => {
  // action
}, delay);

// Cleanup
useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  };
}, []);
```

**Input Validation**:
Always validate data from Supabase before using:
```typescript
import { processLevelName } from '../utils/sanitize';

// Sanitize level names (removes XSS patterns)
const sanitizedName = processLevelName(userInput);

// Validate level data structure at runtime
validateLevelData(data); // Throws if invalid
```

**Error Boundaries**:
All user-facing React trees wrapped in ErrorBoundary ([ErrorBoundary.tsx](src/components/ErrorBoundary.tsx)):
- Catches rendering errors
- Shows user-friendly fallback UI
- Logs errors in development only
- Prevents entire app crash

**Type Safety**:
- No `any` types in production code
- Runtime validation for external data (Supabase)
- Null checks before numeric operations
- Proper TypeScript interfaces for all API responses

**Additional Security Considerations**:
- All security patterns documented in this file under "Security & Logging" section
- Rate limiting on save operations documented above
- Supabase RLS policies enforced at database level
- Input sanitization for all user-provided data
- Error boundaries catch and log rendering errors securely

## Mobile Optimization

**Touch Controls** ([TouchControls.tsx](src/components/TouchControls.tsx)):
- Landscape mode only (auto-detects with `useMobileDetection`)
- Left side: Left/Right movement arrows (positioned bottom-left)
- Right side: Jump button (up) + Action button (shoot/door/bomb) (positioned bottom-right)
- Positioned at bottom corners to avoid covering gameplay
- Uses `env(safe-area-inset-*)` for notch/safe area handling

**Action Button Press Duration** ([GamePage.tsx](src/pages/GamePage.tsx)):
- **Short Press** (<300ms): Shoot weapon (if has weapon and ammo > 0)
- **Long Press** (≥300ms): Open door (if near door and has key) OR place bomb (if bomb count > 0)
- Press duration tracked with timestamp on touch start/end
- Threshold: `ACTION_PRESS_THRESHOLD = 300` milliseconds

**Implementation**:
```typescript
const pressDuration = Date.now() - actionPressStart;

if (pressDuration < ACTION_PRESS_THRESHOLD) {
  // Short press - shoot
  if (gameStateRef.current.player.hasWeapon && gameStateRef.current.ammo > 0) {
    // Fire bullet
  }
} else {
  // Long press - door or bomb
  if (gameStateRef.current.keys > 0) {
    tryOpenDoor(gameStateRef.current); // Try opening nearby door first
  } else if (gameStateRef.current.bombCount > 0) {
    // Place bomb
  }
}
```

**Mobile Canvas Scaling** ([GamePage.tsx](src/pages/GamePage.tsx:156-198)):

The mobile canvas scaling is more sophisticated than standard responsive design:

```typescript
// Dynamic calculation based on viewport
const availableHeight = window.innerHeight - 110; // Account for HUD and controls
const availableWidth = window.innerWidth;

// Calculate scale factors
const scaleX = availableWidth / CANVAS_WIDTH;
const scaleY = availableHeight / CANVAS_HEIGHT;

// Use minimum scale to fit both dimensions
let scale = Math.min(scaleX, scaleY);

// Mobile multiplier for better visibility (110% larger)
if (isMobile) {
  scale *= 1.1;
}

// Enforce minimum 1.5x scale for retro pixel art aesthetic
const finalScale = Math.max(1.5, scale);
```

**Key Features**:
- **Dynamic Viewport Calculation**: Responds to window resize and DevTools viewport changes
- **110% Mobile Multiplier**: Makes game elements larger on mobile for easier touch interaction
- **Minimum 1.5x Scale**: Enforces retro pixel art aesthetic even on large screens
- **HUD Height Consideration**: Subtracts 110px for stats bar and touch controls
- **Maintains Aspect Ratio**: Uses minimum of X/Y scale to prevent distortion
- **Real-time Updates**: Recalculates on orientation change and resize events

**Mobile UI Patterns**:
- Horizontal 3-dot menu (⋯) styled like level badge
- Center-aligned close button in menu
- Full viewport usage with `overflow-hidden`
- Canvas height: `calc(100vh - 115px)` on mobile (accounting for HUD)
- Touch-friendly 44px minimum button size
- Glass morphism HUD with `backdrop-blur`

**Responsive Design** ([index.css](src/index.css)):
- `@media (max-width: 1024px)`: Tablet/mobile styles
- `@media (orientation: landscape)`: Mobile landscape mode
- `@media (pointer: coarse)`: Touch device optimizations
- Prevents text selection and tap highlighting on touch devices
- Optimized canvas rendering with `touch-action: none`

## Key Architectural Patterns

- **React Router** for route-based navigation
- **Protected routes** with role-based access control
- **Supabase RLS** for database security
- **Context API** for authentication state with token refresh UX
- **Service layer** for API abstractions
- **Error boundaries** for graceful error handling
- **Ref-based optimization** for game loop (avoid re-render issues)
- **Canvas immediate mode rendering** - Full redraw each frame
- **Immutable state updates** with spread operators
- **TypeScript strict mode** throughout with runtime validation
- **Grid-to-pixel coordinate conversion** for editor/game separation
- **Background rendering inside canvas** for proper layout
- **Fixed viewport with no scrolling** for game pages
- **Secure logging** with development-only output
- **Input sanitization** for all user inputs (XSS prevention)
- **Memory leak prevention** with proper cleanup patterns
- **Mobile-first touch controls** for landscape gameplay
- **Responsive design** with safe area handling
