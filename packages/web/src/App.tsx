import "./App.css";
import { Routes, Route, Navigate } from "react-router";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Subscribe from "./pages/Subscribe";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import { Office } from "./pages/Office";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import {
  Chat,
  Tasks,
  Crons,
  Integrations,
  Settings,
} from "./pages/DashboardTabs";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] dark flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
          {/* Root redirect */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                onboardingCompleted ? (
                  <Navigate to="/dashboard" />
                ) : (
                  <Navigate to="/onboarding" />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

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
                <Onboarding />
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
            <Route index element={<Navigate to="/dashboard/office" />} />
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
