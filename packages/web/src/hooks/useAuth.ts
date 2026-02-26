import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase, type Session } from "@/lib/supabase";
import { api } from "@/lib/eden";

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  onboardingCompleted: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const navigate = useNavigate();

  // Fetch onboarding status from backend API
  const fetchOnboardingStatus = async () => {
    try {
      const response = await api.core.users.me.get();
      if (response.data?.success && response.data.user) {
        setOnboardingCompleted(response.data.user.onboardingCompleted);
      } else {
        setOnboardingCompleted(false);
      }
    } catch (err) {
      console.error("Error fetching onboarding status:", err);
      setOnboardingCompleted(false);
    }
  };

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email,
        };
        setUser(user);
        void fetchOnboardingStatus();
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email,
        };
        setUser(user);
        void fetchOnboardingStatus();
      } else {
        setUser(null);
        setOnboardingCompleted(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login");
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  return {
    user,
    session,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
    onboardingCompleted,
  };
}
