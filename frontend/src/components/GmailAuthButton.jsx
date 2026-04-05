import { useState, useEffect } from "react";
import { Mail, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "../api/supabaseClient";

// ── Google OAuth config ───────────────────────────────────────
// These are set in frontend .env
const GOOGLE_CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI      = `${window.location.origin}/gmail-callback`;
const SCOPES            = "https://www.googleapis.com/auth/gmail.send email profile";

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

/**
 * GmailAuthButton
 * Shows:
 *  - "Connect Gmail" button if not authorized
 *  - Connected email + disconnect if authorized
 *  - Used inside MedicationTracker reminder toggle
 */
export default function GmailAuthButton({ userId, onStatusChange }) {
  const [status, setStatus]   = useState("loading"); // loading | connected | disconnected
  const [email, setEmail]     = useState("");
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const { data } = await supabase
        .from("gmail_tokens")
        .select("gmail_email, expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (data?.gmail_email) {
        // Check token not expired
        const expired = data.expires_at && new Date(data.expires_at) < new Date();
        if (!expired) {
          setEmail(data.gmail_email);
          setStatus("connected");
          onStatusChange?.("connected", data.gmail_email);
          return;
        }
      }
      setStatus("disconnected");
      onStatusChange?.("disconnected", null);
    } catch {
      setStatus("disconnected");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { if (userId) checkConnection(); }, [userId]);

  // Listen for OAuth callback message from popup
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "GMAIL_AUTH_SUCCESS") {
        checkConnection();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleConnect = () => {
    const state = `${userId}:${Date.now()}`;
    sessionStorage.setItem("gmail_oauth_state", state);
    const url = buildOAuthUrl(state);
    // Open OAuth in popup — exactly like Claude connectors
    const popup = window.open(url, "gmail_auth",
      "width=500,height=620,scrollbars=yes,resizable=yes,left=" +
      (window.screenX + (window.outerWidth - 500) / 2) + ",top=" +
      (window.screenY + (window.outerHeight - 620) / 2));
    if (!popup) window.location.href = url; // fallback if popup blocked
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Gmail? Email reminders will be disabled.")) return;
    await supabase.from("gmail_tokens").delete().eq("user_id", userId);
    setStatus("disconnected");
    setEmail("");
    onStatusChange?.("disconnected", null);
  };

  if (status === "loading" || checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
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
            <p className="text-xs font-medium text-green-800">Gmail connected</p>
            <p className="text-xs text-green-600">{email}</p>
          </div>
        </div>
        <button onClick={handleDisconnect}
          className="text-xs text-red-400 hover:text-red-600 transition font-medium">
          Disconnect
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
