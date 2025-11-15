# Supabase Integration Setup Guide

This guide walks you through setting up Supabase authentication and database for **The Lost Prison** game.

## Overview

The Supabase integration adds:
- **User authentication** with admin/player roles
- **Cloud-based level storage** instead of localStorage
- **Admin-only level editor** with publishing controls
- **Public game access** for playing published levels
- **Player progress tracking** (optional - requires login)

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works fine)
- Git (for version control)

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in the details:
   - **Name**: The Lost Prison
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait 2-3 minutes for the project to initialize

---

## Step 2: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

3. Create a `.env` file in your project root:

```bash
# In the terminal at project root:
cp .env.example .env
```

4. Edit `.env` and paste your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Important**: Never commit `.env` to Git! It's already in `.gitignore`.

---

## Step 3: Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **+ New Query**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste into the SQL editor
5. Click **Run** (or press Ctrl/Cmd + Enter)

You should see a success message. This creates:
- `profiles` table (user roles)
- `levels` table (level data with JSONB map_data)
- `progress` table (player completion tracking)
- Row Level Security (RLS) policies
- Triggers for auto-updating timestamps

---

## Step 4: Create Your First Admin User

### Option A: Supabase Dashboard UI

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Fill in:
   - Email: `admin@example.com` (or your email)
   - Password: Create a strong password
   - Auto Confirm User: ✅ **Check this box**
4. Click **Create User**

5. Copy the user's UUID (shown in the users list)

6. Go back to **SQL Editor** and run:

```sql
-- Replace 'paste-user-uuid-here' with the actual UUID
UPDATE profiles
SET role = 'admin', username = 'admin'
WHERE id = 'paste-user-uuid-here';
```

### Option B: Using Auth API (Advanced)

```bash
# In your project terminal:
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

supabase.auth.signUp({
  email: 'admin@example.com',
  password: 'YourPassword123!',
  options: {
    data: { username: 'admin', role: 'admin' }
  }
}).then(console.log);
"
```

Then run the UPDATE query above to set their role to 'admin'.

---

## Step 5: Configure Authentication Settings

1. Go to **Authentication** → **Settings**
2. Under **Auth Providers**, ensure **Email** is enabled
3. Under **Email Settings**:
   - **Confirm email**: Optional (disable for testing, enable for production)
   - **Enable email confirmations**: Your choice
4. Under **Site URL**, set to:
   - Development: `http://localhost:5173`
   - Production: Your Vercel domain (e.g., `https://lost-prison.vercel.app`)

---

## Step 6: Install Dependencies

```bash
npm install
```

This installs:
- `@supabase/supabase-js` - Supabase client
- `react-router-dom` - Client-side routing
- `@types/react-router-dom` - TypeScript types

---

## Step 7: Start Development Server

```bash
npm run dev
```

The app should start at `http://localhost:5173`

---

## Testing the Integration

### Test Admin Flow

1. Navigate to `http://localhost:5173/admin/login`
2. Log in with your admin credentials
3. You should be redirected to `/admin/editor`
4. Create a level in the editor
5. Click **Save Level**
6. Click **Publish** to make it visible to players
7. Log out

### Test Player Flow

1. Navigate to `http://localhost:5173`
2. You should see published levels (even without logging in)
3. Click on a level to play
4. Background from editor should be visible in game

### Test Role-Based Access

1. Try accessing `/admin/editor` without logging in → Should redirect to login
2. Create a regular player account
3. Try accessing `/admin/editor` → Should show "Access Denied"

---

## Database Structure

### Profiles Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | User ID (refs auth.users) |
| username | TEXT | Display name |
| role | TEXT | 'admin' or 'player' |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

### Levels Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique level ID |
| name | TEXT | Level display name |
| level_number | INTEGER | 1-10 |
| map_data | JSONB | Complete LevelData object |
| background | TEXT | 'none', 'bg1', or 'bg2' |
| is_published | BOOLEAN | Visible to players? |
| created_by | UUID | Admin who created it |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

