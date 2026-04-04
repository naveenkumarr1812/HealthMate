import { useState, useEffect } from "react";
import { Newspaper, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { getMedicalNews, getPersonalizedNews } from "../api/medai";

function NewsCard({ item }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-200 hover:shadow-sm transition">
      <p className="text-sm font-medium text-gray-900 leading-snug mb-2">{item.title}</p>
      {item.content && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3">{item.content}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{item.source}</span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium"
          >
            Read more <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function MedicalNews({ userId }) {
  const [news, setNews] = useState([]);
  const [personalizedNews, setPersonalizedNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("general"); // "general" | "personalized"

  const fetchNews = async () => {
    setLoading(true);
    try {
      const [generalRes, personalRes] = await Promise.all([
        getMedicalNews(),
        getPersonalizedNews(userId),
      ]);
      setNews(generalRes.data.news || []);
      setPersonalizedNews(personalRes.data.news || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, [userId]);

  const displayed = tab === "general" ? news : personalizedNews;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-teal-600" />
          <h2 className="text-sm font-semibold text-gray-900">Medical News</h2>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium ml-1">
            via Tavily
          </span>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-5 flex gap-4">
        {[
          { id: "general", label: "General Medical News" },
          { id: "personalized", label: "For Your Conditions" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-3 text-xs font-medium border-b-2 transition ${
              tab === t.id
                ? "border-teal-400 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* News grid */}
      <div className="flex-1 overflow-y-auto p-5">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-4xl">
            {displayed.map((item, i) => (
              <NewsCard key={i} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
