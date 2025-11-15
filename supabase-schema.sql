-- ============================================
-- THE LOST PRISON - SUPABASE DATABASE SCHEMA
-- ============================================
-- Execute this SQL in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → SQL Editor → New Query

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (User Roles & Metadata)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'player')) DEFAULT 'player',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for role-based queries
CREATE INDEX idx_profiles_role ON profiles(role);

COMMENT ON TABLE profiles IS 'User profiles with role-based access control';
COMMENT ON COLUMN profiles.role IS 'User role: admin (can edit levels) or player (can only play)';

-- ============================================
-- LEVELS TABLE (Level Data)
-- ============================================
CREATE TABLE levels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  level_number INTEGER NOT NULL,
  map_data JSONB NOT NULL,
  background TEXT NOT NULL DEFAULT 'none' CHECK (background IN ('none', 'bg1', 'bg2')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique level numbers per creator
  UNIQUE(level_number, created_by)
);

-- Indexes for efficient queries
CREATE INDEX idx_levels_published ON levels(is_published);
CREATE INDEX idx_levels_creator ON levels(created_by);
CREATE INDEX idx_levels_level_number ON levels(level_number);

COMMENT ON TABLE levels IS 'Game levels with grid data, objects, and background settings';
COMMENT ON COLUMN levels.map_data IS 'Complete LevelData object stored as JSONB';
COMMENT ON COLUMN levels.background IS 'Background image selection: none, bg1 (Forest), or bg2 (Sky Plains)';
COMMENT ON COLUMN levels.is_published IS 'Only published levels are visible to players';

-- ============================================
-- PROGRESS TABLE (Player Completion Data)
-- ============================================
CREATE TABLE progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  best_time INTEGER, -- in seconds
  total_deaths INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One progress record per player per level
  UNIQUE(player_id, level_id)
);

-- Indexes for leaderboard queries
CREATE INDEX idx_progress_player ON progress(player_id);
CREATE INDEX idx_progress_level ON progress(level_id);
CREATE INDEX idx_progress_score ON progress(score DESC);
CREATE INDEX idx_progress_best_time ON progress(best_time ASC) WHERE completed = true;

COMMENT ON TABLE progress IS 'Player progress tracking and leaderboard data';
COMMENT ON COLUMN progress.best_time IS 'Best completion time in seconds';

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_levels_updated_at
  BEFORE UPDATE ON levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at
  BEFORE UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
-- SECURITY: Always creates users with 'player' role regardless of client input
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    'player'  -- SECURITY: Always default to 'player', ignore client-provided role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Everyone can read profiles (for leaderboards)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile (username only, NOT role)
-- SECURITY: Prevents privilege escalation by blocking role modifications
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Ensure role cannot be modified by the user
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- LEVELS POLICIES
-- Anyone can read published levels (even unauthenticated users)
CREATE POLICY "Published levels are viewable by everyone"
  ON levels FOR SELECT
  USING (is_published = true);

-- Admins can read all levels (including unpublished)
CREATE POLICY "Admins can view all levels"
  ON levels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert levels
CREATE POLICY "Only admins can create levels"
  ON levels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can only update their own levels
CREATE POLICY "Admins can update own levels"
  ON levels FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can only delete their own levels
CREATE POLICY "Admins can delete own levels"
  ON levels FOR DELETE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- PROGRESS POLICIES
-- Users can read their own progress
CREATE POLICY "Users can view own progress"
  ON progress FOR SELECT
  USING (player_id = auth.uid());

-- Users can insert their own progress
CREATE POLICY "Users can create own progress"
  ON progress FOR INSERT
  WITH CHECK (player_id = auth.uid());

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON progress FOR UPDATE
  USING (player_id = auth.uid());

-- Admins can view all progress (for analytics)
CREATE POLICY "Admins can view all progress"
  ON progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- SETUP COMPLETE MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ The Lost Prison database schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create your first admin user via Supabase Auth UI';
  RAISE NOTICE '2. Update their role: UPDATE profiles SET role = ''admin'' WHERE id = ''your-user-uuid'';';
  RAISE NOTICE '3. Configure your .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY';
  RAISE NOTICE '4. Start building levels!';
END $$;
