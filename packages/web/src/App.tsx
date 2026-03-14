import "./App.css";
import { Routes, Route, Navigate } from "react-router";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Subscribe from "./pages/Subscribe";
import Dashboard from "./pages/Dashboard";
import { Office } from "./pages/Office";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import { Settings } from "./pages/Settings";
import { Chat } from "./pages/Chat";
import { Crons } from "./pages/Crons";
import { Tasks } from "./pages/Tasks";
import { Integrations } from "./pages/Integrations";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

/** Redirects to homepage if user is already authenticated (for login/signup). */
function GuestOnlyRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading, onboardingCompleted } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] dark flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  let rootRedirectTo: string;
  if (isAuthenticated) {
    rootRedirectTo = onboardingCompleted ? "/dashboard" : "/dashboard/chat";
  } else {
    rootRedirectTo = "/login";
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to={rootRedirectTo} replace />} />

          {/* Auth routes — redirect to homepage if already logged in */}
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <Login />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestOnlyRoute>
                <SignUp />
              </GuestOnlyRoute>
            }
          />

          {/* Legal pages */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Protected routes */}
          <Route
            path="/subscribe"
            element={
              <ProtectedRoute>
                <Subscribe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/chat" replace />
              </ProtectedRoute>
            }
          />

          {/* Dashboard and sub-routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                onboardingCompleted ? (
                  <Navigate to="/dashboard/office" replace />
                ) : (
                  <Navigate to="/dashboard/chat" replace />
                )
              }
            />
            <Route path="office" element={<Office />} />
            <Route path="chat" element={<Chat />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="crons" element={<Crons />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
