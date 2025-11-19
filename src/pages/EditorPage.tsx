import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BACKGROUND_OPTIONS, TOOL_OPTIONS } from "../constants";
import { logError } from "../utils/logger";
import { useTextures } from "../hooks/useTextures";
import { drawEditorCanvas } from "../canvas/editorCanvas";
import { drawGameCanvas } from "../canvas/gameCanvas";
import {
  applyToolAtPosition,
  clearEditorState,
  createInitialEditorState,
  createLevelFromEditorState,
  fillBorder,
  resizeGrid,
  applyLevelToEditorState
} from "../state/editorState";
import {
  buildGameStateFromLevel,
  createInitialGameState,
  createPlacedBomb,
  createPlayerBullet,
  jump
} from "../state/gameState";
import { updateGameFrame, type KeyMap } from "../state/gameLoop";
import {
  MAX_LEVELS,
  MIN_GRID_HEIGHT,
  MIN_GRID_WIDTH,
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  TILE_SIZE,
  type BackgroundKey,
  type EditorState,
  type GameState,
  type Tool
} from "../types";
import {
  upsertLevel,
  getLevelsByCreator,
  getCreatorLevelByNumber,
  publishLevel,
  unpublishLevel,
  levelToLevelData
} from "../services/levelService";
import { exportLevel } from "../utils/storage";

type Mode = "editor" | "game";

interface MessageState {
  text: string;
  visible: boolean;
}

const LevelSelectOptions = Array.from({ length: MAX_LEVELS }, (_, index) => ({
  value: index + 1,
  label: `Level ${index + 1}`
}));

