-- ============================================
-- SUPABASE ADMIN ACCOUNT SETUP GUIDE
-- ============================================
-- This file helps you create and manage admin accounts securely
-- Execute these commands in Supabase SQL Editor

-- ============================================
-- STEP 1: Find User ID
-- ============================================
-- First, you need to find the user_id of the account you want to make admin
-- The user must sign up through the app first (they will be created as 'player')

-- Option 1: Find user by email
SELECT
  auth.users.id,
  auth.users.email,
  profiles.username,
  profiles.role,
  profiles.created_at
FROM auth.users
LEFT JOIN public.profiles ON auth.users.id = profiles.id
WHERE auth.users.email = 'YOUR_EMAIL@example.com';
-- Replace YOUR_EMAIL@example.com with the actual email

-- Option 2: List all users and their roles
SELECT
  auth.users.id,
  auth.users.email,
  profiles.username,
  profiles.role,
  profiles.created_at
FROM auth.users
LEFT JOIN public.profiles ON auth.users.id = profiles.id
ORDER BY profiles.created_at DESC;

-- ============================================
-- STEP 2: Promote User to Admin
-- ============================================
-- Once you have the user_id, update their role to 'admin'
-- IMPORTANT: Copy the UUID from Step 1 and paste it below

UPDATE public.profiles
SET role = 'admin'
WHERE id = 'PASTE_USER_UUID_HERE';
-- Example: WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- ============================================
-- STEP 3: Verify Admin Status
-- ============================================
-- Check that the user is now an admin
SELECT
  id,
  username,
  role,
  created_at
FROM public.profiles
WHERE role = 'admin';

-- ============================================
-- OPTIONAL: Demote Admin Back to Player
-- ============================================
-- If you need to remove admin privileges
UPDATE public.profiles
SET role = 'player'
WHERE id = 'PASTE_USER_UUID_HERE';

-- ============================================
-- QUICK REFERENCE: Common Queries
-- ============================================

-- Count admins
SELECT COUNT(*) as admin_count
FROM public.profiles
WHERE role = 'admin';

-- Count players
SELECT COUNT(*) as player_count
FROM public.profiles
WHERE role = 'player';

-- List all admins with their details
SELECT
  p.id,
  p.username,
  p.role,
  u.email,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC;

-- ============================================
-- SECURITY NOTES
-- ============================================
-- ✅ Users CANNOT promote themselves to admin (protected by RLS)
-- ✅ Only database admins can change roles via SQL
-- ✅ New signups always default to 'player' role
-- ✅ Admin role is required to:
--    - Access /admin/editor route
--    - Create, edit, and publish levels
--    - View unpublished levels
--
-- ⚠️ IMPORTANT: Never expose admin credentials
-- ⚠️ Use strong passwords for admin accounts
-- ⚠️ Consider enabling 2FA for admin accounts in production
