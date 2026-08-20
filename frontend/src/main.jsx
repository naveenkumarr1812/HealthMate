import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Env var check (helps debug white screen on Netlify) ────────
const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
REQUIRED_ENV.forEach((key) => {
  if (!import.meta.env[key]) {
    console.error(`❌ Missing env var: ${key}. App may not work.`);
  }
});

// ── Error Boundary — shows visible error instead of white screen ─
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[HealthMate] App crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "system-ui, sans-serif",
          background: "#f9fafb", padding: "20px",
        }}>
          <div style={{
            background: "white", borderRadius: "16px", padding: "32px",
            maxWidth: "480px", width: "100%", textAlign: "center",
            border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ color: "#111827", marginBottom: "8px", fontSize: "18px" }}>
              HealthMate failed to load
            </h2>
            <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#1d9e75", color: "white", border: "none",
                borderRadius: "8px", padding: "10px 24px", cursor: "pointer",
                fontSize: "14px", fontWeight: "600",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[PWA] SW registered:", reg.scope);
    } catch (e) {
      console.warn("[PWA] SW registration failed:", e);
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
