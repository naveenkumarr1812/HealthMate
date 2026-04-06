import { useState, useEffect, useCallback } from "react";
import { Newspaper, RefreshCw, ExternalLink, Loader2, Tag } from "lucide-react";
import { supabase } from "../api/supabaseClient";
import axios from "axios";

const API = axios.create({ baseURL: "/api" });
API.interceptors.request.use((c) => {
  const t = localStorage.getItem("access_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

function NewsCard({ item }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-200 hover:shadow-sm transition">
      {item.condition && (
        <span className="inline-block text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full font-medium mb-2">
          {item.condition}
        </span>
      )}
      <p className="text-sm font-medium text-gray-900 leading-snug mb-2">{item.title}</p>
      {item.content && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3">{item.content}</p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full truncate max-w-[160px]">
          {item.source || "Medical Source"}
        </span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium flex-shrink-0">
            Read more <ExternalLink size={10} />
          </a>
        )}
      </div>
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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-5 py-3 md:py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Newspaper size={15} className="text-teal-600" />
          <h2 className="text-sm font-semibold text-gray-900">Medical News</h2>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">via Tavily</span>
        </div>
        <button onClick={fetchNews} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-5 flex gap-1 flex-shrink-0">
        <button onClick={() => setTab("general")}
          className={`py-3 text-xs font-medium border-b-2 transition mr-4 ${
            tab === "general" ? "border-teal-400 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          General Medical News
        </button>
        <button onClick={() => setTab("personalized")}
          className={`py-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
            tab === "personalized" ? "border-teal-400 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          <Tag size={11} /> For Your Conditions
          {conditions.length > 0 && (
            <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
              {conditions.length}
            </span>
          )}
        </button>
      </div>

      {/* Condition chips */}
      {tab === "personalized" && conditions.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 md:px-5 py-2 flex flex-wrap gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-400 self-center">Showing news for:</span>
          {conditions.map((c) => (
            <span key={c}
              className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-medium">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* No conditions warning */}
      {tab === "personalized" && conditions.length === 0 && !loading && (
        <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
          <p className="text-sm font-medium text-amber-700 mb-1">No conditions saved</p>
          <p className="text-xs text-amber-600">
            Go to <strong>Health Profile</strong> → add your conditions → come back here for personalized news.
          </p>
        </div>
      )}

      {/* News grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Fetching latest news...</span>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">No news available. Try refreshing.</p>
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
