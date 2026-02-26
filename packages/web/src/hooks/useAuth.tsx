import { createContext, useContext, useEffect, useState } from "react";
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

interface AuthContextValue extends AuthState {
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const navigate = useNavigate();

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
    // Initial session check — drives isLoading and the first /users/me call.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        void fetchOnboardingStatus().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Only re-fetch /users/me on an explicit SIGNED_IN event, not on every
    // TOKEN_REFRESHED or INITIAL_SESSION (which is already handled above).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        if (event === "SIGNED_IN") {
          void fetchOnboardingStatus();
        }
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
      const { error } = await supabase.auth.signUp({ email, password });
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        error,
        onboardingCompleted,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
