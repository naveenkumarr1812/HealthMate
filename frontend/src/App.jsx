import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import GmailCallback from "./pages/GmailCallback";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-teal-400 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <p className="text-sm text-gray-500">Loading MedAI...</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"          element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/signup"         element={user ? <Navigate to="/dashboard" /> : <Signup />} />
      <Route path="/gmail-callback" element={<GmailCallback />} />
      <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*"               element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
