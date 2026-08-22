import { useState, useEffect, useCallback } from "react";
import { Newspaper, RefreshCw, ExternalLink, Tag } from "lucide-react";
import axios from "axios";

const API = axios.create({ baseURL: "/api" });
API.interceptors.request.use((c) => {
  const t = localStorage.getItem("access_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

function NewsCard({ item }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-205 dark:border-slate-800/80 rounded-xl p-4 hover:border-teal-200 dark:hover:border-teal-950 hover:shadow-xs transition transition-colors">
      {item.condition && (
        <span className="inline-block text-[10px] bg-teal-55 dark:bg-teal-950/30 text-teal-705 dark:text-teal-400 border border-teal-100 dark:border-teal-900/30 px-2 py-0.5 rounded-full font-bold mb-2">
          {item.condition}
        </span>
      )}
      <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug mb-2">{item.title}</p>
      {item.content && (
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-3 mb-3 font-medium">{item.content}</p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-950/50 px-2 py-0.5 rounded-full truncate max-w-[160px] font-semibold">
          {item.source || "Medical Source"}
        </span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-bold flex-shrink-0">
            Read more <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── News Card Shimmer Skeleton Loader ──────────────────────────
function NewsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between h-40">
          <div className="space-y-3">
            <div className="h-3 bg-gray-150 dark:bg-slate-850 rounded w-1/3 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-gray-150 dark:bg-slate-850 rounded w-full animate-pulse" />
              <div className="h-3.5 bg-gray-150 dark:bg-slate-850 rounded w-5/6 animate-pulse" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="h-2.5 bg-gray-155 dark:bg-slate-850 rounded w-16 animate-pulse" />
            <div className="h-2.5 bg-gray-155 dark:bg-slate-850 rounded w-12 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MedicalNews({ userId }) {
  const [generalNews, setGeneralNews]           = useState([]);
  const [personalizedNews, setPersonalizedNews] = useState([]);
  const [conditions, setConditions]             = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [tab, setTab]                           = useState("general");

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch general news
      const genRes = await API.get("/news/medical");
      setGeneralNews(genRes.data.news || []);

      // Fetch personalized - backend reads conditions from Supabase directly
      const perRes = await API.get(`/news/personalized/${userId}`);
      setPersonalizedNews(perRes.data.news || []);
      setConditions(perRes.data.conditions || []);
    } catch (err) {
      console.error("[News] Fetch error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const displayed = tab === "general" ? generalNews : personalizedNews;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 md:px-5 py-3 md:py-4 flex items-center justify-between flex-shrink-0 transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          <Newspaper size={15} className="text-teal-600 dark:text-teal-400" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Medical News</h2>
          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 px-2 py-0.5 rounded-full font-bold">via Tavily</span>
        </div>
        <button onClick={fetchNews} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-350 transition">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline font-semibold">Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 md:px-5 flex gap-1 flex-shrink-0 transition-colors">
        <button onClick={() => setTab("general")}
          className={`py-3 text-xs font-bold border-b-2 transition mr-4 ${
            tab === "general" ? "border-teal-400 text-teal-700 dark:text-teal-300" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-750 dark:hover:text-slate-200"
          }`}>
          General Medical News
        </button>
        <button onClick={() => setTab("personalized")}
          className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            tab === "personalized" ? "border-teal-400 text-teal-700 dark:text-teal-300" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-750 dark:hover:text-slate-200"
          }`}>
          <Tag size={11} /> For Your Conditions
          {conditions.length > 0 && (
            <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {conditions.length}
            </span>
          )}
        </button>
      </div>

      {/* Condition chips */}
      {tab === "personalized" && conditions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800/80 px-4 md:px-5 py-2 flex flex-wrap gap-1.5 flex-shrink-0 transition-colors">
          <span className="text-xs text-gray-400 dark:text-slate-500 self-center">Showing news for:</span>
          {conditions.map((c) => (
            <span key={c}
              className="text-xs px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/20 text-teal-705 dark:text-teal-400 border border-teal-100 dark:border-teal-900/30 font-medium">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* No conditions warning */}
      {tab === "personalized" && conditions.length === 0 && !loading && (
        <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-955/15 border border-amber-200 dark:border-amber-900/30 rounded-xl flex-shrink-0">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">No conditions saved</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 font-semibold">
            Go to <strong>Health Profile</strong> → add your conditions → come back here for personalized news.
          </p>
        </div>
      )}

      {/* News grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <NewsSkeleton />
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400 dark:text-slate-500 font-semibold">No news available. Try refreshing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {displayed.map((item, i) => <NewsCard key={i} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
