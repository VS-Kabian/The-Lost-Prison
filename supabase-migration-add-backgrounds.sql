-- ============================================
-- MIGRATION: Add New Background Options
-- ============================================
-- Execute this SQL in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → SQL Editor → New Query
--
-- This migration adds support for bg3, bg4, bg5, and bg6 backgrounds

-- Drop the existing constraint
ALTER TABLE levels
DROP CONSTRAINT IF EXISTS levels_background_check;

-- Add new constraint with all 6 background options
ALTER TABLE levels
ADD CONSTRAINT levels_background_check
CHECK (background IN ('none', 'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6'));

-- Update the comment to reflect all available backgrounds
COMMENT ON COLUMN levels.background IS 'Background image selection: none, bg1 (Forest), bg2 (Sky Plains), bg3, bg4, bg5, or bg6';

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '✅ Background constraint updated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now use all 6 backgrounds:';
  RAISE NOTICE '  - none (no background)';
  RAISE NOTICE '  - bg1 (Forest Platformer)';
  RAISE NOTICE '  - bg2 (Sky Plains)';
  RAISE NOTICE '  - bg3 (Background 3)';
  RAISE NOTICE '  - bg4 (Background 4)';
  RAISE NOTICE '  - bg5 (Background 5)';
  RAISE NOTICE '  - bg6 (Background 6)';
END $$;
