import { supabase } from '../config/supabase';

export async function signUpUser(
  email: string,
  password: string,
  username: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        // Role is always set to 'player' by database trigger
        // Admin role must be granted manually via secure database SQL
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, username, role, created_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// SECURITY: updateUserRole() has been removed to prevent privilege escalation
// Admin roles must only be granted via secure database SQL:
// UPDATE profiles SET role = 'admin' WHERE user_id = 'uuid';
//
// If you need to update user roles, implement a secure server-side function
// with proper authorization checks.
