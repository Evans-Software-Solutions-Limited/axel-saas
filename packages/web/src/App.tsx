import "./App.css";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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
import Home from "./pages/Home";
import UseCases from "./pages/UseCases";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import WaitlistUnsubscribe from "./pages/WaitlistUnsubscribe";

const queryClient = new QueryClient();

// Preserves query string (e.g. ?checkout=success) when redirecting from /dashboard index.
function DashboardIndexRedirect({
  onboardingCompleted,
}: Readonly<{ onboardingCompleted: boolean }>) {
  const location = useLocation();
  const target = onboardingCompleted ? "/dashboard/office" : "/dashboard/chat";
  return (
    <Navigate to={{ pathname: target, search: location.search }} replace />
  );
}

function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading, onboardingCompleted } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090d] dark flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ScrollToTop />
        <Routes>
          {/* Root: marketing home when logged out, redirect to dashboard when logged in */}
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />
            }
          />

          {/* Marketing pages (public) */}
          <Route path="/use-cases" element={<UseCases />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />

          {/* Auth routes disabled during waitlist — send users home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />

          {/* Public waitlist unsubscribe — matches email link path */}
          <Route
            path="/waitlist/unsubscribe"
            element={<WaitlistUnsubscribe />}
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
                <DashboardIndexRedirect
                  onboardingCompleted={onboardingCompleted}
                />
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
