import { useEffect, useMemo, useRef, useState } from "react";
import { useTextures } from "../hooks/useTextures";
import { useAudio } from "../hooks/useAudio";
import { useMobileDetection } from "../hooks/useMobileDetection";
import { drawStaticLayer, drawDynamicLayer, calculateCameraPosition } from "../canvas/layeredGameCanvas";
import {
  buildGameStateFromLevel,
  createInitialGameState,
  createPlacedBomb,
  createPlayerBullet,
  jump
} from "../state/gameState";
import { updateGameFrame, tryOpenDoor, type KeyMap } from "../state/gameLoop";
import { TILE_SIZE, type GameState } from "../types";
import { getPublishedLevels, levelToLevelData } from "../services/levelService";
import type { Database } from "../types/database.types";
import LevelSelector from "../components/LevelSelector";
import { TouchControls } from "../components/TouchControls";
import { logError } from "../utils/logger";

type Level = Database['public']['Tables']['levels']['Row'];

export default function GamePage(): JSX.Element {
  const [publishedLevels, setPublishedLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [loading, setLoading] = useState(true);
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1.5); // Default desktop scale
  const [showTouchControls, setShowTouchControls] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [actionPressStart, setActionPressStart] = useState<number | null>(null);
  const [staticLayerHash, setStaticLayerHash] = useState<string>("");
  const { textures } = useTextures();
  const { playSound, playBackgroundMusic, stopBackgroundMusic, setMuted, enableAudio, enabled, loaded } = useAudio();
  const { isMobileLandscape } = useMobileDetection();

  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<KeyMap>({});
  const gameStateRef = useRef<GameState>(gameState);
  const levelCompleteRef = useRef<boolean>(false);
  const playerDeadRef = useRef<boolean>(false);
  const playerDeathTimeoutRef = useRef<number>();
  const levelCompleteTimeoutRef = useRef<number>();
  const lastCameraXRef = useRef<number>(0);
  const lastCameraYRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load published levels on mount
  useEffect(() => {
    loadPublishedLevels();
  }, []);

  // Prevent page scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Auto-enable audio on first user interaction
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!enabled) {
        await enableAudio();
        if (currentLevel) {
          playBackgroundMusic();
        }
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [enabled, currentLevel, enableAudio, playBackgroundMusic]);

  // Auto-play music when audio is enabled and level is loaded
  useEffect(() => {
    if (enabled && currentLevel) {
      playBackgroundMusic();
    }
  }, [enabled, currentLevel, playBackgroundMusic]);

  const loadPublishedLevels = async () => {
    try {
      setLoading(true);
      const levels = await getPublishedLevels();
      setPublishedLevels(levels);

      // Auto-load first level if available
      if (levels.length > 0) {
        loadLevel(levels[0]);
      }
    } catch (error) {
      logError("Failed to load levels", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLevel = (level: Level) => {
    setCurrentLevel(level);
    setShowLevelSelector(false);
    const levelData = levelToLevelData(level);
    const newGameState = buildGameStateFromLevel(levelData, level.level_number);
    setGameState(newGameState);
    levelCompleteRef.current = false;
    playerDeadRef.current = false;
    // Force static layer re-render by updating hash
    setStaticLayerHash(level.id + "_" + Date.now());
    // Start background music if audio is already enabled
    if (enabled) {
      playBackgroundMusic();
    }
  };

  const handleNextLevel = () => {
    if (!currentLevel) return;
    const currentIndex = publishedLevels.findIndex(l => l.id === currentLevel.id);
    if (currentIndex < publishedLevels.length - 1) {
      loadLevel(publishedLevels[currentIndex + 1]);
    }
  };

  const handlePrevLevel = () => {
    if (!currentLevel) return;
    const currentIndex = publishedLevels.findIndex(l => l.id === currentLevel.id);
    if (currentIndex > 0) {
      loadLevel(publishedLevels[currentIndex - 1]);
    }
  };

  const handleRestart = () => {
    if (currentLevel) {
      loadLevel(currentLevel);
    }
  };

  // Responsive touch controls visibility
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setShowTouchControls(width < 1024); // Show on mobile/tablet, hide on desktop
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamic canvas scaling for mobile
  useEffect(() => {
    const calculateCanvasScale = () => {
      const isMobile = window.innerWidth < 1024;

      if (!isMobile) {
        setCanvasScale(1.5); // Desktop default - always reset to 1.5
        return;
      }

      // Mobile scale calculation
      const hudHeight = 40;  // Absolute minimal HUD
      const controlsHeight = 75; // Ultra-compact controls (65px buttons + minimal gaps)

      // Use FULL viewport with no padding
      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight - hudHeight - controlsHeight;

      // Calculate tile-based scale (12x6 tiles)
      const VIEWPORT_WIDTH = 12;
      const VIEWPORT_HEIGHT = 6;
      const baseCanvasWidth = VIEWPORT_WIDTH * TILE_SIZE; // 480px
      const baseCanvasHeight = VIEWPORT_HEIGHT * TILE_SIZE; // 240px

      const scaleX = availableWidth / baseCanvasWidth;
      const scaleY = availableHeight / baseCanvasHeight;

      // Use minimum to maintain aspect ratio but apply 110% multiplier for extra size
      const optimalScale = Math.min(scaleX, scaleY) * 1.1;

      // Round to 2 decimals
      const scale = Math.round(optimalScale * 100) / 100;

      setCanvasScale(Math.max(scale, 1.5)); // Minimum 1.5x scale
    };

    // Initial calculation
    calculateCanvasScale();

    // Recalculate on window resize (handles DevTools viewport changes)
    window.addEventListener("resize", calculateCanvasScale);
    return () => window.removeEventListener("resize", calculateCanvasScale);
  }, [isMobileLandscape]);

  // Render static layer once when level loads or terrain changes
  useEffect(() => {
    if (!currentLevel) return;

    const staticCanvas = staticCanvasRef.current;
    if (!staticCanvas) return;

    const VIEWPORT_WIDTH = 12;
    const VIEWPORT_HEIGHT = 6;
    staticCanvas.width = VIEWPORT_WIDTH * TILE_SIZE;
    staticCanvas.height = VIEWPORT_HEIGHT * TILE_SIZE;

    const ctx = staticCanvas.getContext("2d");
    if (!ctx) return;

    const { cameraX, cameraY } = calculateCameraPosition(
      gameState,
      staticCanvas.width,
      staticCanvas.height
    );

    // Store camera position for comparison
    lastCameraXRef.current = cameraX;
    lastCameraYRef.current = cameraY;

    drawStaticLayer(ctx, gameState, textures, cameraX, cameraY);
  }, [staticLayerHash, textures, currentLevel]);

  // Initialize dynamic canvas dimensions
  useEffect(() => {
    if (!currentLevel) return;

    const dynamicCanvas = dynamicCanvasRef.current;
    if (!dynamicCanvas) return;

    const VIEWPORT_WIDTH = 12;
    const VIEWPORT_HEIGHT = 6;
    dynamicCanvas.width = VIEWPORT_WIDTH * TILE_SIZE;
    dynamicCanvas.height = VIEWPORT_HEIGHT * TILE_SIZE;
  }, [currentLevel]);


  // Game loop - LAYERED RENDERING OPTIMIZATION
  // Static layer (background + terrain) only re-renders when camera moves >5px or terrain changes
  // Dynamic layer (player, monsters, bullets) renders every frame
  useEffect(() => {
    if (!currentLevel) return;

    const update = () => {
      setGameState(prev => {
        const { state: updatedState, events } = updateGameFrame(prev, keysRef.current);

        // Play sound effects based on events
        if (events.itemCollected) {
          playSound("itemPick");
        }
        if (events.bombExploded) {
          playSound("boom");
          // Re-render static layer when terrain changes (bombs destroy blocks)
          setStaticLayerHash(currentLevel.id + "_" + Date.now());
        }
        if (events.tookDamage) {
          playSound("stricks");
        }

        if (events.playerDied && !playerDeadRef.current) {
          playerDeadRef.current = true;
          playSound("playerOut");
          // Clear any existing timeout before setting new one
          if (playerDeathTimeoutRef.current) {
            window.clearTimeout(playerDeathTimeoutRef.current);
          }
          playerDeathTimeoutRef.current = window.setTimeout(() => {
            if (currentLevel) {
              loadLevel(currentLevel);
            }
          }, 500);
        }

        if (events.levelComplete && !levelCompleteRef.current) {
          levelCompleteRef.current = true;
          // Clear any existing timeout before setting new one
          if (levelCompleteTimeoutRef.current) {
            window.clearTimeout(levelCompleteTimeoutRef.current);
          }
          levelCompleteTimeoutRef.current = window.setTimeout(() => {
            handleNextLevel();
          }, 1000);
        }

        return updatedState;
      });

      // Render dynamic layer every frame
      const dynamicCanvas = dynamicCanvasRef.current;
      const staticCanvas = staticCanvasRef.current;
      if (dynamicCanvas) {
        const ctx = dynamicCanvas.getContext("2d");
        if (ctx) {
          const { cameraX, cameraY } = calculateCameraPosition(
            gameStateRef.current,
            dynamicCanvas.width,
            dynamicCanvas.height
          );

          // OPTIMIZATION: Re-render static layer only if camera moved significantly (>5 pixels)
          // This reduces rendering work from 60 FPS to ~10-15 FPS for static elements
          const cameraDeltaX = Math.abs(cameraX - lastCameraXRef.current);
          const cameraDeltaY = Math.abs(cameraY - lastCameraYRef.current);
          if ((cameraDeltaX > 5 || cameraDeltaY > 5) && staticCanvas) {
            const staticCtx = staticCanvas.getContext("2d");
            if (staticCtx) {
              drawStaticLayer(staticCtx, gameStateRef.current, textures, cameraX, cameraY);
              lastCameraXRef.current = cameraX;
              lastCameraYRef.current = cameraY;
            }
          }

          // Always render dynamic layer (player, monsters, bullets, animations)
          drawDynamicLayer(ctx, gameStateRef.current, textures, cameraX, cameraY);
        }
      }

      animationId = requestAnimationFrame(update);
    };

    let animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [currentLevel, textures]);

  // Cleanup: Clear timeouts on unmount to prevent race conditions
  useEffect(() => {
    return () => {
      if (playerDeathTimeoutRef.current) {
        window.clearTimeout(playerDeathTimeoutRef.current);
      }
      if (levelCompleteTimeoutRef.current) {
        window.clearTimeout(levelCompleteTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;

      if (e.key === " " && gameStateRef.current.player.onGround) {
        e.preventDefault();
        playSound("jump");
        setGameState(prev => {
          const next = { ...prev, player: { ...prev.player } };
          jump(next.player);
          return next;
        });
      }

      if (e.key === "f" || e.key === "F") {
        if (gameStateRef.current.player.hasWeapon && gameStateRef.current.ammo > 0) {
          playSound("gunShoot");
          setGameState(prev => ({
            ...prev,
            bullets: [...prev.bullets, createPlayerBullet(prev.player)],
            ammo: prev.ammo - 1
          }));
        }
      }

      if (e.key === "b" || e.key === "B") {
        if (gameStateRef.current.bombCount > 0) {
          playSound("itemPick");
          setGameState(prev => ({
            ...prev,
            placedBombs: [...prev.placedBombs, createPlacedBomb(prev.player)],
            bombCount: prev.bombCount - 1
          }));
        }
      }

      if (e.key === "k" || e.key === "K") {
        setGameState(prev => {
          const next = { ...prev };
          const opened = tryOpenDoor(next);
          if (opened) {
            playSound("itemPick"); // Play sound when door is opened
          }
          return next;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Touch control handlers for mobile
  const handleLeftStart = () => {
    keysRef.current["ArrowLeft"] = true;
  };

  const handleLeftEnd = () => {
    keysRef.current["ArrowLeft"] = false;
  };

  const handleRightStart = () => {
    keysRef.current["ArrowRight"] = true;
  };

  const handleRightEnd = () => {
    keysRef.current["ArrowRight"] = false;
  };

  const handleJump = () => {
    if (gameStateRef.current.player.onGround) {
      playSound("jump");
      setGameState(prev => {
        const next = { ...prev, player: { ...prev.player } };
        jump(next.player);
        return next;
      });
    }
  };

  // Action button: Long press detection for mobile
  const handleActionStart = () => {
    setActionPressStart(Date.now());
  };

  const handleActionEnd = () => {
    if (actionPressStart === null) return;

    const pressDuration = Date.now() - actionPressStart;
    const state = gameStateRef.current;
    setActionPressStart(null);

    // Long press (>= 300ms): Try door first, then bomb
    if (pressDuration >= 300) {
      // Try to open door if near one and has key
      if (state.keys > 0) {
        setGameState(prev => {
          const next = { ...prev };
          const opened = tryOpenDoor(next);
          if (opened) {
            playSound("itemPick");
            return next;
          }
          // If door didn't open, try bomb instead
          if (state.bombCount > 0) {
            playSound("itemPick");
            return {
              ...next,
              placedBombs: [...next.placedBombs, createPlacedBomb(next.player)],
              bombCount: next.bombCount - 1
            };
          }
          return next;
        });
      } else if (state.bombCount > 0) {
        // No key, just place bomb
        playSound("itemPick");
        setGameState(prev => ({
          ...prev,
          placedBombs: [...prev.placedBombs, createPlacedBomb(prev.player)],
          bombCount: prev.bombCount - 1
        }));
      }
    } else {
      // Short press (< 300ms): Shoot
      if (state.player.hasWeapon && state.ammo > 0) {
        playSound("gunShoot");
        setGameState(prev => ({
          ...prev,
          bullets: [...prev.bullets, createPlayerBullet(prev.player)],
          ammo: prev.ammo - 1
        }));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        <div className="text-center">
          <div className="mb-4 text-6xl animate-bounce">🎮</div>
          <p className="text-xl font-semibold text-slate-700">Loading levels...</p>
        </div>
      </div>
    );
  }

  if (publishedLevels.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        <div className="max-w-2xl text-center p-8">
          <div className="mb-6 text-8xl">🎮</div>
          <h1 className="mb-4 text-4xl font-bold bg-gradient-to-r from-brandStart to-brandEnd bg-clip-text text-transparent">
            The Lost Prison
          </h1>
          <p className="mb-6 text-xl text-slate-600">
            Welcome to the game! No published levels are available yet.
          </p>
          <div className="rounded-2xl bg-yellow-50 border-2 border-yellow-200 p-6">
            <p className="text-lg font-semibold text-yellow-800 mb-2">
              📦 No levels available
            </p>
            <p className="text-yellow-700">
              An admin needs to create and publish levels first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showLevelSelector) {
    return (
      <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-5xl font-bold bg-gradient-to-r from-brandStart to-brandEnd bg-clip-text text-transparent">
              🎮 The Lost Prison
            </h1>
            <p className="text-xl text-slate-600">Choose a level to play</p>
          </div>

          <LevelSelector
            onSelectLevel={loadLevel}
            currentLevelId={currentLevel?.id}
          />

          <div className="mt-8 text-center">
            <button
              onClick={() => setShowLevelSelector(false)}
              className="rounded-lg bg-gradient-to-br from-brandStart to-brandEnd px-6 py-3 font-semibold text-white hover:shadow-lg transition"
            >
              ← Back to Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 overflow-hidden">
      {/* Modern Top Bar */}
      <div className={`flex-shrink-0 ${
        isMobileLandscape
          ? 'px-2 py-1 absolute top-0 left-0 right-0 z-50'
          : 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 shadow-xl px-4 py-2'
      }`}
        style={isMobileLandscape ? {
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))'
        } : undefined}
      >
        <div className={`flex items-center ${
          isMobileLandscape ? 'justify-center mobile-hud-text-shadow' : 'justify-between'
        }`}>
          {/* Desktop: Title + Level */}
          {!isMobileLandscape && (
            <div className="flex items-center gap-3">
              <h1 className="text-white font-bold tracking-tight flex items-center gap-1 text-lg">
                🎮 <span>The Lost Prison</span>
              </h1>
              <div className="bg-white/20 backdrop-blur-sm rounded-full text-white font-bold px-3 py-1 text-xs">
                Lv {currentLevel?.level_number || 1}
              </div>
            </div>
          )}

          {/* Center: Level + Compact Stats HUD + Menu Button */}
          <div className={`flex items-center ${isMobileLandscape ? 'gap-2' : 'gap-0'}`}>
            {/* Mobile: Level indicator */}
            {isMobileLandscape && (
              <div className="bg-white/20 backdrop-blur-sm rounded-full text-white font-bold px-2 py-0.5 text-xs">
                Lv {currentLevel?.level_number || 1}
              </div>
            )}

            {/* Stats HUD */}
            <div className={`flex items-center bg-black/20 backdrop-blur-sm rounded-full ${
              isMobileLandscape ? 'gap-0.5 px-2 py-1' : 'gap-1 px-4 py-1.5'
            }`}>
            {/* Keys */}
            <div className={`flex items-center gap-0.5 ${isMobileLandscape ? 'px-1' : 'px-2'}`}>
              <span className={isMobileLandscape ? 'text-xs' : 'text-sm'}>🔑</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.keys}</span>
            </div>
            <div className={`w-px bg-white/20 ${isMobileLandscape ? 'h-3' : 'h-4'}`}></div>

            {/* Ammo */}
            <div className={`flex items-center gap-0.5 ${isMobileLandscape ? 'px-1' : 'px-2'}`}>
              <span className={isMobileLandscape ? 'text-xs' : 'text-sm'}>🔫</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.ammo}</span>
            </div>
            <div className={`w-px bg-white/20 ${isMobileLandscape ? 'h-3' : 'h-4'}`}></div>

            {/* Health Bar */}
            <div className={`flex items-center ${isMobileLandscape ? 'gap-1 px-1' : 'gap-1.5 px-2'}`}>
              <span className={isMobileLandscape ? 'text-xs' : 'text-sm'}>❤️</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(gameState.health, 10) }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full bg-gradient-to-b from-red-400 to-red-600 ${
                      isMobileLandscape ? 'w-1 h-2' : 'w-1.5 h-3'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className={`w-px bg-white/20 ${isMobileLandscape ? 'h-3' : 'h-4'}`}></div>

            {/* Bombs */}
            <div className={`flex items-center gap-0.5 ${isMobileLandscape ? 'px-1' : 'px-2'}`}>
              <span className={isMobileLandscape ? 'text-xs' : 'text-sm'}>💣</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.bombCount}</span>
            </div>
            {!isMobileLandscape && <div className="w-px h-4 bg-white/20"></div>}

            {/* Time - Hide on mobile */}
            {!isMobileLandscape && (
              <div className="flex items-center gap-1 px-2">
                <span className="text-cyan-300 text-sm">⏱️</span>
                <span className="text-white text-xs font-bold min-w-[2ch]">{gameState.time}s</span>
              </div>
            )}
            {!isMobileLandscape && <div className="w-px h-4 bg-white/20"></div>}

            {/* Deaths - Hide on mobile */}
            {!isMobileLandscape && (
              <div className="flex items-center gap-1 px-2">
                <span className="text-gray-400 text-sm">💀</span>
                <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.deaths}</span>
              </div>
            )}
            </div>

            {/* Mobile: Menu Button (next to stats) */}
            {isMobileLandscape && (
              <button
                onClick={() => setShowMobileMenu(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg text-white font-bold px-2 py-0.5 text-xs transition-all inline-flex items-center justify-center ml-1 hover:bg-white/30"
                style={{ minHeight: 'auto', minWidth: 'auto' }}
                title="Menu"
              >
                ⋯
              </button>
            )}
          </div>

          {/* Desktop: Action Buttons */}
          {!isMobileLandscape && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRestart}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center"
                title="Restart Level"
              >
                🔄
              </button>
              <button
                onClick={handlePrevLevel}
                disabled={!currentLevel || publishedLevels.findIndex(l => l.id === currentLevel.id) === 0}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Previous Level"
              >
                ⏮️
              </button>
              <button
                onClick={handleNextLevel}
                disabled={!currentLevel || publishedLevels.findIndex(l => l.id === currentLevel.id) === publishedLevels.length - 1}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Next Level"
              >
                ⏭️
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button
                onClick={() => setShowControls(!showControls)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center"
                title="Toggle Controls"
              >
                🎮
              </button>
              <button
                onClick={() => setShowLevelSelector(true)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center"
                title="Level Select"
              >
                📋
              </button>
              <button
                onClick={() => {
                  const newMutedState = !isMuted;
                  setIsMuted(newMutedState);
                setMuted(newMutedState);
              }}
              className={`rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 flex items-center justify-center ${
                isMobileLandscape ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
              }`}
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Popup */}
      {showMobileMenu && isMobileLandscape && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Dark overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          ></div>

          {/* Menu popup - Compact */}
          <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden" style={{ width: '220px' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2">
              <h3 className="text-white font-bold text-base">Menu</h3>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <button
                onClick={() => {
                  handleRestart();
                  setShowMobileMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="text-lg">🔄</span>
                <span className="text-sm text-slate-700">Restart Level</span>
              </button>

              <button
                onClick={() => {
                  handlePrevLevel();
                  setShowMobileMenu(false);
                }}
                disabled={!currentLevel || publishedLevels.findIndex(l => l.id === currentLevel.id) === 0}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-lg">⏮️</span>
                <span className="text-sm text-slate-700">Previous Level</span>
              </button>

              <button
                onClick={() => {
                  handleNextLevel();
                  setShowMobileMenu(false);
                }}
                disabled={!currentLevel || publishedLevels.findIndex(l => l.id === currentLevel.id) === publishedLevels.length - 1}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-lg">⏭️</span>
                <span className="text-sm text-slate-700">Next Level</span>
              </button>

              <button
                onClick={() => {
                  const newMutedState = !isMuted;
                  setIsMuted(newMutedState);
                  setMuted(newMutedState);
                  setShowMobileMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="text-lg">{isMuted ? "🔇" : "🔊"}</span>
                <span className="text-sm text-slate-700">Sound {isMuted ? "Off" : "On"}</span>
              </button>

              <div className="h-px bg-slate-200 my-1"></div>

              <button
                onClick={() => setShowMobileMenu(false)}
                className="w-full px-4 py-2 text-center hover:bg-slate-100 rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                <span className="text-lg">✕</span>
                <span className="text-sm text-slate-700">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Canvas with Ambient Glow */}
      <div className={`flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden relative ${
        showTouchControls ? 'p-0 h-screen' : 'flex-1 p-6'
      }`}>
        {/* Subtle ambient light effect */}
        <div className="absolute inset-0 bg-gradient-radial from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>

        {/* Layered Canvas System */}
        <div
          className="relative rounded-2xl border-4 border-slate-700/30 z-10"
          style={{
            boxShadow: `
              0 25px 70px rgba(0, 0, 0, 0.6),
              0 0 100px rgba(139, 92, 246, 0.15),
              0 0 0 1px rgba(255, 255, 255, 0.05) inset
            `,
            transform: `scale(${canvasScale})`,
            imageRendering: 'pixelated',
            width: '480px',
            height: '240px'
          }}
        >
          {/* Static Layer - Background and terrain */}
          <canvas
            ref={staticCanvasRef}
            className="absolute top-0 left-0"
            style={{
              imageRendering: 'pixelated',
              zIndex: 1
            }}
          />
          {/* Dynamic Layer - Player, monsters, bullets, animations */}
          <canvas
            ref={dynamicCanvasRef}
            className="absolute top-0 left-0"
            style={{
              imageRendering: 'pixelated',
              zIndex: 2
            }}
          />
        </div>
      </div>

      {/* Collapsible Controls */}
      {showControls && (
        <div className="bg-white border-t-4 border-brandStart shadow-lg flex-shrink-0">
          <div className="mx-auto max-w-4xl px-6 py-4 overflow-hidden">
            <h3 className="mb-3 text-lg font-bold text-slate-800">🎮 Game Controls</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">← →</kbd>
                <span>or</span>
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">A D</kbd>
                <span className="font-medium">Move left/right</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">SPACE</kbd>
                <span className="font-medium">Jump</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">F</kbd>
                <span className="font-medium">Shoot weapon (when collected)</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">B</kbd>
                <span className="font-medium">Place bomb (destroys stone blocks)</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-3 py-2 font-mono text-sm font-bold">K</kbd>
                <span className="font-medium">Open door (requires key)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls - Only visible on mobile/tablet (<1024px) */}
      {showTouchControls && (
        <TouchControls
          onLeftStart={handleLeftStart}
          onLeftEnd={handleLeftEnd}
          onRightStart={handleRightStart}
          onRightEnd={handleRightEnd}
          onJump={handleJump}
          onActionStart={handleActionStart}
          onActionEnd={handleActionEnd}
        />
      )}
    </div>
  );
}
