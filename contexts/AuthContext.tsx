import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (!error && data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        currency: 'USD',
      });

      const defaultCategories = [
        { name: 'Salary', type: 'income', icon: 'briefcase', color: '#10B981', is_system: true },
        { name: 'Freelance', type: 'income', icon: 'laptop', color: '#3B82F6', is_system: true },
        { name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#EF4444', is_system: true },
        { name: 'Transportation', type: 'expense', icon: 'car', color: '#F59E0B', is_system: true },
        { name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#8B5CF6', is_system: true },
        { name: 'Entertainment', type: 'expense', icon: 'film', color: '#EC4899', is_system: true },
        { name: 'Bills & Utilities', type: 'expense', icon: 'receipt', color: '#6366F1', is_system: true },
        { name: 'Healthcare', type: 'expense', icon: 'heart', color: '#14B8A6', is_system: true },
      ];

      await supabase.from('categories').insert(
        defaultCategories.map(cat => ({
          ...cat,
          user_id: data.user.id,
        }))
      );
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
