import { useEffect, useState } from "react";
import { getPublishedLevels } from "../services/levelService";
import type { Database } from "../types/database.types";
import { logError } from "../utils/logger";

type Level = Database['public']['Tables']['levels']['Row'];

interface LevelSelectorProps {
  onSelectLevel: (level: Level) => void;
  currentLevelId?: string;
}

export default function LevelSelector({
  onSelectLevel,
  currentLevelId
}: LevelSelectorProps): JSX.Element {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLevels();
  }, []);

  const loadLevels = async () => {
    try {
      setLoading(true);
      setError("");
      const publishedLevels = await getPublishedLevels();
      setLevels(publishedLevels);
    } catch (error: any) {
      logError("Failed to load levels", error);
      setError("Failed to load levels. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-6xl animate-bounce">🎮</div>
          <p className="text-lg font-semibold text-slate-600">Loading levels...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
        <div className="mb-2 text-4xl">⚠️</div>
        <p className="text-lg font-semibold text-red-800">Failed to load levels</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          onClick={loadLevels}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (levels.length === 0) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-8 text-center">
        <div className="mb-4 text-6xl">📦</div>
        <p className="text-xl font-semibold text-yellow-800">
          No levels available yet!
        </p>
        <p className="mt-2 text-yellow-600">
          Check back soon for new levels, or contact an admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">
          Available Levels ({levels.length})
        </h2>
        <button
          onClick={loadLevels}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
          title="Refresh levels"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => onSelectLevel(level)}
            className={`group relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200 ${
              currentLevelId === level.id
                ? "border-brandStart bg-gradient-to-br from-brandStart/10 to-brandEnd/10 shadow-lg"
                : "border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-3xl font-bold ${
                currentLevelId === level.id ? "text-brandStart" : "text-slate-400 group-hover:text-brandStart"
              } transition-colors`}>
                Level {level.level_number}
              </span>
              <div className="flex items-center gap-2">
                {level.background !== 'none' && (
                  <span className="text-2xl" title={`Background: ${level.background}`}>
                    🖼️
                  </span>
                )}
                {currentLevelId === level.id && (
                  <span className="text-2xl">▶️</span>
                )}
              </div>
            </div>

            <h3 className="mb-2 text-lg font-semibold text-slate-800 line-clamp-2">
              {level.name}
            </h3>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>
                Created {new Date(level.created_at).toLocaleDateString()}
              </span>
              {level.background !== 'none' && (
                <span className="rounded-full bg-brandStart/10 px-2 py-1 font-medium text-brandStart">
                  {level.background === 'bg1' ? 'Forest' : 'Sky Plains'}
                </span>
              )}
            </div>

            {currentLevelId === level.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brandStart to-brandEnd"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
