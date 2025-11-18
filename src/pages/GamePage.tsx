import { useEffect, useMemo, useRef, useState } from "react";
import { useTextures } from "../hooks/useTextures";
import { useAudio } from "../hooks/useAudio";
import { drawGameCanvas } from "../canvas/gameCanvas";
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
  const { textures } = useTextures();
  const { playSound, playBackgroundMusic, stopBackgroundMusic, setMuted, enableAudio, enabled, loaded } = useAudio();

  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<KeyMap>({});
  const gameStateRef = useRef<GameState>(gameState);
  const levelCompleteRef = useRef<boolean>(false);
  const playerDeadRef = useRef<boolean>(false);

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

  useEffect(() => {
    if (!currentLevel) return;

    const canvas = gameCanvasRef.current;
    if (!canvas) return;

    // Fixed viewport size: 11 tiles wide × 7 tiles tall (3 above + player + 3 below)
    const VIEWPORT_WIDTH = 12;
    const VIEWPORT_HEIGHT = 6;
    canvas.width = VIEWPORT_WIDTH * TILE_SIZE;
    canvas.height = VIEWPORT_HEIGHT * TILE_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawGameCanvas(ctx, gameState, textures);
  }, [gameState, textures, currentLevel]);


  // Game loop
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
        }
        if (events.tookDamage) {
          playSound("stricks");
        }

        if (events.playerDied && !playerDeadRef.current) {
          playerDeadRef.current = true;
          playSound("playerOut");
          setTimeout(() => {
            if (currentLevel) {
              loadLevel(currentLevel);
            }
          }, 500);
        }

        if (events.levelComplete && !levelCompleteRef.current) {
          levelCompleteRef.current = true;
          setTimeout(() => {
            handleNextLevel();
          }, 1000);
        }

        return updatedState;
      });

      const canvas = gameCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawGameCanvas(ctx, gameStateRef.current, textures);
        }
      }

      animationId = requestAnimationFrame(update);
    };

    let animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [currentLevel, textures]);

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
      <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-4 py-2 shadow-xl flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: Title + Level */}
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
              🎮 <span>The Lost Prison</span>
            </h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs font-bold">
              Level {currentLevel?.level_number || 1}
            </div>
          </div>

          {/* Center: Compact Stats HUD */}
          <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-4 py-1.5">
            {/* Keys */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-yellow-300 text-sm">🔑</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.keys}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>

            {/* Ammo */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-blue-300 text-sm">🔫</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.ammo}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>

            {/* Health Bar */}
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-red-400 text-sm">❤️</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(gameState.health, 10) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-3 rounded-full bg-gradient-to-b from-red-400 to-red-600"
                  />
                ))}
              </div>
            </div>
            <div className="w-px h-4 bg-white/20"></div>

            {/* Bombs */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-orange-400 text-sm">💣</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.bombCount}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>

            {/* Time */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-cyan-300 text-sm">⏱️</span>
              <span className="text-white text-xs font-bold min-w-[2ch]">{gameState.time}s</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>

            {/* Deaths */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-gray-400 text-sm">💀</span>
              <span className="text-white text-xs font-bold min-w-[1ch]">{gameState.deaths}</span>
            </div>
          </div>

          {/* Right: Minimal Action Buttons */}
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
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all hover:scale-110 flex items-center justify-center"
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </div>

      {/* Game Canvas with Ambient Glow */}
      <div className="flex flex-1 items-center justify-center p-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden relative">
        {/* Subtle ambient light effect */}
        <div className="absolute inset-0 bg-gradient-radial from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>

        <canvas
          ref={gameCanvasRef}
          className="rounded-2xl border-4 border-slate-700/30 relative z-10"
          style={{
            boxShadow: `
              0 25px 70px rgba(0, 0, 0, 0.6),
              0 0 100px rgba(139, 92, 246, 0.15),
              0 0 0 1px rgba(255, 255, 255, 0.05) inset
            `,
            transform: 'scale(1.5)',
            imageRendering: 'pixelated'
          }}
        />
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
    </div>
  );
}
