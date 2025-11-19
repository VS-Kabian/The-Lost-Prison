import { supabase } from '../config/supabase';
import type { Database } from '../types/database.types';

type Progress = Database['public']['Tables']['progress']['Row'];
type ProgressInsert = Database['public']['Tables']['progress']['Insert'];
type ProgressUpdate = Database['public']['Tables']['progress']['Update'];

interface ProgressData {
  completed: boolean;
  time: number;
  deaths: number;
  score: number;
}

/**
 * Type for progress with joined profile data from Supabase
 */
interface ProgressWithProfile extends Progress {
  profiles: { username: string } | null;
}

/**
 * Type for leaderboard entries with flattened username
 */
interface LeaderboardEntry extends Progress {
  username: string;
}

/**
 * Get player's progress for a specific level
 */
export async function getPlayerProgress(
  playerId: string,
  levelId: string
): Promise<Progress | null> {
  const { data, error } = await supabase
    .from('progress')
    .select('id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at')
    .eq('player_id', playerId)
    .eq('level_id', levelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get all progress records for a player
 */
export async function getAllPlayerProgress(playerId: string): Promise<Progress[]> {
  const { data, error } = await supabase
    .from('progress')
    .select('id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upsert player progress (create or update)
 * Only updates if new time is better or level just completed
 */
export async function upsertProgress(
  playerId: string,
  levelId: string,
  progressData: ProgressData
): Promise<Progress> {
  // Check if progress exists
  const existing = await getPlayerProgress(playerId, levelId);

  if (existing) {
    // Update only if new time is better or level just completed
    const existingBestTime = typeof existing.best_time === 'number' ? existing.best_time : null;
    const shouldUpdate =
      !existing.completed ||
      (progressData.completed &&
       existingBestTime !== null &&
       progressData.time < existingBestTime);

    if (shouldUpdate) {
      const existingDeaths = typeof existing.total_deaths === 'number' ? existing.total_deaths : 0;
      const existingScore = typeof existing.score === 'number' ? existing.score : 0;

      const update: ProgressUpdate = {
        completed: progressData.completed,
        best_time: progressData.time,
        total_deaths: existingDeaths + progressData.deaths,
        score: Math.max(progressData.score, existingScore),
        completed_at: progressData.completed ? new Date().toISOString() : existing.completed_at,
      };

      const { data, error } = await supabase
        .from('progress')
        .update(update)
        .eq('id', existing.id)
        .select('id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at')
        .single();

      if (error) throw error;
      return data;
    }
    return existing;
  } else {
    // Insert new progress
    const insert: ProgressInsert = {
      player_id: playerId,
      level_id: levelId,
      completed: progressData.completed,
      best_time: progressData.time,
      total_deaths: progressData.deaths,
      score: progressData.score,
      completed_at: progressData.completed ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('progress')
      .insert(insert)
      .select('id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Get leaderboard for a specific level
 */
export async function getLeaderboard(
  levelId: string,
  limit = 10
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('progress')
    .select(`
      id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at,
      profiles:player_id (username)
    `)
    .eq('level_id', levelId)
    .eq('completed', true)
    .order('best_time', { ascending: true })
    .limit(limit);

  if (error) throw error;

  // Transform the data to flatten the profiles object with type safety
  return (data as ProgressWithProfile[] || []).map((item): LeaderboardEntry => {
    const { profiles, ...progress } = item;
    return {
      ...progress,
      username: profiles?.username || 'Anonymous',
    };
  });
}

/**
 * Get global leaderboard (best times across all levels)
 */
export async function getGlobalLeaderboard(
  limit = 10
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('progress')
    .select(`
      id, player_id, level_id, completed, best_time, total_deaths, score, completed_at, created_at, updated_at,
      profiles:player_id (username)
    `)
    .eq('completed', true)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Transform the data to flatten the profiles object with type safety
  return (data as ProgressWithProfile[] || []).map((item): LeaderboardEntry => {
    const { profiles, ...progress } = item;
    return {
      ...progress,
      username: profiles?.username || 'Anonymous',
    };
  });
}

/**
 * Get completion statistics for a player
 */
export async function getPlayerStats(playerId: string): Promise<{
  totalLevelsCompleted: number;
  totalDeaths: number;
  averageTime: number;
  bestScore: number;
}> {
  const progress = await getAllPlayerProgress(playerId);

  const completed = progress.filter(p => p.completed);

  // Safe numeric aggregation with null checks
  const totalDeaths = progress.reduce((sum, p) => {
    const deaths = typeof p.total_deaths === 'number' ? p.total_deaths : 0;
    return sum + deaths;
  }, 0);

  const avgTime = completed.length > 0
    ? completed.reduce((sum, p) => {
        const time = typeof p.best_time === 'number' ? p.best_time : 0;
        return sum + time;
      }, 0) / completed.length
    : 0;

  const bestScore = progress.reduce((max, p) => {
    const score = typeof p.score === 'number' ? p.score : 0;
    return Math.max(max, score);
  }, 0);

  return {
    totalLevelsCompleted: completed.length,
    totalDeaths,
    averageTime: Math.round(avgTime),
    bestScore,
  };
}

/**
 * Check if player has completed a level
 */
export async function hasCompletedLevel(
  playerId: string,
  levelId: string
): Promise<boolean> {
  const progress = await getPlayerProgress(playerId, levelId);
  return progress?.completed || false;
}

/**
 * Get player's best time for a level
 */
export async function getBestTime(
  playerId: string,
  levelId: string
): Promise<number | null> {
  const progress = await getPlayerProgress(playerId, levelId);
  return progress?.best_time || null;
}
