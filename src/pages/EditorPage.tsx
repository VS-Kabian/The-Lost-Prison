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
      showMessage("✅ Level saved to cloud!");
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
        <div className="flex items-center justify-between bg-gradient-to-br from-brandStart to-brandEnd px-6 py-3 text-white shadow-lg">
          <h1 className="text-2xl font-bold">🎮 Testing Level</h1>
          <button
            onClick={() => setMode("editor")}
            className="rounded-lg bg-white/20 px-4 py-2 font-semibold hover:bg-white/30"
          >
            📝 Back to Editor
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center p-4 bg-slate-900">
          <canvas ref={gameCanvasRef} className="border-4 border-slate-800 shadow-2xl" />
        </div>

        <div className="flex items-center justify-around bg-slate-800 px-6 py-3 text-white">
          <div>❤️ Health: {gameState.health}/{gameState.maxHealth}</div>
          <div>🔑 Keys: {gameState.keys}</div>
          <div>🔫 Ammo: {gameState.ammo}</div>
          <div>💣 Bombs: {gameState.bombCount}</div>
          <div>⏱️ Time: {gameState.time}s</div>
          <div>💀 Deaths: {gameState.deaths}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Header with Sign Out */}
      <div className="flex items-center justify-between bg-gradient-to-br from-brandStart to-brandEnd px-6 py-3 text-white shadow-lg">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <span>🎮</span>
          <span>The Lost Prison</span>
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5">
            <span className="text-sm font-medium">{profile?.username}</span>
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-slate-900">
              ADMIN
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg bg-red-500 px-4 py-2 font-semibold hover:bg-red-600"
          >
            Sign Out
          </button>
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
        <div className="w-64 space-y-4 overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brandStart">
              <span>⚙️</span>
              <span>Settings</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">LEVEL</label>
                <select
                  value={editorState.currentLevel}
                  onChange={(e) => handleLevelChange(Number(e.target.value))}
                  className="mt-1 w-full rounded border-2 border-slate-200 p-2 text-sm"
                >
                  {LevelSelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">LEVEL NAME</label>
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
                  className="mt-1 w-full rounded border-2 border-slate-200 p-2 text-sm"
                  placeholder="Level Name (max 100 chars)"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">GRID SIZE</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    value={editorState.gridWidth}
                    onChange={(e) => handleResizeGrid(Number(e.target.value), editorState.gridHeight)}
                    className="w-full rounded border-2 border-slate-200 p-2 text-sm"
                    min={MIN_GRID_WIDTH}
                    max={MAX_GRID_WIDTH}
                  />
                  <span className="flex items-center text-slate-400">×</span>
                  <input
                    type="number"
                    value={editorState.gridHeight}
                    onChange={(e) => handleResizeGrid(editorState.gridWidth, Number(e.target.value))}
                    className="w-full rounded border-2 border-slate-200 p-2 text-sm"
                    min={MIN_GRID_HEIGHT}
                    max={MAX_GRID_HEIGHT}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">BACKGROUND</label>
                <select
                  value={editorState.background}
                  onChange={(e) => handleBackgroundChange(e.target.value as BackgroundKey)}
                  className="mt-1 w-full rounded border-2 border-slate-200 p-2 text-sm"
                >
                  {BACKGROUND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-brandStart">ACTIONS</h3>
            <div className="space-y-2">
              <button
                onClick={handleSaveLevel}
                className="w-full rounded-lg bg-green-500 py-2 text-sm font-semibold text-white hover:bg-green-600"
              >
                💾 Save
              </button>

              {isPublished ? (
                <button
                  onClick={handleUnpublishLevel}
                  className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  🔒 Unpublish
                </button>
              ) : (
                <button
                  onClick={handlePublishLevel}
                  className="w-full rounded-lg bg-blue-500 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                >
                  📢 Publish
                </button>
              )}

              <button
                onClick={handleTestLevel}
                className="w-full rounded-lg bg-purple-500 py-2 text-sm font-semibold text-white hover:bg-purple-600"
              >
                ▶️ Test
              </button>

              <button
                onClick={() => setEditorState(clearEditorState(editorState))}
                className="w-full rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                🗑️ Clear
              </button>

              <button
                onClick={() => setEditorState(fillBorder(editorState))}
                className="w-full rounded-lg bg-slate-600 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                🔲 Border
              </button>

              <button
                onClick={handleExportLevel}
                className="w-full rounded-lg bg-slate-400 py-2 text-sm font-semibold text-white hover:bg-slate-500"
              >
                📥 Export
              </button>
            </div>
          </div>

          {isPublished && (
            <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-800">✅ PUBLISHED</p>
              <p className="text-xs text-blue-600 mt-1">Players can see this level</p>
            </div>
          )}
        </div>

        {/* Center - Canvas */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-xl bg-white p-4 shadow-lg">
            <h3 className="mb-3 text-sm font-bold text-brandStart">📦 Level Canvas</h3>
            <div className="flex justify-center overflow-auto bg-slate-900">
              <canvas
                ref={editorCanvasRef}
                className="border-4 border-slate-300 shadow-lg"
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
        <div className="w-64 space-y-4 overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
          <div>
            <h3 className="mb-2 text-sm font-bold text-brandStart">🎨 Tool Palette</h3>
            <div className="space-y-4">
              {TOOL_OPTIONS.map((section) => (
                <div key={section.label}>
                  <p className="mb-2 text-xs font-bold text-slate-500">{section.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {section.tools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleSelectTool(tool.id as Tool)}
                        className={`rounded-lg border-2 p-3 text-center transition ${
                          editorState.selectedTool === tool.id
                            ? "border-brandStart bg-brandStart/10"
                            : "border-slate-200 hover:border-brandStart/50"
                        }`}
                      >
                        <div className="text-2xl">{tool.icon}</div>
                        <div className="mt-1 text-xs font-semibold">{tool.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
