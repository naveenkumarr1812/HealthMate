import { useState, useEffect, useCallback } from "react";
import { Mail, CheckCircle, Loader2, ExternalLink, X } from "lucide-react";
import { supabase } from "../api/supabaseClient";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI     = `${window.location.origin}/gmail-callback`;
const SCOPES           = "https://www.googleapis.com/auth/gmail.send email profile";

function buildOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export default function GmailAuthButton({ userId, onStatusChange }) {
  const [status,  setStatus]  = useState("loading");
  const [email,   setEmail]   = useState("");
  const [checking, setChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!userId) return;
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from("gmail_tokens")
        .select("gmail_email, expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data?.gmail_email) {
        setStatus("disconnected");
        onStatusChange?.("disconnected", null);
        return;
      }

      // Check if token is expired
      if (data.expires_at) {
        const expires  = new Date(data.expires_at);
        const now      = new Date();
        if (expires <= now) {
          // Token expired — backend will refresh automatically on next use
          // But still show as connected since refresh_token exists
        }
      }

      setEmail(data.gmail_email);
      setStatus("connected");
      onStatusChange?.("connected", data.gmail_email);
    } catch (e) {
      console.error("[GmailAuth] Check error:", e);
      setStatus("disconnected");
    } finally {
      setChecking(false);
    }
  }, [userId, onStatusChange]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  // Listen for OAuth callback success from popup
  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GMAIL_AUTH_SUCCESS") {
        checkConnection();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkConnection]);

  const handleConnect = () => {
    if (!GOOGLE_CLIENT_ID) {
      alert("Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to frontend .env");
      return;
    }
    const state = `${userId}:${Date.now()}`;
    sessionStorage.setItem("gmail_oauth_state", state);
    const url   = buildOAuthUrl(state);
    const left  = window.screenX + (window.outerWidth  - 520) / 2;
    const top   = window.screenY + (window.outerHeight - 640) / 2;
    const popup = window.open(url, "gmail_auth",
      `width=520,height=640,scrollbars=yes,resizable=yes,left=${left},top=${top}`);
    if (!popup) {
      // Popup blocked — redirect in same window
      window.location.href = url;
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Gmail? Email reminders will stop.")) return;
    await supabase.from("gmail_tokens").delete().eq("user_id", userId);
    setStatus("disconnected");
    setEmail("");
    onStatusChange?.("disconnected", null);
  };

  if (status === "loading" || checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 size={13} className="animate-spin" />
        Checking Gmail connection...
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-green-800">Gmail connected ✅</p>
            <p className="text-xs text-green-600 truncate max-w-[160px]">{email}</p>
          </div>
        </div>
        <button onClick={handleDisconnect}
          className="text-xs text-red-400 hover:text-red-600 transition font-medium flex items-center gap-1">
          <X size={11} /> Disconnect
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleConnect}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-teal-400 hover:bg-teal-50 text-sm text-gray-600 hover:text-teal-700 transition font-medium group">
      <Mail size={15} className="group-hover:text-teal-600" />
      Connect Gmail for email reminders
      <ExternalLink size={12} className="text-gray-400 group-hover:text-teal-500" />
    </button>
  );
}
