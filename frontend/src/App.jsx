import { useState, useEffect } from "react";
import { initPWA } from "./utils/pwaPrompt";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import GmailCallback from "./pages/GmailCallback";

// ── PWA Install Prompt ────────────────────────────────────────
function PWAInstallBanner() {
  const [prompt, setPrompt]   = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !prompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 bg-white border border-teal-200 rounded-2xl shadow-lg p-4 z-50 slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex-shrink-0">
          <img src="./icons/icon-96.png" className="w-full h-full object-cover rounded-xl shadow-sm" alt="Logo" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Install HealthMate</p>
          <p className="text-xs text-gray-500 mt-0.5">Add to home screen for quick access</p>
        </div>
        <button onClick={() => setVisible(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setVisible(false)}
          className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition">
          Not now
        </button>
        <button
          onClick={() => {
            prompt.prompt();
            prompt.userChoice.then(() => { setVisible(false); setPrompt(null); });
          }}
          className="flex-1 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium transition">
          Install app
        </button>
      </div>
    </div>
  );
}

// ── Protected route ───────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 transition-colors">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 animate-pulse">
            <img src="./icons/icon-192.png" className="w-full h-full object-cover rounded-2xl shadow-md" alt="Logo" />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">Loading HealthMate...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// ── Routes ────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/signup"
          element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
        <Route path="/gmail-callback" element={<GmailCallback />} />
        <Route path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
      <PWAInstallBanner />
    </>
  );
}

export default function App() {
  useEffect(() => {
    initPWA();
  }, []);
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
