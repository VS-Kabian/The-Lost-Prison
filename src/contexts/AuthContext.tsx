import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { logError } from '../utils/logger';

interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'player';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  authMessage: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const authMessageTimeoutRef = useRef<number>();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle different auth events with user feedback
        if (event === 'TOKEN_REFRESHED') {
          setAuthMessage('Session refreshed');
          // Clear existing timeout before setting new one
          if (authMessageTimeoutRef.current) {
            window.clearTimeout(authMessageTimeoutRef.current);
          }
          authMessageTimeoutRef.current = window.setTimeout(() => setAuthMessage(null), 3000);
        } else if (event === 'SIGNED_OUT') {
          setAuthMessage('Signed out successfully');
          if (authMessageTimeoutRef.current) {
            window.clearTimeout(authMessageTimeoutRef.current);
          }
          authMessageTimeoutRef.current = window.setTimeout(() => setAuthMessage(null), 3000);
        } else if (event === 'SIGNED_IN') {
          setAuthMessage('Signed in successfully');
          if (authMessageTimeoutRef.current) {
            window.clearTimeout(authMessageTimeoutRef.current);
          }
          authMessageTimeoutRef.current = window.setTimeout(() => setAuthMessage(null), 3000);
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      // Clean up auth message timeout on unmount
      if (authMessageTimeoutRef.current) {
        window.clearTimeout(authMessageTimeoutRef.current);
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      logError('Error fetching profile', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signIn, signOut, isAdmin, authMessage }}
    >
      {children}
      {/* Auth message toast notification */}
      {authMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-2xl border border-slate-700 flex items-center gap-2">
            <span className="text-sm font-medium">{authMessage}</span>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
