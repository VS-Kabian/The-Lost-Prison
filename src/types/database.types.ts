// Generated types for Supabase tables
// After setting up your Supabase project, you can run:
// npx supabase gen types typescript --project-id your-project-ref > src/types/database.types.ts
// For now, we define them manually

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          role: 'admin' | 'player';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role?: 'admin' | 'player';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: 'admin' | 'player';
          updated_at?: string;
        };
      };
      levels: {
        Row: {
          id: string;
          name: string;
          level_number: number;
          map_data: Json;
          background: 'none' | 'bg1' | 'bg2';
          is_published: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          level_number: number;
          map_data: Json;
          background?: 'none' | 'bg1' | 'bg2';
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          level_number?: number;
          map_data?: Json;
          background?: 'none' | 'bg1' | 'bg2';
          is_published?: boolean;
          updated_at?: string;
        };
      };
      progress: {
        Row: {
          id: string;
          player_id: string;
          level_id: string;
          completed: boolean;
          best_time: number | null;
          total_deaths: number;
          score: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          level_id: string;
          completed?: boolean;
          best_time?: number | null;
          total_deaths?: number;
          score?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          completed?: boolean;
          best_time?: number | null;
          total_deaths?: number;
          score?: number;
          completed_at?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}
