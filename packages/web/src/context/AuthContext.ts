import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";

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

export interface AuthContextValue extends AuthState {
  setOnboardingCompleted: (completed: boolean) => void;
  refreshOnboardingStatus: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    /**
     * True when Supabase returns a user but no session — the user must
     * click the email-verification link before they're authenticated.
     * The SignUp page uses this to render a "check your email" state
     * instead of routing to /subscribe (which would 401 on the free-tier
     * provisioning call because no session exists yet).
     */
    requiresEmailConfirmation?: boolean;
  }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