export default function EditorPage(): JSX.Element {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("editor");
  const [editorState, setEditorState] = useState<EditorState>(() => createInitialEditorState());
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [message, setMessage] = useState<MessageState>({ text: "", visible: false });
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const { textures } = useTextures();

  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const keysRef = useRef<KeyMap>({});
  const gameStateRef = useRef<GameState>(gameState);
  const messageTimeoutRef = useRef<number>();

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load level from Supabase on mount
  useEffect(() => {
    if (user) {
      loadLevelFromSupabase(1);
    }
  }, [user]);

  useEffect(() => {
    if (mode === "editor") {
      const canvas = editorCanvasRef.current;
      if (!canvas) return;
      canvas.width = editorState.gridWidth * TILE_SIZE;
      canvas.height = editorState.gridHeight * TILE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawEditorCanvas(ctx, editorState, textures);
    }
  }, [editorState, textures, mode]);

  useEffect(() => {
    if (mode === "game") {
      const canvas = gameCanvasRef.current;
      if (!canvas) return;
      const width = gameState.grid[0]?.length ?? editorState.gridWidth;
      const height = gameState.grid.length ?? editorState.gridHeight;
      canvas.width = width * TILE_SIZE;
      canvas.height = height * TILE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawGameCanvas(ctx, gameState, textures);
    }
  }, [gameState, textures, mode, editorState.gridHeight, editorState.gridWidth]);

  // Cleanup: Clear message timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const showMessage = (text: string) => {
    setMessage({ text, visible: true });
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleSelectTool = (tool: Tool) => {
    setEditorState((prev) => ({
      ...prev,
      selectedTool: tool
    }));
  };

  const applyToolAt = (clientX: number, clientY: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((clientY - rect.top) / TILE_SIZE);
    setEditorState((prev) => applyToolAtPosition(prev, x, y));
  };

  // Save level to Supabase
  const handleSaveLevel = async () => {
    // SECURITY: Rate limiting - prevent save spam (max once per 2 seconds)
    const now = Date.now();
    const SAVE_COOLDOWN = 2000; // 2 seconds
    if (now - lastSaveTime < SAVE_COOLDOWN) {
      showMessage("⏱️ Please wait before saving again");
      return;
    }

    if (!user) {
      showMessage("⚠️ You must be logged in to save!");
      return;
    }
    if (!editorState.playerStart) {
      showMessage("⚠️ Please set a player start position!");
      return;
    }
    if (!editorState.goal) {
      showMessage("⚠️ Please set a goal position!");
      return;
    }

    try {
      const levelData = createLevelFromEditorState(editorState);
      const savedLevel = await upsertLevel(levelData, editorState.currentLevel, user.id);
      setCurrentLevelId(savedLevel.id);
      setIsPublished(savedLevel.is_published);
      setLastSaveTime(now); // Update last save time after successful save

      if (savedLevel.is_published) {
        showMessage("✅ Level saved to cloud!");
      } else {
        showMessage("✅ Level saved! Click 📢 Publish to make it visible to players");
      }
    } catch (error: any) {
      logError("Error saving level", error);
      showMessage("❌ Failed to save level");
    }
  };

  // Publish level
  const handlePublishLevel = async () => {
    if (!currentLevelId) {
      showMessage("⚠️ Please save the level first!");
      return;
    }

    try {
      await publishLevel(currentLevelId);
      setIsPublished(true);
      showMessage("✅ Level published! Players can now see it!");
    } catch (error: any) {
      logError("Error publishing level", error);
      showMessage("❌ Failed to publish level");
    }
  };

  // Unpublish level
  const handleUnpublishLevel = async () => {
    if (!currentLevelId) {
      showMessage("⚠️ No level loaded!");
      return;
    }

    try {
      await unpublishLevel(currentLevelId);
      setIsPublished(false);
      showMessage("🔒 Level unpublished!");
    } catch (error: any) {
      logError("Error unpublishing level", error);
      showMessage("❌ Failed to unpublish level");
    }
  };

  // Load level from Supabase
  const loadLevelFromSupabase = async (levelNumber: number) => {
    if (!user) return;

    try {
      const level = await getCreatorLevelByNumber(levelNumber, user.id);
      if (level) {
        const levelData = levelToLevelData(level);
        setEditorState((prev) =>
          applyLevelToEditorState(
            {
              ...prev,
              currentLevel: levelNumber,
              name: levelData.name ?? `Level ${levelNumber}`
            },
            levelData
          )
        );
        setCurrentLevelId(level.id);
        setIsPublished(level.is_published);
        showMessage(`📂 Loaded Level ${levelNumber} from cloud`);
      } else {
        setEditorState({
          ...createInitialEditorState(),
          currentLevel: levelNumber,
          name: `Level ${levelNumber}`
        });
        setCurrentLevelId(null);
        setIsPublished(false);
        showMessage(`📝 New Level ${levelNumber}`);
      }
    } catch (error: any) {
      logError("Error loading level", error);
      showMessage("❌ Failed to load level");
    }
  };

  const handleLevelChange = (levelNumber: number) => {
    loadLevelFromSupabase(levelNumber);
  };

  const handleResizeGrid = (width: number, height: number) => {
    if (width < MIN_GRID_WIDTH || width > MAX_GRID_WIDTH || height < MIN_GRID_HEIGHT || height > MAX_GRID_HEIGHT) {
      showMessage("⚠️ Grid size must be 10-30 (width) and 10-20 (height)");
      return;
    }
    setEditorState((prev) => resizeGrid(prev, width, height));
    showMessage("✅ Grid resized!");
  };

  const handleBackgroundChange = (value: BackgroundKey) => {
    setEditorState((prev) => ({
      ...prev,
      background: value
    }));
    showMessage("🖼️ Background changed!");
  };

  const handleExportLevel = () => {
    if (!editorState.playerStart || !editorState.goal) {
      showMessage("⚠️ Please set Start and Goal before exporting!");
      return;
    }
    const levelData = createLevelFromEditorState(editorState);
    exportLevel(editorState.currentLevel, levelData);
    showMessage("✅ Level exported as JSON!");
  };

  const handleTestLevel = () => {
    if (!editorState.playerStart) {
      showMessage("⚠️ Please set the START POINT (🟢) before testing!");
      return;
    }
    if (!editorState.goal) {
      showMessage("⚠️ Please set the END POINT (⭐) before testing!");
      return;
    }
    const levelData = createLevelFromEditorState(editorState);
    const newGameState = buildGameStateFromLevel(levelData, editorState.currentLevel);
    setGameState(newGameState);
    setMode("game");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      logError("Error signing out", error);
    }
  };

  // Game loop and keyboard handlers
  useEffect(() => {
    if (mode !== "game") return;

    const update = () => {
      setGameState(prev => {
        const { state: updatedState, events } = updateGameFrame(prev, keysRef.current);

        if (events.playerDied) {
          setTimeout(() => {
            const levelData = createLevelFromEditorState(editorState);
            const newGameState = buildGameStateFromLevel(levelData, editorState.currentLevel);
            setGameState(newGameState);
          }, 500);
        }

        if (events.levelComplete) {
          setTimeout(() => {
            setMode("editor");
            showMessage("🎉 Level Complete! Returning to editor...");
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
  }, [mode, textures, editorState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "game") return;
      keysRef.current[e.key] = true;

      if (e.key === " " && gameStateRef.current.player.onGround) {
        e.preventDefault();
        setGameState(prev => {
          const next = { ...prev, player: { ...prev.player } };
          jump(next.player);
          return next;
        });
      }

      if (e.key === "f" || e.key === "F") {
        if (gameStateRef.current.player.hasWeapon && gameStateRef.current.ammo > 0) {
          setGameState(prev => ({
            ...prev,
            bullets: [...prev.bullets, createPlayerBullet(prev.player)],
            ammo: prev.ammo - 1
          }));
        }
      }

      if (e.key === "b" || e.key === "B") {
        if (gameStateRef.current.bombCount > 0) {
          setGameState(prev => ({
            ...prev,
            placedBombs: [...prev.placedBombs, createPlacedBomb(prev.player)],
            bombCount: prev.bombCount - 1
          }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (mode !== "game") return;
      keysRef.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode]);

  if (mode === "game") {
    return (
      <div className="flex h-screen flex-col bg-slate-100">
        {/* Test Mode Header */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-4 py-2 shadow-md flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
              🎮 <span>Testing Level {editorState.currentLevel}</span>
            </h1>
            <button
              onClick={() => setMode("editor")}
              className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold text-white transition-all hover:scale-105"
            >
              📝 Back to Editor
            </button>
          </div>
        </div>

        {/* Game Canvas */}
        <div className="flex flex-1 items-center justify-center p-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative">
          <div className="absolute inset-0 bg-gradient-radial from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>
          <canvas
            ref={gameCanvasRef}
            className="rounded-2xl border-4 border-slate-700/30 shadow-2xl relative z-10"
            style={{
              boxShadow: `
                0 25px 70px rgba(0, 0, 0, 0.6),
                0 0 100px rgba(139, 92, 246, 0.15),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset
              `
            }}
          />
        </div>

        {/* Stats Bar */}
        <div className="bg-slate-800 px-4 py-2 shadow-lg">
          <div className="flex items-center justify-center gap-6 text-white text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-red-400">❤️</span>
              <span className="font-bold">{gameState.health}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">🔑</span>
              <span className="font-bold">{gameState.keys}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400">🔫</span>
              <span className="font-bold">{gameState.ammo}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400">💣</span>
              <span className="font-bold">{gameState.bombCount}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400">⏱️</span>
              <span className="font-bold">{gameState.time}s</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">💀</span>
              <span className="font-bold">{gameState.deaths}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Modern Header Bar */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-4 py-2 shadow-md flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
            🎮 <span>The Lost Prison</span>
            <span className="text-xs font-normal text-white/60">Editor</span>
          </h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1">
              <span className="text-sm font-medium text-white">{profile?.username}</span>
              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-slate-900">
                ADMIN
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg bg-red-500/90 hover:bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:scale-105"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {message.visible && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-slate-800 px-6 py-3 text-white shadow-xl">
          {message.text}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left Sidebar - Settings */}
        <div className="w-64 overflow-y-auto rounded-xl bg-white p-3 shadow-lg">
          <h3 className="mb-3 pb-2 border-b-2 border-slate-100 flex items-center gap-2 text-sm font-bold text-purple-600">
            <span>⚙️</span>
            <span>Settings</span>
          </h3>

          <div className="space-y-3">
            {/* Level Section */}
            <div className="pb-3 border-b border-slate-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <span>📋</span>
                <span>LEVEL</span>
              </label>
              <select
                value={editorState.currentLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
                className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm focus:border-purple-400 focus:outline-none"
              >
                {LevelSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="pb-3 border-b border-slate-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <span>✏️</span>
                <span>LEVEL NAME</span>
              </label>
              <input
                type="text"
                value={editorState.name}
                onChange={(e) => {
                  // SECURITY: Sanitize and validate input
                  const sanitized = e.target.value
                    .slice(0, 100) // Max 100 characters
                    .replace(/[<>]/g, ''); // Remove potential XSS characters
                  setEditorState(prev => ({ ...prev, name: sanitized }));
                }}
                maxLength={100}
                className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm focus:border-purple-400 focus:outline-none"
                placeholder="Level Name"
              />
            </div>

            {/* Grid Section */}
            <div className="pb-3 border-b border-slate-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <span>📐</span>
                <span>GRID SIZE</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editorState.gridWidth}
                  onChange={(e) => handleResizeGrid(Number(e.target.value), editorState.gridHeight)}
                  className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm focus:border-purple-400 focus:outline-none"
                  min={MIN_GRID_WIDTH}
                  max={MAX_GRID_WIDTH}
                />
                <span className="flex items-center text-slate-400 font-bold">×</span>
                <input
                  type="number"
                  value={editorState.gridHeight}
                  onChange={(e) => handleResizeGrid(editorState.gridWidth, Number(e.target.value))}
                  className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm focus:border-purple-400 focus:outline-none"
                  min={MIN_GRID_HEIGHT}
                  max={MAX_GRID_HEIGHT}
                />
              </div>
            </div>

            {/* Background Section */}
            <div className="pb-3 border-b border-slate-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <span>🖼️</span>
                <span>BACKGROUND</span>
              </label>
              <select
                value={editorState.background}
                onChange={(e) => handleBackgroundChange(e.target.value as BackgroundKey)}
                className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm focus:border-purple-400 focus:outline-none"
              >
                {BACKGROUND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions Section */}
          <div className="mt-3 pt-3 border-t-2 border-slate-100">
            <label className="flex items-center gap-1.5 text-xs font-bold text-purple-600 mb-2">
              <span>⚡</span>
              <span>ACTIONS</span>
            </label>
            <div className="space-y-1.5">
              <button
                onClick={handleSaveLevel}
                className="w-full rounded-lg bg-green-500 hover:bg-green-600 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
              >
                💾 Save Level
              </button>

              {isPublished ? (
                <button
                  onClick={handleUnpublishLevel}
                  className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
                >
                  🔒 Unpublish
                </button>
              ) : (
                <button
                  onClick={handlePublishLevel}
                  className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!currentLevelId}
                >
                  📢 Publish Level
                </button>
              )}

              {/* Status Badge */}
              <div className={`text-xs font-semibold text-center py-2 rounded-lg ${isPublished ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                {isPublished ? '✅ Published' : '⚠️ Not Published'}
              </div>

              <button
                onClick={handleTestLevel}
                className="w-full rounded-lg bg-purple-500 hover:bg-purple-600 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
              >
                ▶️ Test Level
              </button>

              <button
                onClick={() => setEditorState(clearEditorState(editorState))}
                className="w-full rounded-lg bg-red-500 hover:bg-red-600 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
              >
                🗑️ Clear All
              </button>

              <button
                onClick={() => setEditorState(fillBorder(editorState))}
                className="w-full rounded-lg bg-slate-600 hover:bg-slate-700 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
              >
                🔲 Add Border
              </button>

              <button
                onClick={handleExportLevel}
                className="w-full rounded-lg bg-slate-400 hover:bg-slate-500 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
              >
                📥 Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-xl bg-white p-3 shadow-lg flex flex-col h-full">
            {/* Canvas Header with Zoom Controls */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-100">
              <h3 className="flex items-center gap-2 text-sm font-bold text-purple-600">
                <span>📦</span>
                <span>Level Canvas</span>
                <span className="text-xs font-normal text-slate-500">
                  ({editorState.gridWidth} × {editorState.gridHeight})
                </span>
              </h3>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-2">View:</span>
                <button
                  onClick={() => {
                    const canvas = editorCanvasRef.current;
                    if (canvas) {
                      const currentScale = canvas.style.transform ? parseFloat(canvas.style.transform.replace(/[^0-9.]/g, '')) : 1;
                      const newScale = currentScale >= 1.5 ? 2 : 1.5;
                      canvas.style.transform = `scale(${newScale})`;
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700 transition-all"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    const canvas = editorCanvasRef.current;
                    if (canvas) {
                      const currentScale = canvas.style.transform ? parseFloat(canvas.style.transform.replace(/[^0-9.]/g, '')) : 1;
                      const newScale = currentScale <= 0.5 ? 0.25 : 0.5;
                      canvas.style.transform = `scale(${newScale})`;
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700 transition-all"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  onClick={() => {
                    const canvas = editorCanvasRef.current;
                    if (canvas) {
                      // Get canvas dimensions
                      const canvasWidth = canvas.width;
                      const canvasHeight = canvas.height;

                      // Get container dimensions (parent container)
                      const container = canvas.parentElement;
                      if (container) {
                        const containerWidth = container.clientWidth - 32; // Account for padding
                        const containerHeight = container.clientHeight - 32;

                        // Calculate scale to fit both width and height
                        const scaleX = containerWidth / canvasWidth;
                        const scaleY = containerHeight / canvasHeight;
                        const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

                        canvas.style.transform = `scale(${fitScale})`;
                      }
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-purple-100 hover:bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-700 transition-all"
                  title="Fit to View"
                >
                  ⊡
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 flex justify-center items-center overflow-auto bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-lg p-2 relative">
              {/* Ambient glow effect */}
              <div className="absolute inset-0 bg-gradient-radial from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>

              <canvas
                ref={editorCanvasRef}
                className="rounded-xl border-4 border-slate-700/30 shadow-2xl relative z-10 transition-transform"
                style={{
                  boxShadow: `
                    0 20px 60px rgba(0, 0, 0, 0.6),
                    0 0 80px rgba(139, 92, 246, 0.15),
                    0 0 0 1px rgba(255, 255, 255, 0.05) inset
                  `
                }}
                onMouseDown={(e) => {
                  drawingRef.current = true;
                  applyToolAt(e.clientX, e.clientY, e.currentTarget);
                }}
                onMouseMove={(e) => {
                  if (drawingRef.current) {
                    applyToolAt(e.clientX, e.clientY, e.currentTarget);
                  }
                }}
                onMouseUp={() => {
                  drawingRef.current = false;
                }}
                onMouseLeave={() => {
                  drawingRef.current = false;
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Tools */}
        <div className="w-64 overflow-y-auto rounded-xl bg-white p-3 shadow-lg">
          <h3 className="mb-3 pb-2 border-b-2 border-slate-100 flex items-center gap-2 text-sm font-bold text-purple-600">
            <span>🎨</span>
            <span>Tool Palette</span>
          </h3>

          <div className="space-y-3">
            {TOOL_OPTIONS.map((section) => (
              <div key={section.label} className="pb-3 border-b border-slate-100 last:border-0">
                <p className="mb-2 text-xs font-bold text-slate-600 uppercase">{section.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {section.tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleSelectTool(tool.id as Tool)}
                      className={`rounded-lg border-2 p-2.5 text-center transition-all ${
                        editorState.selectedTool === tool.id
                          ? "border-purple-500 bg-purple-50 shadow-sm scale-105"
                          : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-2xl">{tool.icon}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-700">{tool.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
