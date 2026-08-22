import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "❌ Missing Supabase env vars!\n" +
    "  VITE_SUPABASE_URL:", SUPABASE_URL ? "✓" : "MISSING",
    "\n  VITE_SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "✓" : "MISSING"
  );
}

// Guard: createClient throws if URL/key is undefined — catch it gracefully
let _supabase;
try {
  _supabase = createClient(
    SUPABASE_URL  || "https://placeholder.supabase.co",
    SUPABASE_ANON_KEY || "placeholder-key",
    {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true,
        storageKey:         "HealthMate-auth",
        lock:               async (name, acquireTimeout, fn) => await fn(),
      },
      global: {
        headers: { "X-Client-Info": "HealthMate-web/1.0" },
      },
      db: { schema: "public" },
    }
  );
} catch (e) {
  console.error("❌ Failed to initialize Supabase client:", e.message);
  _supabase = {
    auth: {
      getSession:         () => Promise.resolve({ data: { session: null }, error: e }),
      onAuthStateChange:  () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: e }),
      signUp:             () => Promise.resolve({ data: null, error: e }),
      signOut:            () => Promise.resolve({}),
    },
  };
}

export const supabase = _supabase;

// Helper: get current session token for API calls
export const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || localStorage.getItem("access_token") || "";
};
