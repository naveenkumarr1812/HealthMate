import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * GmailCallback page - handles OAuth redirect from Google.
 * Route: /gmail-callback
 *
 * Flow:
 * 1. Google redirects here with ?code=...&state=...
 * 2. We send code to our backend /auth/gmail/exchange
 * 3. Backend exchanges code for tokens, saves to Supabase
 * 4. We postMessage to opener (parent window) and close
 */
export default function GmailCallback() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handle = async () => {
      const params = new URLSearchParams(window.location.search);
      const code  = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage("Google authorization was cancelled or denied.");
        setTimeout(() => window.close(), 2500);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Invalid OAuth response.");
        setTimeout(() => window.close(), 2500);
        return;
      }

      // Verify state matches what we stored
      const savedState = sessionStorage.getItem("gmail_oauth_state");
      if (savedState && savedState !== state) {
        setStatus("error");
        setMessage("Security check failed. Please try again.");
        setTimeout(() => window.close(), 2500);
        return;
      }

      // Extract userId from state
      const userId = state.split(":")[0];

      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/auth/gmail/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code, user_id: userId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Exchange failed");

        setStatus("success");
        setMessage(`Connected: ${data.gmail_email}`);

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: "GMAIL_AUTH_SUCCESS", email: data.gmail_email }, window.location.origin);
        }

        setTimeout(() => window.close(), 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Something went wrong. Please try again.");
        setTimeout(() => window.close(), 3000);
      }
    };

    handle();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-sm">
        {status === "loading" && (
          <>
            <Loader2 size={36} className="animate-spin text-teal-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Connecting your Gmail...</p>
            <p className="text-xs text-gray-400 mt-1">Please wait</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={36} className="text-green-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Gmail connected!</p>
            <p className="text-xs text-gray-400 mt-1">{message}</p>
            <p className="text-xs text-gray-300 mt-3">This window will close automatically</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={36} className="text-red-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Connection failed</p>
            <p className="text-xs text-gray-400 mt-1">{message}</p>
            <p className="text-xs text-gray-300 mt-3">This window will close automatically</p>
          </>
        )}
      </div>
    </div>
  );
}
