import { useEffect, useMemo, useRef, useState } from "react";
import { BACKGROUND_OPTIONS, TOOL_OPTIONS } from "./constants";
import { useTextures } from "./hooks/useTextures";
import { drawEditorCanvas } from "./canvas/editorCanvas";
import { drawGameCanvas } from "./canvas/gameCanvas";
import {
  applyToolAtPosition,
  clearEditorState,
  createInitialEditorState,
  createLevelFromEditorState,
  fillBorder,
  resizeGrid,
  applyLevelToEditorState
} from "./state/editorState";
import {
  buildGameStateFromLevel,
  createInitialGameState,
  createPlacedBomb,
  createPlayerBullet,
  jump
} from "./state/gameState";
import { updateGameFrame, type KeyMap } from "./state/gameLoop";
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
} from "./types";
import {
  exportLevel,
  hasSeenTutorial,
  loadLevelFromStorage,
  markTutorialSeen,
  saveLevelToStorage
} from "./utils/storage";

type Mode = "editor" | "game";

interface MessageState {
  text: string;
  visible: boolean;
}

const LevelSelectOptions = Array.from({ length: MAX_LEVELS }, (_, index) => ({
  value: index + 1,
  label: `Level ${index + 1}`
}));

interface AppProps {
  initialMode?: Mode;
}

