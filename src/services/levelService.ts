import { supabase } from '../config/supabase';
import type { LevelData } from '../types';
import type { Database } from '../types/database.types';
import { processLevelName } from '../utils/sanitize';

type Level = Database['public']['Tables']['levels']['Row'];
type LevelInsert = Database['public']['Tables']['levels']['Insert'];
type LevelUpdate = Database['public']['Tables']['levels']['Update'];

/**
 * Fetch all published levels (accessible by everyone, including unauthenticated users)
 */
export async function getPublishedLevels(): Promise<Level[]> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .eq('is_published', true)
    .order('level_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch all levels (admin only - includes unpublished)
 */
export async function getAllLevels(): Promise<Level[]> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .order('level_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch levels created by a specific user
 */
export async function getLevelsByCreator(userId: string): Promise<Level[]> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .eq('created_by', userId)
    .order('level_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single level by ID
 */
export async function getLevelById(id: string): Promise<Level | null> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Fetch a published level by level number
 */
export async function getLevelByNumber(levelNumber: number): Promise<Level | null> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .eq('level_number', levelNumber)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Fetch a level by level number for a specific creator (admin only)
 */
export async function getCreatorLevelByNumber(
  levelNumber: number,
  userId: string
): Promise<Level | null> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .eq('level_number', levelNumber)
    .eq('created_by', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Create a new level (admin only)
 */
export async function createLevel(
  levelData: LevelData,
  levelNumber: number,
  userId: string
): Promise<Level> {
  // Sanitize level name to prevent XSS attacks
  const sanitizedName = processLevelName(levelData.name);

  const levelInsert: LevelInsert = {
    name: sanitizedName,
    level_number: levelNumber,
    map_data: { ...levelData, name: sanitizedName } as any, // Store entire LevelData with sanitized name
    background: levelData.background,
    is_published: false,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('levels')
    .insert(levelInsert)
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing level (admin only, must be owner)
 */
export async function updateLevel(
  id: string,
  levelData: LevelData
): Promise<Level> {
  // Sanitize level name to prevent XSS attacks
  const sanitizedName = processLevelName(levelData.name);

  const levelUpdate: LevelUpdate = {
    name: sanitizedName,
    map_data: { ...levelData, name: sanitizedName } as any,
    background: levelData.background,
  };

  const { data, error } = await supabase
    .from('levels')
    .update(levelUpdate)
    .eq('id', id)
    .select('id, name, level_number, map_data, background, is_published, created_by, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Upsert a level (create if doesn't exist, update if exists)
 */
export async function upsertLevel(
  levelData: LevelData,
  levelNumber: number,
  userId: string
): Promise<Level> {
  // Check if level exists
  const existing = await getCreatorLevelByNumber(levelNumber, userId);

  if (existing) {
    return updateLevel(existing.id, levelData);
  } else {
    return createLevel(levelData, levelNumber, userId);
  }
}

/**
 * Publish a level (make it visible to players)
 */
export async function publishLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from('levels')
    .update({ is_published: true })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Unpublish a level (hide from players)
 */
export async function unpublishLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from('levels')
    .update({ is_published: false })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a level (admin only, must be owner)
 */
export async function deleteLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from('levels')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Validate level data structure at runtime
 * @throws Error if data is invalid
 */
function validateLevelData(data: unknown): data is LevelData {
  if (!data || typeof data !== 'object') {
    throw new Error('Level data must be an object');
  }

  const d = data as any;

  // Validate required string fields
  if (typeof d.name !== 'string' || d.name.length === 0) {
    throw new Error('Level must have a non-empty name');
  }

  // Validate grid is 2D array of numbers
  if (!Array.isArray(d.grid)) {
    throw new Error('Level grid must be an array');
  }

  for (let i = 0; i < d.grid.length; i++) {
    if (!Array.isArray(d.grid[i])) {
      throw new Error(`Grid row ${i} must be an array`);
    }
    for (let j = 0; j < d.grid[i].length; j++) {
      if (typeof d.grid[i][j] !== 'number') {
        throw new Error(`Grid cell [${i}][${j}] must be a number`);
      }
    }
  }

  // Validate position objects have x and y numbers
  const validatePositionArray = (arr: any, name: string) => {
    if (!Array.isArray(arr)) {
      throw new Error(`${name} must be an array`);
    }
    arr.forEach((item, index) => {
      if (typeof item?.x !== 'number' || typeof item?.y !== 'number') {
        throw new Error(`${name}[${index}] must have numeric x and y properties`);
      }
    });
  };

  // Validate all position-based arrays
  validatePositionArray(d.monsters || [], 'monsters');
  validatePositionArray(d.weapons || [], 'weapons');
  validatePositionArray(d.bombs || [], 'bombs');
  validatePositionArray(d.keys || [], 'keys');
  validatePositionArray(d.doors || [], 'doors');
  validatePositionArray(d.firetraps || [], 'firetraps');

  // Validate playerStart and goal
  if (!d.playerStart || typeof d.playerStart.x !== 'number' || typeof d.playerStart.y !== 'number') {
    throw new Error('playerStart must have numeric x and y properties');
  }
  if (!d.goal || typeof d.goal.x !== 'number' || typeof d.goal.y !== 'number') {
    throw new Error('goal must have numeric x and y properties');
  }

  // Validate background
  const validBackgrounds = ['none', 'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6'];
  if (!validBackgrounds.includes(d.background)) {
    throw new Error(`background must be one of: ${validBackgrounds.join(', ')}`);
  }

  return true;
}

/**
 * Convert Supabase level to LevelData format with validation
 */
export function levelToLevelData(level: Level): LevelData {
  const data = level.map_data as unknown;

  try {
    validateLevelData(data);
  } catch (error) {
    throw new Error(`Invalid level data for "${level.name}" (ID: ${level.id}): ${error instanceof Error ? error.message : 'Unknown validation error'}`);
  }

  return data as LevelData;
}

/**
 * Get level count for a creator
 */
export async function getCreatorLevelCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('levels')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId);

  if (error) throw error;
  return count || 0;
}

/**
 * Get published level count
 */
export async function getPublishedLevelCount(): Promise<number> {
  const { count, error } = await supabase
    .from('levels')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true);

  if (error) throw error;
  return count || 0;
}
