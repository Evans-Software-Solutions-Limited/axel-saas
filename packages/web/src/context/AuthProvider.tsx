import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase, type Session } from "@/lib/supabase";
import { api } from "@/lib/eden";
import { AuthContext, type AuthUser } from "./AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const navigate = useNavigate();

  const fetchOnboardingStatus = async () => {
    try {
      const { data } = await api.core.users.me.get();
      if (data && "user" in data && data.user) {
        setOnboardingCompleted(data.user.onboardingCompleted);
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

  const completeOnboarding = async () => {
    try {
      // Call the onboarding endpoint to persist completion
      const { error } = await api.core.users.onboarding.post({
        name: "",
        helpWith: [],
        channels: [],
        morningBrief: false,
      });

      if (error) {
        console.error("Error completing onboarding:", error);
        return { success: false, error: "Failed to complete onboarding" };
      }

      // Update local state immediately
      setOnboardingCompleted(true);
      return { success: true };
    } catch (err) {
      console.error("Error completing onboarding:", err);
      return { success: false, error: "Failed to complete onboarding" };
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
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
