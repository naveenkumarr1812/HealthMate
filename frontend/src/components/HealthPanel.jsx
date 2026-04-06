import { useState, useEffect } from "react";
import { Heart, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { getProfile, getPersonalizedNews } from "../api/HealthMate";

function TrendIcon({ trend }) {
  if (trend === "increasing") return <TrendingUp size={12} className="text-red-500" />;
  if (trend === "decreasing") return <TrendingDown size={12} className="text-teal-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function MetricRow({ label, value, trend, color = "teal" }) {
  const colors = {
    teal: "bg-teal-400",
    amber: "bg-amber-400",
    red:   "bg-red-400",
  };
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="flex items-center gap-1">
          <TrendIcon trend={trend} />
          <span className="text-xs font-medium text-gray-700">{value || "-"}</span>
        </div>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full`} style={{ width: "60%" }} />
      </div>
    </div>
  );
}

export default function HealthPanel({ userId }) {
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState([]);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId)
      .then((r) => setProfile(r.data))
      .catch(() => {});
    getPersonalizedNews(userId)
      .then((r) => setNews((r.data.news || []).slice(0, 3)))
      .catch(() => {});
  }, [userId]);

  const conditions = profile?.conditions || [];
  const allergies = profile?.allergies || [];

  return (
    <aside className="w-64 border-l border-gray-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Health Metrics */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={13} className="text-teal-600" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Health Metrics</p>
        </div>
        <MetricRow label="Sugar Trend"  value={profile?.sugar_trend || "Unknown"} trend={profile?.sugar_trend} color="amber" />
        <MetricRow label="BP Trend"     value={profile?.bp_trend || "Unknown"}    trend={profile?.bp_trend}    color="red"   />
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conditions</p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={11} className="text-red-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Allergies</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allergies.map((a) => (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent reports summary */}
      {profile?.recent_reports_summary && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Last Report</p>
          <p className="text-xs text-gray-600 leading-relaxed">{profile.recent_reports_summary}</p>
        </div>
      )}

      {/* News snippets */}
      {news.length > 0 && (
        <div className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Health News</p>
          <div className="space-y-3">
            {news.map((n, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{n.title}</p>
                {n.url && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline mt-0.5 inline-block"
                  >
                    Read →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!profile && (
        <div className="p-4 text-center">
          <Heart size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Upload a document or update your health profile to see your metrics here.</p>
        </div>
      )}
    </aside>
  );
}