**Important**: `map_data` stores the entire LevelData object as JSONB, including grid, monsters, weapons, bombs, keys, doors, playerStart, goal, and theme.

### Progress Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique progress ID |
| player_id | UUID | User ID |
| level_id | UUID | Level ID |
| completed | BOOLEAN | Has player finished? |
| best_time | INTEGER | Best time in seconds |
| total_deaths | INTEGER | Cumulative deaths |
| score | INTEGER | High score |
| completed_at | TIMESTAMP | First completion time |

---

## Row Level Security (RLS) Policies

### Levels Table

| Policy | Description |
|--------|-------------|
| "Published levels are viewable by everyone" | Anyone can SELECT published levels |
| "Admins can view all levels" | Admins can SELECT unpublished levels |
| "Only admins can create levels" | Only admin role can INSERT |
| "Admins can update own levels" | Admins can only UPDATE their own levels |
| "Admins can delete own levels" | Admins can only DELETE their own levels |

### Profiles Table

| Policy | Description |
|--------|-------------|
| "Public profiles are viewable by everyone" | Anyone can SELECT (for leaderboards) |
| "Users can update own profile" | Users can UPDATE only their own profile |

### Progress Table

| Policy | Description |
|--------|-------------|
| "Users can view own progress" | Users can SELECT only their own progress |
| "Users can create own progress" | Users can INSERT only for themselves |
| "Users can update own progress" | Users can UPDATE only their own progress |
| "Admins can view all progress" | Admins can SELECT all progress (analytics) |

---

## Troubleshooting

### "Missing Supabase environment variables"

- Check that `.env` file exists in project root
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the dev server after editing `.env`

### "new row violates row-level security policy"

- Ensure your user has `role = 'admin'` in the profiles table
- Check that you're logged in (check browser dev tools → Application → Local Storage)
- Verify the SQL policies were created correctly

### "relation does not exist"

- The database schema wasn't run properly
- Go back to Step 3 and run `supabase-schema.sql` again

### "Failed to load levels"

- Check browser console for errors
- Verify RLS policies are enabled
- Ensure at least one level is published (set `is_published = true`)

### Login redirects to wrong page

- Check `Site URL` in Supabase **Authentication** → **Settings**
- Should match your development server URL (`http://localhost:5173`)

---

## Migrating Existing localStorage Levels

If you have levels in localStorage from before Supabase integration:

1. Log in as admin
2. In the editor, click **"Import from Browser Storage"** button
3. This will migrate all 10 levels to Supabase
4. Each level will be saved as unpublished
5. Publish the ones you want players to see

---

## Deployment to Vercel

1. Push your code to GitHub (ensure `.env` is in `.gitignore`)
2. Go to [https://vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

6. After deployment, update Supabase **Site URL**:
   - Go to Supabase → **Authentication** → **Settings**
   - Update Site URL to your Vercel domain

---

## Security Best Practices

✅ **DO**:
- Keep your `.env` file private
- Use the `anon` public key (it's safe for client-side)
- Trust RLS policies to enforce permissions
- Enable email confirmations in production

❌ **DON'T**:
- Never commit `.env` to Git
- Don't use the `service_role` key on the client
- Don't disable RLS in production
- Don't share your database password

---

## API Rate Limits (Free Tier)

- **Auth**: 50,000 monthly active users
- **Database**: 500 MB storage
- **Storage**: 1 GB file storage
- **Bandwidth**: 5 GB egress

This is more than enough for a small game project!

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Discord**: https://discord.supabase.com
- **GitHub Issues**: https://github.com/supabase/supabase/issues

---

## Next Steps

After setup, you can:
1. Create more admin users by updating their role in the profiles table
2. Implement player progress tracking (optional)
3. Add leaderboards using the `progress` table
4. Create level categories or tags
5. Add social features (comments, ratings)

Happy level building! 🎮