function App({ initialMode = "editor" }: AppProps = {}): JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [editorState, setEditorState] = useState<EditorState>(() => {
    // Try to load Level 1 from localStorage on initial mount
    const savedLevel = loadLevelFromStorage(1);
    if (savedLevel) {
      return applyLevelToEditorState(
        {
          ...createInitialEditorState(),
          currentLevel: 1,
          name: savedLevel.name ?? "Level 1"
        },
        savedLevel
      );
    }
    return createInitialEditorState();
  });
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [message, setMessage] = useState<MessageState>({ text: "", visible: false });
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

  const editorBackgroundStyle = useMemo(() => {
    const background = editorState.background;
    if (background === "bg1" && textures.bg1?.complete) {
      return {
        backgroundImage: `url(${textures.bg1.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#87CEEB"
      } as const;
    }
    if (background === "bg2" && textures.bg2?.complete) {
      return {
        backgroundImage: `url(${textures.bg2.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#87CEEB"
      } as const;
    }
    return {
      backgroundColor: "#87CEEB"
    } as const;
  }, [editorState.background, textures]);

  const gameBackgroundStyle = useMemo(() => {
    const background = gameState.background;
    if (background === "bg1" && textures.bg1?.complete) {
      return {
        backgroundImage: `url(${textures.bg1.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#87CEEB"
      } as const;
    }
    if (background === "bg2" && textures.bg2?.complete) {
      return {
        backgroundImage: `url(${textures.bg2.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#87CEEB"
      } as const;
    }
    return {
      backgroundColor: "#87CEEB"
    } as const;
  }, [gameState.background, textures]);

  const showMessage = (text: string) => {
    setMessage({ text, visible: true });
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage((prev) => ({ ...prev, visible: false }));
    }, 2000);
  };

  useEffect(() => {
    if (!hasSeenTutorial()) {
      showMessage("👋 Welcome! Set Start (🟢) and End (⭐) points, then click Test!");
      markTutorialSeen();
    }
  }, []);

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

  const handleSaveLevel = () => {
    if (!editorState.playerStart) {
      showMessage("⚠️ Please set a player start position!");
      return;
    }
    if (!editorState.goal) {
      showMessage("⚠️ Please set a goal position!");
      return;
    }
    const levelData = createLevelFromEditorState(editorState);
    saveLevelToStorage(editorState.currentLevel, levelData);
    showMessage("✅ Level saved successfully!");
  };

  const loadLevelIntoEditor = (levelNumber: number) => {
    const savedLevel = loadLevelFromStorage(levelNumber);
    if (savedLevel) {
      setEditorState((prev) =>
        applyLevelToEditorState(
          {
            ...prev,
            currentLevel: levelNumber,
            name: savedLevel.name ?? `Level ${levelNumber}`
          },
          savedLevel
        )
      );
    } else {
      setEditorState({
        ...createInitialEditorState(),
        currentLevel: levelNumber,
        name: `Level ${levelNumber}`
      });
    }
  };

  const handleLevelChange = (levelNumber: number) => {
    loadLevelIntoEditor(levelNumber);
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
    saveLevelToStorage(editorState.currentLevel, levelData);
    exportLevel(editorState.currentLevel, levelData);
    showMessage("✅ Level exported!");
  };

  const handleImportLevel = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const levelData = JSON.parse(loadEvent.target?.result?.toString() ?? "");
          saveLevelToStorage(editorState.currentLevel, levelData);
          loadLevelIntoEditor(editorState.currentLevel);
          showMessage("✅ Level imported!");
        } catch (error) {
          console.error(error);
          showMessage("❌ Invalid level file!");
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
    saveLevelToStorage(editorState.currentLevel, levelData);
    loadGameFromLevel(editorState.currentLevel, levelData);
    setMode("game");
  };

  const loadGameFromLevel = (levelNumber: number, levelData?: ReturnType<typeof createLevelFromEditorState>) => {
    const data = levelData ?? loadLevelFromStorage(levelNumber);
    if (!data) {
      showMessage(`❌ No level found! Create and save Level ${levelNumber} first.`);
      return;
    }
    if (!data.grid) {
      showMessage("❌ No grid data! Please create the level properly.");
      return;
    }
    if (!data.playerStart) {
      showMessage("❌ No Start Point! Please set the Start Point (🟢).");
      return;
    }
    if (!data.goal) {
      showMessage("❌ No End Point! Please set the End Point (⭐).");
      return;
    }

    const nextState = buildGameStateFromLevel(data, levelNumber);
    setGameState(nextState);
    gameStateRef.current = nextState;
  };

  const handleRestartGame = () => {
    loadGameFromLevel(gameState.level);
  };

  const handleNextLevel = () => {
    if (gameState.level >= MAX_LEVELS) return;
    const nextLevel = gameState.level + 1;
    const saved = loadLevelFromStorage(nextLevel);
    if (!saved) {
      showMessage(`⚠️ Level ${nextLevel} not found. Create it in the editor first.`);
      return;
    }
    setEditorState((prev) => ({ ...prev, currentLevel: nextLevel }));
    loadGameFromLevel(nextLevel, saved);
  };

  const handlePrevLevel = () => {
    if (gameState.level <= 1) return;
    const prevLevel = gameState.level - 1;
    const saved = loadLevelFromStorage(prevLevel);
    if (!saved) {
      showMessage(`⚠️ Level ${prevLevel} not found. Create it in the editor first.`);
      return;
    }
    setEditorState((prev) => ({ ...prev, currentLevel: prevLevel }));
    loadGameFromLevel(prevLevel, saved);
  };

  const handleCanvasMouseDown: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    if (mode !== "editor") return;
    drawingRef.current = true;
    applyToolAt(event.clientX, event.clientY, event.currentTarget);
  };

  const handleCanvasMouseMove: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    if (mode !== "editor") return;
    if (!drawingRef.current) return;
    const terrainTools: Tool[] = ["empty", "wall", "stone", "lava", "platform"];
    if (!terrainTools.includes(editorState.selectedTool)) return;
    applyToolAt(event.clientX, event.clientY, event.currentTarget);
  };

  const handleCanvasMouseUp = () => {
    drawingRef.current = false;
  };

  const handleNameChange = (value: string) => {
    setEditorState((prev) => ({
      ...prev,
      name: value
    }));
  };

  const handleClearLevel = () => {
    if (window.confirm("Clear this level?")) {
      setEditorState((prev) => clearEditorState(prev));
      showMessage("🧹 Level cleared!");
    }
  };

  const handleFillBorder = () => {
    setEditorState((prev) => fillBorder(prev));
    showMessage("✅ Border filled!");
  };

  useEffect(() => {
    if (mode !== "game") return;

    const update = () => {
      setGameState((prev) => {
        const { state: updatedState, events } = updateGameFrame(prev, keysRef.current);
        gameStateRef.current = updatedState;

        if (events.playerDied) {
          showMessage("💀 You died!");
          setTimeout(() => {
            loadGameFromLevel(updatedState.level);
          }, 1000);
        }
        if (events.doorOpened) {
          showMessage("🔓 Door opened!");
        }
        if (events.levelComplete) {
          showMessage("🎉 Level complete!");
          setTimeout(() => {
            const nextLevel = Math.min(MAX_LEVELS, updatedState.level + 1);
            if (nextLevel !== updatedState.level) {
              loadGameFromLevel(nextLevel);
              setEditorState((prev) => ({ ...prev, currentLevel: nextLevel }));
            }
          }, 1500);
        }
        if (events.tookDamage && !events.playerDied) {
          showMessage("🔥 Ouch! Lava hurts!");
        }

        return updatedState;
      });
      const ctx = gameCanvasRef.current?.getContext("2d");
      if (ctx) {
        drawGameCanvas(ctx, gameStateRef.current, textures);
      }
      animationId = requestAnimationFrame(update);
    };

    let animationId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [mode, textures]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current[key] = true;

      if (mode === "game") {
        // Always prevent spacebar default behavior in game mode to avoid triggering buttons
        if (event.key === " ") {
          event.preventDefault();
          if (gameStateRef.current.player.onGround) {
            setGameState((prev) => {
              const next = { ...prev, player: { ...prev.player } };
              jump(next.player);
              gameStateRef.current = next;
              return next;
            });
          }
        }

        if (key === "f" && gameStateRef.current.player.hasWeapon && gameStateRef.current.ammo > 0) {
          setGameState((prev) => {
            if (!prev.player.hasWeapon || prev.ammo <= 0) return prev;
            const next: GameState = {
              ...prev,
              bullets: [...prev.bullets, createPlayerBullet(prev.player)],
              ammo: prev.ammo - 1
            };
            gameStateRef.current = next;
            return next;
          });
        }

        if (key === "b" && gameStateRef.current.bombCount > 0) {
          setGameState((prev) => {
            if (prev.bombCount <= 0) return prev;
            const next: GameState = {
              ...prev,
              placedBombs: [...prev.placedBombs, createPlacedBomb(prev.player)],
              bombCount: prev.bombCount - 1
            };
            gameStateRef.current = next;
            return next;
          });
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode]);

  useEffect(() => {
    const ctx = editorCanvasRef.current?.getContext("2d");
    if (ctx && mode === "editor") {
      drawEditorCanvas(ctx, editorState, textures);
    }
  }, [editorState.monsters.length, editorState.keys.length, editorState.weapons.length, editorState.bombs.length, textures, mode]);

  useEffect(() => {
    const ctx = gameCanvasRef.current?.getContext("2d");
    if (ctx && mode === "game") {
      drawGameCanvas(ctx, gameState, textures);
    }
  }, [gameState.keys, gameState.ammo, gameState.health, gameState.deaths, gameState.time, gameState.bullets.length, gameState.placedBombs.length, gameState.collectibles, gameState.monsters.length, gameState.doors.length, textures, mode]);

  return (
    <div className="mx-auto max-w-[1600px] rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-gradient-to-br from-brandStart to-brandEnd px-10 py-6 text-white">
        <div className="flex items-center gap-4 text-2xl font-bold">
          <span role="img" aria-label="game controller">
            🎮
          </span>
          The Lost Prison
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/20 p-1">
          <button
            className={`rounded-lg px-6 py-2 font-semibold transition ${
              mode === "editor" ? "bg-white text-brandStart" : "hover:bg-white/20"
            }`}
            onClick={() => setMode("editor")}
          >
            📝 Editor
          </button>
          <button
            className={`rounded-lg px-6 py-2 font-semibold transition ${
              mode === "game" ? "bg-white text-brandStart" : "hover:bg-white/20"
            }`}
            onClick={() => {
              if (mode === "game") return;
              // Load directly from current editor state so unsaved background and other changes carry over
              const levelData = createLevelFromEditorState(editorState);
              // Optionally keep storage in sync
              saveLevelToStorage(editorState.currentLevel, levelData);
              loadGameFromLevel(editorState.currentLevel, levelData);
              setMode("game");
            }}
          >
            🎮 Play Game
          </button>
        </div>
      </header>

      <main className="p-10">
        {mode === "editor" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr,280px]">
            <aside className="max-h-[85vh] space-y-6 overflow-y-auto rounded-xl bg-slate-100 p-4">
              <PanelTitle icon="⚙️" title="Settings" />
              <Section label="Level">
                <select
                  className="w-full rounded-lg border-2 border-slate-200 p-3 text-base font-medium focus:border-brandStart focus:outline-none"
                  value={editorState.currentLevel}
                  onChange={(event) => handleLevelChange(Number(event.target.value))}
                >
                  {LevelSelectOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editorState.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  className="mt-3 w-full rounded-lg border-2 border-slate-200 p-3 text-sm focus:border-brandStart focus:outline-none"
                  placeholder="Level name..."
                />
              </Section>

              <Section label="Grid Size">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_GRID_WIDTH}
                    max={MAX_GRID_WIDTH}
                    value={editorState.gridWidth}
                    onChange={(event) => handleResizeGrid(Number(event.target.value), editorState.gridHeight)}
                    className="w-16 rounded-lg border-2 border-slate-200 p-2 text-center font-semibold"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min={MIN_GRID_HEIGHT}
                    max={MAX_GRID_HEIGHT}
                    value={editorState.gridHeight}
                    onChange={(event) => handleResizeGrid(editorState.gridWidth, Number(event.target.value))}
                    className="w-16 rounded-lg border-2 border-slate-200 p-2 text-center font-semibold"
                  />
                </div>
              </Section>

              <Section label="Background">
                <select
                  className="w-full rounded-lg border-2 border-slate-200 p-3 text-base font-medium focus:border-brandStart focus:outline-none"
                  value={editorState.background}
                  onChange={(event) => handleBackgroundChange(event.target.value as BackgroundKey)}
                >
                  {BACKGROUND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Section>

              <Section label="Actions">
                <div className="grid gap-2">
                  <ActionButton tone="success" onClick={handleSaveLevel}>
                    💾 Save
                  </ActionButton>
                  <ActionButton tone="primary" onClick={handleTestLevel}>
                    ▶️ Test
                  </ActionButton>
                  <ActionButton tone="danger" onClick={handleClearLevel}>
                    🗑️ Clear
                  </ActionButton>
                  <ActionButton tone="secondary" onClick={handleFillBorder}>
                    🔲 Border
                  </ActionButton>
                </div>
              </Section>

              <Section label="Stats">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="👾" label="Monsters" value={editorState.monsters.length} />
                  <StatCard icon="🔫" label="Weapons" value={editorState.weapons.length} />
                  <StatCard icon="💣" label="Bombs" value={editorState.bombs.length} />
                  <StatCard icon="🗝️" label="Keys" value={editorState.keys.length} />
                </div>
              </Section>
            </aside>

            <section className="rounded-xl bg-white p-4 shadow-lg">
              <PanelTitle icon="🎨" title="Level Canvas" />
              <div className="mt-4 inline-block overflow-hidden rounded-xl border-4 border-slate-200" style={editorBackgroundStyle}>
                <canvas
                  ref={editorCanvasRef}
                  className="block cursor-crosshair"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ActionButton tone="secondary" onClick={handleExportLevel}>
                  📤 Export
                </ActionButton>
                <ActionButton tone="secondary" onClick={handleImportLevel}>
                  📥 Import
                </ActionButton>
              </div>
            </section>

            <aside className="max-h-[85vh] space-y-6 overflow-y-auto rounded-xl bg-slate-100 p-4">
              <PanelTitle icon="🎨" title="Tool Palette" />
              {TOOL_OPTIONS.map((group) => (
                <Section key={group.label} label={group.label}>
                  <div className="grid grid-cols-3 gap-3">
                    {group.tools.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center text-xs font-semibold transition ${
                          editorState.selectedTool === tool.id
                            ? "border-brandStart bg-gradient-to-br from-brandStart to-brandEnd text-white shadow-lg"
                            : "border-slate-200 bg-white hover:-translate-y-1 hover:shadow-md"
                        }`}
                        onClick={() => handleSelectTool(tool.id as Tool)}
                      >
                        <span className="text-xl">{tool.icon}</span>
                        <span>{tool.name}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              ))}
            </aside>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                <GameStat label="Level" value={gameState.level} />
                <GameStat label="🗝️ Keys" value={gameState.keys} />
                <GameStat label="🔫 Ammo" value={gameState.ammo} />
                <GameStat label="❤️ Health" value={gameState.health} />
                <GameStat label="⏱️ Time" value={`${gameState.time}s`} />
                <GameStat label="💀 Deaths" value={gameState.deaths} />
              </div>
              <div className="flex gap-3">
                <ActionButton tone="secondary" onClick={handleRestartGame}>
                  🔄 Restart
                </ActionButton>
                <ActionButton tone="primary" onClick={handlePrevLevel}>
                  ⏮️ Prev
                </ActionButton>
                <ActionButton tone="primary" onClick={handleNextLevel}>
                  ⏭️ Next
                </ActionButton>
              </div>
            </div>

            <section className="rounded-xl bg-white p-4 shadow-lg">
              <div className="inline-block overflow-hidden rounded-xl border-4 border-slate-200" style={gameBackgroundStyle}>
                <canvas ref={gameCanvasRef} className="block" />
              </div>
            </section>

            <section className="rounded-xl bg-slate-100 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-700">Controls</h2>
              <div className="space-y-2 text-sm text-slate-600">
                <Instruction keys={["← →", "A D"]} description="Move left/right" />
                <Instruction keys={["SPACE"]} description="Jump" />
                <Instruction keys={["F"]} description="Shoot weapon" />
                <Instruction keys={["B"]} description="Place bomb (destroys stone blocks)" />
              </div>
            </section>
          </div>
        )}
      </main>

      <div
        className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 transform rounded-2xl bg-white px-16 py-10 text-center text-2xl font-bold text-slate-700 shadow-2xl transition duration-300 ${
          message.visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: string; title: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-brandStart to-brandEnd px-3 py-2 text-sm font-bold text-white">
      <span>{icon}</span>
      <span>{title}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-3">
      <span className="inline-block rounded-md bg-slate-200 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "primary" | "secondary" | "success" | "danger";
}): JSX.Element {
  const toneStyles: Record<typeof tone, string> = {
    primary: "bg-gradient-to-br from-brandStart to-brandEnd text-white hover:-translate-y-1",
    secondary: "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-800 hover:-translate-y-1",
    success: "bg-gradient-to-br from-green-400 to-green-500 text-white hover:-translate-y-1",
    danger: "bg-gradient-to-br from-rose-400 to-rose-500 text-white hover:-translate-y-1"
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition ${toneStyles[tone]}`}
    >
      {children}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-lg border-2 border-slate-200 bg-white p-3">
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-lg font-bold text-brandStart">{value}</span>
    </div>
  );
}

function GameStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-xl bg-gradient-to-br from-brandStart to-brandEnd px-4 py-3 text-white shadow-lg">
      <div className="text-xs uppercase opacity-80">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Instruction({ keys, description }: { keys: string[]; description: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {keys.map((key) => (
          <span key={key} className="rounded-md border-2 border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-600">
            {key}
          </span>
        ))}
      </div>
      <span className="text-sm text-slate-600">{description}</span>
    </div>
  );
}

export default App;

